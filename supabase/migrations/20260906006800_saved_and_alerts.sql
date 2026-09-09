-- A reason to come back when you are not planning a trip.
--
-- Brief item 8. The framing was Airbnb: people browse houses they will never book, and we have
-- nothing for somebody between trips. The brief listed four options — a wishlist, a feed of
-- departures opening, destination alerts, meetups made more prominent — but they are not really
-- four features. A saved list nothing ever alerts you about is a dead list, and an alert with
-- nothing saved has nothing to fire on. They only work as one thing.
--
-- Two deliberate asymmetries:
--
--   Saving needs an account, because there is nothing else to key it to and the list is only
--   useful if it follows you. Alerting does not — it takes an email, exactly like the departure
--   waitlist already does, because the person most worth reaching is the one who has not signed
--   up yet.
--
--   An alert can name a destination we sell **or a place we do not**. The second is the more
--   valuable column in this migration: a company with two products deciding where to run the third
--   should be reading what people asked for rather than guessing.

-- ── The wishlist ─────────────────────────────────────────────────────────────
create table public.saved_tours (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tour_id    uuid not null references public.tours (id) on delete cascade,
  -- Why they saved it. Usually empty; occasionally "for Mum's 60th", which is worth knowing.
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);

create index saved_tours_tour_idx on public.saved_tours (tour_id);

comment on table public.saved_tours is
  'Tours somebody kept for later. Private to them; staff see counts, never who saved what.';

alter table public.saved_tours enable row level security;

create policy "own saved tours" on public.saved_tours
  for select to authenticated using (user_id = (select auth.uid()));
create policy "save own tours" on public.saved_tours
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unsave own tours" on public.saved_tours
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "annotate own saved tours" on public.saved_tours
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- How many people are holding a tour. A count, never a list of names — the same rule the roster
-- stats follow, and the reason a traveler can save something without it being a public act.
create or replace view public.tour_save_counts
with (security_invoker = false) as
select tour_id, count(*)::int as saves
from public.saved_tours
group by tour_id;

alter view public.tour_save_counts owner to postgres;
grant select on public.tour_save_counts to authenticated, anon;

comment on view public.tour_save_counts is
  'How many people saved each tour. Deliberately security_definer: the count is public, the names are nobody''s business.';

-- ── Tell me when ─────────────────────────────────────────────────────────────
create table public.destination_alerts (
  id             uuid primary key default gen_random_uuid(),
  -- Null for somebody who has not signed up. That person is the point of the feature.
  user_id        uuid references auth.users (id) on delete set null,
  email          extensions.citext not null,
  name           text check (name is null or char_length(name) between 1 and 120),
  -- One of these two. A destination we already sell, or a place we do not yet.
  destination_id uuid references public.destinations (id) on delete cascade,
  wanted_place   text check (wanted_place is null or char_length(wanted_place) between 2 and 120),
  note           text check (note is null or char_length(note) <= 500),
  source         text not null default 'site' check (source ~ '^[a-z0-9_-]{1,40}$'),
  created_at     timestamptz not null default now(),
  notified_at    timestamptz,
  -- Unsubscribing keeps the row: the demand signal is still true even once somebody stops wanting
  -- the email, and deleting it would quietly erase the evidence that they ever asked.
  unsubscribed_at timestamptz,
  constraint destination_alerts_one_or_other
    check (num_nonnulls(destination_id, wanted_place) = 1)
);

-- Postgres treats nulls as distinct, so each shape needs its own partial unique index — the same
-- lesson the waitlist table already learned.
create unique index destination_alerts_destination_email_idx
  on public.destination_alerts (destination_id, email) where destination_id is not null;
create unique index destination_alerts_wanted_email_idx
  on public.destination_alerts (lower(wanted_place), email) where wanted_place is not null;
create index destination_alerts_open_idx
  on public.destination_alerts (destination_id) where unsubscribed_at is null;

comment on table public.destination_alerts is
  'People who want to hear when we run something somewhere. Email-only is allowed on purpose — the person worth reaching has usually not signed up yet.';
comment on column public.destination_alerts.wanted_place is
  'Somewhere we do not sell yet, in their words. The most commercially useful column here: it is a list of where to go next, written by the people who would come.';

alter table public.destination_alerts enable row level security;

-- Anyone may ask to be told, signed in or not. Same posture as the waitlist and the newsletter.
create policy "anyone can ask to be told" on public.destination_alerts
  for insert to anon, authenticated with check (true);
create policy "see your own alerts" on public.destination_alerts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "stop your own alerts" on public.destination_alerts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "staff manage alerts" on public.destination_alerts
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- What people are asking for that we do not sell. The whole reason `wanted_place` exists.
create or replace view public.wanted_places
with (security_invoker = true) as
select
  lower(btrim(wanted_place)) as place,
  count(*)::int              as requests,
  count(*) filter (where user_id is not null)::int as from_travelers,
  min(created_at)            as first_asked,
  max(created_at)            as last_asked
from public.destination_alerts
where wanted_place is not null and unsubscribed_at is null
group by lower(btrim(wanted_place))
order by count(*) desc, max(created_at) desc;

comment on view public.wanted_places is
  'Where people asked us to go, most-asked first. security_invoker, so only staff see it — a would-be traveler has no business reading everybody else''s requests.';

-- ── What is coming ───────────────────────────────────────────────────────────
-- One feed answering "is anything happening?", which is the actual question somebody has when they
-- are not planning a trip. Public, because it is a reason to visit rather than a reason to sign in.
create or replace view public.whats_coming
with (security_invoker = false) as
select
  'departure'::text                    as kind,
  d.id                                 as id,
  t.name                               as title,
  t.slug                               as slug,
  coalesce(d.opens_at, d.start_date::timestamptz) as happens_at,
  d.start_date                         as start_date,
  d.end_date                           as end_date,
  d.opens_at                           as opens_at,
  null::text                           as city
from public.departures d
join public.tours t on t.id = d.tour_id
where t.is_published
  and d.status in ('open', 'guaranteed', 'full')
  and d.start_date >= current_date
  -- A drop that has not opened yet is the most interesting row in this feed.
  and (d.opens_at is null or d.opens_at > now() - interval '30 days')

union all

select
  'meetup'::text,
  m.id,
  m.title,
  null,
  m.starts_at,
  m.starts_at::date,
  coalesce(m.ends_at, m.starts_at)::date,
  null::timestamptz,
  m.city
from public.meetups m
where m.is_published and m.starts_at >= now();

alter view public.whats_coming owner to postgres;
grant select on public.whats_coming to authenticated, anon;

comment on view public.whats_coming is
  'Departures opening, trips still to run, and city evenings — one answer to "is anything happening?". Public and security_definer: it exposes only what is already published.';
