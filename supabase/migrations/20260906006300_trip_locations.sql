-- Where people are, while they choose to say so.
--
-- This is the first feature in the product that puts one traveler's physical position in front of
-- another, so the shape of the table is mostly a set of promises:
--
--   Opt-in.        A row exists only because somebody turned sharing on. There is no default, no
--                  backfill, and no way to be sharing without having asked to.
--   Going dark is  Stopping deletes the row. Not a flag, not a soft delete — the position is gone.
--   deletion.      "I turned it off" and "you cannot see where I was" are the same statement.
--   It lapses.     `sharing_until` is required. Sharing that runs until somebody remembers to stop
--                  is sharing that never stops, so it ends on its own and has to be renewed.
--   It goes stale. A position from three hours ago rendered as a live dot is worse than no dot. RLS
--                  hides anything older than the freshness window; a purge removes it.
--   Blocking wins. If either person has blocked the other, neither sees the other's position. The
--                  chat block already means "I do not want this person near me"; it would be absurd
--                  for it not to cover this.
--   Staff cannot   There is no staff policy. An operations screen showing where every traveler is
--   see it.        standing is a surveillance product, and we are not building one. If duty of care
--                  ever needs an exception it should be a deliberate, logged, narrow one — not a
--                  policy somebody added quietly because it was convenient.

create table public.trip_locations (
  trip_id         uuid not null references public.trips (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  -- What the device claimed. A 2 km accuracy circle drawn as a precise pin is a lie about a person.
  accuracy_meters real check (accuracy_meters is null or accuracy_meters >= 0),
  -- When this opt-in runs out. Required, and capped by the trigger below.
  sharing_until   timestamptz not null,
  updated_at      timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_locations_trip_idx on public.trip_locations (trip_id, updated_at desc);

comment on table public.trip_locations is
  'Live positions of trip members who have opted in, for that trip''s map. A row means sharing is on right now; deleting it is how you go dark, and the position goes with it. Never staff-readable.';
comment on column public.trip_locations.sharing_until is
  'Sharing lapses here without being renewed. Sharing that runs until somebody remembers to stop is sharing that never stops.';

-- ── How long is "now" ────────────────────────────────────────────────────────
-- A position older than this is not shown to anyone. Fifteen minutes is long enough to survive a
-- tunnel and short enough that a dot on the map means something.
create or replace function public.location_freshness()
returns interval language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;

-- The longest a single opt-in can run before it has to be renewed deliberately.
create or replace function public.location_sharing_max()
returns interval language sql immutable set search_path = '' as $$ select interval '12 hours' $$;

comment on function public.location_sharing_max is
  'Ceiling on one opt-in. A traveler who forgets to turn sharing off stops sharing anyway, the same day.';

create or replace function public.clamp_location_sharing()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- A client asking to share for a year is not honoured; it is quietly reduced to the ceiling. The
  -- rule belongs here rather than in an app, because there are two apps and one database.
  if new.sharing_until > now() + public.location_sharing_max() then
    new.sharing_until := now() + public.location_sharing_max();
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trip_locations_clamp before insert or update on public.trip_locations
  for each row execute function public.clamp_location_sharing();

-- ── Blocking, in both directions ─────────────────────────────────────────────
-- This has to be `security definer`, and the reason is worth writing down because it is a trap.
--
-- `user_blocks` has its own row-level security: you can only read the blocks *you* created. A
-- policy that inlines `select ... from user_blocks` therefore only ever sees half the picture — I
-- can hide the people I blocked, but somebody who blocked *me* would still be able to watch my
-- position, because their block row is invisible to my query. For chat that asymmetry is the
-- normal meaning of a block. For a map showing where a person physically is, it is the whole
-- safety property inverted, and a pgTAP test caught exactly that.
--
-- It takes two ids rather than reading auth.uid() so it can be reasoned about and tested directly.
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = p_a and ub.blocked_id = p_b)
       or (ub.blocker_id = p_b and ub.blocked_id = p_a)
  );
$$;

revoke execute on function public.blocked_between(uuid, uuid) from public;
grant execute on function public.blocked_between(uuid, uuid) to authenticated, service_role;

comment on function public.blocked_between(uuid, uuid) is
  'Whether either of two people has blocked the other. security definer because user_blocks is itself RLS-protected and a caller can only see the blocks they created — inlining that query would let somebody who blocked you still see you.';

alter table public.trip_locations enable row level security;

-- Read: your own always; other members only while their opt-in is live, their position is fresh,
-- and neither of you has blocked the other.
create policy "see sharing trip members" on public.trip_locations
  for select to authenticated
  using (
    (select public.is_trip_member(trip_id))
    and (
      user_id = (select auth.uid())
      or (
        sharing_until > now()
        and updated_at > now() - public.location_freshness()
        and not public.blocked_between((select auth.uid()), trip_locations.user_id)
      )
    )
  );

-- Write: only your own, only on a trip you are on.
create policy "share own location" on public.trip_locations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_trip_member(trip_id)));

create policy "update own location" on public.trip_locations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Going dark. The only delete anybody needs, and it must never be blocked by anything.
create policy "stop sharing own location" on public.trip_locations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── Housekeeping ─────────────────────────────────────────────────────────────
-- RLS already hides a stale or lapsed row, so this is not a security control — it is the promise
-- that we are not quietly keeping a position we told somebody we had stopped using.
create or replace function public.purge_stale_trip_locations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.trip_locations
    where sharing_until <= now()
       or updated_at <= now() - public.location_freshness()
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.purge_stale_trip_locations() from public;
grant execute on function public.purge_stale_trip_locations() to service_role;

comment on function public.purge_stale_trip_locations is
  'Deletes lapsed and stale positions. Row-level security already hides them; this is us not keeping what we said we would stop keeping. Called hourly.';
