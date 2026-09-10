-- Seed, 2026-09-10: requirements, Monaco repriced from real supplier rates, a different event
-- every night, and the Explore content for Monaco.
--
-- WHY THIS FILE EXISTS
-- The Monte Carlo stay tier was live at a +$4,450 delta for five nights. A live LiteAPI query for
-- the exact trip dates (2027-06-02 → 06-07) returned exactly one available property inside the
-- principality, Le Méridien Beach Plaza, at USD 18,652–19,626 for those five nights. A control
-- query two weeks later returned the same hotel at USD 2,868. That is 6.5x, and it matches the
-- published figure that walkable Monaco properties average ~$4,427 a night in race week. We were
-- selling a $19,600 room for $4,450 on top of a $2,450 base.
--
-- Every number below is either an observed rate from that query or is derived from one. The
-- derivation is the same in each case and is stated once here:
--
--     price = (room cost for 5 nights + 150) * 1.30
--
-- The 150 is the non-room cost already inside the base price: the Nice↔Monaco regional train pass,
-- the welcome round, and per-traveler operations. The 1.30 is our margin. The shared-room discount
-- is the room cost divided by two, so a pair sharing pays for one room and two of everything else
-- and our margin per traveler is unchanged — rooms price per room, not per person, which the same
-- query confirmed (two adults sharing came back within about 1% of one adult).
--
-- WHAT IS NOT VERIFIED. The nightlife below is priced from published entry ranges, not from an API
-- and not from a contract; no Monaco venue offers either. Read the why_price_note on each.

-- ── Requirements (migration 20260910000100) ──────────────────────────────────
update public.tour_versions set minimum_age = 18
where id in ('21000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002');

insert into public.tour_requirements (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000002', 1, 'A passport valid for six months beyond your return date',
   'Monaco is not in the Schengen Area but is reached through France, so you clear French border control. Most non-EU nationals need a passport with at least six months of validity left on 7 June 2027. Check your own government''s advice for visas; we cannot do that for you.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'You must be 18 or over',
   'Everyone on this trip books their own room by default, the group moments run late, and the race-viewing and evening add-ons are all licensed venues with their own age checks. We do not take under-18s on this departure, with or without a parent.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'Travel insurance',
   'Strongly recommended and, for this trip, close to essential: race-week rooms and race viewing are non-refundable from purchase, so a cancellation is a loss the policy covers and we cannot.'),
  ('21000000-0000-4000-8000-000000000001', 1, 'A passport valid for six months beyond your return date',
   'France is in the Schengen Area. Most non-EU nationals need a passport with at least six months of validity left on your return date, and from 2027 an ETIAS authorisation as well. Check your own government''s advice for visas; we cannot do that for you.'),
  ('21000000-0000-4000-8000-000000000001', 2, 'You must be 18 or over',
   'Everyone books their own room by default, the wine afternoon is a tasting, and the trip is built around travelers exploring three cities independently. We do not take under-18s.'),
  ('21000000-0000-4000-8000-000000000001', 3, 'Travel insurance',
   'Recommended. Our cancellation ladder is generous early and falls away as our own commitments become non-recoverable; a policy covers the gap.')
on conflict do nothing;

-- ── Monaco, repriced ─────────────────────────────────────────────────────────
-- Explorer is now a genuinely cheap Nice room rather than the port 3-star, because the bottom rung
-- should be the value play. Observed and available for these dates: Hôtel & Appartements Monsigny
-- 3* at 957, Esatitude 3* at 1,023, Odalys City Nice Centre 3* at 1,032. Priced off 1,000.
--   (1000 + 150) * 1.30 = 1,495
update public.departures set
  price_amount = 149500,
  shared_room_discount_amount = 50000
where id = '30000000-0000-4000-8000-000000000004';

update public.tour_versions set starting_price_amount = 149500
where id = '21000000-0000-4000-8000-000000000002';

