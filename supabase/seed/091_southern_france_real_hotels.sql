-- Seed, 2026-09-10: Southern France gets real hotels, a fourth rung, and prices derived from
-- supplier rates instead of judgement.
--
-- WHAT WAS WRONG
-- Monaco has had linked properties, live pricing, photographs and places-left since this morning.
-- Southern France had none of it: three tiers instead of four, no `hotel_id` anywhere, no rate ever
-- fetched, and a $3,495 price nobody had checked against a room. It could not be fixed by copying
-- Monaco, because Monaco is five nights in ONE hotel and this trip is three nights in Nice, two in
-- Avignon and three in Paris. Migration 20260910001000 added `departure_stay_legs` for exactly
-- that; this seed is the first use of it.
--
-- HOW THE PROPERTIES WERE CHOSEN — docs/tier-classification.md, executed
-- Step 1, name the scarce thing: nothing. Three cities in May and June, everything walkable,
-- 80 of 100 Nice properties and 92 of 100 Paris properties had availability. So the ladder is about
-- the room and the street, not proximity — the opposite of Monaco, where eleven properties in
-- fifteen kilometres decided the whole thing.
--
-- Step 2, bands from live rates: `scripts/tier-candidates.mjs` swept each city for each departure
-- window on 10 September 2026 and priced every candidate at one adult and at two sharing. Per night
-- with breakfast, the bands that came back:
--     Explorer   Nice 176-194   Avignon 122-127   Paris 223-247
--     Classic    Nice 225-254   Avignon 199-200   Paris 240-274
--     Premium    Nice 308-315   Avignon 225       Paris 557-644
--     Elite      Nice 1036-1394 Avignon 658       Paris 747-996
--
-- Step 3, assign: the twelve properties below, all available in BOTH the May and June windows at
-- the occupancies we sell, verified together by `scripts/tier-verify.mjs`. Every figure in this
-- file is a supplier's, quoted for the exact nights.
--
-- Step 4, the briefs at the bottom carry the figures so the next person can disagree with them.
--
-- THE THING THIS TURNED UP, which matters beyond this trip
-- The September departure has almost no inventory. At twelve months out only 24 of 100 Nice
-- properties, 16 of 100 Paris and FOUR of 100 Avignon have released anything. A horizon sweep
-- confirms it is the booking window rather than a fluke: Nice availability runs 93, 86, 80, 65, 24,
-- 10 of 100 at 2, 6, 8, 11, 12 and 14 months out. So a departure more than about a year ahead
-- cannot be tier-assigned from live inventory at all — not because the hotels are full, but because
-- they have not opened. September therefore gets the ladder and the prices but no linked properties
-- and no auto-pricing, and says so in its brief. The weekly rate job will pick it up when its
-- inventory opens; that is now a thing somebody has to check rather than assume.
--
-- HONESTY, unchanged from seed 050 and 082: none of these is contracted. They are the properties
-- each tier is PRICED AGAINST, and `details.hotel_confirmed` stays false so the card keeps saying
-- so.

-- ── The twelve properties ────────────────────────────────────────────────────
-- Addresses, coordinates, star ratings, photographs and facility lists are LiteAPI's own
-- /data/hotel response of 10 September 2026. The descriptions are ours: supplier copy is marketing
-- and reads like it.

insert into public.hotels
  (id, destination_id, name, slug, address, city, country_code, latitude, longitude,
   star_rating, description, image_urls, amenities, is_active)
