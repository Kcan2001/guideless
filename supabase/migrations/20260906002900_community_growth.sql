-- 030_community_growth
-- The group before the trip, and the levers that sell it (docs/roadmap.md §4, Milestones 11 & 13):
--
--   departures.group_opens_days_before  the group (chat, roster) opens a set time before departure
--   open_due_groups()                   daily: activates trips whose group-open date has arrived
--   departure_roster_stats()            anonymized "11 booked · 5 solo · 4 countries" for the departure page
--   tours.kind = 'event'                event-anchored departures (Monaco Grand Prix) with event fields
--   *_itinerary_items.is_anchor         the welcome event, rendered as the trip's anchor everywhere
--   item_rsvps                          "I'll be there" on anchors and optional items
--   profiles: interests, travel_style, languages  opt-in, shown to the group only
--   referral_codes / referrals / account_credits  give a friend a discount, earn credit for your next trip
--   host_applications                   "bring 8, travel free" program intake
--   meetups / meetup_rsvps              monthly city evenings as a funnel

-- ── Group opening ────────────────────────────────────────────────────────────
alter table public.departures
  add column group_opens_days_before integer not null default 30 check (group_opens_days_before between 0 and 365);

-- ── Event-anchored tours ─────────────────────────────────────────────────────
alter table public.tours
  add column kind             text not null default 'route' check (kind in ('route', 'event')),
  add column event_name       text,
  add column event_starts_on  date,
  add column event_ends_on    date,
  add column event_location   text,
  add constraint tours_event_fields check (kind = 'route' or (event_name is not null and event_starts_on is not null));

-- ── Anchors and RSVPs ────────────────────────────────────────────────────────
alter table public.tour_itinerary_items add column is_anchor boolean not null default false;
alter table public.trip_itinerary_items add column is_anchor boolean not null default false;

