-- Seed, 2026-09-10: a different thing to do every night of the Monaco weekend, and the Explore
-- content (where to eat, what to look at) that the app has had a table for since migration 022 and
-- has never had a single row in.
--
-- HOW THE NIGHTS WORK
-- Each night is its own `tier_group`, so a traveler can buy one thing per night and the quote
-- refuses a second. Wednesday is deliberately absent: welcome drinks are included and free, and
-- the point of night one is that everybody is at the same thing.
--
--   night_thu  Thursday 3 June   the coast is quiet, the harbour is filling up
--   night_fri  Friday 4 June     practice day; the parties start
--   night_sat  Saturday 5 June   qualifying night, the busiest night in Monaco
--   night_sun  Sunday 6 June     after the flag
--
-- PRICES ARE RESEARCHED, NOT CONTRACTED. No Monaco venue publishes an API and we hold no
-- allocation at any of them. Every figure below comes from published entry ranges for Grand Prix
-- week and carries our booking on top. They must be confirmed against a venue contract before this
-- departure takes real money for them — the same mistake as the Monte Carlo hotel tier, one floor
-- down. Amber Lounge in particular does not sell at the door and opens applications in January.

-- Put the two evening add-ons that already existed into their nights, so the mutual exclusion works.
update public.departure_add_ons set tier_group = 'night_fri', min_age = 18
where id = '32000000-0000-4000-8000-000000000008';
update public.departure_add_ons set tier_group = 'night_sun', min_age = 18
where id = '32000000-0000-4000-8000-000000000009';

insert into public.departure_add_ons
  (id, departure_id, title, description, kind, price_amount, currency, pricing_basis, capacity,
   day_number, start_time, end_time, location_name, latitude, longitude,
   bookable_until_days_before, cancellable_until_days_before, tier_group, position, is_featured,
   includes, excludes, meeting_point, label, tier, min_age, why_price_note, image_urls)