update public.departure_stay_options set
  name = 'Nice, on a budget',
  tagline = 'The cheapest bed that is still a real hotel.',
  description = 'A simple, central three-star in Nice: clean, well reviewed, ten minutes from Nice-Ville for the train to the circuit. No view and no bar. Every dollar you do not spend here is a dollar for the weekend itself.',
  price_delta_amount = 0,
  shared_room_discount_amount = 50000,
  capacity = 28,
  includes = array['5 nights', 'Train pass Nice to Monaco', 'Property named at booking'],
  excludes = array['Flights', 'Breakfast', 'Race tickets (choose below)'],
  why_price_note = 'Priced from a real available room for these dates at about $200 a night, plus the train pass, the welcome round and our margin. Breakfast is not included at this rung; it is at every other one.',
  details = jsonb_build_object(
    'neighborhood', 'Nice centre',
    'station_distance', '10-15 min to Nice-Ville',
    'train_time', '20-25 min Nice to Monaco',
    'breakfast', 'Not included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false)
where id = '31000000-0000-4000-8000-000000000001';

-- Elite: the only property inside Monaco with availability for these dates.
--   (19626 + 150) * 1.30 = 25,709 → 25,700 price, so a 24,205 delta over Explorer
update public.departure_stay_options set
  name = 'Monaco, Monte Carlo',
  tagline = 'The only rooms left inside the principality.',
  description = 'Five nights in a four-star on the water in Monte Carlo, walking distance to the circuit. This is not a luxury upsell; it is what a room inside Monaco costs on race weekend, and there is almost none of it. A live search of 1,030 properties within 15 km found one available inside Monaco for these dates.',
  price_delta_amount = 2420500,
  shared_room_discount_amount = 981000,
  capacity = 4,
  includes = array['5 nights inside Monaco', 'Breakfast', 'Walk to the circuit', 'Property confirmed at booking'],
  excludes = array['Flights', 'Race tickets (choose below)'],
  why_price_note = 'Race-week rates inside Monaco run six to seven times the ordinary rate. The same hotel that costs about $575 a night a fortnight later costs about $3,900 a night on race weekend. We price the room at cost plus our usual margin and nothing more; the number is large because the room is.',
  details = jsonb_build_object(
    'neighborhood', 'Monte Carlo',
    'station_distance', 'Walking distance to the circuit',
    'train_time', 'None needed on race days',
    'breakfast', 'Included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false)
where id = '31000000-0000-4000-8000-000000000002';

-- Classic: a good Nice hotel with breakfast. Observed and available: Hotel Khla 1,834, Ibis Styles
-- Nice Centre Gare 1,845, La Villa Nice Victor Hugo 1,866, Hôtel Petit Palais 4* 1,872. Off 1,870.
--   (1870 + 150) * 1.30 = 2,626 → 2,625 price, so a 1,130 delta
--
-- Premium: there is no sellable tier inside Monaco below Elite. Monaco's own aparthotels are in the
-- supplier catalogue but every one of them had zero availability for these dates. The nearest real
-- thing is the coast the other side of the principality, ten minutes by train: Roquebrune-Cap-
-- Martin at 1,845-2,446 and Menton from 692. Priced off 2,450.
--   (2450 + 150) * 1.30 = 3,380 → 3,380 price, so a 1,885 delta
insert into public.departure_stay_options
  (id, departure_id, name, tagline, description, hotel_name, area, star_rating, destination_id,
   price_delta_amount, shared_room_discount_amount, capacity, position, is_default, tier,
   includes, excludes, why_price_note, details, image_urls)
values
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004',
   'Nice, the good one',
   'A proper hotel, breakfast, and the old town at the door.',
   'A well-reviewed three or four-star in central Nice with breakfast included. The step up from Explorer is the room, the address and the morning: you walk out into the old town rather than onto a main road.',
   null, 'Nice centre / Old Town', null, '10000000-0000-4000-8000-000000000001',
   113000, 93500, 12, 2, false, 'classic',
   array['5 nights', 'Breakfast', 'Train pass Nice to Monaco', 'Property named at booking'],
   array['Flights', 'Race tickets (choose below)'],
   'Priced from real available breakfast-included rooms for these dates, around $375 a night, plus the train pass, the welcome round and our margin.',
   jsonb_build_object(
     'neighborhood', 'Nice centre / Old Town',
     'station_distance', '10-15 min to Nice-Ville',
     'train_time', '20-25 min Nice to Monaco',
     'breakfast', 'Included',
     'room_type', 'Double or twin',
     'hotel_confirmed', false),
   array['/photos/nice-old-town-evening.jpg', '/photos/nice-promenade-dusk.jpg']),

  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004',
   'On the Monaco border',
   'Ten minutes by train, a fraction of the Monaco price.',
   'Roquebrune-Cap-Martin or Menton, on the coast the other side of the principality. The train into Monaco takes about ten minutes, the sea is better than in Nice, and you are close enough to get back late. The honest middle rung: not inside Monaco, but a great deal nearer than Nice.',
   null, 'Roquebrune-Cap-Martin / Menton', null, '10000000-0000-4000-8000-000000000004',
   188500, 122500, 6, 3, false, 'premium',
   array['5 nights', 'Breakfast', 'Train pass to Monaco', 'Property named at booking'],
   array['Flights', 'Race tickets (choose below)'],
   'Priced from real available rooms on the border for these dates, around $490 a night. Worth saying plainly: this is not inside Monaco. Nothing unremarkable inside Monaco is available on this weekend at any price, so the middle rung is the coast next to it.',
   jsonb_build_object(
     'neighborhood', 'Roquebrune-Cap-Martin / Menton',
     'station_distance', 'Walk to the local station',
     'train_time', '~10 min to Monaco',
     'breakfast', 'Included',
     'room_type', 'Double or twin',
     'hotel_confirmed', false),
   array['/photos/monaco-harbour-rock.jpg'])
