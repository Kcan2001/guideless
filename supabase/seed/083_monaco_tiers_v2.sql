-- Seed, 2026-09-10 (second pass): Premium becomes the Beausoleil aparthotel, deposits become
-- per-tier, and the cancellation ladder stops promising money we will not have.
--
-- WHAT EACH RUNG IS FOR, in Kyle's words, and the property that delivers it:
--
--   Explorer  cheap but decent            Hôtel & Appartements Monsigny 3★, Nice      $957–1,032
--   Classic   a 4★ outside Monaco, well priced   Hôtel Petit Palais 4★, Nice          $1,834–1,872
--   Premium   as close to the action as possible  Beausoleil aparthotel, 1.5 km       $5,094
--   Elite     inside the principality      Le Méridien Beach Plaza 4★, Monte Carlo    $18,652–19,626
--
-- A live search of every property within 7 km of the circuit returned ELEVEN with race-week
-- availability. Three of those are within 1.5 km: Le Méridien, the Riviera Marriott at Cap d'Ail
-- (dearer than Le Méridien, so useless to us), and this Beausoleil apartment. Beausoleil is the
-- commune directly above Monte Carlo — about 600 m from Casino Square, walk down to the circuit —
-- so it is genuinely the closest bed to the action that is not inside Monaco, and it is a self-
-- catering apartment with a terrace rather than a hotel room. That is the Premium rung exactly.
-- Menton, the previous Premium, is 7 km away and was chosen only because nothing nearer had rooms;
-- now that the tighter sweep has run, it is not the right answer.

insert into public.hotels
  (id, destination_id, name, slug, address, city, country_code, latitude, longitude,
   star_rating, description, image_urls, amenities, is_active)
values
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004',
   'La Rivière — Les Jardins d''Elisa', 'la-riviere-les-jardins-delisa',
   '8 Avenue de Verdun, 06240 Beausoleil', 'Beausoleil', 'FR', 43.746730, 7.427310, null,
   'An air-conditioned apartment in Beausoleil, the commune that sits directly above Monte Carlo — about 600 metres from Casino Square, and you walk down into the principality rather than taking a train. Private terrace with sea views, a full kitchenette, and Larvotto beach within reach. Not a hotel: this is the closest bed to the circuit that anyone can still get for race weekend.',
   array['https://static.cupid.travel/hotels/463637848.jpg','https://static.cupid.travel/hotels/hd/463638236.jpg','https://static.cupid.travel/hotels/hd/334616236.jpg'],
   array['Private terrace','Sea view','Kitchenette','Air conditioning','Lift','Parking','Private check-in','Non-smoking throughout','Pets allowed'],
   true)
on conflict (id) do update set
  address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude,
  description = excluded.description, image_urls = excluded.image_urls,
  amenities = excluded.amenities;

insert into public.hotel_supplier_mappings (hotel_id, supplier, supplier_hotel_id) values
  ('40000000-0000-4000-8000-000000000005', 'liteapi', 'lp6565b8a6')
on conflict (supplier, supplier_hotel_id, coalesce(supplier_room_id, '')) do nothing;

-- ── Premium, repriced onto Beausoleil ────────────────────────────────────────
--   (5094 + 150) * 1.30 = 6,817 → 6,815 charged, so a 5,320 delta over Explorer.
--   Sharing saves the room halved: 5094 / 2 = 2,545 each.
update public.departure_stay_options set
  name = 'Beausoleil, above Monte Carlo',
  tagline = 'The closest bed to the circuit anyone can still get.',
  description = 'An apartment in Beausoleil, the commune directly above Monte Carlo. About 600 metres from Casino Square and you walk down into the principality — no train on race morning, no queues at the station, and you are back in bed ten minutes after the podium. Private terrace, sea view, kitchenette. Of the eleven properties within 7 km of the circuit with race-week availability, only three are inside 1.5 km, and this is the one that is not a five-figure hotel room.',
  hotel_id = '40000000-0000-4000-8000-000000000005',
  destination_id = '10000000-0000-4000-8000-000000000004',
  area = 'Beausoleil, above Monte Carlo',
  price_delta_amount = 532000,
  shared_room_discount_amount = 254500,
  capacity = 6,
  includes = array['5 nights', 'Private terrace and sea view', 'Kitchenette', 'Walk down into Monaco', 'Train pass to Monaco'],
  excludes = array['Flights', 'Breakfast (it is an apartment)', 'Race tickets (choose below)'],
  why_price_note = 'Priced from the real available rate for these dates, about $1,019 a night, plus our margin. It costs more than a good hotel in Nice and a great deal less than a room inside Monaco, and what the money buys is the walk: this is 600 metres from Casino Square.',
  details = jsonb_build_object(
    'neighborhood', 'Beausoleil, directly above Monte Carlo',
    'station_distance', 'Walk down into Monaco, ~10 min',
    'train_time', 'None needed on race days',
    'breakfast', 'Not included — self-catering',
    'room_type', 'Apartment with terrace',
    'hotel_confirmed', false)
