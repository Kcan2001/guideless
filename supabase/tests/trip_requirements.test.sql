-- pgTAP tests for trip requirements: the table, the age column, RLS (anonymous reads follow the
-- published version, writes are staff-only), and that both live products actually state a
-- passport requirement and a minimum age. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
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

-- ── Shape ────────────────────────────────────────────────────────────────────
select has_table('public', 'tour_requirements', 'tour_requirements exists');
select col_type_is('public', 'tour_versions', 'minimum_age', 'integer', 'versions carry a minimum age');
select col_is_null('public', 'tour_versions', 'minimum_age', 'minimum age is nullable (unrestricted allowed)');
select col_not_null('public', 'tour_requirements', 'title', 'a requirement must say what it is');

-- The age check is a real constraint, not decoration.
select throws_ok(
  $$ update public.tour_versions set minimum_age = 150
     where id = '21000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'an absurd minimum age is refused');

-- ── RLS ──────────────────────────────────────────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tour_requirements'::regclass),
  'row level security is enabled on tour_requirements');

select tests.authenticate_anon();
select ok(
  (select count(*) from public.tour_requirements
   where tour_version_id = '21000000-0000-4000-8000-000000000002') > 0,
  'anonymous readers see requirements on a published version');
select throws_ok(
  $$ insert into public.tour_requirements (tour_version_id, position, title)
     values ('21000000-0000-4000-8000-000000000002', 99, 'Anonymous injection') $$,
  '42501', null, 'anonymous writers are refused');
select tests.clear_auth();

-- ── Both live products state the two requirements Kyle asked for ─────────────
select is(
  (select minimum_age from public.tour_versions where id = '21000000-0000-4000-8000-000000000002'),
  18, 'Monaco is 18+');
select is(
  (select minimum_age from public.tour_versions where id = '21000000-0000-4000-8000-000000000001'),
  18, 'Southern France is 18+');
select ok(
  (select count(*) from public.tour_requirements
   where tour_version_id = '21000000-0000-4000-8000-000000000002'
     and title ilike '%passport%') = 1,
  'Monaco states a passport requirement');
select ok(
  (select count(*) from public.tour_requirements
   where tour_version_id = '21000000-0000-4000-8000-000000000001'
     and title ilike '%passport%') = 1,
  'Southern France states a passport requirement');

-- ── The age gate actually bites (migration 20260910000200) ──────────────────
select has_function('public', 'enforce_traveler_minimum_age', 'the age trigger function exists');

select tests.create_user('f9000000-0000-4000-8000-0000000000c1', 'age.gate@example.com');
insert into public.traveler_profiles (id, owner_user_id, first_name, last_name, date_of_birth) values
  ('f9100000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000c1', 'Minor', 'Test', '2015-01-01'),
  ('f9100000-0000-4000-8000-000000000002', 'f9000000-0000-4000-8000-0000000000c1', 'Adult', 'Test', '1990-01-01'),
  -- Turns 18 on 2027-05-20, a fortnight before the Monaco departure on 2027-06-02.
  ('f9100000-0000-4000-8000-000000000003', 'f9000000-0000-4000-8000-0000000000c1', 'Justintime', 'Test', '2009-05-20'),
  ('f9100000-0000-4000-8000-000000000004', 'f9000000-0000-4000-8000-0000000000c1', 'Nodob', 'Test', null);

insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status,
                             currency, subtotal_amount, total_amount, deposit_amount, terms_version,
                             hold_expires_at)
select 'f9200000-0000-4000-8000-000000000001', 'GL-AGEGATE', 'f9000000-0000-4000-8000-0000000000c1',
       '30000000-0000-4000-8000-000000000004', d.tour_version_id, 'pending_payment',
       'USD', 100, 100, 50, 'v1', now() + interval '30 minutes'
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

select throws_ok(
  $$ insert into public.booking_travelers (booking_id, traveler_id, room_index)
     values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000001', 1) $$,
  'P0001', 'Travelers must be 18 or over on the departure date',
  'a 12-year-old is refused');

select throws_ok(
  $$ insert into public.booking_travelers (booking_id, traveler_id, room_index)
     values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000004', 1) $$,
  'P0001', 'Traveler date of birth is required on this trip',
  'a missing date of birth is refused rather than waved through');

-- Age is measured on the departure date, so someone who turns 18 before the trip may come.
select lives_ok(
  $$ insert into public.booking_travelers (booking_id, traveler_id, room_index)
     values ('f9200000-0000-4000-8000-000000000001', 'f9100000-0000-4000-8000-000000000003', 1) $$,
  'a traveler who turns 18 before the departure date is allowed');

select * from finish();
rollback;
