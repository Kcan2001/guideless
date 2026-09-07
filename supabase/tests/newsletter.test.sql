-- pgTAP tests for migrations 036 (newsletter) and 037 (Pinterest platform).
-- Run: pnpm db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.com', 'Alice Traveler');
select tests.create_user('d0000000-0000-4000-8000-00000000000d', 'carla@guideless.test', 'Carla Content');
insert into public.user_roles (user_id, role) values ('d0000000-0000-4000-8000-00000000000d', 'content_editor');

-- ── 1. Anonymous signup through the RPC ──────────────────────────────────────
select tests.authenticate_anon();
select is(public.subscribe_newsletter('  Reader@Example.com ', 'footer'), 'subscribed', 'anon can subscribe via RPC');
select is(public.subscribe_newsletter('reader@example.com', 'footer'), 'already_subscribed', 're-subscribing is idempotent (case-insensitive)');
select throws_ok($$ select public.subscribe_newsletter('not-an-email', 'footer') $$, '22023', null, 'invalid email is rejected');
select is((select count(*)::int from public.newsletter_subscribers), 0, 'anon cannot read the subscriber list');
select throws_ok(
  $$ insert into public.newsletter_subscribers (email) values ('direct@example.com') $$,
  '42501', null, 'anon cannot insert directly — only through the RPC');

-- ── 2. Unsubscribe by token ──────────────────────────────────────────────────
select tests.clear_auth();
select is(public.unsubscribe_newsletter((select unsubscribe_token from public.newsletter_subscribers where email = 'reader@example.com')),
  true, 'a valid token unsubscribes');
select is(public.unsubscribe_newsletter(gen_random_uuid()), false, 'an unknown token is a no-op');
select is((select status from public.newsletter_subscribers where email = 'reader@example.com'), 'unsubscribed', 'status flips to unsubscribed');

select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(public.subscribe_newsletter('reader@example.com', 'account'), 'resubscribed', 'an unsubscribed address can re-subscribe');
select tests.clear_auth();
select is((select user_id from public.newsletter_subscribers where email = 'reader@example.com'),
  'a0000000-0000-4000-8000-00000000000a', 'signed-in re-subscribe links the user');
select is((select count(*)::int from public.newsletter_subscribers where email = 'reader@example.com'), 1, 'still a single row per email');

-- ── 3. Staff visibility ──────────────────────────────────────────────────────
select tests.authenticate_as('d0000000-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.newsletter_subscribers), 1, 'content staff can read the list');
select tests.clear_auth();

-- ── 4. Pinterest platform ────────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.social_posts (platform, caption, title, link_url, media_paths)
     values ('pinterest', 'Nice at golden hour', 'Old town, Nice', 'https://guidelesstravel.com/tours/southern-france', array['2026/nice.jpg']) $$,
  'pinterest posts with title and link are accepted');
select throws_ok(
  $$ insert into public.social_posts (platform, caption, link_url) values ('pinterest', 'x', 'ftp://nope') $$,
  '23514', null, 'link_url must be http(s)');

select * from finish();
rollback;
