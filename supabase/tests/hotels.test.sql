-- pgTAP tests for migration 044 (hotel inventory): public projection vs staff-only tables, rate
-- privacy, pricing-rule selection and math in suggest_stay_price(), and the tier ↔ hotel link.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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

select tests.create_user('f4000000-0000-4000-8000-0000000000a1', 'ops.hotels@example.com');
select tests.create_user('f4000000-0000-4000-8000-0000000000b2', 'traveler.hotels@example.com');
insert into public.user_roles (user_id, role) values ('f4000000-0000-4000-8000-0000000000a1', 'trip_staff');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_enum('public', 'hotel_supplier', 'hotel_supplier enum exists');
select enum_has_labels('public', 'hotel_supplier', array['duffel', 'expedia', 'hotelbeds', 'manual'], 'supplier labels');
select has_table('public', 'hotel_rates', 'hotel_rates exists');
select has_view('public', 'hotels_public', 'hotels_public view exists');
select has_view('public', 'stay_option_hotels_public', 'stay_option_hotels_public view exists');
select has_column('public', 'departure_stay_options', 'hotel_id', 'stay options link to a hotel');
select has_function('public', 'suggest_stay_price', array['uuid', 'date', 'date', 'integer'], 'suggest_stay_price exists');

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
insert into public.hotels (id, destination_id, name, slug, city, country_code, star_rating, is_active)
select '55000000-0000-4000-8000-000000000001', d.id, 'Test Harbour Hotel', 'test-harbour-hotel', 'Monaco', 'MC', 4, true
from public.destinations d where d.slug = 'monaco';
insert into public.hotels (id, destination_id, name, slug, city, country_code, is_active)
select '55000000-0000-4000-8000-000000000002', d.id, 'Inactive Hotel', 'inactive-hotel', 'Monaco', 'MC', false
from public.destinations d where d.slug = 'monaco';
insert into public.hotel_rooms (id, hotel_id, name, bed_type, max_occupancy)
values ('56000000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000001', 'Superior King', 'king', 2);
insert into public.hotel_supplier_mappings (hotel_id, supplier, supplier_hotel_id)
values ('55000000-0000-4000-8000-000000000001', 'duffel', 'hot_test_1');

-- Two suppliers, same product (fingerprint), plus an older duplicate, an expired one and a
-- different product; total 400000 vs 395000 → the latest per fingerprint per supplier is kept.
insert into public.hotel_rates (hotel_id, supplier, supplier_rate_id, room_name, bed_type, occupancy_adults,
  check_in, check_out, currency, net_amount, total_amount, refundable, cancellation_policy, breakfast_included,
  payment_type, fetched_at, expires_at) values
  ('55000000-0000-4000-8000-000000000001', 'duffel',  'r-duf-new', 'Superior King Room', 'king', 2, '2027-06-03', '2027-06-07', 'USD', 360000, 400000, true, '{"deadline":"2027-05-20"}', true, 'pay_now', now(), now() + interval '1 hour'),
  ('55000000-0000-4000-8000-000000000001', 'duffel',  'r-duf-old', 'Superior King Room', 'king', 2, '2027-06-03', '2027-06-07', 'USD', 380000, 420000, true, '{"deadline":"2027-05-20"}', true, 'pay_now', now() - interval '2 hours', now() + interval '1 hour'),
  ('55000000-0000-4000-8000-000000000001', 'expedia', 'r-exp',     'superior  king room', 'King', 2, '2027-06-03', '2027-06-07', 'USD', 355000, 395000, true, '{"deadline":"2027-05-20"}', true, 'pay_now', now(), null),
  ('55000000-0000-4000-8000-000000000001', 'hotelbeds','r-hb-exp', 'Superior King Room', 'king', 2, '2027-06-03', '2027-06-07', 'USD', 300000, 330000, true, '{"deadline":"2027-05-20"}', true, 'pay_now', now(), now() - interval '1 minute'),
  ('55000000-0000-4000-8000-000000000001', 'hotelbeds','r-hb-bare','Superior King Room', 'king', 2, '2027-06-03', '2027-06-07', 'USD', 280000, 310000, false, '{}', false, 'pay_now', now(), null);

-- Rules: global 10% min $100; Monaco 12% min $250; hotel fixed $150.
insert into public.pricing_rules (id, min_markup_amount, percentage_markup, fixed_markup_amount, priority)
values ('57000000-0000-4000-8000-000000000001', 10000, 10, 0, 0);
insert into public.pricing_rules (id, destination_id, min_markup_amount, percentage_markup, fixed_markup_amount, priority)
select '57000000-0000-4000-8000-000000000002', d.id, 25000, 12, 0, 0 from public.destinations d where d.slug = 'monaco';

update public.departure_stay_options
set hotel_id = '55000000-0000-4000-8000-000000000001', hotel_room_id = '56000000-0000-4000-8000-000000000001'
where id = '31000000-0000-4000-8000-000000000002';