where id = '31000000-0000-4000-8000-000000000004';

update public.departure_tier_briefs set brief =
  'Beausoleil, the commune directly above Monte Carlo, about 600 m from Casino Square. This rung buys PROXIMITY, not the room: an apartment rather than a hotel, no breakfast, but you walk down into the principality instead of taking a train and you are home ten minutes after the podium. Researched, five nights: 5,094. Only three properties within 1.5 km of the circuit had race-week availability at all.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'premium';

update public.departure_tier_briefs set brief =
  'A four-star outside Monaco at a sensible price — on this weekend that means Nice, where supply is deep and the train is twenty minutes. This rung buys the ROOM and the address, not proximity. Researched band, five nights: 1,834-1,872.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'classic';

-- ── Deposits, per tier (migration 20260910000400) ────────────────────────────
-- The deposit covers what we cannot get back the moment a traveler confirms.
--
-- Nice has hundreds of available rooms for these dates and refundable rates among them, so we need
-- not commit early: the departure's $600 stands for Explorer and $1,000 is enough for Classic.
--
-- Beausoleil and Monte Carlo are different in kind. There is one of each, both non-refundable, and
-- if we do not buy the moment someone books, it is gone and the tier is undeliverable. So we buy
-- immediately, which means the deposit has to cover the room. It works out at about 77% of the
-- price on both, which is a lot to ask at booking — and is exactly why those two tiers carry the
-- insurance requirement most loudly.
update public.departure_stay_options set deposit_amount = null    where id = '31000000-0000-4000-8000-000000000001'; -- Explorer: departure default, $600
update public.departure_stay_options set deposit_amount = 100000  where id = '31000000-0000-4000-8000-000000000003'; -- Classic:  $1,000
update public.departure_stay_options set deposit_amount = 525000  where id = '31000000-0000-4000-8000-000000000004'; -- Premium:  $5,250 (room 5,094 + 150)
update public.departure_stay_options set deposit_amount = 1980000 where id = '31000000-0000-4000-8000-000000000002'; -- Elite:    $19,800 (room 19,626 + 150)

-- ── The cancellation ladder, made solvent ────────────────────────────────────
-- The old ladder returned 70% at 120 days. Every tier is priced at cost × 1.30, so our margin is
-- about 23% of the price on every rung — and because the rooms are non-refundable and bought at
-- confirmation, the rest of the money is gone the day the booking lands. Refunding 70% of a $25,700
-- booking means paying out $17,990 against $5,924 of margin: a $12,000 loss per cancellation, on
-- top of a room we still own.
--
-- Because the margin ratio is the same on every tier by construction, ONE percentage ladder is safe
-- across all four. The top rung is 20%, just inside that 23%.
--
-- This is a real reduction in what a traveler gets back and it should not be quietly shipped: it is
-- the honest number for a scarce, prepaid, non-refundable event weekend, and it is why travel
-- insurance is listed as a requirement rather than a suggestion on this trip.
update public.departures
set cancellation_policy = '[
  {"daysBeforeDeparture": 150, "refundPercentage": 20},
  {"daysBeforeDeparture": 90,  "refundPercentage": 12},
  {"daysBeforeDeparture": 45,  "refundPercentage": 5},
  {"daysBeforeDeparture": 0,   "refundPercentage": 0}
]'::jsonb
where id = '30000000-0000-4000-8000-000000000004';

update public.tour_requirements
set description = 'Not optional in spirit, whatever the law says. On this trip the hotel room and every race-viewing ticket are bought in your name and are non-refundable from the moment you confirm, so our cancellation ladder tops out at 20% and falls from there. A policy covers the gap between what we can return and what you paid. If you are on the Beausoleil or Monte Carlo tiers this matters most: those rooms are the scarcest on the Riviera that weekend and we buy them the day you book.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and title = 'Travel insurance';
