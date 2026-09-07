-- pgTAP tests for migrations 029–031: quote math, rooms, stay tiers, add-ons, referral rewards,
-- roster stats, group opening, and the RLS around all of it. Uses seeded departure
-- 30000000-…-0001 (Southern France, $3,495 own room, $750 deposit) inside a rolled-back transaction.

begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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
  insert into public.profiles (id, display_name) values (uid, full_name) on conflict (id) do nothing;
end $$;

select tests.create_user('e1000000-0000-4000-8000-0000000000e1', 'erin@example.com', 'Erin');
-- Codes are RLS-protected per user; the test reads Erin's through a definer helper like the UI would share it.
create or replace function tests.code_of(uid uuid) returns text language sql security definer as $$
  select code from public.referral_codes where user_id = uid $$;
grant execute on function tests.code_of(uuid) to anon, authenticated;
select tests.create_user('e2000000-0000-4000-8000-0000000000e2', 'frank@example.com', 'Frank');

-- Fixtures on the seeded departure: a shared-room discount, a stay tier and two add-ons.
update public.departures set shared_room_discount_amount = 35000 where id = '30000000-0000-4000-8000-000000000001';
insert into public.departure_stay_options (id, departure_id, name, price_delta_amount, position, is_default)
values ('a2000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000001', 'Test 4★', 85000, 9, false);
insert into public.departure_add_ons (id, departure_id, title, kind, price_amount, currency, pricing_basis, capacity, day_number, bookable_until_days_before, tier_group)
values
  ('a3000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000001', 'Test boat', 'activity', 14500, 'USD', 'per_traveler', 2, 2, 1, null),
  ('a3000000-0000-4000-8000-0000000000a2', '30000000-0000-4000-8000-000000000001', 'Test transfer', 'transfer', 9000, 'USD', 'per_booking', null, 1, 2, null),
  ('a3000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-000000000001', 'Tier A', 'ticket', 10000, 'USD', 'per_traveler', null, 2, 1, 'view'),
  ('a3000000-0000-4000-8000-0000000000a4', '30000000-0000-4000-8000-000000000001', 'Tier B', 'ticket', 20000, 'USD', 'per_traveler', null, 2, 1, 'view');

-- ── Quote math ───────────────────────────────────────────────────────────────
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null, '[]', null, 'deposit', false) ->> 'total_amount')::int,
  349500, 'one traveler in their own room pays the list price');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,1], null, '[]', null, 'deposit', false) ->> 'total_amount')::int,
  (349500 - 35000) * 2, 'two travelers sharing a room each get the shared-room discount');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,1,2], null, '[]', null, 'deposit', false) ->> 'base_amount')::int,
  (349500 - 35000) * 2 + 349500, 'mixed rooms price each traveler by their own room');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,1,1], null, '[]', null, 'deposit', false) -> 'problems' -> 0 ->> 'code'),
  'room_capacity', 'three in a room is refused');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], 'a2000000-0000-4000-8000-0000000000a1', '[]', null, 'deposit', false) ->> 'total_amount')::int,
  349500 + 85000, 'a stay tier adds its delta per traveler');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,2], null,
     '[{"addOnId":"a3000000-0000-4000-8000-0000000000a1","travelerIndexes":[1,2]},{"addOnId":"a3000000-0000-4000-8000-0000000000a2","quantity":1}]'::jsonb,
     null, 'deposit', false) ->> 'add_ons_amount')::int,
  14500 * 2 + 9000, 'per-traveler add-ons multiply by travelers; per-booking ones do not');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,2], null,
     '[{"addOnId":"a3000000-0000-4000-8000-0000000000a1","travelerIndexes":[1,2]}]'::jsonb, null, 'deposit', false) ->> 'due_now_amount')::int,
  75000 * 2 + 14500 * 2, 'add-ons are paid in full at booking on top of the deposit');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1,2,3], null,
     '[{"addOnId":"a3000000-0000-4000-8000-0000000000a1","travelerIndexes":[1,2,3]}]'::jsonb, null, 'deposit', false) -> 'problems' -> 0 ->> 'code'),
  'add_on_sold_out', 'add-on capacity is enforced in the quote');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null,
     '[{"addOnId":"a3000000-0000-4000-8000-0000000000a3","travelerIndexes":[1]},{"addOnId":"a3000000-0000-4000-8000-0000000000a4","travelerIndexes":[1]}]'::jsonb, null, 'deposit', false) -> 'problems' -> 0 ->> 'code'),
  'tier_conflict', 'one traveler cannot hold two tickets from the same tier group');

