-- pgTAP tests for migration 049. The honesty rule is the feature, so these prove the negatives
-- as hard as the positives: a stranger cannot write a review, a traveler whose trip is still in
-- the future cannot, a second review for the same booking is refused, anon sees only published
-- rows, and the aggregate never counts anything unpublished.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.create_user(uid uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
end $$;
create or replace function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

-- ── Shape ────────────────────────────────────────────────────────────────────
select has_table('public', 'reviews', 'reviews exists');
select has_table('public', 'trip_photos', 'trip_photos exists');
select has_view('public', 'tour_review_stats', 'tour_review_stats exists');
select has_enum('public', 'review_status', 'review_status enum exists');
select col_is_unique('public', 'reviews', array['booking_id'], 'one review per booking');

-- ── Fixture: two travelers, one trip that has ended, one still to come ──────
select tests.create_user('b1000000-0000-4000-8000-0000000000a1', 'been.there@example.com');
select tests.create_user('b1000000-0000-4000-8000-0000000000a2', 'not.yet@example.com');
select tests.create_user('b1000000-0000-4000-8000-0000000000a3', 'stranger@example.com');
select tests.create_user('b1000000-0000-4000-8000-0000000000a9', 'moderator@example.com');
insert into public.user_roles (user_id, role) values ('b1000000-0000-4000-8000-0000000000a9', 'admin');

-- A past trip on the Monaco departure, and a future one.
insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
select 'b1000000-0000-4000-8000-000000009001'::uuid, d.id,
       (select g.id from public.departure_groups g where g.departure_id = d.id limit 1),
       d.tour_version_id, 'Past trip', current_date - 20, current_date - 12, d.timezone, now()
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.departure_groups (id, departure_id, name, position)
values ('b1000000-0000-4000-8000-00000000cc02', '30000000-0000-4000-8000-000000000004', 'Review test group B', 90);

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
select 'b1000000-0000-4000-8000-000000009002'::uuid, d.id, 'b1000000-0000-4000-8000-00000000cc02'::uuid,
       d.tour_version_id, 'Future trip', current_date + 30, current_date + 38, d.timezone, now()
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status, currency, subtotal_amount, discount_amount, total_amount)
select 'b1000000-0000-4000-8000-00000000b001'::uuid, 'GL-RVW00001', 'b1000000-0000-4000-8000-0000000000a1',
       d.id, d.tour_version_id, 'confirmed', 'paid', d.currency, 189000, 0, 189000
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status, currency, subtotal_amount, discount_amount, total_amount)
select 'b1000000-0000-4000-8000-00000000b002'::uuid, 'GL-RVW00002', 'b1000000-0000-4000-8000-0000000000a2',
       d.id, d.tour_version_id, 'confirmed', 'paid', d.currency, 189000, 0, 189000
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.trip_members (trip_id, user_id, booking_id, member_role) values
  ('b1000000-0000-4000-8000-000000009001', 'b1000000-0000-4000-8000-0000000000a1', 'b1000000-0000-4000-8000-00000000b001', 'traveler'),
  ('b1000000-0000-4000-8000-000000009002', 'b1000000-0000-4000-8000-0000000000a2', 'b1000000-0000-4000-8000-00000000b002', 'traveler');

-- ── Eligibility ──────────────────────────────────────────────────────────────
select tests.act_as('b1000000-0000-4000-8000-0000000000a1');
select ok(public.can_review_booking('b1000000-0000-4000-8000-00000000b001'),
  'a traveler whose trip has ended may review it');
select is((select count(*)::int from public.reviewable_bookings()), 1,
  'reviewable_bookings lists exactly the finished trip');

select tests.act_as('b1000000-0000-4000-8000-0000000000a2');
select ok(not public.can_review_booking('b1000000-0000-4000-8000-00000000b002'),
  'a traveler whose trip has not happened yet may not review it');
select throws_ok(
  $$ select public.submit_review('b1000000-0000-4000-8000-00000000b002'::uuid, 5::smallint, 'Cannot wait!') $$,
  '42501', null, 'submitting before the trip ends is refused');

select tests.act_as('b1000000-0000-4000-8000-0000000000a3');
select ok(not public.can_review_booking('b1000000-0000-4000-8000-00000000b001'),
  'a stranger may not review someone else''s booking');
select throws_ok(
  $$ select public.submit_review('b1000000-0000-4000-8000-00000000b001'::uuid, 5::smallint, 'Never went.') $$,
  '42501', null, 'a stranger cannot review a trip they did not take');

