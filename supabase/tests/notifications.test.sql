-- pgTAP tests for notification delivery and lifecycle enqueue (migration 028).
-- Run: pnpm db:test — inside a rolled-back transaction. Uses the seeded Southern France departure.

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
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
create or replace function tests.create_user(uid uuid, email text, full_name text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', json_build_object('full_name', full_name)::jsonb, now(), now(),
          '', '', '', '');
end $$;

select tests.create_user('c0000000-0000-4000-8000-00000000000c', 'carol@example.com', 'Carol Traveler');
select tests.create_user('d0000000-0000-4000-8000-00000000000d', 'dan@example.com', 'Dan Traveler');

-- A trip on the seeded departure, seven days out, with Carol and Dan as members.
insert into public.departure_groups (id, departure_id, name, position)
values ('e0000000-0000-4000-8000-0000000000e1', '30000000-0000-4000-8000-000000000001', 'Test group', 9);
insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone)
values ('f0000000-0000-4000-8000-0000000000f1', '30000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000e1',
        '21000000-0000-4000-8000-000000000001', 'Southern France · Test', current_date + 7, current_date + 14, 'Europe/Paris');
insert into public.trip_members (trip_id, user_id) values
  ('f0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-00000000000c'),
  ('f0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000000000d');

-- ── Trip reminders ───────────────────────────────────────────────────────────
select is(public.enqueue_trip_reminders(), 2, 'T-7 reminder is enqueued once per member');
select is(public.enqueue_trip_reminders(), 0, 're-running the daily job enqueues nothing new (dedupe_key)');
select is(
  (select count(*)::int from public.notifications where type = 'trip_upcoming' and trip_id = 'f0000000-0000-4000-8000-0000000000f1'),
  2, 'exactly two trip_upcoming rows exist');

-- Status automation: a trip that started yesterday becomes active; one that ended yesterday completes.
insert into public.departure_groups (id, departure_id, name, position)
values ('e0000000-0000-4000-8000-0000000000e2', '30000000-0000-4000-8000-000000000001', 'Test group 2', 10);
insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, status)
values ('f0000000-0000-4000-8000-0000000000f2', '30000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000e2',
        '21000000-0000-4000-8000-000000000001', 'Ended trip', current_date - 8, current_date - 1, 'Europe/Paris', 'active');
insert into public.trip_members (trip_id, user_id) values ('f0000000-0000-4000-8000-0000000000f2', 'c0000000-0000-4000-8000-00000000000c');
select lives_ok($$ select public.enqueue_trip_reminders() $$, 'the daily job runs again after a trip ends');
select is((select status::text from public.trips where id = 'f0000000-0000-4000-8000-0000000000f2'), 'completed',
  'a trip whose end date passed is marked completed');
select is((select count(*)::int from public.notifications where type = 'trip_completed' and user_id = 'c0000000-0000-4000-8000-00000000000c'),
  1, 'the completed trip thanks its member once');

-- ── Support replies ──────────────────────────────────────────────────────────
insert into public.support_threads (id, customer_id, subject, trip_id)
values ('a1000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-00000000000c', 'Late train', 'f0000000-0000-4000-8000-0000000000f1');
insert into public.support_messages (thread_id, sender_id, is_from_staff, body)
values ('a1000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-00000000000c', false, 'My train is delayed, what now?');
select is((select count(*)::int from public.notifications where type = 'support_response'), 0,
  'a customer message creates no notification');
insert into public.support_messages (thread_id, sender_id, is_from_staff, is_internal_note, body)
values ('a1000000-0000-4000-8000-0000000000a1', null, true, true, 'Internal: call the hotel.');
select is((select count(*)::int from public.notifications where type = 'support_response'), 0,
  'an internal staff note creates no notification');
insert into public.support_messages (thread_id, sender_id, is_from_staff, body)
values ('a1000000-0000-4000-8000-0000000000a1', null, true, 'Take the 18:05 instead; your ticket is valid. The hotel knows.');
select is(
  (select title from public.notifications where type = 'support_response' and user_id = 'c0000000-0000-4000-8000-00000000000c'),
  'Guideless replied: Late train', 'a staff reply notifies the customer with the thread subject');

-- ── Payment reminders ────────────────────────────────────────────────────────
update public.departures set balance_due_date = current_date + 3 where id = '30000000-0000-4000-8000-000000000001';
insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status,
                             currency, subtotal_amount, total_amount, deposit_amount, amount_paid)
values ('b1000000-0000-4000-8000-0000000000b1', 'GL-TEST01', 'c0000000-0000-4000-8000-00000000000c',
        '30000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'confirmed', 'deposit_paid',
        'EUR', 100000, 100000, 30000, 30000);
select is(public.enqueue_payment_reminders(), 1, 'a confirmed booking with a balance due in 3 days gets one reminder');
select is(public.enqueue_payment_reminders(), 0, 'the same stage is never enqueued twice');
select matches(
  (select body from public.notifications where type = 'payment_reminder' and user_id = 'c0000000-0000-4000-8000-00000000000c'),
  '^€700\.00 remaining', 'the reminder states the balance in the booking currency');

-- ── Claiming for delivery ────────────────────────────────────────────────────
insert into public.push_tokens (user_id, token, platform) values
  ('c0000000-0000-4000-8000-00000000000c', 'ExponentPushToken[live]', 'ios'),
  ('c0000000-0000-4000-8000-00000000000c', 'ExponentPushToken[dead]', 'android');
update public.push_tokens set disabled_at = now() where token = 'ExponentPushToken[dead]';

select is(
  (select count(*)::int from public.claim_pending_notifications(100)
    where user_id = 'c0000000-0000-4000-8000-00000000000c' and recipient_email = 'carol@example.com'
      and push_tokens = array['ExponentPushToken[live]'] and operational_email),
  4, 'claiming returns Carol''s rows with her email, live tokens only and default preferences');
select is((select count(*)::int from public.notifications where dispatched_at is null), 0,
  'claimed rows are marked dispatched');
select is((select count(*)::int from public.claim_pending_notifications(100)), 0,
  'a second claim finds nothing');

-- ── Permissions ──────────────────────────────────────────────────────────────
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select * from public.claim_pending_notifications(1) $$,
  '42501', null, 'customers cannot execute the claim function');
select is((select count(*)::int from public.notification_deliveries), 0,
  'customers see no delivery records (RLS)');
select tests.clear_auth();

select * from finish();
rollback;
