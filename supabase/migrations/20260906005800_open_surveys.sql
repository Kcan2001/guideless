-- Which survey, if any, is open for a traveler right now.
--
-- Migration 0057 shipped the table, the eligibility test and the submit function, but eligibility
-- was only answerable one booking at a time. Nothing could ask "is there anything to answer?"
-- without walking every booking and calling `can_survey_booking` per row, which is the kind of
-- thing a page does once and then does forever.
--
-- The two kinds are mutually exclusive in time: pre-trip closes on the day the trip ends and
-- post-trip opens the day after, so a booking has at most one open survey at any moment. That is
-- what lets this return one row per booking with the kind that is open, rather than a row per kind.
--
-- Eligibility is not re-implemented here. The where clause calls `can_survey_booking`, so the list
-- and the submit can never disagree about who may answer what — a drifting copy of that rule would
-- show somebody a form that the database then refuses.
create or replace function public.open_surveys()
returns table (
  booking_id   uuid,
  trip_id      uuid,
  tour_id      uuid,
  tour_name    text,
  trip_name    text,
  start_date   date,
  end_date     date,
  kind         public.survey_kind,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    -- A booking has one trip at most, but two travelers on it means two trip_members rows, so
    -- narrow to this traveler's membership and take one row per booking regardless.
    select distinct on (b.id)
      b.id                                    as booking_id,
      t.id                                    as trip_id,
      tv.tour_id                              as tour_id,
      tr.name                                 as tour_name,
      coalesce(t.name, tr.name)               as trip_name,
      -- Before a departure is activated there is no trip yet, so the dates come from the
      -- departure the booking was made against.
      coalesce(t.start_date, d.start_date)    as start_date,
      coalesce(t.end_date, d.end_date)        as end_date,
      case
        when t.end_date is not null and t.end_date < current_date then 'post_trip'
        else 'pre_trip'
      end::public.survey_kind                 as kind
    from public.bookings b
    join public.tour_versions tv on tv.id = b.tour_version_id
    join public.tours tr on tr.id = tv.tour_id
    join public.departures d on d.id = b.departure_id
    left join public.trip_members tm
      on tm.booking_id = b.id and tm.user_id = (select auth.uid()) and tm.removed_at is null
    left join public.trips t on t.id = tm.trip_id
    where b.customer_id = (select auth.uid())
      and b.status in ('confirmed', 'completed')
    order by b.id, t.end_date nulls last
  )
  select m.booking_id, m.trip_id, m.tour_id, m.tour_name, m.trip_name, m.start_date, m.end_date,
         m.kind, s.submitted_at
  from mine m
  left join public.trip_surveys s on s.booking_id = m.booking_id and s.kind = m.kind
  where public.can_survey_booking(m.booking_id, m.kind)
  order by m.start_date desc;
$$;

revoke execute on function public.open_surveys() from public;
grant execute on function public.open_surveys() to authenticated, service_role;

comment on function public.open_surveys() is
  'Surveys the signed-in traveler may answer right now, one row per booking, with submitted_at set when they already have. Answering again edits, so an answered survey stays in the list rather than vanishing.';