on conflict (id) do nothing;

-- The tier brief promised "Monaco itself, in something unremarkable" for Premium. Real inventory
-- cannot deliver that on this weekend, so the brief has to say what we can actually buy.
update public.departure_tier_briefs set brief =
  'The coast immediately the other side of the principality — Roquebrune-Cap-Martin, Menton — about ten minutes by train. NOT inside Monaco: a live search found no ordinary Monaco property with race-week availability at any price, so this rung buys proximity and a better coastline instead of an address. Researched band, five nights: 1,845-2,450.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'premium';

update public.departure_tier_briefs set brief =
  'A simple central three-star in Nice, around 200 a night, plus the train to the circuit. The value play: spend on the weekend rather than the room. No breakfast at this rung. Researched band, five nights: 957-1,032.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'explorer';

update public.departure_tier_briefs set brief =
  'A good Nice hotel with breakfast, around 375 a night, same train. Buys a real step up in the room and the address without paying Monaco race-week prices. Researched band, five nights: 1,834-1,872.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'classic';

update public.departure_tier_briefs set brief =
  'Inside Monaco, walking distance to the circuit. Race-week rates here run six to seven times ordinary and supply is almost zero: one available property inside the principality across a 1,030-property search. Researched, five nights: 18,652-19,626.'
where departure_id = '30000000-0000-4000-8000-000000000004' and tier = 'elite';

-- ── Ordering and copy the new tiers broke ────────────────────────────────────
-- Elite was seeded at position 2 back when there were only two tiers, so adding Classic and
-- Premium at 2 and 3 made the ladder render budget → Monte Carlo → middle → middle. Put Elite last.
update public.departure_stay_options set position = 4
where id = '31000000-0000-4000-8000-000000000002';

-- Two pieces of marketing copy described a two-tier product and are now wrong rather than merely
-- dated: there are four tiers, and breakfast is NOT included at Explorer.
update public.tour_included_items
set title = '5 nights, at the level you choose',
    description = 'Four tiers, cheapest first: a simple hotel in Nice, a good hotel in Nice, the coast on the Monaco border ten minutes from the circuit, or a room inside Monte Carlo. Breakfast is included at every tier except the budget one, and you get your own room unless you choose to share. Properties are named in your confirmation.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and position = 1;

update public.tour_faqs
set question = 'Nice, the border, or Monaco: which should I choose?',
    answer = 'Four rungs. Nice on a budget is a simple central three-star and the value play; the train to the circuit is twenty minutes and the welcome drinks are in Nice. Nice, the good one, buys a better room and the old town at your door. On the Monaco border is Roquebrune-Cap-Martin or Menton, about ten minutes by train, and the best balance of price and proximity. Monaco, Monte Carlo is inside the principality and walking distance to the track — it is many times the price of the others because race-week rooms in Monaco genuinely are, and there is almost none of it. One group either way; everyone meets at the harbour on Sunday night.'
where tour_version_id = '21000000-0000-4000-8000-000000000002'
  and question = 'Nice or Monaco: which should I choose?';

-- `area` is the label printed above the tier name on the configurator card. Explorer still carried
-- 'Port area, Nice' from when it was the port hotel, while its own details said 'Nice centre' — two
-- different neighbourhoods on the same card.
update public.departure_stay_options set area = 'Nice centre'
where id = '31000000-0000-4000-8000-000000000001';
