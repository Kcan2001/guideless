-- Whether a supplier is actually contracted, as a column rather than a habit.
--
-- Stay tiers have carried `details.hotel_confirmed` since migration 039, and the UI reads it to
-- say "property confirmed at booking" instead of implying we hold the room. Add-ons never got the
-- equivalent, so the only record that a $795 Amber Lounge ticket or a $2,190 grandstand seat is an
-- uncontracted estimate lived in prose inside `why_price_note` — unreadable by any code, and
-- therefore invisible to the page a traveler actually reads.
--
-- That is precisely the gap that let the Monte Carlo stay tier sit live at a quarter of cost: an
-- assumption nobody had to look at. A boolean forces the question at the point of sale.
--
-- Default false, deliberately. A row is uncontracted until somebody says otherwise, and the flag is
-- for staff to flip when a contract exists — not something a seed should quietly set to true.

alter table public.departure_add_ons
  add column supplier_confirmed boolean not null default false;

comment on column public.departure_add_ons.supplier_confirmed is
  'True only when we hold a contract or allocation with the supplier for this add-on. False means '
  'the price is researched, not agreed, and the UI must say so. Defaults false: prove it, do not '
  'assume it.';

-- The two boat parties and the race-viewing tiers predate this column and are equally uncontracted,
-- so nothing is flipped here. This statement exists to be explicit that the default is correct for
-- every existing row rather than an oversight.
--
--   update public.departure_add_ons set supplier_confirmed = true where id = '...';
--
-- is what a contract looks like when one is signed. Staff can do it from /admin.
