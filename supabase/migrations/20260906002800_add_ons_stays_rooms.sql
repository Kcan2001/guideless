-- 029_add_ons_stays_rooms
-- The catalog behind "make it yours" (docs/roadmap.md §4, Milestones 9–10):
--
--   departure_stay_options   where you sleep: "Nice, 3★ by the port" vs "Monaco, 5★" — one group, tiers
--   departure_add_ons        boat trip, wine tour, race-viewing tiers, private transfer, extra night
--   booking_travelers.room_index  rooms are separate by default; two travelers may share (max 2)
--   bookings.stay_option_id  the chosen tier
--   booking_add_ons          what each booking added, with price snapshots and hold/confirm lifecycle
--
-- Pricing rule (decided 2026-09-06): departures.price_amount is per traveler in their OWN room.
-- Two travelers sharing a room each get `shared_room_discount_amount` off. Stay options add a
-- per-traveler delta. Add-ons are paid in full at booking (or any time later, even mid-trip) and
-- never count toward the deposit. All arithmetic lives in quote_booking() (migration 031).

-- ── Departure pricing knobs ──────────────────────────────────────────────────
alter table public.departures
  add column shared_room_discount_amount bigint not null default 0
    check (shared_room_discount_amount >= 0 and shared_room_discount_amount <= price_amount);

-- ── Stay options (accommodation tiers) ───────────────────────────────────────
create table public.departure_stay_options (
  id                           uuid primary key default gen_random_uuid(),
  departure_id                 uuid not null references public.departures (id) on delete cascade,
  name                         text not null check (char_length(name) between 2 and 120),
  description                  text check (char_length(description) <= 2000),
  hotel_name                   text,
  area                         text,                                   -- "Nice, old town" / "Monaco, Monte Carlo"
  star_rating                  smallint check (star_rating between 1 and 5),
  destination_id               uuid references public.destinations (id) on delete set null,
  -- Per traveler, on top of departures.price_amount. Negative allowed for a cheaper tier.
  price_delta_amount           bigint not null default 0,
  -- Overrides the departure's shared-room discount for this tier when set.
  shared_room_discount_amount  bigint check (shared_room_discount_amount >= 0),
  capacity                     integer check (capacity is null or capacity >= 0),   -- travelers
  position                     integer not null default 1,
  is_default                   boolean not null default false,
  is_active                    boolean not null default true,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);
create index departure_stay_options_departure_idx on public.departure_stay_options (departure_id, position);
create unique index departure_stay_options_one_default on public.departure_stay_options (departure_id) where is_default;
create trigger departure_stay_options_set_updated_at before update on public.departure_stay_options
  for each row execute function public.set_updated_at();

alter table public.bookings
  add column stay_option_id uuid references public.departure_stay_options (id) on delete set null;
create index bookings_stay_option_idx on public.bookings (stay_option_id);

-- ── Rooms: separate by default, share on request, two per room max ───────────
alter table public.booking_travelers
  add column room_index smallint not null default 1 check (room_index between 1 and 8);
-- Existing travelers: one room each (matches the default the customer would have had).
with numbered as (
  select booking_id, traveler_id, row_number() over (partition by booking_id order by is_lead desc, created_at) as rn
  from public.booking_travelers
)
update public.booking_travelers bt set room_index = n.rn
from numbered n where n.booking_id = bt.booking_id and n.traveler_id = bt.traveler_id;

create or replace function public.booking_rooms_max_two()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.booking_travelers
      where booking_id = new.booking_id and room_index = new.room_index) > 2 then
    raise exception 'A room holds at most two travelers' using errcode = 'check_violation', hint = 'room_capacity';
  end if;
  return new;
end;
$$;
create constraint trigger booking_travelers_room_capacity
  after insert or update of room_index on public.booking_travelers
  deferrable initially deferred
  for each row execute function public.booking_rooms_max_two();

