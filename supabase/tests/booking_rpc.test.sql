-- pgTAP tests for create_booking() and the hold-release job.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
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

select tests.create_user('d0000000-0000-4000-8000-00000000000d', 'dana@example.com');

-- ── Unauthenticated calls are refused ────────────────────────────────────────
select throws_ok(
  $$ select * from public.create_booking('30000000-0000-4000-8000-000000000001', '[{"firstName":"A","lastName":"B"}]', '{}', '{}') $$,
  '42501', null, 'anonymous callers cannot create bookings');

-- ── Happy path: two travelers, deposit ───────────────────────────────────────
select tests.authenticate_as('d0000000-0000-4000-8000-00000000000d');

create temporary table tmp_result as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000001',
  '[{"firstName":"Dana","lastName":"Traveler","email":"dana@example.com","dateOfBirth":"1988-04-02","nationality":"US"},
    {"firstName":"Sam","lastName":"Traveler","dateOfBirth":"1990-09-09","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Sibling","phone":"+14155550123"}'::jsonb,
  '{"roomPreference":"shared_double","dietaryRequirements":"vegetarian","airportTransfer":"group_welcome_transfer"}'::jsonb,
  'deposit', 'v1');

select is((select count(*)::int from tmp_result), 1, 'create_booking returns one row');
select is((select total_amount from tmp_result), 699000::bigint, 'total = price × travelers (2 × $3,495)');
select is((select deposit_amount from tmp_result), 150000::bigint, 'deposit = deposit × travelers (2 × $750)');
select is((select amount_due_now from tmp_result), 150000::bigint, 'deposit option: due now = deposit');
select alike((select confirmation_number from tmp_result), 'GL-________', 'confirmation number generated');
select ok((select hold_expires_at from tmp_result) > now() + interval '25 minutes', 'hold lasts ~30 minutes');

select is((select status::text from public.bookings where id = (select booking_id from tmp_result)), 'pending_payment', 'booking is pending payment');
select is((select count(*)::int from public.booking_travelers where booking_id = (select booking_id from tmp_result)), 2, 'two booking travelers');
select is((select count(*)::int from public.traveler_profiles where owner_user_id = 'd0000000-0000-4000-8000-00000000000d'), 2, 'customer can read both traveler profiles');
select is((select user_id from public.traveler_profiles tp join public.booking_travelers bt on bt.traveler_id = tp.id
           where bt.booking_id = (select booking_id from tmp_result) and bt.is_lead),
          'd0000000-0000-4000-8000-00000000000d'::uuid, 'lead traveler is linked to the account');
select is((select count(*)::int from public.emergency_contacts ec join public.traveler_profiles tp on tp.id = ec.traveler_id
           where tp.owner_user_id = 'd0000000-0000-4000-8000-00000000000d'), 1, 'emergency contact stored on the lead traveler');
select is((select room_preference::text from public.booking_preferences where booking_id = (select booking_id from tmp_result)),
          'single', 'room preference follows the room layout (two travelers, own rooms by default)');

-- Held seats count against availability.
select results_eq(
  $$ select held from public.get_departure_availability('30000000-0000-4000-8000-000000000001') $$,
  $$ values (2) $$,
  'the pending booking holds two seats');

-- Full payment option
select is(
  (select amount_due_now from public.create_booking('30000000-0000-4000-8000-000000000002',
     '[{"firstName":"Solo","lastName":"Traveler","dateOfBirth":"1980-01-01"}]'::jsonb, null, '{}'::jsonb, 'full', 'v1')),
  369500::bigint, 'full option: due now = total (June departure price)');

select tests.clear_auth();

-- ── Cron job is registered ───────────────────────────────────────────────────
select is((select count(*)::int from cron.job where jobname = 'release-expired-booking-holds'), 1,
  'hold-release job is scheduled');

select * from finish();
rollback;
