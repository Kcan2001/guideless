-- pgTAP tests for migrations 0057 and 0058: private trip surveys, and the prompt that finds them.
--
-- The rules that matter: a traveler answers only for their own booking, the post-trip survey does
-- not open until the trip has ended, and nobody reads anybody else's answers. Surveys are blunt on
-- purpose, so they must never leak the way a review is meant to.
--
-- `open_surveys()` has one extra rule of its own: it must never offer a form the database would
-- then refuse, which is why it is tested against the same bookings as `can_survey_booking`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.clear_auth() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'postgres', true);
end $$;
create or replace function tests.create_user(uid uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
end $$;

select tests.create_user('f5000000-0000-4000-8000-0000000000a1', 'survey.traveler@example.com');
select tests.create_user('f5000000-0000-4000-8000-0000000000a2', 'survey.other@example.com');
select tests.create_user('f5000000-0000-4000-8000-0000000000a3', 'survey.staff@example.com');
insert into public.user_roles (user_id, role) values ('f5000000-0000-4000-8000-0000000000a3', 'admin');

-- A confirmed booking on a departure that has already happened, plus the trip it belongs to.
insert into public.bookings (id, confirmation_number, departure_id, tour_version_id, customer_id,
                             status, payment_status, currency, subtotal_amount, total_amount, deposit_amount)
values ('a6000000-0000-4000-8000-0000000000b1', 'GL-SURVEY1', '30000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000a1',
        'confirmed', 'paid', 'USD', 349500, 349500, 75000);

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, status)
select 'a6000000-0000-4000-8000-0000000000c1', d.id, g.id, d.tour_version_id, 'Past trip',
       current_date - 20, current_date - 10, 'Europe/Paris', 'completed'
from public.departures d
join public.departure_groups g on g.departure_id = d.id
where d.id = '30000000-0000-4000-8000-000000000001'
limit 1;

insert into public.trip_members (trip_id, user_id, booking_id)
values ('a6000000-0000-4000-8000-0000000000c1', 'f5000000-0000-4000-8000-0000000000a1',
        'a6000000-0000-4000-8000-0000000000b1');

-- A second confirmed booking whose departure has not been activated yet, so it has no trip and no
-- members. This is the ordinary state between paying and the group being formed, and it is exactly
-- when the pre-trip survey is worth asking.
insert into public.bookings (id, confirmation_number, departure_id, tour_version_id, customer_id,
                             status, payment_status, currency, subtotal_amount, total_amount, deposit_amount)
values ('a6000000-0000-4000-8000-0000000000b2', 'GL-SURVEY2', '30000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000a1',
        'confirmed', 'deposit_paid', 'USD', 349500, 349500, 75000);

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'trip_surveys', 'trip_surveys exists');
select has_view('public', 'tour_survey_stats', 'staff can read averages per tour');
select enum_has_labels('public', 'survey_kind', array['pre_trip', 'post_trip'], 'survey kinds');

-- ── Eligibility ──────────────────────────────────────────────────────────────
select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a1');
select ok(public.can_survey_booking('a6000000-0000-4000-8000-0000000000b1', 'post_trip'),
  'the traveler can answer after their trip ended');
select ok(public.can_survey_booking('a6000000-0000-4000-8000-0000000000b1', 'pre_trip') = false,
  'the pre-trip survey closes once the trip is over');

select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a2');
select ok(public.can_survey_booking('a6000000-0000-4000-8000-0000000000b1', 'post_trip') = false,
  'somebody else cannot answer for a booking that is not theirs');
select throws_ok(
  $$ select public.submit_trip_survey('a6000000-0000-4000-8000-0000000000b1', 'post_trip', 5::smallint) $$,
  '42501', null, 'and is refused if they try');

-- ── What the traveler is offered ─────────────────────────────────────────────
select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.open_surveys()), 2,
  'both bookings have a survey open: one before, one after');
select is((select kind::text from public.open_surveys() where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  'post_trip', 'the finished trip is offered the post-trip survey');
select is((select kind::text from public.open_surveys() where booking_id = 'a6000000-0000-4000-8000-0000000000b2'),
  'pre_trip', 'a booking whose departure has no trip yet is offered the pre-trip one');
select is((select end_date from public.open_surveys() where booking_id = 'a6000000-0000-4000-8000-0000000000b2'),
  (select end_date from public.departures where id = '30000000-0000-4000-8000-000000000001'),
  'and falls back to the departure dates, because there is no trip to take them from');
select is((select submitted_at from public.open_surveys() where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  null, 'nothing is marked answered before anybody answers');

select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.open_surveys()), 0,
  'a traveler with no bookings is offered nothing');

-- ── Submitting ───────────────────────────────────────────────────────────────
select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select public.submit_trip_survey('a6000000-0000-4000-8000-0000000000b1', 'post_trip',
       5::smallint, 4::smallint, 3::smallint, 5::smallint, 4::smallint, 5::smallint,
       'The morning swim', 'The train was cold', true, null, '{"heard_about":"instagram"}'::jsonb) $$,
  'the traveler answers their post-trip survey');

select is((select overall from public.trip_surveys where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  5::smallint, 'the score is stored');
select is((select answers ->> 'heard_about' from public.trip_surveys where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  'instagram', 'open-ended answers are kept alongside the scores');

-- Answering again edits rather than piling up, because people change their minds on the way home.
select lives_ok(
  $$ select public.submit_trip_survey('a6000000-0000-4000-8000-0000000000b1', 'post_trip', 4::smallint) $$,
  'answering again is allowed');
select is((select count(*)::int from public.trip_surveys where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  1, 'and updates the same row rather than adding another');

-- An answered survey stays in the list, marked, because answering again edits it. Hiding it would
-- mean a traveler who mistyped a score has no way back to it.
select isnt((select submitted_at from public.open_surveys() where booking_id = 'a6000000-0000-4000-8000-0000000000b1'),
  null, 'the answered survey is still listed, and says when it was answered');

-- ── Privacy ──────────────────────────────────────────────────────────────────
select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.trip_surveys), 0,
  'another traveler reads no surveys at all');

select tests.authenticate_as('f5000000-0000-4000-8000-0000000000a3');
select isnt((select count(*)::int from public.trip_surveys), 0, 'staff read them');

select tests.clear_auth();
select * from finish();
rollback;
