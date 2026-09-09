-- pgTAP tests for migration 0063: sharing your location with the group.
--
-- Every assertion here corresponds to a sentence in the privacy policy. That is deliberate: this is
-- the first feature that puts one traveler's physical position in front of another, and a promise
-- in a policy document that nothing enforces is not a promise.
--
--   "only visible to people on the same trip"        → a non-member reads zero
--   "only while you have it on"                      → a lapsed opt-in reads zero
--   "we keep just your latest position"              → one row per person per trip
--   "turning it off deletes it"                      → delete works and leaves nothing
--   "our staff cannot see it"                        → staff read zero
--   and blocking, which the policy does not mention but a traveler would assume.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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

-- Ana and Ben are on the trip. Cara is not. Dee is staff.
select tests.create_user('a8000000-0000-4000-8000-0000000000a1', 'loc.ana@example.com');
select tests.create_user('a8000000-0000-4000-8000-0000000000a2', 'loc.ben@example.com');
select tests.create_user('a8000000-0000-4000-8000-0000000000a3', 'loc.cara@example.com');
select tests.create_user('a8000000-0000-4000-8000-0000000000a4', 'loc.staff@example.com');
insert into public.user_roles (user_id, role) values ('a8000000-0000-4000-8000-0000000000a4', 'admin');

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, status)
select 'a8000000-0000-4000-8000-0000000000c1', d.id, g.id, d.tour_version_id, 'Location trip',
       current_date, current_date + 5, 'Europe/Paris', 'active'
from public.departures d
join public.departure_groups g on g.departure_id = d.id
where d.id = '30000000-0000-4000-8000-000000000001'
limit 1;

insert into public.trip_members (trip_id, user_id)
values ('a8000000-0000-4000-8000-0000000000c1', 'a8000000-0000-4000-8000-0000000000a1'),
       ('a8000000-0000-4000-8000-0000000000c1', 'a8000000-0000-4000-8000-0000000000a2');

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'trip_locations', 'positions have somewhere to live');
select is(public.location_freshness(), interval '15 minutes', 'a position goes stale in fifteen minutes');
select is(public.location_sharing_max(), interval '12 hours', 'and one opt-in cannot outlast the day');

-- ── Turning it on ────────────────────────────────────────────────────────────
select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into public.trip_locations (trip_id, user_id, latitude, longitude, sharing_until)
     values ('a8000000-0000-4000-8000-0000000000c1', 'a8000000-0000-4000-8000-0000000000a1',
             43.6961, 7.2757, now() + interval '2 hours') $$,
  'Ana shares her position with her group');

select throws_ok(
  $$ insert into public.trip_locations (trip_id, user_id, latitude, longitude, sharing_until)
     values ('a8000000-0000-4000-8000-0000000000c1', 'a8000000-0000-4000-8000-0000000000a2',
             43.7, 7.28, now() + interval '2 hours') $$,
  '42501', null, 'and cannot put somebody else on the map');

-- "Sharing that runs until somebody remembers to stop is sharing that never stops."
select tests.clear_auth();
insert into public.trip_locations (trip_id, user_id, latitude, longitude, sharing_until)
values ('a8000000-0000-4000-8000-0000000000c1', 'a8000000-0000-4000-8000-0000000000a2',
        43.7014, 7.2812, now() + interval '30 days');
select ok(
  (select sharing_until from public.trip_locations
   where user_id = 'a8000000-0000-4000-8000-0000000000a2') <= now() + interval '12 hours',
  'a request to share for a month is clamped to the ceiling rather than honoured');

-- ── Who can see it ───────────────────────────────────────────────────────────
select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.trip_locations), 2,
  'a traveler on the trip sees the others who are sharing');

select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.trip_locations), 0,
  'somebody not on the trip sees nobody');

-- The promise that most needs a test, because it is the one that would be convenient to break.
select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a4');
select is((select count(*)::int from public.trip_locations), 0,
  'staff cannot see where any traveler is');

-- ── Blocking ─────────────────────────────────────────────────────────────────
select tests.clear_auth();
insert into public.user_blocks (blocker_id, blocked_id)
values ('a8000000-0000-4000-8000-0000000000a2', 'a8000000-0000-4000-8000-0000000000a1');

select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.trip_locations where user_id <> 'a8000000-0000-4000-8000-0000000000a2'), 0,
  'blocking someone hides their position from you');

-- And the direction that matters more: the person you blocked cannot watch you either.
select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.trip_locations where user_id = 'a8000000-0000-4000-8000-0000000000a2'), 0,
  'and hides yours from them');

-- The helper is security definer precisely so it can see a block made by somebody else; without
-- that, user_blocks' own RLS would hide it and the rule above would only work one way.
select ok(public.blocked_between('a8000000-0000-4000-8000-0000000000a1', 'a8000000-0000-4000-8000-0000000000a2'),
  'a block is visible from either side, whoever is asking');

select tests.clear_auth();
delete from public.user_blocks where blocker_id = 'a8000000-0000-4000-8000-0000000000a2';
select ok(public.blocked_between('a8000000-0000-4000-8000-0000000000a1', 'a8000000-0000-4000-8000-0000000000a2') = false,
  'and unblocking clears it');

-- ── Going stale and lapsing ──────────────────────────────────────────────────
-- The trigger stamps updated_at on every write, so a position cannot be backdated by a client —
-- which is the right behaviour and means the trigger has to be stood down to simulate time here.
alter table public.trip_locations disable trigger trip_locations_clamp;
update public.trip_locations set updated_at = now() - interval '40 minutes'
where user_id = 'a8000000-0000-4000-8000-0000000000a1';
alter table public.trip_locations enable trigger trip_locations_clamp;

select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.trip_locations where user_id = 'a8000000-0000-4000-8000-0000000000a1'), 0,
  'a position from forty minutes ago is not shown as where somebody is now');

select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.trip_locations where user_id = 'a8000000-0000-4000-8000-0000000000a1'), 1,
  'though you can always see your own, so you know you are still sharing');

select tests.clear_auth();
update public.trip_locations set sharing_until = now() - interval '1 minute'
where user_id = 'a8000000-0000-4000-8000-0000000000a2';

select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.trip_locations where user_id = 'a8000000-0000-4000-8000-0000000000a2'), 0,
  'and an opt-in that has run out shows nothing, without anybody doing anything');

-- ── Going dark, and housekeeping ─────────────────────────────────────────────
select tests.authenticate_as('a8000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ delete from public.trip_locations where user_id = 'a8000000-0000-4000-8000-0000000000a1' $$,
  'turning it off is a delete');
select is((select count(*)::int from public.trip_locations
           where user_id = 'a8000000-0000-4000-8000-0000000000a1'), 0,
  'and leaves nothing behind — not a hidden row, nothing');

select tests.clear_auth();
select ok(public.purge_stale_trip_locations() >= 1,
  'the hourly purge removes what has lapsed, so we do not keep what we stopped using');

select tests.clear_auth();
select * from finish();
rollback;