values
  -- ── Nice ──────────────────────────────────────────────────────────────────
  ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
   'Hôtel Vendôme', 'hotel-vendome-nice',
   '26 Rue Pastorelli', 'Nice', 'FR', 43.700863, 7.271306, 3,
   'A nineteenth-century townhouse a few streets back from the old town, with a garden you can eat breakfast in. Ten minutes on foot to the Cours Saleya market and fifteen to the sea.',
   array['https://static.cupid.travel/hotels/508099994.jpg','https://static.cupid.travel/hotels/508099982.jpg','https://static.cupid.travel/hotels/508099539.jpg','https://static.cupid.travel/hotels/508099792.jpg','https://static.cupid.travel/hotels/508099662.jpg'],
   array['Free WiFi','Garden','Terrace','Air conditioning','24-hour front desk','Lift','Family rooms','Pets allowed'],
   true),

  ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001',
   'The Deck Hotel by Happyculture', 'the-deck-hotel-nice',
   '2 Rue Maccarani', 'Nice', 'FR', 43.697169, 7.264988, 4,
   'A four-star between the Carré d''Or and the Promenade, done as a wooden deck and Mediterranean colours. Marble bathrooms, a bar people actually sit in, and the beach at the end of the street.',
   array['https://static.cupid.travel/hotels/167724609.jpg','https://static.cupid.travel/hotels/308620653.jpg','https://static.cupid.travel/hotels/149989445.jpg','https://static.cupid.travel/hotels/143382686.jpg','https://static.cupid.travel/hotels/204471501.jpg'],
   array['Free WiFi','Air conditioning','Bar','Terrace','24-hour front desk','Business centre','Lift','Non-smoking'],
   true),

  ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001',
   'Hotel Le Grimaldi by Happyculture', 'hotel-le-grimaldi-nice',
   '15 Rue Grimaldi', 'Nice', 'FR', 43.699177, 7.264817, 4,
   'A belle-époque building in the Carré d''Or with big rooms, Pierre Frey fabrics and a breakfast that runs late. Five minutes from the flower market and the same again from the water.',
   array['https://static.cupid.travel/hotels/427340553.jpg','https://static.cupid.travel/hotels/579117746.jpg','https://static.cupid.travel/hotels/427340589.jpg','https://static.cupid.travel/hotels/427340578.jpg','https://static.cupid.travel/hotels/427340305.jpg'],
   array['Free WiFi','Air conditioning','Room service','Terrace','24-hour front desk','Lift','Family rooms','Pets allowed'],
   true),

  ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001',
   'Hotel Le Negresco', 'hotel-le-negresco-nice',
   '37 Promenade des Anglais', 'Nice', 'FR', 43.694493, 7.258379, 5,
   'The pink dome on the Promenade des Anglais, open since 1913 and still family-owned. Every room is different, the art collection is real, and Le Chantecler has held its stars for decades. There is no better address in Nice, which is the point of this rung.',
   array['https://static.cupid.travel/hotels/310379316.jpg','https://static.cupid.travel/hotels/587184622.jpg','https://static.cupid.travel/hotels/85962608.jpg','https://static.cupid.travel/hotels/587188999.jpg','https://static.cupid.travel/hotels/587201591.jpg'],
   array['Private beach','Swimming pool','Fitness centre','Restaurant','Room service','Free WiFi','Parking','24-hour front desk'],
   true),

  -- ── Avignon ───────────────────────────────────────────────────────────────
  ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002',
   'Hôtel Central', 'hotel-central-avignon',
   '31-33 Rue de la République', 'Avignon', 'FR', 43.945525, 4.805761, 3,
   'Inside the walls on the main street, with a courtyard garden and a bar. Air conditioning, which matters in Provence, and the Palais des Papes is a five-minute walk uphill.',
   array['https://static.cupid.travel/hotels/104762155.jpg','https://static.cupid.travel/hotels/50451539.jpg','https://static.cupid.travel/hotels/104575064.jpg','https://static.cupid.travel/hotels/117882136.jpg','https://static.cupid.travel/hotels/270024545.jpg'],
   array['Free WiFi','Garden','Terrace','Bar','Air conditioning','24-hour front desk','Room service','Parking'],
   true),

  ('40000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000002',
   'Mercure Avignon Centre Palais des Papes', 'mercure-avignon-palais-des-papes',
   '1 Rue Jean Vilar', 'Avignon', 'FR', 43.949901, 4.806477, 4,
   'On the Place de l''Horloge, fifty metres from the Palais des Papes and five hundred from the bridge. Unremarkable as a building and unbeatable as a location: you walk out of the door into the square.',
   array['https://static.cupid.travel/hotels/28304016.jpg','https://static.cupid.travel/hotels/355762794.jpg','https://static.cupid.travel/hotels/15978156.jpg','https://static.cupid.travel/hotels/355762851.jpg','https://static.cupid.travel/hotels/139962141.jpg'],
   array['Free WiFi','Air conditioning','Bar','Room service','24-hour front desk','Parking','Lift','Family rooms'],
   true),

  ('40000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000002',
   'Hôtel Cloître Saint Louis', 'hotel-cloitre-saint-louis-avignon',
   '20 Rue du Portail Boquier', 'Avignon', 'FR', 43.943808, 4.804947, 4,
   'A sixteenth-century Jesuit cloister inside the walls, with a plane-tree courtyard, vaulted ceilings in the old wing and a rooftop pool in the Jean Nouvel one. The most interesting building you can sleep in in Avignon short of La Mirande.',
   array['https://static.cupid.travel/hotels/11222356.jpg','https://static.cupid.travel/hotels/528166768.jpg','https://static.cupid.travel/hotels/134642390.jpg','https://static.cupid.travel/hotels/111826794.jpg','https://static.cupid.travel/hotels/53256342.jpg'],
   array['Rooftop pool','Restaurant','Courtyard','Free WiFi','Air conditioning','Room service','Parking','24-hour front desk'],
   true),

  ('40000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000002',
   'La Mirande', 'la-mirande-avignon',
   '4 Place de l''Amirande', 'Avignon', 'FR', 43.950077, 4.807707, 5,
   'A cardinal''s palace at the foot of the Palais des Papes, restored as a private house rather than a hotel: antique windows, silk, oak floors, a walled garden and a kitchen table in the vaulted cellar you can cook at. Twenty-six rooms, no two the same.',
   array['https://static.cupid.travel/hotels/284647886.jpg','https://static.cupid.travel/hotels/284186484.jpg','https://static.cupid.travel/hotels/377774095.jpg','https://static.cupid.travel/hotels/377774248.jpg','https://static.cupid.travel/hotels/284189685.jpg'],
   array['Restaurant','Cooking school','Garden','Free WiFi','Air conditioning','Room service','Parking','24-hour front desk'],
   true),

  -- ── Paris ─────────────────────────────────────────────────────────────────
  ('40000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000003',
   'Hôtel Mondial', 'hotel-mondial-paris',
   '5 Cité Bergère', 'Paris', 'FR', 48.871888, 2.343943, 3,
   'On a gated pedestrian passage in the 9th, so it is quiet in a part of Paris that is not. Opéra Garnier and the Grands Boulevards are both a few minutes away, and the Métro is at the end of the lane.',
   array['https://static.cupid.travel/hotels/97005687.jpg','https://static.cupid.travel/hotels/608230034.jpg','https://static.cupid.travel/hotels/66269734.jpg','https://static.cupid.travel/hotels/66271098.jpg','https://static.cupid.travel/hotels/66270734.jpg'],
   array['Free WiFi','24-hour front desk','Lift','Luggage storage','Laundry','Express check-in','Family rooms','Non-smoking'],
   true),

  ('40000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-000000000003',
   'Le Général Hôtel', 'le-general-hotel-paris',
   '5-7 Rue Rampon', 'Paris', 'FR', 48.866119, 2.366921, 4,
   'A design four-star off Place de la République, in the part of the 11th people actually go out in. Nespresso machines, L''Occitane in the bathrooms, a small gym, and Oberkampf and the Marais both walkable.',
   array['https://static.cupid.travel/hotels/67620205.jpg','https://static.cupid.travel/hotels/65541021.jpg','https://static.cupid.travel/hotels/65540984.jpg','https://static.cupid.travel/hotels/65541059.jpg','https://static.cupid.travel/hotels/67619928.jpg'],
   array['Free WiFi','Air conditioning','Fitness centre','Bar','Room service','24-hour front desk','Lift','Family rooms'],
   true),

  ('40000000-0000-4000-8000-00000000001b', '10000000-0000-4000-8000-000000000003',
   'Hôtel Bel Ami', 'hotel-bel-ami-paris',
   '7-11 Rue Saint-Benoît', 'Paris', 'FR', 48.854858, 2.333061, 5,
   'A former printworks behind Saint-Germain-des-Prés, thirty seconds from the Café de Flore. Five-star, contemporary rather than gilded, with a spa in the basement and rooms that look over the rooftops of the 6th.',
   array['https://static.cupid.travel/hotels/149446077.jpg','https://static.cupid.travel/hotels/496557672.jpg','https://static.cupid.travel/hotels/289751866.jpg','https://static.cupid.travel/hotels/139507918.jpg','https://static.cupid.travel/hotels/75801834.jpg'],
   array['Spa','Fitness centre','Restaurant','Bar','Room service','Free WiFi','Air conditioning','24-hour front desk'],
   true),

  ('40000000-0000-4000-8000-00000000001c', '10000000-0000-4000-8000-000000000003',
   'InterContinental Paris Le Grand', 'intercontinental-paris-le-grand',
   '2 Rue Scribe', 'Paris', 'FR', 48.870623, 2.329881, 5,
   'Built with the Opéra Garnier in 1862 and facing it across the square. The Café de la Paix is on the corner, the glass roof over La Verrière is listed, and the good rooms look straight at the opera house. This is the grand-hotel answer rather than the boutique one.',
   array['https://static.cupid.travel/hotels/245795558.jpg','https://static.cupid.travel/hotels/245924346.jpg','https://static.cupid.travel/hotels/578619347.jpg','https://static.cupid.travel/hotels/245801199.jpg','https://static.cupid.travel/hotels/305226334.jpg'],
   array['Restaurant','Bar','Fitness centre','Room service','Free WiFi','Air conditioning','Parking','24-hour front desk'],
   true)
