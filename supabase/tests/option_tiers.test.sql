-- pgTAP tests for migration 040 (option tiers): the enum, the nullable columns on both catalog
-- tables, anonymous reads, and the seeded Monaco mapping. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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

-- ── Enum and columns ─────────────────────────────────────────────────────────
select has_enum('public', 'option_tier', 'option_tier enum exists');
select enum_has_labels('public', 'option_tier', array['explorer', 'classic', 'premium', 'elite'],
  'option_tier has the four public tiers in order');
select col_type_is('public', 'departure_stay_options', 'tier', 'option_tier', 'stay options carry a tier');
select col_type_is('public', 'departure_add_ons', 'tier', 'option_tier', 'add-ons carry a tier');
select col_is_null('public', 'departure_stay_options', 'tier', 'stay tier is nullable (untiered allowed)');
select col_is_null('public', 'departure_add_ons', 'tier', 'add-on tier is nullable (untiered allowed)');

-- ── Seeded Monaco mapping ────────────────────────────────────────────────────
select is(
  (select tier::text from public.departure_stay_options where id = '31000000-0000-4000-8000-000000000001'),
  'explorer', 'Nice, near the port is Explorer');
select is(
  (select tier::text from public.departure_stay_options where id = '31000000-0000-4000-8000-000000000002'),
  'elite', 'Monaco, Monte Carlo is Elite');
select is(
  (select tier::text from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000001'),
  'explorer', 'Grandstand K is Explorer');
select is(
  (select tier::text from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000003'),
  'elite', 'Yacht in the harbour is Elite');

-- ── Anonymous reads include the tier ─────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select tier::text from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000004'),
  'premium', 'anon reads the tier of an active add-on (Friday boat is Premium)');
select tests.clear_auth();

select * from finish();
rollback;
