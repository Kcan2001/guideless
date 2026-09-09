-- What a traveler likes: asked first, then adjusted by what they actually open.
--
-- The decision (docs/product-brief-2026-09-09.md) was explicit seed plus behavioural refinement.
-- Asking alone is dull and static; behaviour alone cold-starts badly, and day one of a first trip
-- is exactly when a suggestion has to be good. So both, in that order.
--
-- Why this is a table and not a PostHog query: PostHog is analytics, and analytics is not a system
-- of record. A product decision — which three places to suggest to somebody standing in Nice at
-- 19:00 — cannot depend on a sink we do not own, cannot join to, and cannot promise is complete.
--
-- Chat messages are not read for this, by decision. The only inputs are what a traveler told us
-- and what they opened.

create table public.traveler_signals (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- What they did. Opening a recommendation is a weaker signal than turning up to something.
  kind        text not null check (kind in (
    'recommendation_opened', 'add_on_viewed', 'add_on_bought', 'moment_joined', 'plan_added'
  )),
  -- The vocabulary is the same enum the curated recommendations use, so a signal and a place can
  -- actually be compared. A signal with no categories is still worth recording as activity.
  categories  public.recommendation_category[] not null default '{}',
  ref_id      uuid,
  created_at  timestamptz not null default now()
);

create index traveler_signals_user_idx on public.traveler_signals (user_id, created_at desc);

comment on table public.traveler_signals is
  'First-party behavioural signals used to refine suggestions. Private to the traveler; never read by staff and never joined to a person on an admin screen.';

alter table public.traveler_signals enable row level security;

create policy "own signals" on public.traveler_signals
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "record own signals" on public.traveler_signals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ── Taste ────────────────────────────────────────────────────────────────────
-- One weighted view of a traveler, from the three places we know anything.
--
-- Weights are deliberately crude and deliberately visible. A stated interest outranks a tap,
-- because somebody who wrote "food" meant it and somebody who opened a bar listing may have been
-- killing time. Buying something outranks both, because money is the least ambiguous signal there
-- is. Nothing here is machine-learned; when it is wrong, a person can read this function and see
-- why.
create or replace function public.traveler_taste(p_user_id uuid default null)
returns table (category public.recommendation_category, weight numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select coalesce(p_user_id, (select auth.uid())) as uid
  ),
  -- Only ever yourself, unless you are staff. Passing somebody else's id gets you nothing.
  allowed as (
    select uid from target
    where uid = (select auth.uid()) or (select public.is_staff())
  ),
  stated as (
    -- profiles.interests is free text chosen from a fixed list in onboarding; only the values that
    -- match the recommendation vocabulary can be compared with anything, so the rest are dropped.
    select i::public.recommendation_category as category, 3.0 as weight
    from public.profiles p
    join allowed a on a.uid = p.id
    cross join unnest(p.interests) as i
    where i = any (enum_range(null::public.recommendation_category)::text[])
  ),
  behaved as (
    select c as category,
           case s.kind
             when 'add_on_bought' then 4.0
             when 'moment_joined' then 2.0
             when 'plan_added' then 2.0
             else 1.0
           end as weight
    from public.traveler_signals s
    join allowed a on a.uid = s.user_id
    cross join unnest(s.categories) as c
    -- A year-old tap says nothing about this trip.
    where s.created_at > now() - interval '365 days'
  )
  select category, round(sum(weight)::numeric, 2) as weight
  from (select * from stated union all select * from behaved) signals
  group by category
  order by weight desc, category;
$$;

revoke execute on function public.traveler_taste(uuid) from public;
grant execute on function public.traveler_taste(uuid) to authenticated, service_role;

comment on function public.traveler_taste(uuid) is
  'Weighted categories for a traveler: stated interests outrank taps, buying outranks both. Yourself only unless staff. Crude on purpose — when a suggestion is wrong, this function explains why.';

-- ── Pace ─────────────────────────────────────────────────────────────────────
-- The pre-trip survey asks what kind of week somebody thinks they booked. It is the one piece of
-- taste that changes how much to suggest rather than what to suggest, so it is read separately.
create or replace function public.traveler_pace(p_booking_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.answers ->> 'pace'
  from public.trip_surveys s
  where s.booking_id = p_booking_id
    and s.kind = 'pre_trip'
    and (s.user_id = (select auth.uid()) or (select public.is_staff()))
  limit 1;
$$;

revoke execute on function public.traveler_pace(uuid) from public;
grant execute on function public.traveler_pace(uuid) to authenticated, service_role;

comment on function public.traveler_pace(uuid) is
  'relaxed | balanced | full from the pre-trip survey, or null if they did not answer. Changes how much the assistant suggests, not what.';