on conflict (id) do update set
  name = excluded.name, address = excluded.address,
  latitude = excluded.latitude, longitude = excluded.longitude,
  star_rating = excluded.star_rating, description = excluded.description,
  image_urls = excluded.image_urls, amenities = excluded.amenities, is_active = true;

-- The LiteAPI ids the rates above were quoted against, so a refresh re-prices the same property.
insert into public.hotel_supplier_mappings (hotel_id, supplier, supplier_hotel_id) values
  ('40000000-0000-4000-8000-000000000011', 'liteapi', 'lp30008'),
  ('40000000-0000-4000-8000-000000000012', 'liteapi', 'lp33721'),
  ('40000000-0000-4000-8000-000000000013', 'liteapi', 'lp28307'),
  ('40000000-0000-4000-8000-000000000014', 'liteapi', 'lp1aafd'),
  ('40000000-0000-4000-8000-000000000015', 'liteapi', 'lp467aa'),
  ('40000000-0000-4000-8000-000000000016', 'liteapi', 'lp2c8f2'),
  ('40000000-0000-4000-8000-000000000017', 'liteapi', 'lp1ee54'),
  ('40000000-0000-4000-8000-000000000018', 'liteapi', 'lp1e966'),
  ('40000000-0000-4000-8000-000000000019', 'liteapi', 'lp1d8fa'),
  ('40000000-0000-4000-8000-00000000001a', 'liteapi', 'lp44f88'),
  ('40000000-0000-4000-8000-00000000001b', 'liteapi', 'lp1aa1d'),
  ('40000000-0000-4000-8000-00000000001c', 'liteapi', 'lp19f1f')
