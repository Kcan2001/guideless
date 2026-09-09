-- pgTAP tests for migration 0070: the link a past traveler fills in themselves.
--
-- Two things carry the weight. The submitter is anonymous and has no account, so the only door is
-- submit_testimonial() and it must refuse the things a form could otherwise be talked into:
-- a submission without consent, and photo paths pointing at somebody else's folder. And what
-- arrives is staff-only — it holds an email address and somebody's unedited words.
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

select tests.create_user('e1000000-0000-4000-8000-0000000000a1', 'content2@example.com');
insert into public.user_roles (user_id, role)
values ('e1000000-0000-4000-8000-0000000000a1', 'content_editor');

select has_table('public', 'testimonial_submissions', 'somewhere for what people send in');

-- ── An anonymous stranger with the link ──────────────────────────────────────
select tests.be_anon();

select lives_ok(
  $$ select public.submit_testimonial(
       'e1000000-0000-4000-8000-0000000000f1'::uuid,
       (select slug from public.tours limit 1),
       'Dan', 'dan@example.com',
       'Went in 2025 and still talk about it. Nobody told us where to be.',
       2025, true, true,
       array['e1000000-0000-4000-8000-0000000000f1/one.jpg']) $$,
  'somebody with no account can send their words in');

select throws_ok(
  $$ select public.submit_testimonial(
       'e1000000-0000-4000-8000-0000000000f2'::uuid,
       (select slug from public.tours limit 1),
       'Nope', 'nope@example.com',
       'This is long enough to pass the length check but has no consent.',
       2025, false, false, '{}') $$,
  '22023', null, 'but not without ticking the consent box');

select throws_ok(
  $$ select public.submit_testimonial(
       'e1000000-0000-4000-8000-0000000000f3'::uuid,
       (select slug from public.tours limit 1),
       'Sneaky', 'sneaky@example.com',
       'Trying to claim the photographs somebody else uploaded earlier.',
       2025, true, true,
       array['e1000000-0000-4000-8000-0000000000f1/one.jpg']) $$,
  '22023', null, 'and cannot claim photos from another submission''s folder');

select throws_ok(
  $$ select public.submit_testimonial(
       'e1000000-0000-4000-8000-0000000000f4'::uuid,
       (select slug from public.tours limit 1),
       'Typo', 'not-an-email',
       'A perfectly good quote attached to an address we could never reply to.',
       2025, true, false, '{}') $$,
  '22023', null, 'nor send an address we could not write back to');

select throws_ok(
  $$ select public.submit_testimonial(
       'e1000000-0000-4000-8000-0000000000f5'::uuid,
       (select slug from public.tours limit 1),
       'Brief', 'brief@example.com', 'Nice.', 2025, true, false, '{}') $$,
  '22023', null, 'and a one-word quote is not worth publishing');

-- What they cannot do is read any of it back.
select is((select count(*)::int from public.testimonial_submissions), 0,
  'and cannot read what anybody sent, including their own');

select throws_ok(
  $$ insert into public.testimonial_submissions
       (id, author_name, email, quote, consent_public)
     values ('e1000000-0000-4000-8000-0000000000f9', 'Direct', 'd@example.com',
             'Going straight at the table instead of through the function.', true) $$,
  '42501', null, 'and cannot write at the table directly — the function is the only door');

-- ── Staff ────────────────────────────────────────────────────────────────────
select tests.authenticate_as('e1000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.testimonial_submissions), 1,
  'staff see what came in');
select is(
  (select consent_public from public.testimonial_submissions
   where id = 'e1000000-0000-4000-8000-0000000000f1'),
  true,
  'and the consent recorded is the submitter''s own tick');
select is(
  (select cardinality(photo_paths) from public.testimonial_submissions
   where id = 'e1000000-0000-4000-8000-0000000000f1'),
  1, 'with their photo attached');

-- The tour is resolved from the slug in the link, so the quote lands on the right page.
select isnt(
  (select tour_id from public.testimonial_submissions
   where id = 'e1000000-0000-4000-8000-0000000000f1'),
  null, 'and the tour resolved from the link they were sent');

-- ── The bucket is private ────────────────────────────────────────────────────
select tests.clear_auth();
select is((select public from storage.buckets where id = 'testimonial-uploads'), false,
  'nothing a stranger uploads is publicly fetchable before somebody has looked at it');
select is(
  (select count(*)::int from storage.buckets
   where id = 'testimonial-uploads' and file_size_limit = 15728640),
  1, 'and the bucket caps the file size rather than trusting the browser');

select * from finish();
rollback;
