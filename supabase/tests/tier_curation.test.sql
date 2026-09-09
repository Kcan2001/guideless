-- pgTAP tests for migration 0053: trip character and staff-only tier briefs.
--
-- The point of this file is the leak test. `departures` is readable by anonymous clients under the
-- "open departures are public" policy, so a staff-only column on it would be readable by anyone who
-- asked for it by name. Migration 0023 already moved `internal_notes` off that table for the same
-- reason. These tests hold the line for tier briefs.
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
create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
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

select tests.create_user('f4000000-0000-4000-8000-0000000000c1', 'tier.staff@example.com');
select tests.create_user('f4000000-0000-4000-8000-0000000000c2', 'tier.customer@example.com');
insert into public.user_roles (user_id, role)
  values ('f4000000-0000-4000-8000-0000000000c1', 'admin');

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'departure_tier_briefs', 'tier briefs have their own table');
select hasnt_column('public', 'departures', 'tier_brief',
  'no staff-only brief column on departures, which anonymous clients can read');
select has_column('public', 'tour_versions', 'character', 'a tour version records what kind of trip it is');

-- Character is a different axis from pace. Both trips are catalogued at their own pace and want
-- different hotels, which is the whole reason this column exists.
select isnt(
  (select character::text from public.tour_versions where id = '21000000-0000-4000-8000-000000000001'),
  (select character::text from public.tour_versions where id = '21000000-0000-4000-8000-000000000002'),
  'the two trips have different characters');
select ok(
  (select 'event' = any (character) from public.tour_versions where id = '21000000-0000-4000-8000-000000000002'),
  'the Grand Prix trip is characterised as an event');
select ok(
  (select 'slow' = any (character) from public.tour_versions where id = '21000000-0000-4000-8000-000000000001'),
  'the France trip is characterised as slow');

-- ── The leak test ────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select count(*)::int from public.departure_tier_briefs),
  0, 'anonymous readers see no tier briefs at all');
select isnt(
  (select count(*)::int from public.departures where status = 'open'),
  0, 'while still being able to read open departures, so the test means something');

select tests.authenticate_as('f4000000-0000-4000-8000-0000000000c2');
select is(
  (select count(*)::int from public.departure_tier_briefs),
  0, 'a signed-in customer sees no tier briefs either');

select tests.authenticate_as('f4000000-0000-4000-8000-0000000000c1');
select isnt(
  (select count(*)::int from public.departure_tier_briefs),
  0, 'staff read the briefs');
select lives_ok(
  $$ insert into public.departure_tier_briefs (departure_id, tier, brief)
     values ('30000000-0000-4000-8000-000000000004', 'classic', 'overwritten by staff')
     on conflict (departure_id, tier) do update set brief = excluded.brief $$,
  'staff write a brief');

-- ── Shape ────────────────────────────────────────────────────────────────────
-- A brief is reasoning, not a label. Something under ten characters is a tier name, not a brief.
select throws_ok(
  $$ insert into public.departure_tier_briefs (departure_id, tier, brief)
     values ('30000000-0000-4000-8000-000000000004', 'elite', 'nice') $$,
  '23514', null, 'a one-word brief is refused');

select tests.clear_auth();
select * from finish();
rollback;