-- ── Writing, once ────────────────────────────────────────────────────────────
select tests.act_as('b1000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select public.submit_review('b1000000-0000-4000-8000-00000000b001'::uuid, 5::smallint,
       'The trains were booked, the welcome drinks were real, and nobody herded us anywhere.',
       'Exactly what it says on the tin', true) $$,
  'an eligible traveler can submit a review');

select is((select status::text from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
  'pending', 'a new review starts pending, never published');
-- The byline is frozen on the row: anon cannot read `profiles`, and a published review should
-- not change its name because the author renamed themselves later.
select isnt((select author_name from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
  '', 'the author name is stored on the review');
select is((select published_at from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
  null, 'nothing is published until a human publishes it');

select throws_ok(
  $$ select public.submit_review('b1000000-0000-4000-8000-00000000b001'::uuid, 4::smallint, 'Second thoughts.') $$,
  '23505', null, 'a second review for the same booking is refused');

select is((select count(*)::int from public.reviewable_bookings()), 0,
  'a reviewed booking no longer appears as reviewable');

-- ── Visibility while pending ─────────────────────────────────────────────────
select tests.act_as_anon();
select is((select count(*)::int from public.reviews), 0, 'anon sees no pending review');
select is((select count(*)::int from public.tour_review_stats), 0,
  'the aggregate has no row while nothing is published');

select tests.act_as('b1000000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.reviews), 0, 'another traveler sees no pending review');

select tests.act_as('b1000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.reviews), 1, 'the author sees their own pending review');

-- ── Moderation ───────────────────────────────────────────────────────────────
select tests.act_as('b1000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ select public.set_review_status(
       (select id from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
       'published'::public.review_status) $$,
  '42501', null, 'a traveler cannot publish their own review');

select tests.act_as('b1000000-0000-4000-8000-0000000000a9');
select lives_ok(
  $$ select public.set_review_status(
       (select id from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
       'published'::public.review_status, 'Reads like a person wrote it.') $$,
  'a moderator can publish');

select tests.act_as_anon();
select is((select count(*)::int from public.reviews), 1, 'anon now sees the published review');
select is((select review_count from public.tour_review_stats limit 1), 1,
  'the aggregate counts the published review');
select is((select average_rating from public.tour_review_stats limit 1), 5.00::numeric,
  'the average reflects the published rating');

-- Rejecting takes it back out of public view and clears the publish stamp.
select tests.act_as('b1000000-0000-4000-8000-0000000000a9');
select lives_ok(
  $$ select public.set_review_status(
       (select id from public.reviews where booking_id = 'b1000000-0000-4000-8000-00000000b001'),
       'rejected'::public.review_status, 'Duplicate of another entry.') $$,
  'a moderator can reject');
select tests.act_as_anon();
select is((select count(*)::int from public.tour_review_stats), 0,
  'a rejected review leaves the aggregate empty again');

-- ── Photos follow the same rules ─────────────────────────────────────────────
select tests.act_as('b1000000-0000-4000-8000-0000000000a3');
select throws_ok(
  $$ select public.submit_trip_photo('b1000000-0000-4000-8000-00000000b001'::uuid,
       'b1000000-0000-4000-8000-000000009001/b1000000-0000-4000-8000-0000000000a3/harbour.jpg') $$,
  '42501', null, 'a stranger cannot add a photo to a trip they did not take');

select tests.act_as('b1000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ select public.submit_trip_photo('b1000000-0000-4000-8000-00000000b001'::uuid,
       'b1000000-0000-4000-8000-000000009001/b1000000-0000-4000-8000-0000000000a3/not-mine.jpg') $$,
  '42501', null, 'a path in someone else''s folder is refused');

select lives_ok(
  $$ select public.submit_trip_photo('b1000000-0000-4000-8000-00000000b001'::uuid,
       'b1000000-0000-4000-8000-000000009001/b1000000-0000-4000-8000-0000000000a1/harbour.jpg',
       'Sunday night at the harbour.') $$,
  'a traveler can add a photo from a trip that has ended');

select is((select status::text from public.trip_photos limit 1), 'pending',
  'a new photo starts pending');

select is((select author_name from public.trip_photos limit 1),
  (select author_name from public.reviews limit 1), 'a photo carries the same frozen byline');

select tests.act_as_anon();
select is((select count(*)::int from public.trip_photos), 0, 'anon sees no pending photo');

select * from finish();
rollback;