on conflict (supplier, supplier_hotel_id, coalesce(supplier_room_id, '')) do nothing;

-- ── The fourth rung ──────────────────────────────────────────────────────────
-- Classic never existed on this trip; its brief said so and said it must not be sold without
-- researched figures. It has them now. Elite comes back as three hotel rooms rather than the villa
-- seed 089 retired — the condition that seed set was "a researched answer that is not the villa",
-- and the sweep produced one.

insert into public.departure_stay_options
  (id, departure_id, name, tier, label, position, price_delta_amount, is_default, is_active,
   area, tagline, description, includes, excludes, details, why_price_note,
   fixed_cost_amount, cost_multiple, auto_price)
select
  ('42000000-0000-4000-8000-00000000000' || row_number() over (order by d.start_date))::uuid,
  d.id,
  'A better room, same streets',
  'classic', null, 2, 0, false, true,
  'Nice Carré d''Or · Place de l''Horloge · Paris 11e',
  'Four stars in all three cities, for a few hundred more.',
  'A design four-star in Nice a street from the Promenade, the hotel on Avignon''s main square fifty metres from the Palais des Papes, and a four-star off République in the part of the 11th people go out in. Breakfast everywhere.',
  array['8 nights in four-star hotels','Breakfast','Trains between cities','Properties named at booking'],
  array['Flights'],
  '{"breakfast":"Included","room_type":"Double or twin","hotel_confirmed":false}'::jsonb,
  'The smallest real step on this trip: three or four hundred dollars moves every night of the eight from a good three-star to a four-star, because the gap between them in these three cities is genuinely narrow. We pass most of it through.',
  40000, 1.80, false
