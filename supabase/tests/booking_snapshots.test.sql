-- pgTAP tests for migration 041: purchased-item snapshots, the 'stay' line item and the payment
-- notifications. Uses the Monaco seed (departure 30000000-…-0004: $1,890 own room, $500 deposit,
-- Nice tier +$0, Monaco tier +$3,950; Grandstand K $1,290 per traveler; transfer $120 per booking).
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

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

select tests.create_user('f1000000-0000-4000-8000-0000000000f1', 'snap@example.com');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_column('public', 'booking_add_ons', 'title_snapshot', 'booking_add_ons.title_snapshot exists');
select lives_ok(
  $$ insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency)
     select id, 'stay', 'Stay: probe', 1, 0, 0, currency from public.bookings limit 0 $$,
  'booking_items accepts kind = stay');

-- ── A Monaco booking on the Monaco tier with two add-ons ─────────────────────
select tests.authenticate_as('f1000000-0000-4000-8000-0000000000f1');

create temporary table snap_booking as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000004',
  '[{"firstName":"Kyle","lastName":"Tester","email":"snap@example.com","dateOfBirth":"1987-08-23","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb,
  '{"airportTransfer":"own_arrangement"}'::jsonb,
  'deposit', 'v1',
  '31000000-0000-4000-8000-000000000002',
  '[{"addOnId":"32000000-0000-4000-8000-000000000001","travelerIndexes":[1]},
    {"addOnId":"32000000-0000-4000-8000-000000000005","quantity":1}]'::jsonb,
  null, null);

select is((select total_amount from snap_booking), 725000::bigint,
  'total = base 1,890 + Monaco tier 3,950 + Grandstand K 1,290 + transfer 120');

select is(
  (select unit_amount from public.booking_items where booking_id = (select booking_id from snap_booking) and kind = 'base'),
  189000::bigint, 'base line carries the departure price without the tier delta');
select is(
  (select row(kind, quantity, unit_amount, total_amount)::text from public.booking_items
   where booking_id = (select booking_id from snap_booking) and kind = 'stay'),
  '(stay,1,395000,395000)', 'stay line = delta × travelers');
select is(
  (select metadata ->> 'stay_option_id' from public.booking_items where booking_id = (select booking_id from snap_booking) and kind = 'stay'),
  '31000000-0000-4000-8000-000000000002', 'stay line remembers the option');
select is(
  (select metadata ->> 'tier' from public.booking_items where booking_id = (select booking_id from snap_booking) and kind = 'stay'),
  (select tier::text from public.departure_stay_options where id = '31000000-0000-4000-8000-000000000002'),
  'stay line snapshots the tier as sold');
select is(
  ((select sum(total_amount) from public.booking_items where booking_id = (select booking_id from snap_booking) and kind in ('base', 'stay'))
    + (select sum(total_amount) from public.booking_add_ons where booking_id = (select booking_id from snap_booking)))::bigint,
  (select subtotal_amount from public.bookings where id = (select booking_id from snap_booking)),
  'base + stay + add-ons = booking subtotal, to the cent');
select is(
  (select title_snapshot from public.booking_add_ons where booking_id = (select booking_id from snap_booking)
     and add_on_id = '32000000-0000-4000-8000-000000000001'),
  (select title from public.departure_add_ons where id = '32000000-0000-4000-8000-000000000001'),
  'add-on title snapshotted at booking');

-- ── Catalog edits never rewrite what was sold ────────────────────────────────
select tests.clear_auth();
update public.departure_add_ons set title = 'Grandstand K (renamed after sale)' where id = '32000000-0000-4000-8000-000000000001';
update public.bookings set status = 'confirmed', payment_status = 'deposit_paid', amount_paid = 50000 + 129000 + 12000
where id = (select booking_id from snap_booking);

select is(
  (select title from public.booking_items where booking_id = (select booking_id from snap_booking)
     and kind = 'add_on' and metadata ->> 'add_on_id' = '32000000-0000-4000-8000-000000000001'),
  (select title_snapshot from public.booking_add_ons where booking_id = (select booking_id from snap_booking)
     and add_on_id = '32000000-0000-4000-8000-000000000001'),
  'confirmed add-on line item uses the snapshot, not the renamed catalog title');
select isnt(
  (select title from public.booking_items where booking_id = (select booking_id from snap_booking)
     and kind = 'add_on' and metadata ->> 'add_on_id' = '32000000-0000-4000-8000-000000000001'),
  'Grandstand K (renamed after sale)', 'the rename did not leak into the booking');

-- ── Included tier: a zero stay line, base untouched ──────────────────────────
select tests.authenticate_as('f1000000-0000-4000-8000-0000000000f1');
create temporary table snap_nice as
select * from public.create_booking(
  '30000000-0000-4000-8000-000000000004',
  '[{"firstName":"Kyle","lastName":"Tester","dateOfBirth":"1987-08-23","nationality":"US"}]'::jsonb,
  '{"name":"Pat","relationship":"Friend","phone":"+14155550123"}'::jsonb, '{}'::jsonb,
  'deposit', 'v1', '31000000-0000-4000-8000-000000000001', '[]'::jsonb, null, null);
select is((select total_amount from snap_nice), 189000::bigint, 'Nice tier: total = base price');
select is(
  (select row(quantity, unit_amount, total_amount)::text from public.booking_items where booking_id = (select booking_id from snap_nice) and kind = 'stay'),
  '(1,0,0)', 'included tier still gets a zero stay line for the record');
select is(
  (select unit_amount from public.booking_items where booking_id = (select booking_id from snap_nice) and kind = 'base'),
  189000::bigint, 'base line unchanged when the tier is included');

-- ── Payment notifications ────────────────────────────────────────────────────
select tests.clear_auth();
select is(public.notify_booking_paid((select booking_id from snap_booking), 'pi_snapshot_test_1', 'deposit'), true,
  'first notification for a payment intent is written');
select is(public.notify_booking_paid((select booking_id from snap_booking), 'pi_snapshot_test_1', 'deposit'), false,
  'the same payment intent is not notified twice');
select is(
  (select row(type, title, deep_link ->> 'kind')::text from public.notifications
   where user_id = 'f1000000-0000-4000-8000-0000000000f1' and dedupe_key = 'payment:pi_snapshot_test_1'),
  '(booking_confirmed,"Your trip is confirmed",payment)', 'confirmation notification shape');
select is(public.notify_booking_paid((select booking_id from snap_booking), 'pi_snapshot_test_2', 'balance'), true,
  'a balance payment notifies too');
select is(
  (select title from public.notifications where dedupe_key = 'payment:pi_snapshot_test_2'),
  'Payment received', 'balance payments say "Payment received"');

-- Add-on bought later: confirm_add_on_purchase writes "Added to your trip".
select tests.authenticate_as('f1000000-0000-4000-8000-0000000000f1');
create temporary table snap_purchase as
select * from public.start_add_on_purchase((select booking_id from snap_booking),
  '[{"addOnId":"32000000-0000-4000-8000-000000000004","travelerIndexes":[1]}]'::jsonb);
select tests.clear_auth();
select ok(public.confirm_add_on_purchase((select purchase_id from snap_purchase), (select amount from snap_purchase), 'pi_snapshot_test_3', 'cs_snapshot_test_3'),
  'add-on purchase confirms');
select is(
  (select row(type, title)::text from public.notifications where dedupe_key = 'payment:pi_snapshot_test_3'),
  '(add_on_confirmed,"Added to your trip")', 'add-on purchase notifies the owner once');

select * from finish();
rollback;