values
  -- ── Thursday ───────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000004',
   'Thursday at Sass Café',
   'The Monaco institution: small, loud, live music from about eleven and no dance floor to speak of, so everybody ends up standing on something. The locals go here all year, which is exactly why it is worth the Thursday rather than the Saturday.',
   'ticket', 19500, 'USD', 'per_traveler', 16, 2, '22:00', null, 'Sass Café, Avenue Princesse Grace', 43.7462, 7.4310,
   7, 14, 'night_thu', 10, false,
   array['Reserved entry off the guest list', 'One drink'],
   array['Dinner', 'Getting back to Nice'],
   'Avenue Princesse Grace, from 21:45', 'social', 'classic', 18,
   'Guest-list entry with a drink, at the published Grand Prix week rate plus our booking. Researched, not contracted: we hold no allocation here yet.',
   array['/photos/monaco-casino-night.jpg']),

  ('32000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000004',
   'Thursday dinner at Buddha-Bar Monte-Carlo',
   'Dinner under the dome next to the Casino, then the room turns into a bar and the DJ starts. The gentlest of the four nights and the only one where you will be able to hold a conversation.',
   'ticket', 26500, 'USD', 'per_traveler', 20, 2, '20:00', null, 'Buddha-Bar Monte-Carlo, Place du Casino', 43.7396, 7.4278,
   7, 14, 'night_thu', 11, false,
   array['Set dinner', 'Table for the group', 'Stays on for the DJ'],
   array['Drinks beyond the first', 'Getting back to Nice'],
   'Place du Casino, 19:45', null, 'premium', 18,
   'A set dinner at the published race-week rate plus our booking. Researched, not contracted.',
   array['/photos/monaco-casino-square.jpg']),

  -- ── Friday ─────────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000004',
   'Friday at Twiga',
   'The big-room night. Twiga books headline acts across the four Grand Prix nights — recent years have run to 50 Cent, Anyma and Bob Sinclar — and Friday is the one you can still get into. On the harbour, so you can walk out of it into the paddock end of the port.',
   'ticket', 49500, 'USD', 'per_traveler', 16, 3, '23:00', null, 'Twiga Monte Carlo, Quai Albert 1er', 43.7345, 7.4265,
   14, 14, 'night_fri', 12, false,
   array['Entry off the guest list', 'Line skipped'],
   array['Table service', 'Drinks', 'Getting back to Nice'],
   'Quai Albert 1er, from 22:45', null, 'premium', 18,
   'Guest-list entry on a headline night at the published race-week range plus our booking; a table here is several thousand and is not what this is. Researched, not contracted.',
   array['/photos/monaco-harbour-yachts.jpg']),

  -- ── Saturday ───────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000004',
   'Saturday at Jimmy''z',
   'The one the drivers actually go to. Jimmy''z has been Monaco''s club since 1974, it runs until dawn, and on qualifying night half the grid has been known to turn up. If you buy one night, buy this one.',
   'ticket', 39500, 'USD', 'per_traveler', 14, 4, '23:30', null, 'Jimmy''z Monte-Carlo, Avenue Princesse Grace', 43.7480, 7.4327,
   14, 14, 'night_sat', 13, true,
   array['Entry off the guest list', 'Line skipped'],
   array['Table service', 'Drinks', 'Getting back to Nice'],
   'Avenue Princesse Grace, from 23:15', 'most_popular', 'premium', 18,
   'Guest-list entry on the busiest night of the Monaco year, at the published range plus our booking. Tables here start in the thousands and are a different product. Researched, not contracted.',
   array['/photos/monaco-night-sea.jpg']),

  ('32000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000004',
   'Saturday at Amber Lounge',
   'The Grand Prix party, and the only one that exists purely because of the race: a fashion show with drivers on the runway, then a set that runs very late. Amber Lounge opens for this weekend and no other, and it does not sell at the door.',
   'ticket', 79500, 'USD', 'per_traveler', 10, 4, '21:00', null, 'Amber Lounge, Monte Carlo', 43.7402, 7.4290,
   30, null, 'night_sat', 14, false,
   array['Entry', 'The fashion show', 'One drink'],
   array['Table service', 'Getting back to Nice'],
   'Exact venue confirmed in your app the week before', 'luxury', 'elite', 18,
   'Amber Lounge sells entry from about EUR 500 and tables from about EUR 4,000; this is the entry, plus our booking. It is non-refundable because their guest list closes early and they do not take names off it. Researched, not contracted — applications open in January.',
   array['/photos/monaco-yacht-deck-view.jpg']),

  -- ── Sunday ─────────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000004',
   'Sunday at Jimmy''z, closing night',
   'The last night. Everyone who is still standing ends up here, the race is over so the drivers are relaxed, and it goes until the sun is up over the harbour. Cheaper than Saturday because Saturday is the one everybody books.',
   'ticket', 34500, 'USD', 'per_traveler', 14, 5, '23:30', null, 'Jimmy''z Monte-Carlo, Avenue Princesse Grace', 43.7480, 7.4327,
   14, 14, 'night_sun', 15, false,
   array['Entry off the guest list', 'Line skipped'],
   array['Table service', 'Drinks', 'Getting back to Nice'],
   'Avenue Princesse Grace, from 23:15', null, 'classic', 18,
   'Guest-list entry, published range plus our booking. Researched, not contracted.',
   array['/photos/monaco-night-sea.jpg'])
on conflict (id) do nothing;

-- Every one of these ends long after the last train to Nice. Say so once, on each of them, rather
-- than letting a traveler in the Explorer tier find out at 2 am.
update public.departure_add_ons
set excludes = array_append(excludes, 'A way home: the last train to Nice goes before this ends')
where departure_id = '30000000-0000-4000-8000-000000000004'
  and tier_group in ('night_thu', 'night_fri', 'night_sat', 'night_sun')
  and not ('A way home: the last train to Nice goes before this ends' = any(excludes));

-- ── Explore: Monaco ──────────────────────────────────────────────────────────
-- `recommendations` has existed since migration 022 and has never held a row, which is why the
-- Explore tab is empty. These are free to look at and mostly free to do; the paid things are
-- add-ons, and these are deliberately not.
insert into public.recommendations
  (destination_id, title, description, categories, neighborhood, time_of_day, price_level,
   address, latitude, longitude, maps_url, tour_version_id, day_number, position, is_published)
