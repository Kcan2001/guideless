-- pgTAP tests for migration 045: a chat room per paid add-on.
-- The assertion that matters most: a traveler on the same trip who did NOT buy the add-on can
-- neither list the room nor read a message in it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

-- ── Fixture: one trip, two travelers, one add-on that only Ada buys ──────────
select tests.create_user('a5000000-0000-4000-8000-00000000ada1', 'ada.boat@example.com');
select tests.create_user('a5000000-0000-4000-8000-00000000b0b2', 'bob.noboat@example.com');

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
select 'a5000000-0000-4000-8000-000000007111'::uuid, d.id,
       (select g.id from public.departure_groups g where g.departure_id = d.id limit 1),
       d.tour_version_id, 'Activity chat test trip', d.start_date, d.end_date, d.timezone, now()
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.trip_members (trip_id, user_id, member_role) values
  ('a5000000-0000-4000-8000-000000007111', 'a5000000-0000-4000-8000-00000000ada1', 'traveler'),
  ('a5000000-0000-4000-8000-000000007111', 'a5000000-0000-4000-8000-00000000b0b2', 'traveler');

-- Both hold a booking on the departure; only Ada's carries a confirmed add-on.
insert into public.bookings (id, confirmation_number, departure_id, tour_version_id, customer_id, status, currency, subtotal_amount, total_amount, deposit_amount)
select 'a5000000-0000-4000-8000-00000000bc01'::uuid, 'GL-ACHAT01', d.id, d.tour_version_id, 'a5000000-0000-4000-8000-00000000ada1'::uuid, 'confirmed'::public.booking_status, 'USD'::public.currency_code, 189000, 189000, 50000
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004'
union all
select 'a5000000-0000-4000-8000-00000000bc02'::uuid, 'GL-ACHAT02', d.id, d.tour_version_id, 'a5000000-0000-4000-8000-00000000b0b2'::uuid, 'confirmed'::public.booking_status, 'USD'::public.currency_code, 189000, 189000, 50000
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.booking_add_ons (booking_id, add_on_id, quantity, unit_amount, total_amount, currency, status, title_snapshot)
select 'a5000000-0000-4000-8000-00000000bc01'::uuid, a.id, 1, a.price_amount, a.price_amount, a.currency, 'confirmed', a.title
from public.departure_add_ons a
where a.departure_id = '30000000-0000-4000-8000-000000000004' and a.title like 'Friday coast boat%';

-- ── The room ────────────────────────────────────────────────────────────────
select tests.authenticate_as('a5000000-0000-4000-8000-00000000ada1');

select lives_ok(
  $$ select public.ensure_add_on_chat_room(
       'a5000000-0000-4000-8000-000000007111',
       (select id from public.departure_add_ons
        where departure_id = '30000000-0000-4000-8000-000000000004' and title like 'Friday coast boat%')) $$,
  'a confirmed buyer opens the activity room');

select is(
  (select count(*)::int from public.chat_rooms
   where trip_id = 'a5000000-0000-4000-8000-000000007111' and add_on_id is not null),
  1, 'exactly one activity room exists');

select is(
  (select name from public.chat_rooms
   where trip_id = 'a5000000-0000-4000-8000-000000007111' and add_on_id is not null),
  'Friday coast boat to Monaco', 'the room is named after the add-on');

select is(
  (select type::text from public.chat_rooms
   where trip_id = 'a5000000-0000-4000-8000-000000007111' and add_on_id is not null),
  'optional_activities', 'an activity room is typed optional_activities');

-- Calling again is idempotent rather than creating a second room.
select lives_ok(
  $$ select public.ensure_add_on_chat_room(
       'a5000000-0000-4000-8000-000000007111',
       (select id from public.departure_add_ons
        where departure_id = '30000000-0000-4000-8000-000000000004' and title like 'Friday coast boat%')) $$,
  'opening the room twice is idempotent');
select is(
  (select count(*)::int from public.chat_rooms
   where trip_id = 'a5000000-0000-4000-8000-000000007111' and add_on_id is not null),
  1, 'still exactly one activity room');

-- ── Membership follows the purchase ─────────────────────────────────────────
select is(
  (select count(*)::int from public.chat_members cm
   join public.chat_rooms r on r.id = cm.room_id
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null
     and cm.user_id = 'a5000000-0000-4000-8000-00000000ada1' and cm.removed_at is null),
  1, 'the buyer is a member of the activity room');

select is(
  (select count(*)::int from public.chat_members cm
   join public.chat_rooms r on r.id = cm.room_id
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null
     and cm.user_id = 'a5000000-0000-4000-8000-00000000b0b2' and cm.removed_at is null),
  0, 'a traveler who did not buy it is not a member');

-- Ada posts in the room so there is something for Bob to fail to read.
insert into public.messages (room_id, sender_id, body)
select r.id, 'a5000000-0000-4000-8000-00000000ada1'::uuid, 'Meeting at Port Lympia at 10.'
from public.chat_rooms r
where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null;

select is(
  (select count(*)::int from public.chat_rooms r
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null),
  1, 'the buyer can list the activity room');

-- ── The traveler who did not buy it ─────────────────────────────────────────
select tests.authenticate_as('a5000000-0000-4000-8000-00000000b0b2');

select is(
  (select count(*)::int from public.chat_rooms r
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null),
  0, 'a non-participant cannot list the activity room');

select is(
  (select count(*)::int from public.messages m
   join public.chat_rooms r on r.id = m.room_id
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null),
  0, 'a non-participant cannot read messages in the activity room');

select throws_ok(
  $$ select public.ensure_add_on_chat_room(
       'a5000000-0000-4000-8000-000000007111',
       (select id from public.departure_add_ons
        where departure_id = '30000000-0000-4000-8000-000000000004' and title like 'Friday coast boat%')) $$,
  '42501', null, 'a non-participant is refused when opening the room');

-- Bob is still in the whole-trip room; activity rooms do not affect it.
select is(
  (select count(*)::int from public.chat_rooms r
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.type = 'trip_group'),
  1, 'a non-participant still sees the trip group room');

-- ── Cancelling the add-on removes access ────────────────────────────────────
select tests.clear_auth();
update public.booking_add_ons set status = 'cancelled'
where booking_id = 'a5000000-0000-4000-8000-00000000bc01';

select is(
  (select count(*)::int from public.chat_members cm
   join public.chat_rooms r on r.id = cm.room_id
   where r.trip_id = 'a5000000-0000-4000-8000-000000007111' and r.add_on_id is not null
     and cm.user_id = 'a5000000-0000-4000-8000-00000000ada1' and cm.removed_at is null),
  0, 'cancelling the purchase removes the traveler from the room');

select * from finish();
rollback;
