-- pgTAP tests for the permission model and core database invariants.
-- Run: pnpm db:test   (supabase test db — resets nothing; runs inside a rolled-back transaction)
-- Relies on seed data: destinations, Southern France v1, three open departures.

begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
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

-- Alice and Bob are customers; Stella is trip staff.
select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.com', 'Alice Traveler');
select tests.create_user('b0000000-0000-4000-8000-00000000000b', 'bob@example.com', 'Bob Traveler');
select tests.create_user('c0000000-0000-4000-8000-00000000000c', 'stella@guideless.test', 'Stella Staff');
insert into public.user_roles (user_id, role) values ('c0000000-0000-4000-8000-00000000000c', 'trip_staff');

-- A staff-only supplier record on departure 1.
insert into public.suppliers (id, name, kind) values ('50000000-0000-4000-8000-000000000001', 'Hôtel Test', 'hotel');
insert into public.supplier_services (supplier_id, departure_id, title, cost_amount, cost_currency, confirmation_number)
values ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Nice hotel block', 120000, 'EUR', 'CONF-123');

-- ── 1. Profiles are created automatically ────────────────────────────────────
select is((select count(*)::int from public.profiles where id in
  ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b')), 2,
  'handle_new_user creates a profile per auth user');
select is((select display_name from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  'Alice Traveler', 'profile display_name comes from user metadata');

-- ── 2. Public catalogue ──────────────────────────────────────────────────────
select tests.authenticate_anon();
select is((select count(*)::int from public.tours), 2, 'anon can read the published tours (Southern France, Monaco GP)');
select is((select count(*)::int from public.departures where status = 'open'), 4, 'anon can read open departures');
select is((select count(*)::int from public.tour_itinerary_items where visibility <> 'public_preview'), 0,
  'anon cannot see non-preview itinerary items');
select ok((select count(*) from public.tour_itinerary_items where visibility = 'public_preview') > 20,
  'anon sees preview itinerary items');
select is((select count(*)::int from public.supplier_services), 0, 'anon cannot read supplier services');
select tests.clear_auth();

select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is((select count(*)::int from public.supplier_services), 1, 'trip staff can read supplier services');
select tests.clear_auth();

-- ── 3. Bookings are private to their customer ────────────────────────────────
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
insert into public.traveler_profiles (id, owner_user_id, user_id, first_name, last_name, date_of_birth, nationality)
values ('60000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a',
        'Alice', 'Traveler', '1990-01-01', 'US');
insert into public.bookings (id, customer_id, departure_id, tour_version_id, currency, subtotal_amount, total_amount, deposit_amount)
values ('70000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a',
        '30000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'USD', 349500, 349500, 75000);
insert into public.booking_travelers (booking_id, traveler_id, is_lead)
values ('70000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', true);

select is((select count(*)::int from public.bookings), 1, 'Alice sees her own booking');
select alike((select confirmation_number from public.bookings where id = '70000000-0000-4000-8000-00000000000a'),
  'GL-________', 'confirmation number is generated');
select is((select count(*)::int from public.supplier_services), 0, 'customers cannot read supplier services or costs');
select is((select count(*)::int from public.bookings_public), 1, 'bookings_public view is readable by the customer');

select throws_ok(
  $$ update public.bookings set status = 'confirmed' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'a customer cannot confirm their own booking (only drafts are editable, only by staff/service)');

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.bookings), 0, 'Bob cannot see Alice''s booking');
select is((select count(*)::int from public.traveler_profiles), 0, 'Bob cannot see Alice''s traveler PII');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'), 0,
  'Bob cannot see Alice''s profile before they share a trip');
select tests.clear_auth();

-- ── 4. Inventory ─────────────────────────────────────────────────────────────
update public.bookings set status = 'confirmed', payment_status = 'deposit_paid', amount_paid = 75000
where id = '70000000-0000-4000-8000-00000000000a';

select results_eq(
  $$ select confirmed, held, available from public.get_departure_availability('30000000-0000-4000-8000-000000000001') $$,
  $$ values (1, 0, 13) $$,
  'availability counts confirmed seats');

-- Tiny departure to test the guard: capacity 1.
insert into public.departures (id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity,
                               price_amount, deposit_amount, currency)
