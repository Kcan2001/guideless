-- pgTAP tests for migration 20260910001100: redeemed account credit comes back when a booking is
-- cancelled.
--
-- The bug this covers was silent and one-directional. Credit was spent at confirmation as a
-- negative `account_credits` row, and nothing reversed it, so a traveler who put $100 of credit
-- toward a trip and cancelled at the 90% tier got 90% of the card payment and none of the credit.
-- `previewRefund` could not even see it, because credit is not part of `amount_paid`.
--
-- Also covered: the restore is idempotent. A booking that goes cancelled and then refunded must
-- not hand the credit back twice. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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

select tests.create_user('fa000000-0000-4000-8000-0000000000c1', 'credit.restore@example.com');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_function('public', 'restore_credit_on_cancellation', 'the restore function exists');
select has_trigger('public', 'bookings', 'bookings_restore_credit', 'the trigger is on bookings');

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- $150 of credit granted, a booking that spends $100 of it, confirmed.
insert into public.account_credits (user_id, amount, currency, source, note)
values ('fa000000-0000-4000-8000-0000000000c1', 15000, 'USD', 'manual', 'Test grant');

insert into public.bookings
  (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status,
   currency, subtotal_amount, total_amount, deposit_amount, amount_paid, hold_expires_at)
values ('fa100000-0000-4000-8000-000000000001', 'GL-CREDIT1',
        'fa000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', 'pending_payment', 'unpaid',
        'USD', 300000, 300000, 75000, 0, now() + interval '30 minutes');

insert into public.account_credits (user_id, amount, currency, source, booking_id, note)
values ('fa000000-0000-4000-8000-0000000000c1', -10000, 'USD', 'redemption',
        'fa100000-0000-4000-8000-000000000001', 'Applied at checkout');

select is(public.account_credit_balance('fa000000-0000-4000-8000-0000000000c1', 'USD'), 5000::bigint,
  'spending $100 of $150 leaves $50 on the balance');

-- ── Cancelling returns it ────────────────────────────────────────────────────
update public.bookings set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
where id = 'fa100000-0000-4000-8000-000000000001';

select is(public.account_credit_balance('fa000000-0000-4000-8000-0000000000c1', 'USD'), 15000::bigint,
  'cancelling returns the redeemed credit in full');
select is(
  (select count(*)::int from public.account_credits
    where booking_id = 'fa100000-0000-4000-8000-000000000001' and source = 'redemption'),
  2, 'the return is a new row, so the original redemption stays auditable');

-- ── Idempotence ──────────────────────────────────────────────────────────────
update public.bookings set status = 'refunded'
where id = 'fa100000-0000-4000-8000-000000000001';

select is(public.account_credit_balance('fa000000-0000-4000-8000-0000000000c1', 'USD'), 15000::bigint,
  'cancelled then refunded does not return the credit twice');

-- ── A booking that spent no credit ───────────────────────────────────────────
insert into public.bookings
  (id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status,
   currency, subtotal_amount, total_amount, deposit_amount, amount_paid, hold_expires_at)
values ('fa100000-0000-4000-8000-000000000002', 'GL-CREDIT2',
        'fa000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', 'pending_payment', 'unpaid',
        'USD', 300000, 300000, 75000, 0, now() + interval '30 minutes');
update public.bookings set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
where id = 'fa100000-0000-4000-8000-000000000002';

select is(public.account_credit_balance('fa000000-0000-4000-8000-0000000000c1', 'USD'), 15000::bigint,
  'cancelling a booking that spent no credit changes nothing');

select * from finish();
rollback;