-- ── Anonymous: public projection only ────────────────────────────────────────
select tests.authenticate_anon();
select is((select count(*)::int from public.hotels_public where slug in ('test-harbour-hotel', 'inactive-hotel')), 1,
  'anon sees the active hotel through hotels_public and not the inactive one');
select is((select hotel_name from public.stay_option_hotels_public where stay_option_id = '31000000-0000-4000-8000-000000000002'),
  'Test Harbour Hotel', 'anon sees the hotel name behind the Monaco tier');
select is((select room_name from public.stay_option_hotels_public where stay_option_id = '31000000-0000-4000-8000-000000000002'),
  'Superior King', 'anon sees the linked room');
select is((select count(*)::int from public.hotels), 0, 'anon cannot read the hotels table directly');
select is((select count(*)::int from public.hotel_rates), 0, 'anon cannot read net rates');
select is((select count(*)::int from public.pricing_rules), 0, 'anon cannot read pricing rules');
select is((select count(*)::int from public.hotel_supplier_mappings), 0, 'anon cannot read supplier mappings');
select throws_ok(
  $$ select public.suggest_stay_price('55000000-0000-4000-8000-000000000001', '2027-06-03', '2027-06-07', 2) $$,
  '42501', 'permission denied for function suggest_stay_price', 'anon cannot execute suggest_stay_price');
select tests.clear_auth();

-- ── Traveler: same as anon for staff data ────────────────────────────────────
select tests.authenticate_as('f4000000-0000-4000-8000-0000000000b2');
select is((select count(*)::int from public.hotel_rates), 0, 'a signed-in traveler cannot read net rates');
select throws_like(
  $$ select public.suggest_stay_price('55000000-0000-4000-8000-000000000001', '2027-06-03', '2027-06-07', 2) $$,
  '%Staff only%', 'a traveler cannot call suggest_stay_price');
select tests.clear_auth();

-- ── Ops staff: rates, rules and the suggestion ───────────────────────────────
select tests.authenticate_as('f4000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.hotel_rates where hotel_id = '55000000-0000-4000-8000-000000000001'), 5,
  'ops staff read net rates');
select is((select count(*)::int from public.pricing_rules), 2, 'ops staff read pricing rules');

create temporary table hs as
select public.suggest_stay_price('55000000-0000-4000-8000-000000000001', '2027-06-03', '2027-06-07', 2) as j;

select is((select (j ->> 'rule_id')::uuid from hs), '57000000-0000-4000-8000-000000000002',
  'the Monaco destination rule beats the global rule');
select is((select jsonb_array_length(j -> 'rates') from hs), 2,
  'one suggestion per equivalent product (expired and older duplicates dropped)');
-- Flexible product: Expedia 395000 is the latest per its supplier; Duffel latest is 400000; the
-- DISTINCT ON keeps the single latest fetch per fingerprint, which is the newest row: r-exp or
-- r-duf-new share now(); assert the flexible entry carries the Monaco math either way.
select ok(
  (select bool_and((r ->> 'markup')::bigint = greatest(25000, round((r ->> 'net_total')::bigint * 12 / 100.0)::bigint))
   from hs, jsonb_array_elements(j -> 'rates') r),
  'markup = max(min, round(net × 12%)) for every suggested rate');
select ok(
  (select bool_and((r ->> 'customer_total')::bigint = (r ->> 'net_total')::bigint + (r ->> 'markup')::bigint)
   from hs, jsonb_array_elements(j -> 'rates') r),
  'customer_total = net_total + markup');
select is(
  (select (r ->> 'net_total')::bigint from hs, jsonb_array_elements(j -> 'rates') r where (r ->> 'refundable')::boolean = false),
  310000::bigint, 'the non-refundable product is the Hotelbeds bare rate, not the expired one');

-- A hotel-specific rule now wins with its fixed markup.
select tests.clear_auth();
insert into public.pricing_rules (id, hotel_id, min_markup_amount, percentage_markup, fixed_markup_amount, priority)
values ('57000000-0000-4000-8000-000000000003', '55000000-0000-4000-8000-000000000001', 0, 0, 15000, 0);
select tests.authenticate_as('f4000000-0000-4000-8000-0000000000a1');
select is(
  (select (public.suggest_stay_price('55000000-0000-4000-8000-000000000001', '2027-06-03', '2027-06-07', 2) ->> 'rule_id')::uuid),
  '57000000-0000-4000-8000-000000000003', 'a hotel rule beats the destination rule');
select is(
  (select (r ->> 'markup')::bigint
   from jsonb_array_elements(public.suggest_stay_price('55000000-0000-4000-8000-000000000001', '2027-06-03', '2027-06-07', 2) -> 'rates') r
   where (r ->> 'refundable')::boolean = false),
  15000::bigint, 'fixed markup applied from the hotel rule');
select tests.clear_auth();

-- ── Trip staff cannot write pricing rules; finance can ───────────────────────
select tests.authenticate_as('f4000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ insert into public.pricing_rules (min_markup_amount) values (1) $$,
  '42501', null, 'trip staff cannot insert pricing rules');
select tests.clear_auth();

select * from finish();
rollback;
