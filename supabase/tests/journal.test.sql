-- pgTAP tests for migration 051 (journal on cms_pages).
-- Run: pnpm db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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

select tests.create_user('c1000000-0000-4000-8000-00000000000a', 'reader@example.com', 'Rita Reader');
select tests.create_user('c1000000-0000-4000-8000-00000000000c', 'editor@guideless.test', 'Carla Content');
insert into public.user_roles (user_id, role)
  values ('c1000000-0000-4000-8000-00000000000c', 'content_editor');

-- ── Columns and defaults ─────────────────────────────────────────────────────
select has_column('public', 'cms_pages', 'kind', 'cms_pages carries a kind discriminator');
select has_column('public', 'cms_pages', 'body_markdown', 'cms_pages carries the post body');
select has_column('public', 'cms_pages', 'tour_id', 'a post can point at a trip');
select col_default_is('public', 'cms_pages', 'kind', 'page', 'existing rows stay standing pages');

-- ── Constraints that protect a published post ────────────────────────────────
insert into public.cms_pages (slug, title, kind, body_markdown, excerpt, is_published, published_at)
values ('nice-in-may', 'Nice in May', 'journal', repeat('Body. ', 40), 'A summary.', true, now());

select throws_ok(
  $$insert into public.cms_pages (slug, title, kind, is_published, published_at)
    values ('no-date', 'No date', 'journal', true, null)$$,
  '23514',
  null,
  'a published post must carry a date to sort by'
);

select throws_ok(
  $$insert into public.cms_pages (slug, title, kind) values ('bad-kind', 'Bad', 'newsletter')$$,
  '23514',
  null,
  'kind is limited to page and journal'
);

select throws_ok(
  $$insert into public.cms_pages (slug, title, kind, excerpt)
    values ('long-excerpt', 'Long', 'journal', repeat('x', 301))$$,
  '23514',
  null,
  'the summary is capped so the index cannot be flooded'
);

-- A draft is allowed to be incomplete: the constraint only binds when it goes live.
select lives_ok(
  $$insert into public.cms_pages (slug, title, kind) values ('half-written', 'Half written', 'journal')$$,
  'a draft post needs nothing but a slug and a title'
);

-- ── RLS: published is public, drafts are staff-only ──────────────────────────
select tests.authenticate_anon();
select is(
  (select count(*)::int from public.cms_pages where slug = 'nice-in-may'),
  1,
  'anyone can read a published post'
);
select is(
  (select count(*)::int from public.cms_pages where slug = 'half-written'),
  0,
  'a draft is invisible to the public'
);
select throws_ok(
  $$insert into public.cms_pages (slug, title, kind) values ('anon-post', 'Anon', 'journal')$$,
  '42501',
  null,
  'the public cannot write a post'
);

select tests.authenticate_as('c1000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.cms_pages where slug = 'half-written'),
  0,
  'a signed-in traveler still cannot see drafts'
);

select tests.authenticate_as('c1000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::int from public.cms_pages where slug = 'half-written'),
  1,
  'content staff see drafts'
);
select lives_ok(
  $$update public.cms_pages set title = 'Half written, now edited' where slug = 'half-written'$$,
  'content staff can edit a post'
);

-- ── A deleted tour leaves the post standing ──────────────────────────────────
select tests.clear_auth();
select is(
  (select confdeltype from pg_constraint
    where conname like 'cms_pages_tour_id%' and contype = 'f'),
  'n',
  'deleting a tour nulls the link rather than deleting the post'
);

select * from finish();
rollback;
