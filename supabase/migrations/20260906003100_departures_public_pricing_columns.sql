-- 032_departures_public_pricing_columns
-- Expose the two customer-facing pricing knobs added in 029/030 through the public view so the
-- marketing pages can state "share and save $350" and "group opens 30 days out" without quoting.
-- (create or replace view may only append columns, which is what we do.)
create or replace view public.departures_public
with (security_invoker = true) as
select id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity,
       minimum_travelers, price_amount, deposit_amount, currency, booking_deadline,
       balance_due_date, cancellation_policy, created_at, updated_at,
       shared_room_discount_amount, group_opens_days_before
from public.departures;
