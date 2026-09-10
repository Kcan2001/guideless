-- Seed, 2026-09-10: the four properties each Monaco tier is priced against, as real `hotels` rows
-- with real supplier mappings.
--
-- Every field below came from LiteAPI's own /data/hotel response on 10 September 2026 — the
-- addresses, the coordinates, the star ratings and the facility lists are the supplier's, not ours.
--
-- WHY THIS MATTERS BEYOND SHOWING A NAME
-- `listStayOptionsToRefresh()` in apps/web/lib/hotels/search.ts selects stay options
-- `.not("hotel_id", "is", null)`. Every Monaco tier had a null hotel_id, so the nightly rate
-- refresh has been walking straight past this departure since it was created. Linking these four
-- is what makes the scheduled re-price actually cover the trip whose price was most wrong.
--
-- THE HONESTY PROBLEM, STATED PLAINLY
-- Seed 050 set the rule: "no star rating or property name until a hotel is contracted", and every
-- tier carries `details.hotel_confirmed = false`. We have contracted none of these. So these are
-- recorded and displayed as the property each tier is PRICED AGAINST — the room whose real rate
-- produced the number on the page — and the card says so. That is a different and weaker claim
-- than "this is your hotel", and the UI must keep it weaker until a contract exists.

insert into public.hotels
  (id, destination_id, name, slug, address, city, country_code, latitude, longitude,
   star_rating, description, image_urls, amenities, is_active)
values
  -- Explorer. $957–1,032 for the five nights; the cheapest real hotel with availability.
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Hôtel & Appartements Monsigny', 'hotel-appartements-monsigny',
   '17 Avenue Malaussena', 'Nice', 'FR', 43.707851, 7.263119, 3,
   'A straightforward three-star a few minutes from Nice-Ville, so the train to the circuit starts at the end of the road. Rooftop terrace, lift, safe at the desk. Breakfast is available but is not in our price at this tier.',
   array['https://static.cupid.travel/hotels/ex_e2b68c01_z.jpg','https://static.cupid.travel/hotels/ex_202a5d52_z.jpg'],
   array['Rooftop terrace','Lift','Safe at front desk','Multilingual staff','Smoke-free','Electric car charging','Wheelchair accessible parking'],
   true),

  -- Classic. $1,834–1,872, breakfast included.
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Hôtel Petit Palais', 'hotel-petit-palais',
   '17 Avenue Emile Bieckert', 'Nice', 'FR', 43.705615, 7.274820, 4,
   'Twenty-five rooms on the Cimiez hillside above the old town, with a pool and a garden. Some rooms look at the sea, some at the roofs of Nice. The step up from Explorer is the room, the quiet and the walk home.',
   array['https://static.cupid.travel/hotels/363486298.jpg','https://static.cupid.travel/hotels/530008600.jpg'],
   array['Free WiFi','Swimming pool','Garden','Terrace','Air conditioning','24-hour front desk','Room service','Family rooms','Pets allowed','Lift'],
   true),

  -- Premium. $2,456 for the five nights, and refundable, which almost nothing on this weekend is.
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
   'Studio La Florentina', 'studio-la-florentina',
   '8 Avenue du Général de Gaulle', 'Menton', 'FR', 43.766730, 7.488780, null,
   'A beachfront studio in Menton with a terrace and sea views, about ten minutes by train into Monaco. Not a hotel and not inside the principality: this rung buys the coast and the proximity rather than an address.',
   array['https://static.cupid.travel/hotels/135980443.jpg','https://static.cupid.travel/hotels/hd/135979988.jpg'],
   array['Free WiFi','Private parking','Terrace','Sea view','Air conditioning','Airport shuttle (surcharge)','Non-smoking throughout'],
   true),

  -- Elite. $18,652–19,626, and the only property inside Monaco with anything at all.
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   'Le Méridien Beach Plaza', 'le-meridien-beach-plaza',
   '22 Avenue Princesse Grace', 'Monte Carlo', 'MC', 43.748382, 7.435824, 4,
   'The only hotel inside Monaco with rooms left for race weekend. On the water at Larvotto with a private beach, indoor and outdoor pools and a walk into the circuit. It is a four-star, not a palace; on this weekend it is what being inside the principality costs.',
   array['https://static.cupid.travel/hotels/426587837.jpg','https://static.cupid.travel/hotels/489519146.jpg'],
   array['Private beach','Indoor and outdoor pools','Fitness centre','Restaurant','Room service','Free WiFi','Terrace','Garden','24-hour front desk','Parking'],
   true)
on conflict (id) do update set
  address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude,
  star_rating = excluded.star_rating, description = excluded.description,
  image_urls = excluded.image_urls, amenities = excluded.amenities;

-- Supplier mappings. These are the LiteAPI ids the rates above were actually quoted against, so a
-- refresh re-prices the same room rather than a lookalike.
insert into public.hotel_supplier_mappings (hotel_id, supplier, supplier_hotel_id) values
  ('40000000-0000-4000-8000-000000000001', 'liteapi', 'lp7003e'),
  ('40000000-0000-4000-8000-000000000002', 'liteapi', 'lp45336'),
  ('40000000-0000-4000-8000-000000000003', 'liteapi', 'lp65608a91'),
  ('40000000-0000-4000-8000-000000000004', 'liteapi', 'lp35250')
on conflict (supplier, supplier_hotel_id, coalesce(supplier_room_id, '')) do nothing;

-- Link each tier to its property. This is also what puts the Monaco departure into the scheduled
-- rate refresh for the first time.
update public.departure_stay_options set hotel_id = '40000000-0000-4000-8000-000000000001'
where id = '31000000-0000-4000-8000-000000000001';
update public.departure_stay_options set hotel_id = '40000000-0000-4000-8000-000000000002'
where id = '31000000-0000-4000-8000-000000000003';
update public.departure_stay_options set hotel_id = '40000000-0000-4000-8000-000000000003'
where id = '31000000-0000-4000-8000-000000000004';
update public.departure_stay_options set hotel_id = '40000000-0000-4000-8000-000000000004'
where id = '31000000-0000-4000-8000-000000000002';

-- `hotel_name` is the free-text field the card used before hotels existed. Clear it on these four
-- so there is exactly one source of truth for the property and the two can never disagree.
update public.departure_stay_options set hotel_name = null
where departure_id = '30000000-0000-4000-8000-000000000004';
