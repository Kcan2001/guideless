-- LiteAPI offer ids do not fit in 200 characters, and nothing could store a rate until they did.
--
-- `hotel_rates.supplier_rate_id` was capped at 200 chars, which is a reasonable guess for an
-- opaque id and wrong for this supplier. LiteAPI's `offerId` is not a key into their database, it
-- is the offer itself, encoded — measured against the live API on 2026-09-10 across one hotel and
-- one date range it ran 1,156 to 1,276 characters. Every insert therefore failed:
--
--   23514 · new row for relation "hotel_rates" violates check constraint
--           "hotel_rates_supplier_rate_id_check"
--
-- Which is the second reason `hotel_rates` was empty in production. The first was that the adapter
-- sent `children` as a count where LiteAPI wants an array of ages, so the request 400'd before it
-- ever reached this constraint. Both were invisible because the cron endpoint reduced any thrown
-- non-Error to the word "failed" — a Supabase PostgrestError is a plain object, so the constraint
-- name, the code and the failing row were all being thrown away. That is fixed alongside this.
--
-- 4000 rather than something snug: the id is a serialised offer, so its length is a function of how
-- much the supplier chooses to put in it and will grow when they add a field. There is no cost to
-- headroom on a text column, and another round of this would be silly.
--
-- `hotel_bookings.supplier_booking_id` keeps its 200: a booking reference really is a short key,
-- and LiteAPI's is. Widening it would only hide a future surprise.

alter table public.hotel_rates
  drop constraint if exists hotel_rates_supplier_rate_id_check;

alter table public.hotel_rates
  add constraint hotel_rates_supplier_rate_id_check
    check (char_length(supplier_rate_id) between 1 and 4000);

comment on column public.hotel_rates.supplier_rate_id is
  'The supplier handle used to re-price and book this rate. For LiteAPI this is the offerId, which '
  'is a serialised offer of roughly 1,200 characters rather than a short key — hence the 4000 cap.';

-- ── Commission can be negative, and that is worth knowing ────────────────────
-- `supplier_commission_amount >= 0` assumed a commission is always something we earn. LiteAPI
-- returns a negative figure on some rates — 1 of 14 on a single Nice hotel for the Monaco dates —
-- which means selling that rate at the quoted retail earns us LESS than the net we pay. That is
-- precisely the number a pricing system must not lose, and the check was throwing the whole row
-- away rather than recording it.
--
-- The floor goes, the column stays nullable, and a negative value is now storable so
-- compare.ts can score against it instead of never seeing the rate at all.
alter table public.hotel_rates
  drop constraint if exists hotel_rates_supplier_commission_amount_check;

comment on column public.hotel_rates.supplier_commission_amount is
  'What the supplier pays us on this rate, in minor units. May be NEGATIVE: some rates sell below '
  'the net we are charged, and that has to be visible rather than rejected. Null when not disclosed.';
