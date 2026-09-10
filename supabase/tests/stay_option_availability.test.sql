-- pgTAP tests for migration 048 (stay-tier availability): the view counts travelers the same way
-- quote_booking() does, and only staff can read the numbers. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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
create or replace function tests.create_user(uid uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
end $$;

select tests.create_user('f8000000-0000-4000-8000-0000000000a1', 'ops.inventory@example.com');
select tests.create_user('f8000000-0000-4000-8000-0000000000b2', 'traveler.inventory@example.com');
insert into public.user_roles (user_id, role) values ('f8000000-0000-4000-8000-0000000000a1', 'trip_staff');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_view('public', 'stay_option_availability', 'stay_option_availability view exists');
select has_function('public', 'stay_option_availability_for', array['uuid'],
  'stay_option_availability_for exists');

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- The Monaco departure has two seeded tiers; tier 1 (Nice) gets the bookings below.
--   one confirmed booking with 2 travelers   → confirmed 2
--   one pending booking, live hold, 1 traveler → held 1
--   one pending booking, lapsed hold, 3 travelers → ignored, the release job will clear it
--   one cancelled booking, 2 travelers        → ignored
-- Dates of birth because the Monaco departure is 18+ and migration 20260910000200 enforces it on
-- insert into booking_travelers. This test is about capacity counting, so every traveler is adult.
insert into public.traveler_profiles (id, owner_user_id, first_name, last_name, date_of_birth)
values ('f8100000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000b2', 'Ada', 'Confirmed', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000002', 'f8000000-0000-4000-8000-0000000000b2', 'Ben', 'Confirmed', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000003', 'f8000000-0000-4000-8000-0000000000b2', 'Cal', 'Holding', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000004', 'f8000000-0000-4000-8000-0000000000b2', 'Dee', 'Lapsed', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000005', 'f8000000-0000-4000-8000-0000000000b2', 'Eve', 'Lapsed', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000006', 'f8000000-0000-4000-8000-0000000000b2', 'Fay', 'Lapsed', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000007', 'f8000000-0000-4000-8000-0000000000b2', 'Gus', 'Cancelled', '1990-01-01'),
       ('f8100000-0000-4000-8000-000000000008', 'f8000000-0000-4000-8000-0000000000b2', 'Hal', 'Cancelled', '1990-01-01');

insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, stay_option_id, status,
                             currency, subtotal_amount, total_amount, deposit_amount, terms_version, hold_expires_at,
                             cancelled_at)
select v.id, v.cn, v.cust, v.dep, d.tour_version_id, v.stay, v.st, v.cur, v.sub, v.tot, v.dep_amt, v.terms, v.hold,
       case when v.st = 'cancelled' then now() end
from public.departures d,
 (values
  ('f8200000-0000-4000-8000-000000000001'::uuid, 'GL-TESTCF1', 'f8000000-0000-4000-8000-0000000000b2'::uuid,
   '30000000-0000-4000-8000-000000000004'::uuid, '31000000-0000-4000-8000-000000000001'::uuid, 'confirmed'::public.booking_status,
   'USD'::public.currency_code, 100, 100, 50, 'v1', null::timestamptz),
  ('f8200000-0000-4000-8000-000000000002', 'GL-TESTHD1', 'f8000000-0000-4000-8000-0000000000b2',
   '30000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'pending_payment',
   'USD', 100, 100, 50, 'v1', now() + interval '20 minutes'),
  ('f8200000-0000-4000-8000-000000000003', 'GL-TESTLP1', 'f8000000-0000-4000-8000-0000000000b2',
   '30000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'pending_payment',
   'USD', 100, 100, 50, 'v1', now() - interval '5 minutes'),
  ('f8200000-0000-4000-8000-000000000004', 'GL-TESTCX1', 'f8000000-0000-4000-8000-0000000000b2',
   '30000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'cancelled',
   'USD', 100, 100, 50, 'v1', null)
 ) as v(id, cn, cust, dep, stay, st, cur, sub, tot, dep_amt, terms, hold)
