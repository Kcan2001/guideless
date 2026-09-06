-- 014_trips
-- A trip is the operational instance of one departure group. trip_members is the RLS pivot for
-- everything a traveler sees after booking: itinerary, chat, documents, live moments.

create table public.trips (
  id                  uuid primary key default gen_random_uuid(),
  departure_id        uuid not null references public.departures (id) on delete restrict,
  departure_group_id  uuid not null unique references public.departure_groups (id) on delete restrict,
  tour_version_id     uuid not null references public.tour_versions (id) on delete restrict,
  status              public.trip_status not null default 'upcoming',
  name                text not null,
  start_date          date not null,
  end_date            date not null,
  timezone            text not null,
  snapshot_taken_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trips_dates check (end_date >= start_date)
);
create index trips_departure_idx on public.trips (departure_id);
create index trips_status_start_idx on public.trips (status, start_date);
create trigger trips_set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create table public.trip_members (
  trip_id      uuid not null references public.trips (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  traveler_id  uuid references public.traveler_profiles (id) on delete set null,
  booking_id   uuid references public.bookings (id) on delete set null,
  member_role  text not null default 'traveler' check (member_role in ('traveler', 'staff')),
  joined_at    timestamptz not null default now(),
  removed_at   timestamptz,
  primary key (trip_id, user_id)
);
create unique index trip_members_traveler_unique on public.trip_members (trip_id, traveler_id)
  where traveler_id is not null;
create index trip_members_user_idx on public.trip_members (user_id) where removed_at is null;

-- ── Helpers used by every trip-scoped policy ─────────────────────────────────
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.removed_at is null
  );
$$;
revoke execute on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated, service_role;

create or replace function public.is_departure_member(p_departure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    join public.trips t on t.id = m.trip_id
    where t.departure_id = p_departure_id and m.user_id = auth.uid() and m.removed_at is null
  );
$$;
revoke execute on function public.is_departure_member(uuid) from public;
grant execute on function public.is_departure_member(uuid) to authenticated, service_role;

create or replace function public.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members me
    join public.trip_members them on them.trip_id = me.trip_id
    where me.user_id = auth.uid() and me.removed_at is null
      and them.user_id = p_user_id and them.removed_at is null
  );
$$;
revoke execute on function public.shares_trip_with(uuid) from public;
grant execute on function public.shares_trip_with(uuid) to authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

create policy "members read their trips" on public.trips
  for select to authenticated
  using ((select public.is_trip_member(id)) or (select public.is_staff()));
create policy "ops staff manage trips" on public.trips
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "members see their group roster" on public.trip_members
  for select to authenticated
  using (removed_at is null and (select public.is_trip_member(trip_id)) or (select public.is_staff()));
create policy "ops staff manage membership" on public.trip_members
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Deferred from 003: travelers on the same trip see each other's (public) profile.
create policy "trip co-members read profiles" on public.profiles
  for select to authenticated
  using ((select public.shares_trip_with(id)));