-- ── Add-ons ──────────────────────────────────────────────────────────────────
create table public.departure_add_ons (
  id                            uuid primary key default gen_random_uuid(),
  departure_id                  uuid not null references public.departures (id) on delete cascade,
  title                         text not null check (char_length(title) between 2 and 120),
  description                   text check (char_length(description) <= 2000),
  kind                          text not null default 'activity'
    check (kind in ('activity', 'ticket', 'transfer', 'dinner', 'extra_night', 'room_upgrade', 'other')),
  price_amount                  bigint not null check (price_amount >= 0),
  currency                      public.currency_code not null,
  pricing_basis                 text not null default 'per_traveler' check (pricing_basis in ('per_traveler', 'per_booking')),
  capacity                      integer check (capacity is null or capacity >= 0),       -- units (travelers or bookings)
  -- When it happens, so it can sit on the itinerary and gate the sales window.
  day_number                    integer check (day_number is null or day_number >= 1),
  start_time                    time,
  end_time                      time,
  location_name                 text,
  address                       text,
  latitude                      double precision,
  longitude                     double precision,
  -- Sales window: bookable until N days before the add-on's date (or the trip end when undated).
  -- 0 = until the day itself, which is how mid-trip purchases work.
  bookable_until_days_before    integer not null default 1 check (bookable_until_days_before >= 0),
  cancellable_until_days_before integer not null default 7 check (cancellable_until_days_before >= 0),
  -- Mutually exclusive choices share a tier_group (race viewing: grandstand / terrace / yacht).
  tier_group                    text,
  supplier_service_id           uuid references public.supplier_services (id) on delete set null,
  tour_itinerary_item_id        uuid references public.tour_itinerary_items (id) on delete set null,
  position                      integer not null default 1,
  is_featured                   boolean not null default false,
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint departure_add_ons_times check (end_time is null or start_time is null or end_time > start_time)
);
create index departure_add_ons_departure_idx on public.departure_add_ons (departure_id, position);
create trigger departure_add_ons_set_updated_at before update on public.departure_add_ons
  for each row execute function public.set_updated_at();

-- The date an add-on happens (null when undated) and the last day it can be bought.
create or replace function public.add_on_date(p_add_on public.departure_add_ons)
returns date
language sql
stable
set search_path = ''
as $$
  select case when p_add_on.day_number is null then d.end_date else d.start_date + (p_add_on.day_number - 1) end
  from public.departures d where d.id = p_add_on.departure_id;
$$;

create or replace function public.add_on_bookable_until(p_add_on public.departure_add_ons)
returns date
language sql
stable
set search_path = ''
as $$
  select public.add_on_date(p_add_on) - p_add_on.bookable_until_days_before;
$$;

create table public.booking_add_ons (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references public.bookings (id) on delete cascade,
  add_on_id                   uuid not null references public.departure_add_ons (id) on delete restrict,
  traveler_id                 uuid references public.traveler_profiles (id) on delete cascade,   -- null for per_booking
  quantity                    integer not null default 1 check (quantity >= 1),
  unit_amount                 bigint not null check (unit_amount >= 0),
  total_amount                bigint not null check (total_amount >= 0),
  currency                    public.currency_code not null,
  status                      text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'refunded')),
  -- Set when bought after the initial booking; all rows of one purchase share it.
  purchase_id                 uuid,
  hold_expires_at             timestamptz,
  stripe_checkout_session_id  text,
  payment_id                  uuid references public.payments (id) on delete set null,
  cancelled_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint booking_add_ons_total check (total_amount = unit_amount * quantity)
);
create index booking_add_ons_booking_idx on public.booking_add_ons (booking_id);
create index booking_add_ons_add_on_idx on public.booking_add_ons (add_on_id, status);
create index booking_add_ons_purchase_idx on public.booking_add_ons (purchase_id) where purchase_id is not null;
-- One live row per traveler (or per booking) and add-on.
create unique index booking_add_ons_live_unique
  on public.booking_add_ons (booking_id, add_on_id, coalesce(traveler_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending', 'confirmed');
create trigger booking_add_ons_set_updated_at before update on public.booking_add_ons
  for each row execute function public.set_updated_at();

-- Units taken: confirmed, plus pending rows whose hold is still live.
create or replace view public.add_on_availability
with (security_invoker = false) as
select a.id as add_on_id,
       a.capacity,
       coalesce(sum(case when ba.status = 'confirmed' then ba.quantity end), 0)::integer as confirmed,
       coalesce(sum(case when ba.status = 'pending' and coalesce(ba.hold_expires_at, now() + interval '1 minute') > now() then ba.quantity end), 0)::integer as held
from public.departure_add_ons a
left join public.booking_add_ons ba on ba.add_on_id = a.id
group by a.id, a.capacity;
grant select on public.add_on_availability to anon, authenticated;

-- Aggregate social signal only: "6 people are on the boat". Who they are is trip-member-only
-- (trip_add_on_participants in migration 031).
create or replace view public.add_on_headcounts
with (security_invoker = false) as
select add_on_id, coalesce(sum(quantity), 0)::integer as going
from public.booking_add_ons
where status = 'confirmed'
group by add_on_id;
grant select on public.add_on_headcounts to anon, authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.departure_stay_options enable row level security;
alter table public.departure_add_ons enable row level security;
alter table public.booking_add_ons enable row level security;

create policy "anyone reads active stay options" on public.departure_stay_options
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "ops staff manage stay options" on public.departure_stay_options
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "anyone reads active add-ons" on public.departure_add_ons
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "ops staff manage add-ons" on public.departure_add_ons
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Customers read their own; writes go through the booking functions (security definer).
create policy "customers read their booking add-ons" on public.booking_add_ons
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()))
         or (select public.is_staff()));
create policy "ops staff manage booking add-ons" on public.booking_add_ons
  for update to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Customers may also read the room layout of their own booking (already covered by booking_travelers policies).