where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.booking_travelers (booking_id, traveler_id, room_index) values
  ('f8200000-0000-4000-8000-000000000001', 'f8100000-0000-4000-8000-000000000001', 1),
  ('f8200000-0000-4000-8000-000000000001', 'f8100000-0000-4000-8000-000000000002', 1),
  ('f8200000-0000-4000-8000-000000000002', 'f8100000-0000-4000-8000-000000000003', 1),
  ('f8200000-0000-4000-8000-000000000003', 'f8100000-0000-4000-8000-000000000004', 1),
  ('f8200000-0000-4000-8000-000000000003', 'f8100000-0000-4000-8000-000000000005', 2),
  ('f8200000-0000-4000-8000-000000000003', 'f8100000-0000-4000-8000-000000000006', 3),
  ('f8200000-0000-4000-8000-000000000004', 'f8100000-0000-4000-8000-000000000007', 1),
  ('f8200000-0000-4000-8000-000000000004', 'f8100000-0000-4000-8000-000000000008', 2);

-- ── The counting rule ────────────────────────────────────────────────────────
select is((select confirmed from public.stay_option_availability
           where stay_option_id = '31000000-0000-4000-8000-000000000001'), 2,
  'confirmed counts travelers on confirmed bookings');
select is((select held from public.stay_option_availability
           where stay_option_id = '31000000-0000-4000-8000-000000000001'), 1,
  'held counts travelers on pending bookings whose hold is still live');
select is((select confirmed + held from public.stay_option_availability
           where stay_option_id = '31000000-0000-4000-8000-000000000001'), 3,
  'a lapsed hold and a cancelled booking are both ignored');

-- The same arithmetic quote_booking uses, so the two can never disagree.
select is(
  (select confirmed + held from public.stay_option_availability
    where stay_option_id = '31000000-0000-4000-8000-000000000001'),
  (select count(*)::integer from public.booking_travelers bt
     join public.bookings b on b.id = bt.booking_id
    where b.stay_option_id = '31000000-0000-4000-8000-000000000001'
      and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.hold_expires_at > now()))),
  'the view agrees with the rule inside quote_booking()');

select is((select held from public.stay_option_availability
           where stay_option_id = '31000000-0000-4000-8000-000000000002'), 0,
  'a tier with no bookings reports zero rather than disappearing');
select isnt((select capacity from public.stay_option_availability
             where stay_option_id = '31000000-0000-4000-8000-000000000001'), null,
  'capacity comes through from the tier');

-- ── Access ───────────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select throws_ok(
  $$ select * from public.stay_option_availability $$,
  '42501', null, 'anon cannot read the view directly');
select throws_ok(
  $$ select * from public.stay_option_availability_for('30000000-0000-4000-8000-000000000004') $$,
  null, null, 'anon cannot execute the wrapper');

select tests.authenticate_as('f8000000-0000-4000-8000-0000000000b2');
select throws_ok(
  $$ select * from public.stay_option_availability_for('30000000-0000-4000-8000-000000000004') $$,
  '42501', 'Staff only', 'a traveler is refused by the wrapper');

select tests.authenticate_as('f8000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select * from public.stay_option_availability_for('30000000-0000-4000-8000-000000000004') $$,
  'ops staff may call the wrapper');
-- Four tiers since the 2026-09-10 repricing: cheap Nice, good Nice, the Monaco border, Monte Carlo.
select is((select count(*)::int from public.stay_option_availability_for('30000000-0000-4000-8000-000000000004')), 4,
  'the wrapper returns all four Monaco stay tiers');
select is((select confirmed from public.stay_option_availability_for('30000000-0000-4000-8000-000000000004')
           where stay_option_id = '31000000-0000-4000-8000-000000000001'), 2,
  'the wrapper reports the same confirmed count as the view');
-- Southern France carries three purchasable tiers since seed 087 added the Luberon villa as Elite.
select is((select count(*)::int from public.stay_option_availability_for('30000000-0000-4000-8000-000000000001')), 3,
  'the wrapper scopes to the departure asked for');

select tests.clear_auth();
select * from finish();
rollback;
