-- pgTAP tests for migration 042: friend / group codes and create_booking v3 (p_group_code).
-- Monaco seed: departure 30000000-…-0004, tour slug monaco-grand-prix, start 2027 → codes end in -27.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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

select tests.create_user('f2000000-0000-4000-8000-0000000000a1', 'kyle.gc@example.com');
select tests.create_user('f2000000-0000-4000-8000-0000000000b2', 'sarah.gc@example.com');

-- ── Kyle books and creates a code ────────────────────────────────────────────
select tests.authenticate_as('f2000000-0000-4000-8000-0000000000a1');
create temporary table gc_kyle as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000004',
  '[{"firstName":"Kyle","lastName":"Tester","dateOfBirth":"1987-08-23","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb, '{}'::jsonb,
  'deposit', 'v1', null, '[]'::jsonb, null, null);

select is((select code from public.create_group_code((select booking_id from gc_kyle))), 'KYLE-MONACO-27',
  'code = first name + tour token + two-digit year');
select is((select code from public.create_group_code((select booking_id from gc_kyle))), 'KYLE-MONACO-27',
  'creating again returns the same code');
select is((select count(*)::int from public.group_codes where owner_booking_id = (select booking_id from gc_kyle)), 1,
  'one code per booking');
create temporary table gc_code as select id from public.group_codes where code = 'KYLE-MONACO-27';
select is((select count(*)::int from public.group_codes), 1, 'owner can read their own code through RLS');

select throws_ok(
  $$ insert into public.group_codes (code, departure_id, owner_user_id) values ('HACK-MONACO-27', '30000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'customers cannot insert codes directly');

-- ── Anonymous lookup ─────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select public.check_group_code('kyle-monaco-27 ', '30000000-0000-4000-8000-000000000004')),
  '{"valid": true, "joined": 0, "reason": null, "owner_first_name": "Kyle"}'::jsonb,
  'valid code: trimmed, case-insensitive, owner first name only');
select is(
  (select public.check_group_code('KYLE-MONACO-27', '30000000-0000-4000-8000-000000000001') ->> 'reason'),
  'wrong_departure', 'a code only works on its own departure');
select is(
  (select public.check_group_code('NOBODY-MONACO-27', '30000000-0000-4000-8000-000000000004') ->> 'reason'),
  'not_found', 'unknown code');
select is((select count(*)::int from public.group_codes), 0, 'anon cannot list codes');

-- ── Sarah cannot see Kyle's code but can book with it ────────────────────────
select tests.authenticate_as('f2000000-0000-4000-8000-0000000000b2');
select is((select count(*)::int from public.group_codes), 0, 'another customer cannot read the code row');
select throws_ok(
  $$ select public.create_group_code((select booking_id from gc_kyle)) $$,
  '23514', null, 'only the booking owner can create its code');

create temporary table gc_sarah as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000004',
  '[{"firstName":"Sarah","lastName":"Friend","dateOfBirth":"1990-01-15","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb, '{}'::jsonb,
  'deposit', 'v1', null, '[]'::jsonb, null, 'kyle-monaco-27');

select is((select total_amount from gc_sarah), 189000::bigint, 'a group code never changes the price');
select is(
  (select group_code_id from public.bookings where id = (select booking_id from gc_sarah)),
  (select id from gc_code),
  'the friend booking is linked to the code');
select is((select public.check_group_code('KYLE-MONACO-27', '30000000-0000-4000-8000-000000000004') ->> 'joined')::int, 1,
  'joined counts linked bookings');

select throws_ok(
  $$ select * from public.create_booking(
       '30000000-0000-4000-8000-000000000004',
       '[{"firstName":"Sam","lastName":"Friend","dateOfBirth":"1990-01-15","nationality":"US"}]'::jsonb,
       '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb, '{}'::jsonb,
       'deposit', 'v1', null, '[]'::jsonb, null, 'NOPE-MONACO-27') $$,
  '23514', null, 'an invalid group code refuses the booking');

select tests.clear_auth();
select is((select uses from public.group_codes where code = 'KYLE-MONACO-27'), 1, 'uses incremented once');
update public.group_codes set max_uses = 1 where code = 'KYLE-MONACO-27';
select is((select public.check_group_code('KYLE-MONACO-27', '30000000-0000-4000-8000-000000000004') ->> 'reason'), 'full',
  'a code at max uses reports full');
update public.group_codes set max_uses = 20, expires_at = now() - interval '1 day' where code = 'KYLE-MONACO-27';
select is((select public.check_group_code('KYLE-MONACO-27', '30000000-0000-4000-8000-000000000004') ->> 'reason'), 'expired',
  'an expired code reports expired');

-- ── Collision handling ───────────────────────────────────────────────────────
select tests.create_user('f2000000-0000-4000-8000-0000000000c3', 'kyle2.gc@example.com');
select tests.authenticate_as('f2000000-0000-4000-8000-0000000000c3');
create temporary table gc_kyle2 as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000004',
  '[{"firstName":"Kyle","lastName":"Other","dateOfBirth":"1985-05-05","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb, '{}'::jsonb,
  'deposit', 'v1', null, '[]'::jsonb, null, null);
select is((select code from public.create_group_code((select booking_id from gc_kyle2))), 'KYLE-MONACO-27-02',
  'a second Kyle gets a counter segment');

select * from finish();
rollback;