-- Referral code: Frank books with Erin's code and gets 5% off the base trip.
select tests.authenticate_as('e2000000-0000-4000-8000-0000000000e2');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null, '[]',
     tests.code_of('e1000000-0000-4000-8000-0000000000e1'), 'full', true) ->> 'discount_amount')::int,
  (349500 * 5) / 100, 'a friend''s referral code takes the configured percent off the base trip');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null, '[]',
     tests.code_of('e2000000-0000-4000-8000-0000000000e2'), 'full', true) -> 'problems' -> 0 ->> 'code'),
  'code_own_referral', 'you cannot use your own referral code');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null, '[]', 'NOPE', 'full', true) -> 'problems' -> 0 ->> 'code'),
  'code_invalid', 'an unknown code is reported, not ignored');

-- ── create_booking v2 stores the quote and the rooms ─────────────────────────
select lives_ok($$
  select * from public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '[{"firstName":"Frank","lastName":"Test","email":"frank@example.com","dateOfBirth":"1990-01-01","nationality":"US","roomIndex":1},
      {"firstName":"Gina","lastName":"Test","email":"gina@example.com","dateOfBirth":"1991-02-02","nationality":"CA","roomIndex":1}]'::jsonb,
    '{"name":"Pat","relationship":"Sibling","phone":"+1 555 0100"}'::jsonb,
    '{"airportTransfer":"group_welcome_transfer"}'::jsonb,
    'deposit', 'v1', 'a2000000-0000-4000-8000-0000000000a1',
    '[{"addOnId":"a3000000-0000-4000-8000-0000000000a1","travelerIndexes":[1,2]},{"addOnId":"a3000000-0000-4000-8000-0000000000a2","quantity":1}]'::jsonb,
    tests.code_of('e1000000-0000-4000-8000-0000000000e1'))
$$, 'a booking with a shared room, a stay tier, add-ons and a referral code is created');
select tests.clear_auth();

select is(
  (select total_amount::int from public.bookings where customer_id = 'e2000000-0000-4000-8000-0000000000e2'),
  ((349500 + 85000 - 35000) * 2) - (((349500 + 85000 - 35000) * 2 * 5) / 100) + 14500 * 2 + 9000,
  'the booking total equals the quote: base with tier and shared discount, minus referral, plus add-ons');
select is(
  (select count(distinct room_index)::int from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
    where b.customer_id = 'e2000000-0000-4000-8000-0000000000e2'),
  1, 'both travelers share one room');
select is(
  (select count(*)::int from public.booking_add_ons ba join public.bookings b on b.id = ba.booking_id
    where b.customer_id = 'e2000000-0000-4000-8000-0000000000e2' and ba.status = 'pending'),
  3, 'add-on rows are pending until payment (two per-traveler, one per-booking)');
select is(
  (select status from public.referrals where referred_user_id = 'e2000000-0000-4000-8000-0000000000e2'),
  'pending', 'the referral waits for the payment');

-- Confirmation flips add-ons, rewards the referrer and writes line items.
update public.bookings set status = 'confirmed', payment_status = 'deposit_paid', amount_paid = deposit_amount + 14500 * 2 + 9000
where customer_id = 'e2000000-0000-4000-8000-0000000000e2';
select is(
  (select count(*)::int from public.booking_add_ons ba join public.bookings b on b.id = ba.booking_id
    where b.customer_id = 'e2000000-0000-4000-8000-0000000000e2' and ba.status = 'confirmed'),
  3, 'paying confirms the add-ons');
