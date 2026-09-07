-- pgTAP tests for migration 025 (social publishing): RLS, claim semantics, bucket, cron.
-- Run: pnpm db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
create or replace function tests.create_user(uid uuid, email text, full_name text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', json_build_object('full_name', full_name)::jsonb, now(), now(),
          '', '', '', '');
end $$;

-- Carla is a content editor; Alice is a customer; Stella is trip staff (not content).
select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.com', 'Alice Traveler');
select tests.create_user('c0000000-0000-4000-8000-00000000000c', 'stella@guideless.test', 'Stella Staff');
select tests.create_user('d0000000-0000-4000-8000-00000000000d', 'carla@guideless.test', 'Carla Content');
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-4000-8000-00000000000c', 'trip_staff'),
  ('d0000000-0000-4000-8000-00000000000d', 'content_editor');

insert into public.social_accounts (id, platform, external_id, username, access_token, token_expires_at)
values ('90000000-0000-4000-8000-000000000001', 'instagram', '1784', 'guidelesstravel', 'secret-token', now() + interval '50 days');

insert into public.social_posts (id, caption, media_paths, status, scheduled_at) values
  ('91000000-0000-4000-8000-000000000001', 'Due now',       array['2026/nice-01.jpg'], 'scheduled', now() - interval '1 minute'),
  ('91000000-0000-4000-8000-000000000002', 'Due tomorrow',  array['2026/nice-02.jpg'], 'scheduled', now() + interval '1 day'),
  ('91000000-0000-4000-8000-000000000003', 'Just a draft',  '{}',                       'draft',     null);

-- ── 1. Invariants ────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.social_posts (caption, status) values ('no time', 'scheduled') $$,
  '23514', null, 'a scheduled post needs scheduled_at');
select throws_ok(
  $$ insert into public.social_posts (caption, status, scheduled_at) values ('no media', 'scheduled', now()) $$,
  '23514', null, 'a scheduled post needs at least one media file');
select throws_ok(
  $$ insert into public.social_posts (caption, kind, status, scheduled_at, media_paths)
     values ('one-image carousel', 'carousel', 'scheduled', now(), array['a.jpg']) $$,
  '23514', null, 'a scheduled carousel needs at least two media files');
select lives_ok(
  $$ insert into public.social_posts (caption, kind, media_paths) values ('carousel draft', 'carousel', array['a.jpg']) $$,
  'a carousel draft may be incomplete');

-- ── 2. Visibility ────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is((select count(*)::int from public.social_posts), 0, 'anon cannot read the social queue');
select is((select count(*)::int from public.social_accounts), 0, 'anon cannot read social accounts');

select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.social_posts), 0, 'customers cannot read the social queue');
select throws_ok(
  $$ insert into public.social_posts (caption) values ('customer draft') $$,
  '42501', null, 'customers cannot create social posts');

select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is((select count(*)::int from public.social_posts), 0, 'trip staff (not content) cannot read the social queue');

select tests.authenticate_as('d0000000-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.social_posts), 4, 'content staff see every post');
select is((select count(*)::int from public.social_accounts), 0, 'content staff never see account tokens (service role only)');
select lives_ok(
  $$ update public.social_posts set caption = 'Edited by Carla' where id = '91000000-0000-4000-8000-000000000003' $$,
  'content staff can edit posts');
select throws_ok(
  $$ select * from public.claim_due_social_posts(5) $$,
  '42501', null, 'content staff cannot claim posts (service role only)');
select tests.clear_auth();

-- ── 3. Claiming ──────────────────────────────────────────────────────────────
select results_eq(
  $$ select id from public.claim_due_social_posts(5) $$,
  $$ values ('91000000-0000-4000-8000-000000000001'::uuid) $$,
  'claim returns only due scheduled posts and nothing else');
select is((select status::text from public.social_posts where id = '91000000-0000-4000-8000-000000000001'),
  'publishing', 'claimed post is flipped to publishing (attempts + 1) so a second run skips it');
select is((select count(*)::int from public.claim_due_social_posts(5)), 0, 'a second claim finds nothing');

-- ── 4. Bucket and cron ───────────────────────────────────────────────────────
select is((select count(*)::int from storage.buckets where id = 'social-media' and public), 1, 'public social-media bucket exists');
-- (plan counts the cron assertion below)
select is((select count(*)::int from cron.job where jobname = 'publish-due-social-posts'), 1,
  'publish job is scheduled');

select * from finish();
rollback;
