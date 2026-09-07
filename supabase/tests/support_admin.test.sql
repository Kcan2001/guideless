-- pgTAP tests for the staff support inbox and trip document notifications (migration 035).
-- Run: pnpm db:test — inside a rolled-back transaction. Uses the seeded Southern France departure.

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
  insert into public.profiles (id, display_name) values (uid, full_name) on conflict (id) do nothing;
end $$;

-- Carol and Dan are customers; Sam is support staff.
select tests.create_user('c1000000-0000-4000-8000-0000000000c1', 'carol.s@example.com', 'Carol');
select tests.create_user('c2000000-0000-4000-8000-0000000000c2', 'dan.s@example.com', 'Dan');
select tests.create_user('c3000000-0000-4000-8000-0000000000c3', 'sam.support@example.com', 'Sam');
insert into public.user_roles (user_id, role) values ('c3000000-0000-4000-8000-0000000000c3', 'support');

-- A trip with Carol and Dan as members (fresh departure group on the seeded departure).
insert into public.departure_groups (id, departure_id, name, position)
values ('d1000000-0000-4000-8000-0000000000d1', '30000000-0000-4000-8000-000000000001', 'Support test group', 11);
insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone)
values ('d2000000-0000-4000-8000-0000000000d2', '30000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-0000000000d1',
        '21000000-0000-4000-8000-000000000001', 'Southern France · Support test', current_date + 20, current_date + 28, 'Europe/Paris');
insert into public.trip_members (trip_id, user_id) values
  ('d2000000-0000-4000-8000-0000000000d2', 'c1000000-0000-4000-8000-0000000000c1'),
  ('d2000000-0000-4000-8000-0000000000d2', 'c2000000-0000-4000-8000-0000000000c2');

-- Carol opens a thread and writes.
insert into public.support_threads (id, customer_id, trip_id, subject, category)
values ('d3000000-0000-4000-8000-0000000000d3', 'c1000000-0000-4000-8000-0000000000c1', 'd2000000-0000-4000-8000-0000000000d2', 'Hotel key card', 'hotel');
insert into public.support_messages (thread_id, sender_id, is_from_staff, body)
values ('d3000000-0000-4000-8000-0000000000d3', 'c1000000-0000-4000-8000-0000000000c1', false, 'My key card stopped working.');

-- ── Reading ──────────────────────────────────────────────────────────────────
select tests.authenticate_as('c3000000-0000-4000-8000-0000000000c3');
select is((select count(*)::int from public.support_threads where id = 'd3000000-0000-4000-8000-0000000000d3'), 1,
  'support staff can read a customer thread');
select tests.clear_auth();

select tests.authenticate_as('c2000000-0000-4000-8000-0000000000c2');
select is((select count(*)::int from public.support_threads where id = 'd3000000-0000-4000-8000-0000000000d3'), 0,
  'another customer cannot see the thread');
select is((select count(*)::int from public.support_messages where thread_id = 'd3000000-0000-4000-8000-0000000000d3'), 0,
  'nor its messages');
select tests.clear_auth();

-- ── Staff reply ──────────────────────────────────────────────────────────────
select tests.authenticate_as('c3000000-0000-4000-8000-0000000000c3');
select lives_ok($$
  insert into public.support_messages (thread_id, sender_id, is_from_staff, body)
  values ('d3000000-0000-4000-8000-0000000000d3', 'c3000000-0000-4000-8000-0000000000c3', true, 'A new card is at reception under your name.') $$,
  'support staff can reply');
select lives_ok($$
  insert into public.support_messages (thread_id, sender_id, is_from_staff, is_internal_note, body)
  values ('d3000000-0000-4000-8000-0000000000d3', 'c3000000-0000-4000-8000-0000000000c3', true, true, 'Called the hotel; sorted.') $$,
  'support staff can add an internal note');
select lives_ok($$
  update public.support_threads set assigned_to = 'c3000000-0000-4000-8000-0000000000c3', priority = 'high'
  where id = 'd3000000-0000-4000-8000-0000000000d3' $$,
  'support staff can assign the thread to themselves and set priority');
select tests.clear_auth();

select ok((select first_response_at is not null from public.support_threads where id = 'd3000000-0000-4000-8000-0000000000d3'),
  'the first staff reply stamps first_response_at');
select is((select status::text from public.support_threads where id = 'd3000000-0000-4000-8000-0000000000d3'), 'waiting_on_customer',
  'a staff reply moves the thread to waiting_on_customer');
select is((select count(*)::int from public.notifications where type = 'support_response' and user_id = 'c1000000-0000-4000-8000-0000000000c1'), 1,
  'the customer is notified once (the internal note is silent)');

-- The customer sees the reply but not the internal note.
select tests.authenticate_as('c1000000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.support_messages where thread_id = 'd3000000-0000-4000-8000-0000000000d3'), 2,
  'the customer sees their message and the staff reply, not the internal note');
select tests.clear_auth();

-- ── Trip documents notify the people they are for ────────────────────────────
insert into public.trip_documents (trip_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by)
values ('d2000000-0000-4000-8000-0000000000d2', 'hotel_confirmation', 'Nice hotel confirmation', 'trips/d2000000-0000-4000-8000-0000000000d2/a.pdf', 'application/pdf', 1200, 'c3000000-0000-4000-8000-0000000000c3');
select is((select count(*)::int from public.notifications where type = 'document_added' and trip_id = 'd2000000-0000-4000-8000-0000000000d2'), 2,
  'a group document notifies every member');

insert into public.trip_documents (trip_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by, for_user_id)
values ('d2000000-0000-4000-8000-0000000000d2', 'ticket', 'Dan train ticket', 'trips/d2000000-0000-4000-8000-0000000000d2/b.pdf', 'application/pdf', 900, 'c3000000-0000-4000-8000-0000000000c3', 'c2000000-0000-4000-8000-0000000000c2');
select is((select count(*)::int from public.notifications where type = 'document_added' and user_id = 'c2000000-0000-4000-8000-0000000000c2'), 2,
  'a personal document notifies only its traveler (Dan now has two)');
select is((select count(*)::int from public.notifications where type = 'document_added' and user_id = 'c1000000-0000-4000-8000-0000000000c1'), 1,
  'Carol was not told about Dan''s ticket');

insert into public.trip_documents (trip_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by, visibility)
values ('d2000000-0000-4000-8000-0000000000d2', 'other', 'Staff rooming list', 'trips/d2000000-0000-4000-8000-0000000000d2/c.pdf', 'application/pdf', 500, 'c3000000-0000-4000-8000-0000000000c3', 'staff_only');
select is((select count(*)::int from public.notifications where type = 'document_added' and trip_id = 'd2000000-0000-4000-8000-0000000000d2'), 3,
  'staff-only documents notify nobody');

select * from finish();
rollback;
