-- pgTAP tests for migration 040 (option tiers): the enum, the nullable columns on both catalog
-- tables, anonymous reads, and the shape of the seeded Monaco ladder. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
-- Assert the LADDER, not which add-on wears which badge. Which property or ticket sits on a rung
-- is curation data that moves with every reprice: pinning "Grandstand K is Explorer" here broke
-- the moment a cheaper general-admission ticket was added below it, which is the catalogue working
-- correctly. What must hold is that within a mutually exclusive group the badges run in the same
-- direction as the prices.
select is(
  (select tier::text from public.departure_add_ons
    where departure_id = '30000000-0000-4000-8000-000000000004' and tier_group = 'race_view'
      and is_active
    order by price_amount limit 1),
  'explorer', 'the cheapest race-viewing option is the Explorer rung');
select is(
  (select tier::text from public.departure_add_ons
    where departure_id = '30000000-0000-4000-8000-000000000004' and tier_group = 'race_view'
      and is_active
    order by price_amount desc limit 1),
  'elite', 'the dearest race-viewing option is the Elite rung');
select is(
  (select count(*)::int from (
     select tier,
            price_amount,
            lag(tier) over (order by price_amount) as prev_tier
       from public.departure_add_ons
      where departure_id = '30000000-0000-4000-8000-000000000004' and tier_group = 'race_view'
        and is_active and tier is not null
   ) t
   where prev_tier is not null and t.tier < t.prev_tier),
  0, 'race-viewing badges never go backwards as the price goes up');

-- ── Anonymous reads include the tier ─────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select tier::text from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000004'),
  'premium', 'anon reads the tier of an active add-on (Friday boat is Premium)');
select tests.clear_auth();

select * from finish();
rollback;