create table public.item_rsvps (
  item_id     uuid not null references public.trip_itinerary_items (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);
create trigger item_rsvps_set_updated_at before update on public.item_rsvps
  for each row execute function public.set_updated_at();

create or replace view public.item_rsvp_counts
with (security_invoker = false) as
select item_id, count(*) filter (where status = 'going')::integer as going,
       count(*) filter (where status = 'maybe')::integer as maybe
from public.item_rsvps group by item_id;
grant select on public.item_rsvp_counts to authenticated;

-- Snapshot copies the anchor flag (same body as migration 015 plus is_anchor).
create or replace function public.create_trip_for_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_departure public.departures%rowtype;
  v_group     public.departure_groups%rowtype;
  v_tour_name text;
  v_trip_id   uuid;
begin
  select * into v_group from public.departure_groups where id = p_group_id;
  if not found then raise exception 'Departure group % not found', p_group_id; end if;
  select * into v_departure from public.departures where id = v_group.departure_id;
  select name into v_tour_name from public.tours where id = v_departure.tour_id;

  insert into public.trips (departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
  values (v_departure.id, v_group.id, v_departure.tour_version_id, v_tour_name,
          v_departure.start_date, v_departure.end_date, v_departure.timezone, now())
  returning id into v_trip_id;

  insert into public.trip_days (trip_id, day_number, date, destination_id, timezone, title, summary)
  select v_trip_id, d.day_number, v_departure.start_date + (d.day_number - 1),
         d.destination_id, coalesce(dest.timezone, v_departure.timezone), d.title, d.summary
  from public.tour_days d
  left join public.destinations dest on dest.id = d.destination_id
  where d.tour_version_id = v_departure.tour_version_id;

  insert into public.trip_itinerary_items (
    trip_id, trip_day_id, source_item_id, position, type, title, description, start_time, end_time,
    timezone, location_name, address, latitude, longitude, instructions, responsibility, is_optional, visibility, is_anchor)
  select v_trip_id, td.id, i.id, i.position, i.type, i.title, i.description, i.start_time, i.end_time,
         i.timezone, i.location_name, i.address, i.latitude, i.longitude, i.instructions, i.responsibility,
         i.is_optional,
         case when i.visibility = 'public_preview' then 'trip_member'::public.content_visibility else i.visibility end,
         i.is_anchor
  from public.tour_itinerary_items i
  join public.tour_days d on d.id = i.tour_day_id
  join public.trip_days td on td.trip_id = v_trip_id and td.day_number = d.day_number
  where d.tour_version_id = v_departure.tour_version_id;

  insert into public.trip_members (trip_id, user_id, traveler_id, booking_id)
  select v_trip_id, coalesce(tp.user_id, b.customer_id), tp.id, b.id
  from public.booking_travelers bt
  join public.bookings b on b.id = bt.booking_id
  join public.traveler_profiles tp on tp.id = bt.traveler_id
  where b.departure_id = v_departure.id and b.status = 'confirmed'
    and (bt.departure_group_id = v_group.id
         or (bt.departure_group_id is null
             and (select count(*) from public.departure_groups g where g.departure_id = v_departure.id) = 1))
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

-- Daily: open groups whose date has come (departure viable), then tell the members.
create or replace function public.open_due_groups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  v_trip   uuid;
  v_count  integer := 0;
begin
  for r in
    select g.id as group_id, d.id as departure_id, t.name as tour_name
    from public.departure_groups g
    join public.departures d on d.id = g.departure_id
    join public.tours t on t.id = d.tour_id
    where d.status in ('open', 'guaranteed', 'full', 'closed')
      and d.start_date >= current_date
      and d.start_date - d.group_opens_days_before <= current_date
      and not exists (select 1 from public.trips tr where tr.departure_group_id = g.id)
      and (select count(*) from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
           where b.departure_id = d.id and b.status = 'confirmed') >= d.minimum_travelers
  loop
    v_trip := public.create_trip_for_group(r.group_id);
    perform public.notify_trip_members(
      v_trip, 'social', 'group_opened',
      'Your group is open: ' || r.tour_name,
      'Say hello, see who else is going and what they''ve added on. Nothing is mandatory.',
      jsonb_build_object('kind', 'trip', 'tripId', v_trip), null, 'group_opened:' || v_trip);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.open_due_groups() from public, anon, authenticated;

create or replace function public.run_lifecycle_notifications()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.open_due_groups();
  select public.enqueue_payment_reminders();
  select public.enqueue_trip_reminders();
$$;

-- ── Roster stats (anonymized, public) ────────────────────────────────────────
create or replace function public.departure_roster_stats(p_departure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dep      public.departures%rowtype;
  v_booked   integer;
  v_solo     integer;
  v_pairs    integer;
  v_groups   integer;
  v_nations  integer;
  v_age_min  integer;
  v_age_max  integer;
  v_open     boolean;
begin
  select * into v_dep from public.departures where id = p_departure_id;
  if not found then return null; end if;

  select count(*) into v_booked
  from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
  where b.departure_id = p_departure_id and b.status = 'confirmed';

  select count(*) filter (where n = 1), count(*) filter (where n = 2), count(*) filter (where n >= 3)
  into v_solo, v_pairs, v_groups
  from (select count(*) as n from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
        where b.departure_id = p_departure_id and b.status = 'confirmed' group by b.id) s;

  select count(distinct tp.nationality) into v_nations
  from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
  join public.traveler_profiles tp on tp.id = bt.traveler_id
  where b.departure_id = p_departure_id and b.status = 'confirmed' and tp.nationality is not null;

  -- Age range only once four or more people are booked, rounded to 5, never individual ages.
  if v_booked >= 4 then
    select (floor(min(a) / 5) * 5)::int, (ceil(max(a) / 5) * 5)::int into v_age_min, v_age_max
    from (select extract(year from age(tp.date_of_birth))::numeric as a
          from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
          join public.traveler_profiles tp on tp.id = bt.traveler_id
          where b.departure_id = p_departure_id and b.status = 'confirmed' and tp.date_of_birth is not null) x;
  end if;

  v_open := exists (select 1 from public.trips t where t.departure_id = p_departure_id);

  return jsonb_build_object(
    'booked', v_booked,
    'solo', v_solo,
    'pairs', v_pairs,
    'groups', v_groups,
    'countries', v_nations,
    'ageMin', v_age_min,
    'ageMax', v_age_max,
    'capacity', v_dep.capacity,
    'spotsLeft', greatest(v_dep.capacity - v_booked, 0),
    'groupOpensOn', v_dep.start_date - v_dep.group_opens_days_before,
    'groupOpen', v_open
  );
end;
$$;
grant execute on function public.departure_roster_stats(uuid) to anon, authenticated, service_role;

-- ── Profiles: what you choose to show the group ──────────────────────────────
alter table public.profiles
  add column interests      text[] not null default '{}' check (cardinality(interests) <= 12),
  add column travel_style   text check (travel_style in ('relaxed', 'balanced', 'active')),
  add column languages      text[] not null default '{}' check (cardinality(languages) <= 8),
  add column show_interests boolean not null default true;

-- ── Referrals ────────────────────────────────────────────────────────────────
create table public.referral_codes (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  code        text not null unique check (code ~ '^GL-[A-Z0-9]{6}$'),
  created_at  timestamptz not null default now()
);

create or replace function public.generate_referral_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
begin
  loop
    v_code := 'GL-' || (select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.referral_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.profiles_create_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.referral_codes (user_id, code) values (new.id, public.generate_referral_code())
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger profiles_create_referral_code after insert on public.profiles
  for each row execute function public.profiles_create_referral_code();
insert into public.referral_codes (user_id, code)
select p.id, public.generate_referral_code() from public.profiles p
on conflict (user_id) do nothing;

create table public.referrals (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  referred_user_id  uuid not null references auth.users (id) on delete cascade,
  booking_id        uuid not null unique references public.bookings (id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'earned', 'void')),
  reward_amount     bigint not null check (reward_amount >= 0),
  currency          public.currency_code not null,
  created_at        timestamptz not null default now(),
  earned_at         timestamptz,
  constraint referrals_not_self check (referrer_id <> referred_user_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

-- Positive rows are earned credit, negative rows are redemptions. Balance = sum per currency.
create table public.account_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      bigint not null check (amount <> 0),
  currency    public.currency_code not null,
  source      text not null check (source in ('referral_reward', 'redemption', 'manual', 'host_reward')),
  booking_id  uuid references public.bookings (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index account_credits_user_idx on public.account_credits (user_id, currency);

create or replace function public.account_credit_balance(p_user_id uuid, p_currency text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.account_credits
  where user_id = p_user_id and currency = upper(p_currency)::public.currency_code;
$$;
grant execute on function public.account_credit_balance(uuid, text) to authenticated, service_role;

insert into public.system_settings (key, value, description) values
  ('referral_discount_percent', '5', 'Percent off the base trip for a customer booking with a friend''s referral code'),
  ('referral_reward_amount', '7500', 'Credit (minor units, in the booking currency) the referrer earns when the referred booking is confirmed'),
  ('host_free_spot_threshold', '8', 'Confirmed travelers a host must bring to travel free')
on conflict (key) do nothing;

-- ── Host program intake ──────────────────────────────────────────────────────
create table public.host_applications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users (id) on delete set null,
  name                  text not null check (char_length(name) between 2 and 120),
  email                 extensions.citext not null,
  community_description text not null check (char_length(community_description) between 10 and 2000),
  community_size        integer check (community_size is null or community_size >= 0),
  links                 text check (char_length(links) <= 500),
  city                  text,
  preferred_tour_id     uuid references public.tours (id) on delete set null,
  preferred_month       text check (preferred_month is null or preferred_month ~ '^\d{4}-\d{2}$'),
  status                text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  staff_notes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index host_applications_status_idx on public.host_applications (status, created_at desc);
create trigger host_applications_set_updated_at before update on public.host_applications
  for each row execute function public.set_updated_at();

-- ── City meetups ─────────────────────────────────────────────────────────────
create table public.meetups (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 2 and 120),
  description   text check (char_length(description) <= 2000),
  city          text not null,
  country_code  char(2),
  venue_name    text,
  address       text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  timezone      text not null,
  capacity      integer check (capacity is null or capacity >= 0),
  is_published  boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint meetups_times check (ends_at is null or ends_at > starts_at)
);
create index meetups_upcoming_idx on public.meetups (starts_at) where is_published;
create trigger meetups_set_updated_at before update on public.meetups
  for each row execute function public.set_updated_at();

create table public.meetup_rsvps (
  meetup_id   uuid not null references public.meetups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'going' check (status in ('going', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create trigger meetup_rsvps_set_updated_at before update on public.meetup_rsvps
  for each row execute function public.set_updated_at();

create or replace view public.meetup_rsvp_counts
with (security_invoker = false) as
select meetup_id, count(*) filter (where status = 'going')::integer as going
from public.meetup_rsvps group by meetup_id;
grant select on public.meetup_rsvp_counts to anon, authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.item_rsvps enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.account_credits enable row level security;
alter table public.host_applications enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_rsvps enable row level security;

create policy "trip members see rsvps on their trip" on public.item_rsvps
  for select to authenticated
  using (exists (select 1 from public.trip_itinerary_items i where i.id = item_id and (select public.is_trip_member(i.trip_id)))
         or (select public.is_staff()));
create policy "trip members rsvp for themselves" on public.item_rsvps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trip_itinerary_items i where i.id = item_id and (select public.is_trip_member(i.trip_id))));

create policy "users read their referral code" on public.referral_codes
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy "users read referrals they made or received" on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_user_id = (select auth.uid()) or (select public.is_staff()));

create policy "users read their credits" on public.account_credits
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "admins grant manual credit" on public.account_credits
  for insert to authenticated with check ((select public.is_admin()) and source = 'manual');

create policy "anyone applies to host" on public.host_applications
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy "applicants read their application" on public.host_applications
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "staff manage host applications" on public.host_applications
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "anyone reads published meetups" on public.meetups
  for select to anon, authenticated using (is_published or (select public.is_staff()));
create policy "content and ops staff manage meetups" on public.meetups
  for all to authenticated
  using ((select public.is_content_staff()) or (select public.is_ops_staff()))
  with check ((select public.is_content_staff()) or (select public.is_ops_staff()));

create policy "users manage their meetup rsvp" on public.meetup_rsvps
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "staff read meetup rsvps" on public.meetup_rsvps
  for select to authenticated using ((select public.is_staff()));