values ('30000000-0000-4000-8000-0000000000ff', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        'open', '2027-10-01', '2027-10-09', 'Europe/Paris', 1, 100000, 0, 'USD');
insert into public.traveler_profiles (id, owner_user_id, first_name, last_name)
values ('60000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'Bob', 'Traveler'),
       ('60000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-00000000000b', 'Bobs', 'Friend');
insert into public.bookings (id, customer_id, departure_id, tour_version_id, status, hold_expires_at, currency, subtotal_amount, total_amount)
values ('70000000-0000-4000-8000-0000000000ff', 'b0000000-0000-4000-8000-00000000000b',
        '30000000-0000-4000-8000-0000000000ff', '21000000-0000-4000-8000-000000000001', 'pending_payment', now() + interval '30 minutes', 'USD', 200000, 200000);
insert into public.booking_travelers (booking_id, traveler_id) values ('70000000-0000-4000-8000-0000000000ff', '60000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ insert into public.booking_travelers (booking_id, traveler_id) values ('70000000-0000-4000-8000-0000000000ff', '60000000-0000-4000-8000-00000000000c') $$,
  '23514', null, 'adding a traveler beyond capacity is refused');
select results_eq(
  $$ select confirmed, held, available from public.get_departure_availability('30000000-0000-4000-8000-0000000000ff') $$,
  $$ values (0, 1, 0) $$,
  'held seats count against availability');

-- Expired holds are released.
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = '70000000-0000-4000-8000-0000000000ff';
select is(public.release_expired_holds(), 1, 'release_expired_holds returns the number released');
select is((select status::text from public.bookings where id = '70000000-0000-4000-8000-0000000000ff'), 'draft', 'expired hold returns to draft');

-- ── 5. Cancellation tiers ────────────────────────────────────────────────────
select is(public.refund_percentage_for((select cancellation_policy from public.departures where id = '30000000-0000-4000-8000-000000000001'), 90), 100, '90 days out → 100%');
select is(public.refund_percentage_for((select cancellation_policy from public.departures where id = '30000000-0000-4000-8000-000000000001'), 45), 75, '45 days out → 75%');
select is(public.refund_percentage_for((select cancellation_policy from public.departures where id = '30000000-0000-4000-8000-000000000001'), 7), 0, '7 days out → 0%');

-- ── 6. Trip snapshot and trip-scoped access ───────────────────────────────────
select lives_ok(
  $$ select public.create_trip_for_group((select id from public.departure_groups where departure_id = '30000000-0000-4000-8000-000000000001' limit 1)) $$,
  'create_trip_for_group runs');
select is((select count(*)::int from public.trip_days td join public.trips t on t.id = td.trip_id
           where t.departure_id = '30000000-0000-4000-8000-000000000001'), 9, 'snapshot copies 9 days');
select is((select count(*)::int from public.chat_rooms r join public.trips t on t.id = r.trip_id
           where t.departure_id = '30000000-0000-4000-8000-000000000001'), 3, 'three chat rooms per trip');
select is((select count(*)::int from public.trip_members m join public.trips t on t.id = m.trip_id
           where t.departure_id = '30000000-0000-4000-8000-000000000001' and m.user_id = 'a0000000-0000-4000-8000-00000000000a'), 1,
  'confirmed traveler becomes a trip member');

select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.trips), 1, 'Alice sees her trip');
select is((select count(*)::int from public.trip_notes), 0, 'Alice cannot see staff notes');
select lives_ok(
  $$ insert into public.messages (room_id, sender_id, body)
     values ((select r.id from public.chat_rooms r join public.trips t on t.id = r.trip_id where r.type = 'trip_group' limit 1),
             'a0000000-0000-4000-8000-00000000000a', 'Bonjour!') $$,
  'a member can post in the trip group');
select throws_ok(
  $$ insert into public.messages (room_id, sender_id, body)
     values ((select r.id from public.chat_rooms r join public.trips t on t.id = r.trip_id where r.type = 'announcements' limit 1),
             'a0000000-0000-4000-8000-00000000000a', 'I am not staff') $$,
  '42501', null, 'members cannot post announcements');

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.trips), 0, 'Bob (not a member) cannot see the trip');
select is((select count(*)::int from public.messages), 0, 'Bob cannot read the group chat');
select tests.clear_auth();

-- Removing a member revokes access immediately.
update public.trip_members set removed_at = now() where user_id = 'a0000000-0000-4000-8000-00000000000a';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.messages), 0, 'removed member can no longer read messages');
select tests.clear_auth();

-- ── 7. Audit ─────────────────────────────────────────────────────────────────
select ok((select count(*) from public.audit_logs where action = 'booking_created' and entity_id = '70000000-0000-4000-8000-00000000000a') >= 1,
  'booking creation is audited');

select * from finish();
rollback;
