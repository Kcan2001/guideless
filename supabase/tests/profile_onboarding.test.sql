-- pgTAP tests for migration 046: the first-run profile questions and the avatar bucket.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

select tests.create_user('a6000000-0000-4000-8000-0000000000c1', 'onboard.a@example.com');
select tests.create_user('a6000000-0000-4000-8000-0000000000d2', 'onboard.b@example.com');

-- ── Columns ─────────────────────────────────────────────────────────────────
select has_column('public', 'profiles', 'traveling_from', 'profiles.traveling_from exists');
select has_column('public', 'profiles', 'excited_about', 'profiles.excited_about exists');
select has_column('public', 'profiles', 'party_type', 'profiles.party_type exists');
select has_column('public', 'profiles', 'onboarded_at', 'profiles.onboarded_at exists');
select has_column('public', 'profiles', 'show_traveling_from', 'profiles.show_traveling_from exists');

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_traveling_from'),
  'true', 'traveling-from visibility defaults to shown');

-- ── Constraints ─────────────────────────────────────────────────────────────
select tests.authenticate_as('a6000000-0000-4000-8000-0000000000c1');

select lives_ok(
  $$ update public.profiles
     set traveling_from = 'Santa Monica', excited_about = 'The Friday boat, mostly.',
         party_type = 'solo', onboarded_at = now()
     where id = 'a6000000-0000-4000-8000-0000000000c1' $$,
  'a traveler answers the first-run questions');

select is(
  (select party_type from public.profiles where id = 'a6000000-0000-4000-8000-0000000000c1'),
  'solo', 'the answer is stored');

select throws_ok(
  $$ update public.profiles set party_type = 'entourage'
     where id = 'a6000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'an unknown party type is rejected');

select throws_ok(
  $$ update public.profiles set excited_about = repeat('x', 281)
     where id = 'a6000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'excited_about is capped at 280 characters');

-- ── Avatars ─────────────────────────────────────────────────────────────────
select tests.clear_auth();

select is(
  (select file_size_limit from storage.buckets where id = 'user-avatars'),
  5242880::bigint, 'the avatar bucket accepts 5 MB');

select ok(
  (select 'image/heic' = any(allowed_mime_types) from storage.buckets where id = 'user-avatars'),
  'the avatar bucket accepts the HEIC photos phones produce');

select * from finish();
rollback;
