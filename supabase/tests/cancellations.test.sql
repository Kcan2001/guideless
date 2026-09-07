-- pgTAP tests for migration 034: cancellation requests and the public-form rate limiter.
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
  insert into public.profiles (id, display_name) values (uid, full_name) on conflict (id) do nothing;
end $$;

select tests.create_user('c1000000-0000-4000-8000-0000000000c1', 'hana@example.com', 'Hana');
select tests.create_user('c2000000-0000-4000-8000-0000000000c2', 'ivan@example.com', 'Ivan');
select tests.create_user('c3000000-0000-4000-8000-0000000000c3', 'ops@example.com', 'Ops Staff');
insert into public.user_roles (user_id, role) values ('c3000000-0000-4000-8000-0000000000c3', 'admin');

-- Hana holds a confirmed booking on the seeded departure (policy: 100% ≥60 days, then tiers).
update public.departures
set start_date = current_date + 90, end_date = current_date + 98, booking_deadline = current_date + 60, balance_due_date = current_date + 30,
    cancellation_policy = '[{"daysBeforeDeparture":60,"refundPercentage":100},{"daysBeforeDeparture":30,"refundPercentage":50},{"daysBeforeDeparture":0,"refundPercentage":0}]'::jsonb
where id = '30000000-0000-4000-8000-000000000001';
insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status, currency,
                             subtotal_amount, total_amount, deposit_amount, amount_paid)
values ('b2000000-0000-4000-8000-0000000000b2', 'GL-CANC01', 'c1000000-0000-4000-8000-0000000000c1',
        '30000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'confirmed', 'deposit_paid',
        'USD', 349500, 349500, 75000, 75000);
insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status, currency,
                             subtotal_amount, total_amount, deposit_amount, amount_paid, hold_expires_at)
values ('b3000000-0000-4000-8000-0000000000b3', 'GL-CANC02', 'c1000000-0000-4000-8000-0000000000c1',
        '30000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'pending_payment', 'unpaid',
        'USD', 349500, 349500, 75000, 0, now() + interval '30 minutes');

-- ── Requesting ───────────────────────────────────────────────────────────────
select tests.authenticate_as('c2000000-0000-4000-8000-0000000000c2');
select throws_ok(
  $$ select public.request_cancellation('b2000000-0000-4000-8000-0000000000b2', 'Not my booking') $$,
  'P0002', null, 'another customer cannot request a cancellation on a booking they do not own');

select tests.authenticate_as('c1000000-0000-4000-8000-0000000000c1');
select throws_ok(
  $$ select public.request_cancellation('b3000000-0000-4000-8000-0000000000b3', 'Changed my mind') $$,
  '23514', null, 'a booking that is not confirmed cannot be cancelled through the request flow');
select throws_ok(
  $$ select public.request_cancellation('b2000000-0000-4000-8000-0000000000b2', 'x') $$,
  '23514', null, 'a reason is required');
select lives_ok(
  $$ select public.request_cancellation('b2000000-0000-4000-8000-0000000000b2', 'Work moved my dates.') $$,
  'the owner of a confirmed booking can request a cancellation');
select is((select refund_percentage_quoted from public.cancellation_requests where booking_id = 'b2000000-0000-4000-8000-0000000000b2'),
  100, 'the refund tier for today is quoted on the request (90 days out → 100%)');
select throws_ok(
  $$ select public.request_cancellation('b2000000-0000-4000-8000-0000000000b2', 'Again') $$,
  '23505', null, 'only one open request per booking');
select is((select count(*)::int from public.notifications where type = 'cancellation_requested' and user_id = 'c1000000-0000-4000-8000-0000000000c1'),
  1, 'the customer is told the request was received');
select is((select count(*)::int from public.cancellation_requests), 1, 'the customer sees their own request through RLS');

-- Withdraw, then request again.
select ok(public.withdraw_cancellation_request((select id from public.cancellation_requests where status = 'pending')),
  'the customer can withdraw a pending request');
select lives_ok(
  $$ select public.request_cancellation('b2000000-0000-4000-8000-0000000000b2', 'Actually, yes.') $$,
  'a new request can be opened after withdrawing');

-- Another customer sees nothing; staff resolve.
select tests.authenticate_as('c2000000-0000-4000-8000-0000000000c2');
select is((select count(*)::int from public.cancellation_requests), 0, 'other customers see no requests (RLS)');
select throws_ok(
  $$ select public.resolve_cancellation_request((select id from public.cancellation_requests where status = 'pending'), 'approved', null) $$,
  '42501', null, 'customers cannot resolve requests');

select tests.clear_auth();
select tests.authenticate_as('c3000000-0000-4000-8000-0000000000c3');
select lives_ok(
  $$ select public.resolve_cancellation_request((select id from public.cancellation_requests where status = 'pending'), 'approved', 'Refund via Stripe') $$,
  'staff can approve a pending request');
select tests.clear_auth();

-- ── Rate limiter ─────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is(
  (select count(*) filter (where allowed)::int from (select public.check_rate_limit('test:form:abc', 3, 3600) as allowed from generate_series(1, 5)) s),
  3, 'the fixed-window limiter allows exactly the limit and refuses the rest');
select tests.clear_auth();

select * from finish();
rollback;
