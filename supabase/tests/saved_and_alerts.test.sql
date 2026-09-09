-- pgTAP tests for migration 0068: something to come back to between trips.
--
-- Two rules carry the weight here. Saving is private — a count is public, the names are not, which
-- is what makes it safe to save something without it being an act. And an alert can be left by
-- somebody with no account, because the person worth reaching has usually not signed up.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

select tests.create_user('b1000000-0000-4000-8000-0000000000a1', 'saver@example.com');
select tests.create_user('b1000000-0000-4000-8000-0000000000a2', 'nosy@example.com');
select tests.create_user('b1000000-0000-4000-8000-0000000000a3', 'demand.staff@example.com');
insert into public.user_roles (user_id, role) values ('b1000000-0000-4000-8000-0000000000a3', 'admin');

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'saved_tours', 'there is somewhere to keep a tour');
select has_table('public', 'destination_alerts', 'and somewhere to ask to be told');
select has_view('public', 'whats_coming', 'and one feed of what is happening');
select has_view('public', 'wanted_places', 'and a list of where people want us to go');

-- ── Saving is private ────────────────────────────────────────────────────────
select tests.authenticate_as('b1000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into public.saved_tours (user_id, tour_id, note)
     select 'b1000000-0000-4000-8000-0000000000a1', id, 'for the spring' from public.tours limit 1 $$,
  'a traveler keeps a tour for later');
select is((select count(*)::int from public.saved_tours), 1, 'and can see it');

select throws_ok(
  $$ insert into public.saved_tours (user_id, tour_id)
     select 'b1000000-0000-4000-8000-0000000000a2', id from public.tours limit 1 $$,
  '42501', null, 'and cannot save something on somebody else''s behalf');

select tests.authenticate_as('b1000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.saved_tours), 0,
  'another traveler cannot see what anybody saved');

-- Staff included: saving is not a public act, and the count is the only thing anybody needs.
select tests.authenticate_as('b1000000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.saved_tours), 0,
  'and neither can staff — they get the count, not the names');
select is((select sum(saves)::int from public.tour_save_counts), 1,
  'the count itself is readable, which is what the tour page shows');

select tests.be_anon();
select is((select sum(saves)::int from public.tour_save_counts), 1,
  'and it is readable signed out, so the tour page stays cacheable');

-- ── Asking to be told needs no account ───────────────────────────────────────
select lives_ok(
  $$ insert into public.destination_alerts (email, wanted_place, source)
     values ('stranger@example.com', 'Lisbon', 'whats-coming') $$,
  'somebody with no account can ask us to go somewhere');

select tests.clear_auth();
select throws_ok(
  $$ insert into public.destination_alerts (email, destination_id, wanted_place)
     select 'both@example.com', id, 'Lisbon' from public.destinations limit 1 $$,
  '23514', null, 'but not name a destination and a wish at the same time');
select throws_ok(
  $$ insert into public.destination_alerts (email) values ('neither@example.com') $$,
  '23514', null, 'nor neither');

-- Asking twice is a person being keen, not an error the second time.
select throws_ok(
  $$ insert into public.destination_alerts (email, wanted_place)
     values ('stranger@example.com', 'lisbon') $$,
  '23505', null, 'the same person cannot ask for the same place twice');

-- ── The demand signal ────────────────────────────────────────────────────────
insert into public.destination_alerts (email, wanted_place)
values ('another@example.com', 'Lisbon '), ('third@example.com', 'LISBON');

select tests.authenticate_as('b1000000-0000-4000-8000-0000000000a3');
select is((select requests from public.wanted_places where place = 'lisbon'), 3,
  'the same place asked for in three different casings counts as three requests for one place');

-- The whole point of keeping the row: a demand signal outlives the subscription.
select tests.clear_auth();
update public.destination_alerts set unsubscribed_at = now() where email = 'third@example.com';
select tests.authenticate_as('b1000000-0000-4000-8000-0000000000a3');
select is((select requests from public.wanted_places where place = 'lisbon'), 2,
  'somebody who stops the emails stops being counted as waiting to hear');

select tests.clear_auth();
select * from finish();
rollback;
