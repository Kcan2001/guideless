-- Seed, 2026-09-10 (third pass): a margin we can actually run a company on.
--
-- Seeds 080 and 083 priced every Monaco tier at landed cost × 1.30. That sounds like a 30% margin
-- and is not: a 1.30 multiple on cost is a 23% gross margin on the price, and out of that 23% comes
-- Stripe (about 3% of the whole price, so an eighth of the margin before anything else), refunds,
-- support, the app, and the free things we do together. On the Explorer rung it was $345 a traveler
-- to run a five-night trip. That is not a business.
--
-- The multiple is no longer one number, because the rungs are not one product.
--
--     price = (room cost for 5 nights + 150) × the tier's multiple
--
--   Explorer  × 1.45   the entry point, and the only rung anyone price-shops
--   Classic   × 1.55
--   Premium   × 1.60
--   Elite     × 1.60
--
-- Explorer stays deliberately keen. It is the shop window, it is the number on the tour card, and
-- it is the one a traveler can check against booking the same hotel themselves — so it has to be
-- defensible on price alone. Nothing above it is bought that way. Premium and Elite are not sold
-- against a cheaper Nice hotel; they are sold against the fact that eleven properties within 7 km
-- of the circuit had race-week availability and three of them are inside 1.5 km. You cannot
-- price-shop a thing that only exists three times. What the upper rungs actually sell is the group,
-- the app and the model, and those do not get cheaper because a room does.
--
-- The shared-room discount stays at cost pass-through (room ÷ 2 per traveler), so a pair
-- sharing still pays for one room and two of everything else and our margin per traveler is
-- untouched. Marking up the discount would claw back money from the thing we most want people to
-- do, which is travel together.
--
-- Explorer plus a three-day grandstand is $3,860 for five nights against about $3,550 for three
-- nights and one day elsewhere, so the entry point still reads as fair. Above that we are not the
-- cheapest and are not trying to be.
--
-- Room costs are unchanged and still the live LiteAPI figures:
--   Explorer   Hôtel & Appartements Monsigny 3★, Nice        1,000  → (1,150 × 1.45) =  1,667.5 → 1,670
--   Classic    Hôtel Petit Palais 4★, Nice                   1,870  → (2,020 × 1.55) =  3,131   → 3,130
--   Premium    Beausoleil aparthotel, 1.5 km from the track  5,094  → (5,244 × 1.60) =  8,390.4 → 8,390
--   Elite      Le Méridien Beach Plaza 4★, Monte Carlo      19,626  → (19,776 × 1.60) = 31,641.6 → 31,640
--
-- Gross margin on price: Explorer 31%, Classic 35%, Premium 37.5%, Elite 37.5%.

update public.departures set price_amount = 167000
where id = '30000000-0000-4000-8000-000000000004';

update public.tour_versions set starting_price_amount = 167000
where id = '21000000-0000-4000-8000-000000000002';

update public.departure_stay_options set price_delta_amount = 0        where id = '31000000-0000-4000-8000-000000000001'; -- Explorer, the base
update public.departure_stay_options set price_delta_amount = 146000   where id = '31000000-0000-4000-8000-000000000003'; -- Classic  3,130 − 1,670
update public.departure_stay_options set price_delta_amount = 672000   where id = '31000000-0000-4000-8000-000000000004'; -- Premium  8,390 − 1,670
update public.departure_stay_options set price_delta_amount = 2997000  where id = '31000000-0000-4000-8000-000000000002'; -- Elite   31,640 − 1,670

update public.departure_stay_options set
  why_price_note = 'Priced from a real available room for these dates at about $200 a night, plus the train pass, the welcome round and our margin. Breakfast is not included at this rung; it is at every other one.'
where id = '31000000-0000-4000-8000-000000000001';