from public.departures d
where d.tour_id = '20000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.departure_stay_options o
     where o.departure_id = d.id and o.tier = 'classic'
  );

-- Premium moves to 3 so the ladder reads cheapest first, and Elite comes back on.
update public.departure_stay_options set position = 3
where tier = 'premium'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

update public.departure_stay_options set
  is_active = true,
  position = 4,
  capacity = 4,
  name = 'The best room on the route',
  area = 'Promenade des Anglais · beside the Palais des Papes · Place de l''Opéra',
  tagline = 'The Negresco, a cardinal''s palace, and the Opéra.',
  description = 'Three addresses rather than three hotels: the pink dome on the Promenade des Anglais, a restored cardinal''s palace at the foot of the Palais des Papes, and the grand hotel built with the Opéra Garnier and facing it across the square. Nothing on this route is hard to reach, so this rung buys the room and the building, not the proximity.',
  includes = array['8 nights in the best hotel we can get in each city','Breakfast','Trains between cities','The Châteauneuf-du-Pape afternoon','Properties named at booking'],
  excludes = array['Flights'],
  details = '{"breakfast":"Included","room_type":"Best available double","hotel_confirmed":false}'::jsonb,
  why_price_note = 'Rooms at this level cost four to five times the entry tier and we take a smaller multiple on them, not a larger one — the trip we run is identical whichever room you sleep in. The price is the room.',
  image_urls = '{}'
where tier = 'elite'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

-- Explorer and Premium: the copy said things that are no longer true (Marais, a rooftop pool, a
-- converted mansion) now that the properties are real and named.
update public.departure_stay_options set
  area = 'Nice centre · Avignon intramuros · Paris 9e',
  tagline = 'Three good hotels, three walkable neighbourhoods.',
  description = 'A nineteenth-century townhouse with a garden in Nice, a hotel inside the walls on Avignon''s main street, and a quiet passage in the Paris 9th a few minutes from the Opéra. Breakfast included everywhere.',
  why_price_note = 'This is the base trip. Hotels, trains, the welcome drinks and the Châteauneuf-du-Pape afternoon are already in the price.'
where tier = 'explorer'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

update public.departure_stay_options set
  name = 'Design-led, in the best part of town',
  area = 'Nice Carré d''Or · a 16th-century cloister · Saint-Germain-des-Prés',
  tagline = 'Buildings worth staying in.',
  description = 'A belle-époque hotel in the Carré d''Or, a sixteenth-century Jesuit cloister with a rooftop pool inside the Avignon walls, and a five-star former printworks thirty seconds from the Café de Flore. This rung buys the building.',
  includes = array['8 nights in design-led hotels','Breakfast','Trains between cities','Properties named at booking'],
  why_price_note = 'Most of this is Paris. Saint-Germain at this level runs two and a half times the entry tier on its own; Nice and Avignon are a smaller step.'
