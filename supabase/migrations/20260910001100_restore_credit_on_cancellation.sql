-- Account credit comes back when a booking is cancelled.
--
-- Until now it did not. `booking_status_effects` inserts a NEGATIVE `account_credits` row with
-- source `redemption` when a booking confirms, and nothing ever reversed it. So a traveler who put
-- $100 of referral credit toward a trip and cancelled ninety days out — the tier that refunds 90%
-- of the money — got 90% of the card payment back and 0% of the credit. The credit was not part of
-- `amount_paid`, so `previewRefund` never saw it and the account page never mentioned it.
--
-- That is indefensible in both directions. It is punitive to the customer, and it costs us nothing
-- to fix: credit is a discount on a future trip, not money. Returning it in full when the trip it
-- was spent on does not happen is what the balance meant in the first place, and it is what the
-- Terms can then say out loud.
--
-- A separate trigger rather than an edit to `booking_status_effects`: that function is long, has
-- been redefined twice already, and this rule is independent of everything in it.

create or replace function public.restore_credit_on_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_net bigint;
begin
  if new.status not in ('cancelled', 'refunded') then return new; end if;
  if old.status in ('cancelled', 'refunded') then return new; end if;

  -- The net of every redemption row for this booking: negative while credit is still spent, zero
  -- once it has been returned. Summing rather than reading one row makes this idempotent, so a
  -- booking that goes cancelled → refunded does not hand the credit back twice.
  select coalesce(sum(amount), 0) into v_net
  from public.account_credits
  where booking_id = new.id and source = 'redemption';

  if v_net < 0 then
    insert into public.account_credits (user_id, amount, currency, source, booking_id, note)
    values (new.customer_id, -v_net, new.currency, 'redemption', new.id,
            'Returned to your balance when this booking was cancelled');
  end if;

  return new;
end;
$$;

revoke execute on function public.restore_credit_on_cancellation() from public, anon, authenticated;

comment on function public.restore_credit_on_cancellation() is
  'Puts redeemed account credit back on the balance when a booking is cancelled or refunded. '
  'Credit is a discount on a future trip, not money, so it is returned in full rather than at the '
  'refund tier percentage — the tier governs the card payment. Idempotent: it settles the net of '
  'the redemption rows for the booking rather than mirroring one of them.';

drop trigger if exists bookings_restore_credit on public.bookings;
create trigger bookings_restore_credit
  after update of status on public.bookings
  for each row execute function public.restore_credit_on_cancellation();