select is(public.account_credit_balance('e1000000-0000-4000-8000-0000000000e1', 'USD'), 7500::bigint,
  'the referrer earns the configured credit when the booking is confirmed');
select is(
  (select count(*)::int from public.booking_items bi join public.bookings b on b.id = bi.booking_id
    where b.customer_id = 'e2000000-0000-4000-8000-0000000000e2' and bi.kind = 'add_on'),
  3, 'confirmed add-ons appear as line items');
select is((select going from public.add_on_headcounts where add_on_id = 'a3000000-0000-4000-8000-0000000000a1'), 2,
  'the public head-count shows two people on the boat');

-- Erin's credit is applied automatically to her next quote.
select tests.authenticate_as('e1000000-0000-4000-8000-0000000000e1');
select is(
  (public.quote_booking('30000000-0000-4000-8000-000000000001', array[1], null, '[]', null, 'full', true) ->> 'credit_amount')::int,
  7500, 'account credit is applied to the next booking''s quote');
select tests.clear_auth();

-- ── Roster stats are anonymized and public ───────────────────────────────────
select tests.authenticate_anon();
select is((public.departure_roster_stats('30000000-0000-4000-8000-000000000001') ->> 'pairs')::int, 1,
  'anonymous visitors see the pair count');
select ok((public.departure_roster_stats('30000000-0000-4000-8000-000000000001') ->> 'ageMin') is null,
  'age range stays hidden until four travelers are booked');
select tests.clear_auth();

-- ── Group opening ────────────────────────────────────────────────────────────
-- A fresh departure (the seeded one may already have a trip locally) ten days out, one confirmed
-- traveler, minimum one: the daily job must create its trip and tell the member.
insert into public.departures (id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity, minimum_travelers,
                               price_amount, deposit_amount, currency, booking_deadline, balance_due_date, group_opens_days_before)
values ('a4000000-0000-4000-8000-0000000000a4', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        'open', current_date + 10, current_date + 18, 'Europe/Paris', 14, 1, 349500, 75000, 'USD', current_date + 5, current_date + 3, 30);
insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status, currency,
                             subtotal_amount, total_amount, deposit_amount, amount_paid)
values ('a5000000-0000-4000-8000-0000000000a5', 'GL-OPEN01', 'e2000000-0000-4000-8000-0000000000e2', 'a4000000-0000-4000-8000-0000000000a4',
        '21000000-0000-4000-8000-000000000001', 'confirmed', 'paid', 'USD', 349500, 349500, 75000, 349500);
insert into public.traveler_profiles (id, owner_user_id, user_id, first_name, last_name, date_of_birth, nationality)
values ('a6000000-0000-4000-8000-0000000000a6', 'e2000000-0000-4000-8000-0000000000e2', 'e2000000-0000-4000-8000-0000000000e2', 'Frank', 'Test', '1990-01-01', 'US');
insert into public.booking_travelers (booking_id, traveler_id, is_lead, room_index)
values ('a5000000-0000-4000-8000-0000000000a5', 'a6000000-0000-4000-8000-0000000000a6', true, 1);
select ok(public.open_due_groups() >= 1, 'a viable departure inside its group-open window gets its trip created');
select is((select count(*)::int from public.trips where departure_id = 'a4000000-0000-4000-8000-0000000000a4'), 1,
  'exactly one trip exists for the opened departure');
select is((select count(*)::int from public.notifications where type = 'group_opened' and user_id = 'e2000000-0000-4000-8000-0000000000e2'), 1,
  'members are told their group is open');

-- ── RLS: customers cannot write catalog rows ─────────────────────────────────
select tests.authenticate_as('e2000000-0000-4000-8000-0000000000e2');
select throws_ok($$ insert into public.departure_add_ons (departure_id, title, price_amount, currency)
  values ('30000000-0000-4000-8000-000000000001', 'Hack', 1, 'USD') $$, '42501', null, 'customers cannot create add-ons');
select tests.clear_auth();

select * from finish();
rollback;