where tier = 'premium'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

-- `hotel_name` is the free-text field from before hotels existed. One source of truth.
update public.departure_stay_options set hotel_name = null
where departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

-- ── Legs: which hotel, which nights ──────────────────────────────────────────
-- Departure 1 runs 2027-05-14 → 05-22 and departure 2 runs 06-11 → 06-19; three nights in Nice,
-- two in Avignon, three in Paris, which is the itinerary in tour_days.

delete from public.departure_stay_legs
where stay_option_id in (
  select o.id from public.departure_stay_options o
    join public.departures d on d.id = o.departure_id
   where d.tour_id = '20000000-0000-4000-8000-000000000001'
);

insert into public.departure_stay_legs
  (stay_option_id, destination_id, hotel_id, position, check_in, check_out)
select o.id, l.destination_id, l.hotel_id, l.position, l.check_in, l.check_out
  from public.departure_stay_options o
  join (values
    -- departure 1, May
    ('30000000-0000-4000-8000-000000000001'::uuid, 'explorer'::public.option_tier, '10000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000011'::uuid, 1::smallint, date '2027-05-14', date '2027-05-17'),
    ('30000000-0000-4000-8000-000000000001', 'explorer', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000015', 2, date '2027-05-17', date '2027-05-19'),
    ('30000000-0000-4000-8000-000000000001', 'explorer', '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000019', 3, date '2027-05-19', date '2027-05-22'),
    ('30000000-0000-4000-8000-000000000001', 'classic',  '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000012', 1, date '2027-05-14', date '2027-05-17'),
    ('30000000-0000-4000-8000-000000000001', 'classic',  '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000016', 2, date '2027-05-17', date '2027-05-19'),
    ('30000000-0000-4000-8000-000000000001', 'classic',  '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001a', 3, date '2027-05-19', date '2027-05-22'),
    ('30000000-0000-4000-8000-000000000001', 'premium',  '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 1, date '2027-05-14', date '2027-05-17'),
    ('30000000-0000-4000-8000-000000000001', 'premium',  '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000017', 2, date '2027-05-17', date '2027-05-19'),
    ('30000000-0000-4000-8000-000000000001', 'premium',  '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001b', 3, date '2027-05-19', date '2027-05-22'),
    ('30000000-0000-4000-8000-000000000001', 'elite',    '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000014', 1, date '2027-05-14', date '2027-05-17'),
    ('30000000-0000-4000-8000-000000000001', 'elite',    '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000018', 2, date '2027-05-17', date '2027-05-19'),
    ('30000000-0000-4000-8000-000000000001', 'elite',    '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001c', 3, date '2027-05-19', date '2027-05-22'),
    -- departure 2, June
    ('30000000-0000-4000-8000-000000000002', 'explorer', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000011', 1, date '2027-06-11', date '2027-06-14'),
    ('30000000-0000-4000-8000-000000000002', 'explorer', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000015', 2, date '2027-06-14', date '2027-06-16'),
    ('30000000-0000-4000-8000-000000000002', 'explorer', '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000019', 3, date '2027-06-16', date '2027-06-19'),
    ('30000000-0000-4000-8000-000000000002', 'classic',  '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000012', 1, date '2027-06-11', date '2027-06-14'),
    ('30000000-0000-4000-8000-000000000002', 'classic',  '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000016', 2, date '2027-06-14', date '2027-06-16'),
    ('30000000-0000-4000-8000-000000000002', 'classic',  '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001a', 3, date '2027-06-16', date '2027-06-19'),
    ('30000000-0000-4000-8000-000000000002', 'premium',  '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 1, date '2027-06-11', date '2027-06-14'),
    ('30000000-0000-4000-8000-000000000002', 'premium',  '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000017', 2, date '2027-06-14', date '2027-06-16'),
    ('30000000-0000-4000-8000-000000000002', 'premium',  '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001b', 3, date '2027-06-16', date '2027-06-19'),
    ('30000000-0000-4000-8000-000000000002', 'elite',    '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000014', 1, date '2027-06-11', date '2027-06-14'),
    ('30000000-0000-4000-8000-000000000002', 'elite',    '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000018', 2, date '2027-06-14', date '2027-06-16'),
    ('30000000-0000-4000-8000-000000000002', 'elite',    '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-00000000001c', 3, date '2027-06-16', date '2027-06-19')
  ) as l(departure_id, tier, destination_id, hotel_id, position, check_in, check_out)
    on l.departure_id = o.departure_id and l.tier = o.tier
 where o.is_active;

-- ── Prices, derived ──────────────────────────────────────────────────────────
-- price = (room + fixed) x multiple, the same formula the live-pricing job runs, so the numbers on
-- the page today and the numbers it writes next Monday are produced the same way.
--
-- `fixed` is $400: the per-traveler cost that is not a room — the Nice airport transfer, both TGV
-- reservations, the Châteauneuf-du-Pape afternoon with lunch, the first round on night one, and
-- payment and support costs. It is deliberately a cost, not padding; the margin lives in the
-- multiple where it can be seen.
--
-- The multiple FALLS as the room gets dearer: 1.95, 1.80, 1.70, 1.55. We run the identical trip
-- whichever room somebody sleeps in, so a flat percentage on a $6,666 Elite room would be four
-- times the margin for the same work. Absolute margin still rises with the tier ($1,760 → $3,884
-- on the May departure), which is the right shape.

-- Departure 1, May: room costs 1,450 / 1,793 / 3,067 / 6,666.
update public.departures set price_amount = 361000 where id = '30000000-0000-4000-8000-000000000001';
update public.departure_stay_options set
  price_delta_amount = case tier when 'explorer' then 0 when 'classic' then 33500
                                 when 'premium' then 228500 else 734000 end,
  priced_room_amount = case tier when 'explorer' then 145000 when 'classic' then 179300
                                 when 'premium' then 306700 else 666600 end,
  cost_multiple = case tier when 'explorer' then 1.95 when 'classic' then 1.80
                            when 'premium' then 1.70 else 1.55 end,
  fixed_cost_amount = 40000,
  auto_price = true,
  priced_at = now()
where departure_id = '30000000-0000-4000-8000-000000000001' and is_active;

-- Departure 2, June: dearer everywhere, and Paris considerably so.
update public.departures set price_amount = 383500 where id = '30000000-0000-4000-8000-000000000002';
update public.departure_stay_options set
  price_delta_amount = case tier when 'explorer' then 0 when 'classic' then 46000
                                 when 'premium' then 246500 else 994000 end,
  priced_room_amount = case tier when 'explorer' then 156700 when 'classic' then 198600
                                 when 'premium' then 330600 else 848700 end,
  cost_multiple = case tier when 'explorer' then 1.95 when 'classic' then 1.80
                            when 'premium' then 1.70 else 1.55 end,
  fixed_cost_amount = 40000,
  auto_price = true,
  priced_at = now()
where departure_id = '30000000-0000-4000-8000-000000000002' and is_active;

-- Departure 3, September: no inventory to price against yet (see the note at the top). It takes the
-- May ladder rather than the old $3,495, because the one thing we know about September is that we
-- have not checked it, and pricing an unchecked departure BELOW a checked one is how a $19,626 room
-- ended up on sale for $4,450. No legs, no auto-pricing, no "priced as of" date on the card.
update public.departures set price_amount = 361000 where id = '30000000-0000-4000-8000-000000000003';
update public.departure_stay_options set
  price_delta_amount = case tier when 'explorer' then 0 when 'classic' then 33500
                                 when 'premium' then 228500 else 734000 end,
  priced_room_amount = null,
  priced_at = null,
  cost_multiple = case tier when 'explorer' then 1.95 when 'classic' then 1.80
                            when 'premium' then 1.70 else 1.55 end,
  fixed_cost_amount = 40000,
  auto_price = false
where departure_id = '30000000-0000-4000-8000-000000000003' and is_active;

-- ── Deposits, per tier ───────────────────────────────────────────────────────
-- The deposit exists to cover what we sink and cannot recover when somebody cancels late: the train
-- reservations, the wine afternoon and the first non-refundable night. Those scale with the room,
-- so the deposit does too. A flat $750 against a $10,950 Elite booking is the same shape of hole
-- migration 20260910000400 fixed on Monaco.
update public.departure_stay_options set
  deposit_amount = case tier when 'explorer' then null when 'classic' then 90000
                             when 'premium' then 150000 else 300000 end,
  capacity = case tier when 'premium' then 8 when 'elite' then 4 else null end
where departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');

-- ── The briefs ───────────────────────────────────────────────────────────────
insert into public.departure_tier_briefs (departure_id, tier, brief)
select d.id, b.tier, b.brief
  from public.departures d
 cross join (values
   ('explorer'::public.option_tier,
    'Comfortable, well located, walkable to the centre of each city, breakfast everywhere. Priced against Hôtel Vendôme in Nice, Hôtel Central inside the Avignon walls and Hôtel Mondial in the Paris 9th. Researched band, per night with breakfast: Nice 176-194, Avignon 122-127, Paris 223-247 USD (LiteAPI, 10 Sep 2026, for the exact nights). Never the cheapest bed in town — the cheapest available Nice property was 100/night at 5 km out, and it is not this rung.'),
   ('classic',
    'Four stars in all three cities, in the same neighbourhoods or better. Priced against The Deck Hotel in Nice, the Mercure on Avignon''s Place de l''Horloge and Le Général off République. Researched band, per night with breakfast: Nice 225-254, Avignon 199-200, Paris 240-274 USD. The gap to Explorer is small in absolute terms (about $335 for the whole trip) because the three-to-four-star gap in these cities is genuinely narrow; that makes it the easiest upgrade to sell, not a broken rung.'),
   ('premium',
    'The building, not the address — nothing on this route is hard to reach. Priced against Hotel Le Grimaldi in the Carré d''Or, the 16th-century Cloître Saint Louis inside the Avignon walls and the five-star Bel Ami in Saint-Germain. Researched band, per night with breakfast: Nice 308-315, Avignon 225, Paris 557-644 USD. Note the shape: Paris is most of this rung and Avignon barely moves, because the town has almost nothing between a good four-star and La Mirande.'),
   ('elite',
    'Reinstated 2026-09-10 with the researched answer seed 089 required, which is three hotel rooms rather than a villa. Priced against Le Negresco on the Promenade des Anglais, La Mirande at the foot of the Palais des Papes and the InterContinental Le Grand facing the Opéra. Researched band, per night with breakfast: Nice 1,036-1,394, Avignon 658, Paris 747-996 USD. Capacity 4 is an estimate of what could be secured, not a held allocation. The multiple here is the lowest on the ladder (1.55): the trip is the same trip, and the price is the room.')
 ) as b(tier, brief)
 where d.tour_id = '20000000-0000-4000-8000-000000000001'
on conflict (departure_id, tier) do update set brief = excluded.brief, updated_at = now();

-- September carries an extra paragraph on every rung, because the reason its card has no "priced
-- as of" date is not an oversight.
update public.departure_tier_briefs set brief = brief ||
  ' SEPTEMBER 2027 — NOT YET PRICED FROM LIVE RATES: at twelve months out the properties above have released no inventory (24 of 100 Nice, 16 of 100 Paris and 4 of 100 Avignon properties had ANY availability on 10 Sep 2026, against 80/92/39 for the May window). That is the booking window, not the trip being full. This departure therefore takes the May ladder, has no linked hotels and no auto-pricing, and must be re-swept and re-linked once inventory opens — check it from about June 2027.'
where departure_id = '30000000-0000-4000-8000-000000000003';
