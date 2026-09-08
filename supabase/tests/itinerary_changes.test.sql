-- pgTAP tests for migration 047: the change note, the replacement link, and the notification
-- that now carries the staff sentence instead of "Details changed."
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.create_user(uid uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
end $$;

select has_column('public', 'trip_itinerary_items', 'change_note', 'change_note exists');
select has_column('public', 'trip_itinerary_items', 'replaced_by_item_id', 'replaced_by_item_id exists');
select has_column('public', 'trip_itinerary_items', 'changed_at', 'changed_at exists');

-- ── Fixture: a trip with one traveler and two itinerary items ───────────────
select tests.create_user('a7000000-0000-4000-8000-0000000000e1', 'train.rider@example.com');

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
select 'a7000000-0000-4000-8000-000000007222'::uuid, d.id,
       (select g.id from public.departure_groups g where g.departure_id = d.id limit 1),
       d.tour_version_id, 'Change notice test trip', d.start_date, d.end_date, d.timezone, now()
from public.departures d where d.id = '30000000-0000-4000-8000-000000000004';

insert into public.trip_members (trip_id, user_id, member_role)
values ('a7000000-0000-4000-8000-000000007222', 'a7000000-0000-4000-8000-0000000000e1', 'traveler');

insert into public.trip_days (id, trip_id, day_number, date, timezone, title)
values ('a7000000-0000-4000-8000-0000000071d1', 'a7000000-0000-4000-8000-000000007222', 1, current_date + 30, 'Europe/Paris', 'Day one');

insert into public.trip_itinerary_items (id, trip_id, trip_day_id, position, type, title, start_time, timezone, location_name, visibility)
values ('a7000000-0000-4000-8000-0000000071a1', 'a7000000-0000-4000-8000-000000007222', 'a7000000-0000-4000-8000-0000000071d1',
        1, 'train', 'Nice → Monaco', '09:15', 'Europe/Paris', 'Nice-Ville station', 'trip_member'),
       ('a7000000-0000-4000-8000-0000000071a2', 'a7000000-0000-4000-8000-000000007222', 'a7000000-0000-4000-8000-0000000071d1',
        2, 'train', 'Nice → Monaco (replacement)', '09:32', 'Europe/Paris', 'Nice-Ville station, platform 2', 'trip_member');

-- ── Marking an item changed ─────────────────────────────────────────────────
select lives_ok(
  $$ update public.trip_itinerary_items
     set status = 'changed',
         change_note = 'Replaced by the 09:32 from platform 2. Your pass still covers it.',
         replaced_by_item_id = 'a7000000-0000-4000-8000-0000000071a2'
     where id = 'a7000000-0000-4000-8000-0000000071a1' $$,
  'staff mark an item changed with a note and a replacement');

select isnt(
  (select changed_at from public.trip_itinerary_items where id = 'a7000000-0000-4000-8000-0000000071a1'),
  null, 'changed_at is stamped automatically');

select is(
  (select replaced_by_item_id from public.trip_itinerary_items where id = 'a7000000-0000-4000-8000-0000000071a1'),
  'a7000000-0000-4000-8000-0000000071a2'::uuid, 'the replacement is linked');

-- ── The notification carries the staff sentence ─────────────────────────────
select is(
  (select body from public.notifications
   where trip_id = 'a7000000-0000-4000-8000-000000007222' and type = 'itinerary_change'
   order by created_at desc limit 1),
  'Replaced by the 09:32 from platform 2. Your pass still covers it.',
  'the traveler is told what actually changed, not "Details changed"');

select is(
  (select deep_link ->> 'replacedById' from public.notifications
   where trip_id = 'a7000000-0000-4000-8000-000000007222' and type = 'itinerary_change'
   order by created_at desc limit 1),
  'a7000000-0000-4000-8000-0000000071a2',
  'the notification links to the replacement item');

select is(
  (select title from public.notifications
   where trip_id = 'a7000000-0000-4000-8000-000000007222' and type = 'itinerary_change'
   order by created_at desc limit 1),
  'Updated: Nice → Monaco', 'the title still names the item');

-- ── Guard rails ─────────────────────────────────────────────────────────────
select throws_ok(
  $$ update public.trip_itinerary_items set replaced_by_item_id = id
     where id = 'a7000000-0000-4000-8000-0000000071a1' $$,
  '23514', null, 'an item cannot replace itself');

select throws_ok(
  $$ update public.trip_itinerary_items set change_note = repeat('x', 281)
     where id = 'a7000000-0000-4000-8000-0000000071a1' $$,
  '23514', null, 'the change note is capped at 280 characters');

select * from finish();
rollback;
