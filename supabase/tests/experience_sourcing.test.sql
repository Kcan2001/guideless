-- pgTAP tests for migration 0065: sourcing extras from a supplier.
--
-- The rule this file exists to enforce is rule 11: never expose supplier costs to customers. The
-- extras list on a tour page is readable by **anon**, so the whole design rests on none of the
-- commercial detail living on that table. If somebody later adds a `net_amount` column to
-- `departure_add_ons` for convenience, these tests are what should stop them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.be_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
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

select tests.create_user('a9000000-0000-4000-8000-0000000000a1', 'exp.traveler@example.com');
select tests.create_user('a9000000-0000-4000-8000-0000000000a2', 'exp.ops@example.com');
insert into public.user_roles (user_id, role) values ('a9000000-0000-4000-8000-0000000000a2', 'trip_staff');

insert into public.experience_products
  (id, supplier, supplier_product_id, destination_id, title, from_amount, currency)
select 'a9000000-0000-4000-8000-0000000000f1', 'mock', 'mock-exp-test', d.id,
       'Old Town food walk', 6500, 'EUR'
from public.destinations d limit 1;

insert into public.experience_rates
  (id, product_id, supplier, supplier_option_id, option_name, travel_date, currency,
   net_amount, total_amount, capacity, available)
values ('a9000000-0000-4000-8000-0000000000e1', 'a9000000-0000-4000-8000-0000000000f1', 'mock',
        'mock-exp-test-am', '10:00 English', current_date + 30, 'EUR', 6500, 6500, 8, true);

insert into public.departure_add_ons
  (id, departure_id, title, kind, price_amount, currency, pricing_basis, is_active)
values ('a9000000-0000-4000-8000-0000000000d1', '30000000-0000-4000-8000-000000000001',
        'Old Town food walk', 'activity', 9500, 'EUR', 'per_traveler', true);

insert into public.add_on_sourcing
  (add_on_id, product_id, supplier, supplier_option_id, net_amount, currency, source_rate_id)
values ('a9000000-0000-4000-8000-0000000000d1', 'a9000000-0000-4000-8000-0000000000f1', 'mock',
        'mock-exp-test-am', 6500, 'EUR', 'a9000000-0000-4000-8000-0000000000e1');

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'experience_products', 'the supplier catalog is cached');
select has_table('public', 'experience_rates', 'with prices per date');
select has_table('public', 'add_on_sourcing', 'and a link from what we sell to what we bought');
select has_column('public', 'pricing_rules', 'applies_to', 'one markup table, scoped, not two');

-- The load-bearing assertion of the whole design.
select hasnt_column('public', 'departure_add_ons', 'net_amount',
  'the customer-facing add-on carries no supplier cost');
select hasnt_column('public', 'departure_add_ons', 'supplier_option_id',
  'nor a supplier product id somebody could go and buy direct');

-- ── What a customer can see ──────────────────────────────────────────────────
select tests.be_anon();
select is((select count(*)::int from public.departure_add_ons
           where id = 'a9000000-0000-4000-8000-0000000000d1'), 1,
  'anyone can see the add-on itself — it is on a public tour page');
select is((select count(*)::int from public.add_on_sourcing), 0,
  'and nobody signed out can see what it cost us');
select is((select count(*)::int from public.experience_rates), 0, 'nor the supplier prices');
select is((select count(*)::int from public.experience_products), 0, 'nor the supplier catalog');

select tests.authenticate_as('a9000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.add_on_sourcing), 0,
  'and neither can a signed-in traveler, who is the one being charged');
select is((select count(*)::int from public.experience_rates), 0,
  'a traveler cannot price-check us against the supplier');

-- ── What staff can see ───────────────────────────────────────────────────────
select tests.authenticate_as('a9000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.add_on_sourcing), 1, 'ops staff see the sourcing');
select is((select net_amount from public.add_on_sourcing
           where add_on_id = 'a9000000-0000-4000-8000-0000000000d1'), 6500::bigint,
  'including what it cost, which is the point of the screen');

-- ── Pricing ──────────────────────────────────────────────────────────────────
select tests.clear_auth();
insert into public.pricing_rules (destination_id, applies_to, percentage_markup, min_markup_amount, priority, is_active)
select p.destination_id, 'experience', 40, 1000, 10, true
from public.experience_products p where p.id = 'a9000000-0000-4000-8000-0000000000f1';

select tests.authenticate_as('a9000000-0000-4000-8000-0000000000a2');
select is(public.suggest_experience_price('a9000000-0000-4000-8000-0000000000f1', 6500::bigint),
  9100::bigint, 'a 40% markup on 65.00 suggests 91.00');
select is(public.suggest_experience_price('a9000000-0000-4000-8000-0000000000f1', 1000::bigint),
  2000::bigint, 'and the minimum markup floors a cheap one rather than earning us four euros');

-- A cost is an argument to this function, so a traveler must not be able to call it and learn
-- anything by feeding it numbers.
select tests.authenticate_as('a9000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ select public.suggest_experience_price('a9000000-0000-4000-8000-0000000000f1', 6500::bigint) $$,
  '42501', null, 'a traveler cannot ask what we would charge for a given cost');

select tests.clear_auth();
select * from finish();
rollback;