values
  -- Sights
  ('10000000-0000-4000-8000-000000000004', 'Changing of the guard at the Prince''s Palace',
   'Every day at 11:55, in front of the palace on the rock, and it takes about ten minutes. Get there by 11:40 for a spot at the front. Free, and the walk up through Monaco-Ville is the better half of it.',
   array['culture', 'local']::public.recommendation_category[], 'Monaco-Ville', array['morning'], null,
   'Place du Palais, 98000 Monaco', 43.7314, 7.4203,
   'https://www.google.com/maps/search/?api=1&query=Palais+Princier+de+Monaco', '21000000-0000-4000-8000-000000000002', 2, 1, true),

  ('10000000-0000-4000-8000-000000000004', 'The Oceanographic Museum',
   'Jacques Cousteau ran this place for thirty years. It is built into the cliff face, the aquarium is genuinely good, and the roof terrace has the best free-ish view in Monaco. Two hours, and the one indoor thing worth doing if the weather turns.',
   array['culture', 'rainy_day']::public.recommendation_category[], 'Monaco-Ville', array['morning', 'afternoon'], 2,
   'Avenue Saint-Martin, 98000 Monaco', 43.7307, 7.4256,
   'https://www.google.com/maps/search/?api=1&query=Musee+Oceanographique+de+Monaco', '21000000-0000-4000-8000-000000000002', 2, 2, true),

  ('10000000-0000-4000-8000-000000000004', 'Casino Square, from the outside',
   'You do not have to go in, and on race weekend you largely cannot. Stand at the top of the square in the evening and watch the cars arrive; it is the single most Monaco thing available and it costs nothing. Inside there is a dress code and a passport check.',
   array['culture', 'local']::public.recommendation_category[], 'Monte Carlo', array['evening', 'night'], null,
   'Place du Casino, 98000 Monaco', 43.7396, 7.4278,
   'https://www.google.com/maps/search/?api=1&query=Place+du+Casino+Monaco', '21000000-0000-4000-8000-000000000002', 3, 3, true),

  ('10000000-0000-4000-8000-000000000004', 'The Fairmont Hairpin',
   'The slowest corner in Formula One and the one every photograph is taken at. On a Thursday you can stand on it. From Friday it is inside the circuit, so go early in the week if you want the picture.',
   array['local', 'hidden_gem']::public.recommendation_category[], 'Monte Carlo', array['morning', 'afternoon'], null,
   'Avenue des Spélugues, 98000 Monaco', 43.7397, 7.4271,
   'https://www.google.com/maps/search/?api=1&query=Fairmont+Hairpin+Monaco', '21000000-0000-4000-8000-000000000002', 2, 4, true),

  ('10000000-0000-4000-8000-000000000004', 'Jardin Exotique and the view back down',
   'Cactus gardens cut into the cliff, five hundred feet above the harbour, and almost nobody from the race goes up there. The bus from the port takes fifteen minutes. Best hour of a Thursday if you want Monaco without the noise.',
   array['nature', 'hidden_gem']::public.recommendation_category[], 'Jardin Exotique', array['morning', 'afternoon'], 1,
   '62 Boulevard du Jardin Exotique, 98000 Monaco', 43.7311, 7.4116,
   'https://www.google.com/maps/search/?api=1&query=Jardin+Exotique+de+Monaco', '21000000-0000-4000-8000-000000000002', 2, 5, true),

  ('10000000-0000-4000-8000-000000000004', 'Larvotto beach',
   'Monaco''s public beach, rebuilt a few years ago, free, and about ten minutes from Casino Square. The water is clean and the view back at the principality is better than the one from inside it.',
   array['nature', 'local']::public.recommendation_category[], 'Larvotto', array['morning', 'afternoon'], null,
   'Avenue Princesse Grace, 98000 Monaco', 43.7466, 7.4342,
   'https://www.google.com/maps/search/?api=1&query=Plage+du+Larvotto+Monaco', '21000000-0000-4000-8000-000000000002', 2, 6, true),

  -- Food
  ('10000000-0000-4000-8000-000000000004', 'Marché de la Condamine',
   'The food hall behind the port, and the answer to "where do people who live here eat lunch". Counters rather than restaurants: socca, pasta, barbajuan. Ten to fifteen euros and it is open at midday, which on race weekend matters more than it sounds.',
   array['food', 'local', 'hidden_gem']::public.recommendation_category[], 'La Condamine', array['morning', 'afternoon'], 1,
   'Place d''Armes, 98000 Monaco', 43.7333, 7.4204,
   'https://www.google.com/maps/search/?api=1&query=Marche+de+la+Condamine+Monaco', '21000000-0000-4000-8000-000000000002', null, 7, true),

  ('10000000-0000-4000-8000-000000000004', 'Café de Paris Monte-Carlo',
   'The brasserie on Casino Square. Not a secret and not cheap, but the terrace is the best people-watching in the principality and you can sit there for an hour over one coffee. Book for dinner in race week or do not bother turning up.',
   array['food', 'coffee']::public.recommendation_category[], 'Monte Carlo', array['morning', 'afternoon', 'evening'], 3,
   'Place du Casino, 98000 Monaco', 43.7392, 7.4283,
   'https://www.google.com/maps/search/?api=1&query=Cafe+de+Paris+Monte-Carlo', '21000000-0000-4000-8000-000000000002', null, 8, true),

  ('10000000-0000-4000-8000-000000000004', 'Beefbar, Fontvieille',
   'Down in Fontvieille, away from the circuit, which is the point: on Saturday night it is the one good room in Monaco you can still get a table in. Steak, and very good.',
   array['food']::public.recommendation_category[], 'Fontvieille', array['evening'], 3,
   '42 Quai Jean-Charles Rey, 98000 Monaco', 43.7273, 7.4256,
   'https://www.google.com/maps/search/?api=1&query=Beefbar+Monaco', '21000000-0000-4000-8000-000000000002', null, 9, true),

  ('10000000-0000-4000-8000-000000000004', 'Le Louis XV — Alain Ducasse',
   'Three Michelin stars in the Hôtel de Paris, and one of the great dining rooms in Europe. Several hundred euros a head and booked months out, race weekend especially. Here because you asked what the top of Monaco looks like, not because we think you should.',
   array['food', 'romantic']::public.recommendation_category[], 'Monte Carlo', array['evening'], 4,
   'Place du Casino, 98000 Monaco', 43.7390, 7.4271,
   'https://www.google.com/maps/search/?api=1&query=Le+Louis+XV+Alain+Ducasse+Monaco', '21000000-0000-4000-8000-000000000002', null, 10, true),

  ('10000000-0000-4000-8000-000000000004', 'La Montgolfière',
   'A tiny room up in Monaco-Ville doing French cooking with a Southeast Asian hand. About twenty covers, so book. The best value proper dinner in the principality, which is a low bar cleared by a distance.',
   array['food', 'hidden_gem']::public.recommendation_category[], 'Monaco-Ville', array['evening'], 3,
   '16 Rue Basse, 98000 Monaco', 43.7314, 7.4224,
   'https://www.google.com/maps/search/?api=1&query=La+Montgolfiere+Monaco', '21000000-0000-4000-8000-000000000002', null, 11, true),

  ('10000000-0000-4000-8000-000000000004', 'Bar of the Hôtel Hermitage',
   'A quiet, high-ceilinged room to end a night in when the harbour is unbearable. No queue, no list, no music you have to shout over. Order one thing and stay an hour.',
   array['bars', 'romantic']::public.recommendation_category[], 'Monte Carlo', array['evening', 'night'], 3,
   'Square Beaumarchais, 98000 Monaco', 43.7387, 7.4265,
   'https://www.google.com/maps/search/?api=1&query=Hotel+Hermitage+Monte-Carlo', '21000000-0000-4000-8000-000000000002', null, 12, true)
on conflict do nothing;