-- ── Add-ons where the documented margin was too thin to survive a refund ─────
-- The race-viewing add-ons were priced one at a time and drifted apart. The yacht is the worst of
-- them: seed 050 records its cost at roughly $6,000 a head once Amber Lounge's 20% French VAT and
-- 3% card fee are added, against a $6,750 price — an 11% gross margin on the single most expensive,
-- least refundable thing we sell, where one cancellation wipes out the margin on eight bookings.
-- These move to the same 1.45 multiple on the cost the seed already recorded.
--
-- Grandstand K is left alone: its cost basis is a published 2027 face value plus about 9%, and at
-- $2,190 against roughly $1,690 it already carries a 23% margin. Raising it would push us past the
-- face value a traveler can look up, which is the one number on this trip they can check.
update public.departure_add_ons set
  price_amount = 870000,
  why_price_note = 'Amber Lounge charge a per-person day rate for race day and add 20% French VAT and a 3% card fee on top; that lands near $6,000 a head before we touch it. This is that plus our margin. It is the most expensive seat in Monaco and the price reflects it. Researched, not contracted: we hold no berth of our own.'
where id = '32000000-0000-4000-8000-000000000003';  -- yacht, race day: 6,750 → 8,700

update public.departure_add_ons set price_amount = 638000
where id = '32000000-0000-4000-8000-000000000006';  -- yacht, qualifying: 4,950 → 6,380

update public.departure_add_ons set
  price_amount = 1470000,
  why_price_note = 'Both yacht days bought together. It saves about $610 against booking the two days separately, and it is the only way to keep the same spot on the boat across the weekend.'
where id = '32000000-0000-4000-8000-000000000007';  -- yacht, both days: 11,400 → 14,700 (vs 15,080 separately)

update public.departure_add_ons set price_amount = 703000
where id = '32000000-0000-4000-8000-000000000002';  -- harbour terrace: 5,450 → 7,030

-- The evening events were priced at published entry ranges plus a booking fee that never had a
-- number behind it. Same multiple, so the whole catalogue is consistent and nothing is sold at a
-- level that cannot absorb a single no-show.
update public.departure_add_ons set price_amount = 218000 where id = '32000000-0000-4000-8000-000000000008'; -- Friday on the water   1,690 → 2,180
update public.departure_add_ons set price_amount = 295000 where id = '32000000-0000-4000-8000-000000000009'; -- Sunday after the flag 2,290 → 2,950
update public.departure_add_ons set price_amount =  25000 where id = '32000000-0000-4000-8000-000000000010'; -- Sass Café               195 →   250
update public.departure_add_ons set price_amount =  34000 where id = '32000000-0000-4000-8000-000000000011'; -- Buddha-Bar              265 →   340
update public.departure_add_ons set price_amount =  64000 where id = '32000000-0000-4000-8000-000000000012'; -- Twiga                   495 →   640
update public.departure_add_ons set price_amount =  51000 where id = '32000000-0000-4000-8000-000000000013'; -- Jimmy'z Saturday        395 →   510
update public.departure_add_ons set price_amount = 102000 where id = '32000000-0000-4000-8000-000000000014'; -- Amber Lounge Saturday   795 → 1,020
update public.departure_add_ons set price_amount =  44500 where id = '32000000-0000-4000-8000-000000000015'; -- Jimmy'z Sunday          345 →   445
update public.departure_add_ons set price_amount =  27000 where id = '32000000-0000-4000-8000-000000000004'; -- Friday coast boat       210 →   270

-- The airport transfer is a real cost we pay a driver, not a margin play: a private car from Nice
-- runs EUR 90–140. It moves with the rest but stays honest about what it is.
update public.departure_add_ons set price_amount = 19500
where id = '32000000-0000-4000-8000-000000000005';  -- 150 → 195

-- ── The ladder still has to be solvent at the new margin ─────────────────────
-- Margin is now 31–37.5% of price rather than 23%, so the 20% top rung has real headroom instead of
-- sitting a few points under the line: on Elite we would refund $6,328 against $11,864 of margin,
-- and the $19,776 room we have already bought is still covered twice over. The ladder is unchanged,
-- which is the point — the extra margin buys safety, not a bigger promise.
