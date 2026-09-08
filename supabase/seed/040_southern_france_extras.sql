-- Seed: "make it yours" for Southern France — stay options, add-ons, the welcome anchor and the
-- shared-room discount (own room is the default; two travelers sharing each save $350).

update public.departures
set shared_room_discount_amount = 35000, group_opens_days_before = 30
where tour_id = '20000000-0000-4000-8000-000000000001';

-- The welcome drinks on day 1 are the trip's anchor: everyone is invited, nobody is obliged.
update public.tour_itinerary_items
set is_anchor = true,
    title = 'Welcome drinks',
    description = 'First round on us at a bar in the old town, 8 pm. Meet your group, or don''t — the app shows who''s coming.',
    start_time = '20:00', end_time = '22:00', location_name = 'Old town bar (exact spot in your app)',
    type = 'live_moment', is_optional = true
where tour_day_id = '22000000-0000-4000-8000-000000000001' and position = (
  select max(position) from public.tour_itinerary_items where tour_day_id = '22000000-0000-4000-8000-000000000001');

-- Stay options for each Southern France departure (same two tiers; default is the 3★ trio).
insert into public.departure_stay_options
  (id, departure_id, name, description, hotel_name, area, star_rating, price_delta_amount, shared_room_discount_amount, position, is_default)
select gen_random_uuid(), d.id, s.name, s.description, s.hotel_name, s.area, s.star_rating, s.delta, s.shared, s.position, s.is_default
from public.departures d
cross join (values
  ('Well-located 3★ hotels', 'Three comfortable hotels a short walk from the centre of each city. Breakfast included. This is the trip most people book.', null, 'Old town Nice · intramuros Avignon · Marais Paris', 3, 0::bigint, null::bigint, 1, true),
  ('Boutique 4★ upgrade', 'Design-led boutique hotels in the same neighbourhoods: rooftop pool in Nice, a converted mansion in Avignon, a Marais townhouse in Paris.', null, 'Same neighbourhoods, nicer rooms', 4, 85000::bigint, 40000::bigint, 2, false)
) as s(name, description, hotel_name, area, star_rating, delta, shared, position, is_default)
where d.tour_id = '20000000-0000-4000-8000-000000000001'
  and not exists (select 1 from public.departure_stay_options o where o.departure_id = d.id);

-- Add-ons per departure: the boat in Nice, the wine afternoon extension, a private airport transfer,
-- an extra night in Paris and a farewell dinner. Prices in USD minor units.
insert into public.departure_add_ons
  (id, departure_id, title, description, kind, price_amount, currency, pricing_basis, capacity, day_number, start_time, end_time,
   location_name, latitude, longitude, bookable_until_days_before, cancellable_until_days_before, position, is_featured)
select gen_random_uuid(), d.id, a.title, a.description, a.kind::public.add_on_kind, a.price, d.currency, a.basis, a.capacity, a.day_number, a.start_time, a.end_time,
       a.location_name, a.lat, a.lng, a.bookable, a.cancellable, a.position, a.featured
from public.departures d
cross join (values
  ('Boat day along the Riviera', 'A shared boat from the old port to Villefranche and Cap Ferrat with swim stops. Skipper, snorkels and lunch on board. Day 2, 10 am; the app shows who from Your Group is in.',
   'activity', 14500::bigint, 'per_traveler', 12, 2, '10:00'::time, '16:00'::time, 'Port Lympia, Nice', 43.6955, 7.2851, 1, 7, 1, true),
  ('Châteauneuf-du-Pape cellar afternoon', 'After the included tasting and lunch on day 5: a second tasting in the winemaker''s cellar, then the village on foot. Small group, own pace.',
   'activity', 9500::bigint, 'per_traveler', 10, 5, '15:00'::time, '18:30'::time, 'Châteauneuf-du-Pape', 44.0564, 4.8322, 2, 7, 2, true),
  ('Private airport transfer', 'Your own car from Nice airport to the hotel instead of the shared welcome drive. Handy if you land late.',
   'transfer', 9000::bigint, 'per_booking', null, 1, null, null, 'Nice Côte d''Azur Airport', null, null, 2, 3, 3, false),
  ('Extra night in Paris', 'Stay one more night in the same hotel after the trip ends. Breakfast included.',
   'extra_night', 21000::bigint, 'per_traveler', 6, 9, null, null, 'Your Paris hotel', null, null, 7, 7, 4, false),
  ('Farewell dinner', 'One long table at a neighbourhood bistro in the Marais on the last evening, 8 pm. Optional, like everything else.',
   'dinner', 8500::bigint, 'per_traveler', 20, 8, '20:00'::time, '23:00'::time, 'Le Marais, Paris', 48.8575, 2.3622, 1, 3, 5, false)
) as a(title, description, kind, price, basis, capacity, day_number, start_time, end_time, location_name, lat, lng, bookable, cancellable, position, featured)
where d.tour_id = '20000000-0000-4000-8000-000000000001'
  and not exists (select 1 from public.departure_add_ons x where x.departure_id = d.id);

