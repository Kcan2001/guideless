-- pgTAP tests for migration 039 (catalog presentation): the new enums and columns, their
-- guard rails, anonymous reads, and — most important — that quote_booking() is unchanged.
-- Uses the seeded Monaco departure 30000000-…-0004 inside a rolled-back transaction.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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

-- ── Enums ────────────────────────────────────────────────────────────────────
select has_enum('public', 'option_label', 'option_label enum exists');
select enum_has_labels('public', 'option_label', array['best_value', 'most_popular', 'social', 'luxury'],
  'option_label has the four manual badges');
select has_enum('public', 'add_on_kind', 'add_on_kind enum exists');
select enum_has_labels('public', 'add_on_kind',
  array['activity', 'ticket', 'transfer', 'dinner', 'extra_night', 'room_upgrade', 'group_moment', 'insurance', 'extension', 'other'],
  'add_on_kind carries the old kinds plus group_moment / insurance / extension');
select col_type_is('public', 'departure_add_ons', 'kind', 'add_on_kind', 'departure_add_ons.kind is the enum now');

-- ── Columns and defaults ─────────────────────────────────────────────────────
select has_column('public', 'departure_stay_options', 'details', 'stay options have details jsonb');
select col_default_is('public', 'departure_stay_options', 'image_urls', '{}'::text[], 'stay image_urls default to an empty array');
select has_column('public', 'departure_add_ons', 'meeting_point', 'add-ons have a meeting point');
select has_column('public', 'departure_add_ons', 'min_age', 'add-ons have a minimum age');
select col_default_is('public', 'departure_add_ons', 'includes', '{}'::text[], 'add-on includes default to an empty array');

-- ── Guard rails ──────────────────────────────────────────────────────────────
select throws_ok(
  $$ update public.departure_add_ons set includes = array_fill('x'::text, array[13]) where id = '32000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'more than 12 include lines is rejected');
select throws_ok(
  $$ update public.departure_stay_options set tagline = repeat('x', 161) where id = '31000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'a 161-character tagline is rejected');
select throws_ok(
  $$ update public.departure_add_ons set min_age = 120 where id = '32000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'min_age above 99 is rejected');
select throws_ok(
  $$ update public.departure_stay_options set details = '[]'::jsonb where id = '31000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'details must be a JSON object');
select lives_ok(
  $$ update public.departure_add_ons set kind = 'group_moment' where id = '32000000-0000-4000-8000-000000000004' $$,
  'a new kind value is accepted');

-- ── Anonymous reads include the new columns ──────────────────────────────────
update public.departure_add_ons set label = 'most_popular', includes = array['Seat both days']
where id = '32000000-0000-4000-8000-000000000001';
select tests.authenticate_anon();
select is(
  (select label::text from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000001'),
  'most_popular', 'anon reads the label of an active add-on');
select is(
  (select cardinality(includes) from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000001'),
  1, 'anon reads includes of an active add-on');
select tests.clear_auth();

-- ── Pricing is untouched ─────────────────────────────────────────────────────
-- One traveler, default Nice tier, Grandstand K + Friday boat + private transfer, deposit.
-- Expected: 189000 (base) + 129000 + 21000 + 12000 = 351000.
select is(
  ((public.quote_booking(
      '30000000-0000-4000-8000-000000000004', array[1], null,
      '[{"addOnId":"32000000-0000-4000-8000-000000000001","travelerIndexes":[1]},
        {"addOnId":"32000000-0000-4000-8000-000000000004","travelerIndexes":[1]},
        {"addOnId":"32000000-0000-4000-8000-000000000005","quantity":1}]'::jsonb,
      null, 'deposit', false)) ->> 'total_amount')::bigint,
  351000::bigint,
  'quote_booking total for the Monaco example is unchanged by the presentation columns');

select * from finish();
rollback;
