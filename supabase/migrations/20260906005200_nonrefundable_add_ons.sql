-- Some extras cannot be given back once we have bought them. A Monaco grandstand seat is the clear
-- case: the ticket is issued in our travelers' names months ahead and the event does not take it
-- back, so a refund is money we simply lose. Until now every add-on had to name a number of days
-- before which it could still be cancelled, and the only way to express "never" was an absurdly
-- large number that would have printed as "free cancellation until 400 days before".
--
-- Null now means non-refundable from the moment it is bought, and the surfaces say exactly that.
-- Nothing changes for the add-ons that keep a number.

alter table public.departure_add_ons
  alter column cancellable_until_days_before drop not null;

comment on column public.departure_add_ons.cancellable_until_days_before is
  'Days before the add-on happens that it can still be cancelled for a full refund. Null means it is non-refundable once purchased — say so at the point of sale.';
