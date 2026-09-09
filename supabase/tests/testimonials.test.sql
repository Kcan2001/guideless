-- pgTAP tests for migration 0069: testimonials from trips run before Guideless.
--
-- The feature is a separation, so the separation is what gets tested. A testimonial must never be
-- confusable with a review: no rating column to average, nothing in tour_review_stats, and the
-- consent flag and source note must not be readable by the public even though the quote is.
--
-- Also covers the related fix in the same migration: `reviews` and `trip_photos` no longer hand an
-- anonymous visitor their `staff_note` and `user_id` along with the published row.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

select tests.create_user('c1000000-0000-4000-8000-0000000000a1', 'content@example.com');
select tests.create_user('c1000000-0000-4000-8000-0000000000a2', 'nosy@example.com');
insert into public.user_roles (user_id, role)
values ('c1000000-0000-4000-8000-0000000000a1', 'content_editor');

-- ── Structure: it cannot become a review ─────────────────────────────────────
select has_table('public', 'testimonials', 'there is somewhere to keep a quote from an earlier trip');
select has_view('public', 'testimonials_public', 'and a projection the public reads');
select hasnt_column('public', 'testimonials', 'rating',
  'a testimonial has no rating — absent, not nullable, so nothing can average it later');
select hasnt_column('public', 'testimonials_public', 'consent_confirmed',
  'the public projection does not carry whether consent was given');
select hasnt_column('public', 'testimonials_public', 'source_note',
  'nor the staff note saying where the quote came from');

-- ── Consent gates publishing ─────────────────────────────────────────────────
select tests.authenticate_as('c1000000-0000-4000-8000-0000000000a1');

select lives_ok(
  $$ insert into public.testimonials (id, quote, author_name, trip_label, tour_id)
     select 'c1000000-0000-4000-8000-0000000000d1',
            'Best weekend of the year, and nobody told us where to stand.',
            'Dan', 'Monaco, 2025', id
     from public.tours limit 1 $$,
  'content staff can add a quote');

select throws_ok(
  $$ update public.testimonials
     set status = 'published', published_at = now()
     where id = 'c1000000-0000-4000-8000-0000000000d1' $$,
  '23514', null,
  'but cannot publish it until somebody confirms the person agreed to be quoted');

select lives_ok(
  $$ update public.testimonials
     set consent_confirmed = true, status = 'published', published_at = now()
     where id = 'c1000000-0000-4000-8000-0000000000d1' $$,
  'with consent confirmed it publishes');

-- The published/published_at pair cannot drift apart, same rule reviews follow.
select throws_ok(
  $$ update public.testimonials set published_at = null
     where id = 'c1000000-0000-4000-8000-0000000000d1' $$,
  '23514', null, 'a published row must keep its publish stamp');

-- ── What the public can and cannot see ───────────────────────────────────────
select tests.be_anon();
select is((select count(*)::int from public.testimonials_public), 1,
  'an anonymous visitor reads the published quote');
select is((select count(*)::int from public.testimonials), 0,
  'but not the table behind it, which holds the consent flag and the source note');

-- A draft is not a quiet publish.
select tests.authenticate_as('c1000000-0000-4000-8000-0000000000a1');
insert into public.testimonials (quote, author_name, trip_label)
values ('Said something nice but has not agreed to it being used.', 'Sam', 'Monaco, 2024');
select tests.be_anon();
select is((select count(*)::int from public.testimonials_public), 1,
  'a draft stays invisible');

-- Staff who are not content staff can read but not write.
select tests.authenticate_as('c1000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.testimonials), 0,
  'somebody with no staff role sees nothing at all');
select throws_ok(
  $$ insert into public.testimonials (quote, author_name, trip_label)
     values ('Making this up entirely, as a treat.', 'Nobody', 'Monaco, 2025') $$,
  '42501', null, 'and cannot add one');

-- ── It never reaches the star rating ─────────────────────────────────────────
select tests.be_anon();
select is((select count(*)::int from public.tour_review_stats), 0,
  'a published testimonial adds nothing to the review stats that feed AggregateRating');

-- ── The related fix: published reviews no longer leak the moderator's note ───
select tests.clear_auth();
select has_view('public', 'reviews_public', 'published reviews have a projection of their own');
select hasnt_column('public', 'reviews_public', 'staff_note',
  'which cannot select the moderation note');
select hasnt_column('public', 'reviews_public', 'user_id',
  'nor tie a published review to an auth user');
select hasnt_column('public', 'trip_photos_public', 'staff_note',
  'and the same for traveler photos');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'reviews' and policyname = 'published reviews are public'),
  0,
  'the policy that handed anon the whole review row is gone');

select tests.clear_auth();
select * from finish();
rollback;
