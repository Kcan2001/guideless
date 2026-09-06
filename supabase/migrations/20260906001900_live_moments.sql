-- 019_live_moments
-- Temporary, optional events during a trip ("Sunset walk at 7:45", "Meeting in the lobby in 20").
-- Phase 2 feature; schema lands now so the trip model is complete. Behind the live_moments flag.

create table public.live_moments (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  created_by     uuid not null references auth.users (id) on delete set null,
  title          text not null check (char_length(title) between 1 and 120),
  description    text check (char_length(description) <= 2000),
  start_at       timestamptz not null,
  end_at         timestamptz,
  timezone       text not null,
  location_name  text,
  address        text,
  latitude       double precision,
  longitude      double precision,
  status         public.live_moment_status not null default 'scheduled',
  visibility     public.content_visibility not null default 'trip_member',
  capacity       integer check (capacity is null or capacity >= 1),
  is_official    boolean not null default false,     -- created by staff vs a traveler
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint live_moments_times check (end_at is null or end_at > start_at)
);
create index live_moments_trip_start_idx on public.live_moments (trip_id, start_at);
create trigger live_moments_set_updated_at before update on public.live_moments
  for each row execute function public.set_updated_at();

create table public.live_moment_participants (
  moment_id   uuid not null references public.live_moments (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'joined' check (status in ('joined', 'maybe', 'left')),
  joined_at   timestamptz not null default now(),
  primary key (moment_id, user_id)
);

-- Lightweight presence pings ("3 people are grabbing coffee nearby"). Opt-in, trip-scoped, short-lived.
create table public.checkins (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  note        text check (char_length(note) <= 200),
  expires_at  timestamptz not null default now() + interval '2 hours',
  created_at  timestamptz not null default now()
);
create index checkins_trip_active_idx on public.checkins (trip_id, expires_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.live_moments enable row level security;
alter table public.live_moment_participants enable row level security;
alter table public.checkins enable row level security;

create policy "trip members read moments" on public.live_moments
  for select to authenticated
  using ((select public.is_staff())
         or (visibility <> 'staff_only' and status <> 'draft' and (select public.is_trip_member(trip_id))));
create policy "trip members create moments" on public.live_moments
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_trip_member(trip_id))
              and (not is_official or (select public.is_ops_staff())));
create policy "creators edit their moments" on public.live_moments
  for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_ops_staff()))
  with check (created_by = (select auth.uid()) or (select public.is_ops_staff()));
create policy "creators delete draft moments" on public.live_moments
  for delete to authenticated
  using ((created_by = (select auth.uid()) and status = 'draft') or (select public.is_ops_staff()));

create policy "trip members see participants" on public.live_moment_participants
  for select to authenticated
  using (exists (select 1 from public.live_moments lm where lm.id = live_moment_participants.moment_id
                 and ((select public.is_trip_member(lm.trip_id)) or (select public.is_staff()))));
create policy "users manage their participation" on public.live_moment_participants
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.live_moments lm where lm.id = live_moment_participants.moment_id
                          and (select public.is_trip_member(lm.trip_id))));

create policy "trip members see active checkins" on public.checkins
  for select to authenticated
  using (expires_at > now() and ((select public.is_trip_member(trip_id)) or (select public.is_staff())));
create policy "users manage their checkins" on public.checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_trip_member(trip_id)));
