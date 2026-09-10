-- Seed, 2026-09-10: an Elite tier for Southern France, built around a private villa in the Luberon.
--
-- Kyle's call: villas are the right shape for Elite. They are — but not through a hotel API, and
-- not without changing what the Provence leg is. Both of those are recorded here rather than
-- discovered later.
--
-- WHAT THE SUPPLIER CAN AND CANNOT SELL US
-- A live LiteAPI sweep of 1,335 properties around Avignon found 167 villa- and house-shaped ones
-- and 18 with availability for the May dates. Every one of them is a gîte or a holiday home at
-- $98–253 a night: cheaper than the hotels, not an upgrade on them. The luxury Provence villa —
-- six bedrooms, heated pool, staff — is not in an ordinary hotel API at all, which is what
-- docs/hotel-provider-audit.md already concluded when it named Interhome as the route for real
-- villas. So this tier is priced by hand from published agency rates and NOT auto-priced.
--
-- THE CONSTRAINT THAT ACTUALLY BITES
-- Luberon villas sleeping twelve are advertised at EUR 1,208–3,215 a night, and they let by the
-- WEEK, Saturday to Saturday. The Avignon leg is two nights. So a villa on this trip means paying
-- for seven nights to use two, and that cost is then divided by however many travelers turn up.
--
-- Priced off EUR 2,000 a night (mid-band), a week is EUR 14,000, about USD 15,200:
--
--     12 travelers   1,267 each        the number this tier is NOT priced at
--      8 travelers   1,900 each        what it IS priced at
--      6 travelers   2,533 each        the departure minimum
--
-- Pricing at eight rather than twelve is deliberate. A villa is the one component whose cost per
-- person RISES as the group empties, which is exactly backwards from how the rest of the trip
-- behaves and from where we want the risk to sit. Assuming a full house and then running six would
-- lose money on every seat.
--
-- Room cost for the tier: Nice 3 nights at the researched premium band (~USD 850), the villa share
-- (USD 1,900), Paris 3 nights premium (~USD 815) = USD 3,565.
--     (3,565 + 150) * 1.60 = 5,944  →  delta over the $3,495 base = 2,449
--
-- WHAT KYLE STILL HAS TO DO BEFORE THIS SELLS A SEAT
--   1. Contract a villa. Interhome, Le Collectionist, Villanovo or a Luberon agency direct.
--      Until then hotel_confirmed stays false and the page says the property is named at booking.
--   2. Decide whether the Provence leg grows. Paying for seven nights to use two is defensible
--      once; it is not a good product. A longer Provence leg on this tier — or a villa-only
--      departure — turns the week minimum from waste into the point of the trip.

insert into public.departure_stay_options
  (id, departure_id, name, tagline, description, area, star_rating, destination_id,
   price_delta_amount, shared_room_discount_amount, capacity, position, is_default, tier,
   includes, excludes, why_price_note, details, image_urls, auto_price, cost_multiple,
   fixed_cost_amount)
select
  ('41000000-0000-4000-8000-' || lpad(row_number() over (order by d.start_date)::text, 12, '0'))::uuid,
  d.id,
  'A villa in the Luberon',
  'The wine days from a private house, not a hotel corridor.',
  'Nice and Paris in the best rooms on the route, and the Provence days in a private villa in the Luberon — six bedrooms, a pool, a kitchen somebody actually cooks in, and the Châteauneuf-du-Pape cellars half an hour away. The group has the house to itself. It is the only tier where the wine afternoon ends somewhere that is yours rather than a lobby.',
  'Luberon, Provence', null, '10000000-0000-4000-8000-000000000002',
  244900, 60000, 8, 4, false, 'elite',
  array['8 nights', 'Private villa for the Provence days', 'Best available rooms in Nice and Paris', 'Breakfast', 'Trains between all three cities', 'The Châteauneuf-du-Pape afternoon'],
  array['Flights', 'A chef or staff at the villa (we can arrange, it is not in the price)'],
  'A Luberon villa that sleeps twelve lets by the week, Saturday to Saturday, at about EUR 2,000 a night — so the Provence days cost a full week whether we use two nights or seven. That week is divided across the group and we price it at eight travelers rather than a full house, because a villa is the one thing that gets MORE expensive per person as a group empties, and we would rather absorb a quiet departure than surprise you. The rest is the best room we can get in Nice and in Paris.',
  jsonb_build_object(
    'neighborhood', 'Luberon (Provence leg); central Nice and Paris',
    'station_distance', 'Transfers to and from the villa are included',
    'train_time', 'Trains between all three cities as on every tier',
    'breakfast', 'Included',
    'room_type', 'Own bedroom in the villa; hotel rooms in Nice and Paris',
    'hotel_confirmed', false),
  array['/photos/provence-view-vines.jpg', '/photos/chateauneuf-vineyard-road.jpg'],
  false, null, 0
from public.departures d
where d.tour_id = '20000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;

-- The Elite brief said "NO RESEARCHED BAND YET, do not sell until researched". It is researched now,
-- and the brief says what the number rests on and what is still missing.
update public.departure_tier_briefs set brief =
  'A private villa in the Luberon for the Provence days, with the best rooms we can get in Nice and Paris either side. RESEARCHED: Luberon villas sleeping twelve advertise at EUR 1,208-3,215 a night and let BY THE WEEK, Saturday to Saturday, so two nights costs seven. Priced off EUR 2,000/night divided by eight travelers, not twelve, because a villa is the one component whose per-person cost rises as a group empties. NOT SOURCEABLE through LiteAPI: a sweep of 1,335 Avignon-area properties found only gites and holiday homes at $98-253/night. Contract through Interhome, Le Collectionist or a Luberon agency before this sells a seat.'
where tier = 'elite'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');
