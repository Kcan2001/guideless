-- pgTAP tests for migration 20260910001000 (multi-city stay tiers).
--
-- Two things must hold, and both have already been got wrong once in this codebase:
--   1. A tier with legs is projected as one public row per city, with that city's own nights —
--      not one row for the whole departure, which is what priced eight nights in Nice.
--   2. A tier with no legs keeps working exactly as before, because Monaco is one hotel for the
--      whole stay and nothing about it should have to change.
-- Plus the usual: the base table is staff-only and the projection is readable by anyone.
-- Rolled back at the end.

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

select tests.create_user('f9000000-0000-4000-8000-0000000000a1', 'ops.legs@example.com');
select tests.create_user('f9000000-0000-4000-8000-0000000000b2', 'traveler.legs@example.com');
insert into public.user_roles (user_id, role) values ('f9000000-0000-4000-8000-0000000000a1', 'trip_staff');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_table('public', 'departure_stay_legs', 'departure_stay_legs exists');
select has_view('public', 'stay_option_hotels_public', 'the public projection still exists');
select has_column('public', 'stay_option_hotels_public', 'nights', 'the projection carries nights');
select has_column('public', 'stay_option_hotels_public', 'leg_name', 'the projection names the city');

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Three hotels in the three seeded Southern France destinations, and legs on the Explorer tier of
-- the first Southern France departure (2027-05-14 → 2027-05-22, 8 nights: 3 / 2 / 3).
insert into public.hotels (id, destination_id, name, slug, city, country_code, star_rating)
values ('f9100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
        'Test Nice Hotel', 'test-nice-hotel', 'Nice', 'FR', 3),
       ('f9100000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
        'Test Avignon Hotel', 'test-avignon-hotel', 'Avignon', 'FR', 3),
       ('f9100000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
        'Test Paris Hotel', 'test-paris-hotel', 'Paris', 'FR', 3);

-- A scratch tier of its own rather than one of the seeded ones, so this test says what it means
-- and does not fight whatever the catalog seeds have linked this week.
insert into public.departure_stay_options (id, departure_id, name, position, price_delta_amount)
values ('f9200000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
        'Legs under test', 19, 0);

insert into public.departure_stay_legs
  (stay_option_id, destination_id, hotel_id, position, check_in, check_out)
values
  ('f9200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'f9100000-0000-4000-8000-000000000001', 1, date '2027-05-14', date '2027-05-17'),
  ('f9200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   'f9100000-0000-4000-8000-000000000002', 2, date '2027-05-17', date '2027-05-19'),
  ('f9200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
   'f9100000-0000-4000-8000-000000000003', 3, date '2027-05-19', date '2027-05-22');

-- ── Invariants ───────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.departure_stay_legs (stay_option_id, hotel_id, position, check_in, check_out)
    values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000001', 9,
            date '2027-05-17', date '2027-05-17')$$,
  '23514', null, 'a leg of zero nights is rejected');

select throws_ok(
  $$insert into public.departure_stay_legs (stay_option_id, hotel_id, position, check_in, check_out)
    values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000002', 1,
            date '2027-05-14', date '2027-05-17')$$,
  '23505', null, 'two legs cannot share a position');

-- ── The projection ───────────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.stay_option_hotels_public
    where stay_option_id = 'f9200000-0000-4000-8000-000000000001'),
  3, 'a three-city tier projects three rows');

select is(
  (select array_agg(city order by position) from public.stay_option_hotels_public
    where stay_option_id = 'f9200000-0000-4000-8000-000000000001'),
  array['Nice', 'Avignon', 'Paris'],
  'the legs come back in itinerary order');

select is(
  (select sum(nights)::int from public.stay_option_hotels_public
    where stay_option_id = 'f9200000-0000-4000-8000-000000000001'),
  8, 'the legs add up to the length of the departure');

select is(
  (select leg_name from public.stay_option_hotels_public
    where stay_option_id = 'f9200000-0000-4000-8000-000000000001' and position = 2),
  'Avignon', 'each leg is labelled with its city');

-- A tier with no legs still projects exactly one row covering the whole departure. Monaco's
-- Explorer tier is a single Nice hotel and must be unaffected by any of the above.
select is(
  (select count(*)::int from public.stay_option_hotels_public v
     join public.departure_stay_options o on o.id = v.stay_option_id
    where o.departure_id = '30000000-0000-4000-8000-000000000004' and o.tier = 'explorer'),
  1, 'a single-city tier still projects one row');

select is(
  (select v.nights::int from public.stay_option_hotels_public v
     join public.departure_stay_options o on o.id = v.stay_option_id
    where o.departure_id = '30000000-0000-4000-8000-000000000004' and o.tier = 'explorer'),
  (select (end_date - start_date)::int from public.departures
    where id = '30000000-0000-4000-8000-000000000004'),
  'a legless tier covers the whole departure');

-- ── Access ───────────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select count(*)::int from public.departure_stay_legs), 0,
  'anon cannot read the base table');
select ok(
  (select count(*) from public.stay_option_hotels_public) > 0,
  'anon can read the public projection');

select tests.authenticate_as('f9000000-0000-4000-8000-0000000000a1');
select ok(
  (select count(*) from public.departure_stay_legs) > 0,
  'staff can read the base table');

select tests.clear_auth();
select * from finish();
rollback;
