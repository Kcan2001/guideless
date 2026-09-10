-- Seed, 2026-09-10 (fourth pass): put the Monaco pricing formula in columns so it can be executed.
--
-- Seeds 080–084 recorded the arithmetic in comments. Migration 20260910000600 gave the tiers
-- somewhere to keep it, and this fills it in, which is what lets the Trip Builder re-derive a real
-- price from a live supplier rate rather than showing whatever a human last typed.
--
--     price = (room cost for the five nights + fixed_cost_amount) × cost_multiple
--
-- fixed_cost_amount is $150 on every rung: the Nice↔Monaco regional train pass, the welcome round,
-- and per-traveler operations. It does not vary by tier because none of those things do.
--
-- cost_multiple is per tier and is the decision from 084: Explorer is the entry point and the only
-- rung anyone price-shops, so it stays keen; nothing above it is bought on price.
--
-- auto_price is opt-in and is set here ONLY for this departure. Southern France keeps its hand-set
-- prices: its rooms are abundant and refundable, its margin is comfortable, and there is no reason
-- to let a supplier move a price that is not under pressure.

update public.departure_stay_options set
  fixed_cost_amount = 15000,
  auto_price = true,
  cost_multiple = 1.45,
  priced_room_amount = 100000,   -- Hôtel & Appartements Monsigny, observed 2026-09-10
  priced_at = now()
where id = '31000000-0000-4000-8000-000000000001';   -- Explorer

update public.departure_stay_options set
  fixed_cost_amount = 15000,
  auto_price = true,
  cost_multiple = 1.55,
  priced_room_amount = 187000,   -- Hôtel Petit Palais
  priced_at = now()
where id = '31000000-0000-4000-8000-000000000003';   -- Classic

update public.departure_stay_options set
  fixed_cost_amount = 15000,
  auto_price = true,
  cost_multiple = 1.60,
  priced_room_amount = 509400,   -- Beausoleil aparthotel
  priced_at = now()
where id = '31000000-0000-4000-8000-000000000004';   -- Premium

update public.departure_stay_options set
  fixed_cost_amount = 15000,
  auto_price = true,
  cost_multiple = 1.60,
  priced_room_amount = 1962600,  -- Le Méridien Beach Plaza
  priced_at = now()
where id = '31000000-0000-4000-8000-000000000002';   -- Elite
