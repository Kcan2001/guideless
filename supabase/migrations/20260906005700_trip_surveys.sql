-- Surveys, before and after a trip.
--
-- Two different jobs that share a table.
--
-- **Before** tells us what somebody is expecting, which is the only way to find out that a traveler
-- booked a "relaxed" week thinking it meant a spa and not a wine cellar. It is answerable from the
-- moment a booking is confirmed.
--
-- **After** is how we learn anything at all. The reviews table is deliberately empty until real
-- travelers write, and nothing currently asks them to. A survey is what prompts a review, and it
-- also collects the parts nobody would publish: which hotel was actually worth the tier, whether
-- the free morning swim was the best thing or an empty beach, whether the price felt fair.
--
-- A survey is not a review. Reviews are public, moderated and marketing. Surveys are private,
-- unmoderated and operational. Keeping them apart means we can ask a blunt question without
-- worrying about how the answer reads on a tour page.

create type public.survey_kind as enum ('pre_trip', 'post_trip');

comment on type public.survey_kind is 'Mirror of SURVEY_KINDS in @guideless/types.';

create table public.trip_surveys (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  trip_id        uuid references public.trips (id) on delete set null,
  tour_id        uuid references public.tours (id) on delete set null,
  kind           public.survey_kind not null,

  -- Scores are 1 to 5 and every one of them is optional, because a survey that refuses to submit
  -- until it is complete is a survey people abandon.
  overall        smallint check (overall is null or overall between 1 and 5),
  accommodation  smallint check (accommodation is null or accommodation between 1 and 5),
  value_for_money smallint check (value_for_money is null or value_for_money between 1 and 5),
  group_feeling  smallint check (group_feeling is null or group_feeling between 1 and 5),
  organisation   smallint check (organisation is null or organisation between 1 and 5),
  freedom        smallint check (freedom is null or freedom between 1 and 5),

  -- The answers that actually change the product.
  best_bit       text check (best_bit is null or char_length(best_bit) <= 2000),
  worst_bit      text check (worst_bit is null or char_length(worst_bit) <= 2000),
  would_repeat   boolean,
  -- Pre-trip: what they are hoping for. Post-trip: anything the scores did not capture.
  expectations   text check (expectations is null or char_length(expectations) <= 2000),
  -- Free-form answers to questions we have not thought of yet, keyed by question id.
  answers        jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),

  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One of each kind per booking. Re-answering updates rather than piling up.
create unique index trip_surveys_booking_kind_idx on public.trip_surveys (booking_id, kind);
create index trip_surveys_tour_idx on public.trip_surveys (tour_id, kind);
create index trip_surveys_user_idx on public.trip_surveys (user_id);

create trigger trip_surveys_set_updated_at before update on public.trip_surveys
  for each row execute function public.set_updated_at();

comment on table public.trip_surveys is
  'Private feedback, before and after a trip. Never public: reviews are the public surface and live in their own table. Staff read these to change the product.';

alter table public.trip_surveys enable row level security;

-- A traveler sees and writes only their own; staff read everything and write nothing.
create policy "own surveys" on public.trip_surveys
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy "staff manage surveys" on public.trip_surveys
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ── Eligibility ──────────────────────────────────────────────────────────────
create or replace function public.can_survey_booking(p_booking_id uuid, p_kind public.survey_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    left join public.trip_members tm on tm.booking_id = b.id
    left join public.trips t on t.id = tm.trip_id
    where b.id = p_booking_id
      and b.customer_id = (select auth.uid())
      and b.status in ('confirmed', 'completed')
      and case
            -- Before: any time between paying and coming home.
            when p_kind = 'pre_trip' then coalesce(t.end_date, b.created_at::date + 3650) >= current_date
            -- After: only once the trip has actually ended, and not for a cancelled one.
            else t.end_date is not null and t.end_date < current_date and t.status <> 'cancelled'
          end
  );
$$;

revoke execute on function public.can_survey_booking(uuid, public.survey_kind) from public;
grant execute on function public.can_survey_booking(uuid, public.survey_kind) to authenticated, service_role;

