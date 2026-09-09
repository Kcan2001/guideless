-- pgTAP tests for migration 043: Trip Builder saved configurations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

select tests.create_user('f3000000-0000-4000-8000-0000000000a1', 'draft.a@example.com');
select tests.create_user('f3000000-0000-4000-8000-0000000000b2', 'draft.b@example.com');

select tests.authenticate_as('f3000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into public.builder_drafts (user_id, departure_id, draft, step)
     values ('f3000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000004', '{"stayOptionId":"31000000-0000-4000-8000-000000000001","travelers":1}', 2) $$,
  'owner saves a draft');
select lives_ok(
  $$ insert into public.builder_drafts (user_id, departure_id, draft, step)
     values ('f3000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-000000000004', '{"travelers":2}', 3)
     on conflict (user_id, departure_id) do update set draft = excluded.draft, step = excluded.step $$,
  'saving again upserts');
select is((select step from public.builder_drafts where departure_id = '30000000-0000-4000-8000-000000000004'), 3::smallint,
  'the latest step is kept');
select is((select count(*)::int from public.builder_drafts), 1, 'owner reads exactly their draft');
select throws_ok(
  $$ insert into public.builder_drafts (user_id, departure_id, draft, step)
     values ('f3000000-0000-4000-8000-0000000000b2', '30000000-0000-4000-8000-000000000004', '{}', 0) $$,
  '42501', null, 'cannot save a draft for someone else');
select throws_ok(
  $$ update public.builder_drafts set step = 8 where departure_id = '30000000-0000-4000-8000-000000000004' $$,
  '23514', null, 'step is bounded 0–7');

select tests.authenticate_as('f3000000-0000-4000-8000-0000000000b2');
select is((select count(*)::int from public.builder_drafts), 0, 'another customer sees no drafts');
update public.builder_drafts set step = 0 where departure_id = '30000000-0000-4000-8000-000000000004';
select tests.clear_auth();
-- Scoped to this test's own draft. Asserting on the whole table assumed nothing else had ever
-- written one, and end-to-end runs leaving drafts behind turned that assumption into a failure
-- that had nothing to do with the policy under test.
select is((select step from public.builder_drafts
           where departure_id = '30000000-0000-4000-8000-000000000004'
             and user_id = 'f3000000-0000-4000-8000-0000000000a1'), 3::smallint,
  'another customer cannot update it either');

-- ── Expiry ───────────────────────────────────────────────────────────────────
alter table public.builder_drafts disable trigger builder_drafts_set_updated_at;
update public.builder_drafts set updated_at = now() - interval '40 days';
select is(public.purge_stale_builder_drafts(), 1, 'drafts untouched for 30 days are purged');
select is((select count(*)::int from cron.job where jobname = 'purge-stale-builder-drafts'), 1, 'purge job is scheduled');

select * from finish();
rollback;