-- ── Presentation (migration 039) ─────────────────────────────────────────────
-- Keyed by title so both fresh and existing databases pick these up. Only facts already stated
-- in the descriptions above are turned into includes / excludes.
update public.departure_stay_options o set
  tagline = 'Three good hotels, three walkable neighbourhoods.',
  label = 'best_value',
  includes = array['8 nights across Nice, Avignon and Paris', 'Breakfast', 'Trains between cities', 'Properties named at booking'],
  excludes = array['Flights'],
  details = jsonb_build_object('breakfast', 'Included', 'room_type', 'Double or twin', 'hotel_confirmed', false),
  why_price_note = 'This is the base trip. Hotels, trains and the welcome drinks are already in the price.'
from public.departures d
where o.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and o.name = 'Well-located 3★ hotels';

update public.departure_stay_options o set
  tagline = 'Same neighbourhoods, nicer rooms.',
  includes = array['8 nights in boutique hotels', 'Breakfast', 'Trains between cities', 'Properties named at booking'],
  excludes = array['Flights'],
  details = jsonb_build_object('breakfast', 'Included', 'room_type', 'Double or twin', 'hotel_confirmed', false),
  why_price_note = 'Design-led boutique properties in the same neighbourhoods; the difference is the room, not the route.'
from public.departures d
where o.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and o.name = 'Boutique 4★ upgrade';

update public.departure_add_ons a set
  label = 'social',
  includes = array['Shared boat from the old port', 'Skipper', 'Snorkels', 'Lunch on board', 'Swim stops at Villefranche and Cap Ferrat'],
  excludes = array['Drinks'],
  meeting_point = 'Port Lympia, Nice · 10:00',
  why_price_note = 'The boat, skipper and lunch for the day, split across up to twelve travelers.',
  image_urls = array['/photos/nice-beach-castle-hill.jpg']
from public.departures d
where a.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and a.title = 'Boat day along the Riviera';

update public.departure_add_ons a set
  includes = array['Second tasting in the winemaker''s cellar', 'Village walk at your own pace'],
  excludes = array['Bottles to take home'],
  meeting_point = 'Châteauneuf-du-Pape, after the included lunch',
  why_price_note = 'A private cellar tasting for a small group; the afternoon tasting and lunch are already in the trip.',
  image_urls = array['/photos/chateauneuf-cellar-barrels.jpg', '/photos/chateauneuf-vineyard-road.jpg']
from public.departures d
where a.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and a.title = 'Châteauneuf-du-Pape cellar afternoon';

update public.departure_add_ons a set
  includes = array['Private car, airport to your hotel'],
  excludes = array['Return to the airport'],
  meeting_point = 'Nice Côte d''Azur Airport, arrivals hall',
  why_price_note = 'One car per booking instead of the shared welcome drive.'
from public.departures d
where a.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and a.title = 'Private airport transfer';

update public.departure_add_ons a set
  includes = array['One extra night in your Paris hotel', 'Breakfast'],
  excludes = array['Late check-out'],
  why_price_note = 'The same room for one more night at our group rate.'
from public.departures d
where a.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and a.title = 'Extra night in Paris';

update public.departure_add_ons a set
  label = 'social',
  includes = array['Dinner at one long table in a Marais bistro'],
  excludes = array['Drinks'],
  meeting_point = 'Le Marais, Paris · 20:00 (exact bistro in your app)',
  why_price_note = 'A set menu for the group at a neighbourhood bistro; drinks are on you.',
  image_urls = array['/photos/paris-covered-passage.jpg']
from public.departures d
where a.departure_id = d.id and d.tour_id = '20000000-0000-4000-8000-000000000001'
  and a.title = 'Farewell dinner';

-- Honesty rule (plan v2 §10): no star rating is shown until a real property is confirmed. Tiers whose
-- details do not say hotel_confirmed = true carry no rating; the cards print "Property confirmed at
-- booking" instead.
update public.departure_stay_options
set star_rating = null
where coalesce((details ->> 'hotel_confirmed')::boolean, false) = false
  and star_rating is not null;

-- Tier names carry no star rating until properties are confirmed, and no popularity claims.
update public.departure_stay_options
set name = 'Well-located hotels',
    description = 'Three comfortable hotels a short walk from the centre of each city. Breakfast included.'
where name = 'Well-located 3★ hotels';
update public.departure_stay_options
set name = 'Boutique upgrade'
where name = 'Boutique 4★ upgrade';

-- ── Public tiers (migration 040) ─────────────────────────────────────────────
-- Only the two accommodation levels are tiers. The add-ons (boat day, cellar afternoon, transfer,
-- extra night, farewell dinner) are single experiences, not levels of one another, so they stay untiered.
update public.departure_stay_options set tier = 'explorer' where name = 'Well-located hotels';
update public.departure_stay_options set tier = 'premium'  where name = 'Boutique upgrade';

-- ── Insurance wording, corrected (2026-09-08) ────────────────────────────────
-- The policy audit rewrote the Terms and the FAQ to say travel insurance is strongly recommended
-- and explicitly not a condition of booking, because nothing in the schema can mark a departure as
-- requiring it and nobody checks. This line was missed because it lives in seed data rather than in
-- code, so the trip page went on telling travelers insurance was required while the Terms two
-- clicks away said the opposite. Contradicting ourselves about a contract term is worse than either
-- position on its own.
update public.tour_excluded_items
set description = 'Strongly recommended, and yours to arrange. Our cancellation policy refunds what we control; insurance covers your flights, your health and everything you booked yourself.'
where tour_version_id = '21000000-0000-4000-8000-000000000001'
  and title = 'Travel insurance';