comment on function public.can_survey_booking(uuid, public.survey_kind) is
  'Whether the signed-in traveler may answer this survey: their own confirmed booking, before the trip ends for pre_trip, after it ends for post_trip.';

-- ── Submission ───────────────────────────────────────────────────────────────
-- One entry point, so a traveler cannot write a survey for a trip they did not take, and cannot
-- set trip_id or tour_id themselves.
create or replace function public.submit_trip_survey(
  p_booking_id      uuid,
  p_kind            public.survey_kind,
  p_overall         smallint default null,
  p_accommodation   smallint default null,
  p_value_for_money smallint default null,
  p_group_feeling   smallint default null,
  p_organisation    smallint default null,
  p_freedom         smallint default null,
  p_best_bit        text default null,
  p_worst_bit       text default null,
  p_would_repeat    boolean default null,
  p_expectations    text default null,
  p_answers         jsonb default '{}'::jsonb
)
returns public.trip_surveys
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_trip uuid;
  v_tour uuid;
  v_row  public.trip_surveys;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if not public.can_survey_booking(p_booking_id, p_kind) then
    raise exception 'That survey is not open for this booking'
      using errcode = 'insufficient_privilege', hint = 'not_eligible';
  end if;

  select tm.trip_id, tv.tour_id
  into v_trip, v_tour
  from public.bookings b
  left join public.trip_members tm on tm.booking_id = b.id
  left join public.tour_versions tv on tv.id = b.tour_version_id
  where b.id = p_booking_id
  limit 1;

  insert into public.trip_surveys as s
    (booking_id, user_id, trip_id, tour_id, kind, overall, accommodation, value_for_money,
     group_feeling, organisation, freedom, best_bit, worst_bit, would_repeat, expectations, answers)
  values
    (p_booking_id, v_uid, v_trip, v_tour, p_kind, p_overall, p_accommodation, p_value_for_money,
     p_group_feeling, p_organisation, p_freedom, nullif(btrim(p_best_bit), ''),
     nullif(btrim(p_worst_bit), ''), p_would_repeat, nullif(btrim(p_expectations), ''),
     coalesce(p_answers, '{}'::jsonb))
  on conflict (booking_id, kind) do update set
    overall = excluded.overall,
    accommodation = excluded.accommodation,
    value_for_money = excluded.value_for_money,
    group_feeling = excluded.group_feeling,
    organisation = excluded.organisation,
    freedom = excluded.freedom,
    best_bit = excluded.best_bit,
    worst_bit = excluded.worst_bit,
    would_repeat = excluded.would_repeat,
    expectations = excluded.expectations,
    answers = excluded.answers,
    submitted_at = now()
  returning s.* into v_row;

  return v_row;
end;
$$;

revoke execute on function public.submit_trip_survey(uuid, public.survey_kind, smallint, smallint, smallint, smallint, smallint, smallint, text, text, boolean, text, jsonb) from public;
grant execute on function public.submit_trip_survey(uuid, public.survey_kind, smallint, smallint, smallint, smallint, smallint, smallint, text, text, boolean, text, jsonb) to authenticated, service_role;

-- ── What staff actually look at ──────────────────────────────────────────────
-- Averages per tour, and the count behind them, so nobody reads a 5.0 from one answer as a signal.
create or replace view public.tour_survey_stats
with (security_invoker = true) as
select
  s.tour_id,
  s.kind,
  count(*)::int                                as responses,
  round(avg(s.overall)::numeric, 2)            as overall,
  round(avg(s.accommodation)::numeric, 2)      as accommodation,
  round(avg(s.value_for_money)::numeric, 2)    as value_for_money,
  round(avg(s.group_feeling)::numeric, 2)      as group_feeling,
  round(avg(s.organisation)::numeric, 2)       as organisation,
  round(avg(s.freedom)::numeric, 2)            as freedom,
  count(*) filter (where s.would_repeat)::int  as would_repeat
from public.trip_surveys s
where s.tour_id is not null
group by s.tour_id, s.kind;

comment on view public.tour_survey_stats is
  'Staff-only averages per tour and survey kind. security_invoker, so the reader''s own row-level security applies and a traveler sees only their own answers.';
