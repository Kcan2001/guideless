-- A traveler's own plans, alongside the trip's itinerary but never inside it.
--
-- `trip_itinerary_items` is the shared, staff-authored day that every member of a trip sees, and
-- it is a snapshot: editing a tour must not change a booked trip, and one traveler deciding to
-- have dinner somewhere must not change anybody else's evening. So a personal plan cannot live in
-- that table. An `owner_user_id` column on it would be one forgotten filter away from putting a
-- private dinner reservation on the whole group's schedule, or into an admin itinerary editor.
--
-- These rows are merged in at read time — the app's Today screen and the calendar feed show both
-- and label which is which. Nothing else joins them, and no staff screen reads them at all: what a
-- traveler chooses to do with their free evening is not operational data.
--
-- `free_time` is a first-class item type in the shared itinerary precisely so a traveler can fill
-- it. This is the table they fill it with.

create table public.traveler_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- A plan belongs to a trip when there is one, and to a booking before the departure is
  -- activated, so something saved the week before booking still has a home.
  trip_id        uuid references public.trips (id) on delete cascade,
  booking_id     uuid references public.bookings (id) on delete cascade,

  title          text not null check (char_length(btrim(title)) between 1 and 200),
  notes          text check (notes is null or char_length(notes) <= 2000),
  -- The day it belongs to, in the trip's own calendar. Nullable: "sometime this trip" is a real
  -- and common state, and refusing to store it would mean losing the idea.
  plan_date      date,
  start_time     time,
  end_time       time,
  -- Always the zone of the place, never the traveler's phone. A plan at 20:00 in Nice is at 20:00
  -- in Nice whatever time it is at home.
  timezone       text not null,

  location_name  text check (location_name is null or char_length(location_name) <= 200),
  address        text check (address is null or char_length(address) <= 400),
  latitude       double precision check (latitude is null or latitude between -90 and 90),
  longitude      double precision check (longitude is null or longitude between -180 and 180),
  maps_url       text,

  -- Where the idea came from. 'assistant' is not decoration: a traveler must be able to see which
  -- of their plans a machine put there, and we must be able to measure whether those are any good.
  source         text not null default 'traveler' check (source in ('traveler', 'assistant')),
  -- The curated row or supplier place this came from, when it came from one.
  recommendation_id uuid references public.recommendations (id) on delete set null,
  place_ref      text check (place_ref is null or char_length(place_ref) <= 200),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint traveler_plans_belongs_somewhere check (trip_id is not null or booking_id is not null),
  constraint traveler_plans_times check (end_time is null or start_time is null or end_time >= start_time)
);

create index traveler_plans_user_date_idx on public.traveler_plans (user_id, plan_date);
create index traveler_plans_trip_idx on public.traveler_plans (trip_id) where trip_id is not null;

create trigger traveler_plans_set_updated_at before update on public.traveler_plans
  for each row execute function public.set_updated_at();

comment on table public.traveler_plans is
  'One traveler''s own plans for their trip. Private to them — not staff-readable, and never merged into the shared trip itinerary. Read alongside trip_itinerary_items by the app and the calendar feed.';

alter table public.traveler_plans enable row level security;

-- Theirs, entirely. There is deliberately no staff policy: an operations screen has no business
-- knowing where a traveler decided to have dinner, and the absence of the policy is what enforces
-- that rather than everybody remembering not to look.
create policy "own plans" on public.traveler_plans
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "add own plans" on public.traveler_plans
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (trip_id is null or (select public.is_trip_member(trip_id)))
    and (booking_id is null or exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    ))
  );

create policy "change own plans" on public.traveler_plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own plans" on public.traveler_plans
  for delete to authenticated
  using (user_id = (select auth.uid()));
