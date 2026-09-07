-- Seed: the first tour, "Southern France" — Nice → Avignon → Paris, 9 days. Version 1, published.
-- Free time is deliberate. Every item states who arranges it. Welcome drinks (8 pm, night one) are
-- the anchor; the farewell dinner is a paid add-on (seed 040), not included.

insert into public.tours (id, slug, name, duration_days, group_size_min, group_size_max, activity_level, is_published)
values ('20000000-0000-4000-8000-000000000001', 'southern-france', 'Southern France', 9, 6, 14, 'moderate', true)
on conflict (id) do nothing;

insert into public.tour_versions
  (id, tour_id, version_number, status, tagline, summary, description, why_this_trip,
   starting_price_amount, starting_price_currency, seo_title, seo_description, published_at)
values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'published',
   'Riviera light, Provençal wine, Parisian evenings — on your own terms.',
   'Nine days from the Mediterranean to the Seine. We book the hotels, the trains and one wine afternoon worth showing up for. You fly into Nice, meet Your Group over a drink on night one, and explore each city at your own pace.',
   'Three cities, three rhythms. Nice for sea and light. Avignon for slow lunches and vineyards. Paris for everything else. Your Route lives in the app: where you are staying, when the train leaves, what is worth a walk, and hours of free time on purpose. Add a boat day or a cellar afternoon if you like; skip them if you don''t.',
   'Everything planned. Nothing forced. This is the route we would send a friend on, with a group to share it and no one telling you where to stand.',
   349500, 'USD',
   'Southern France Trip — Nice, Avignon, Paris | Guideless Travel',
   'A 9-day small-group trip through Nice, Avignon and Paris with hotels, trains and experiences organized — and no tour guide.',
   now())
on conflict (id) do nothing;

update public.tours set current_version_id = '21000000-0000-4000-8000-000000000001'
where id = '20000000-0000-4000-8000-000000000001';

insert into public.tour_version_destinations (tour_version_id, destination_id, position, nights) values
  ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, 3),
  ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 2, 2),
  ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 3, 3)
on conflict do nothing;

insert into public.tour_included_items (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000001', 1, '8 nights in well-located hotels', 'Three in Nice, two in Avignon, three in Paris. Breakfast included.'),
  ('21000000-0000-4000-8000-000000000001', 2, 'Welcome transfer from Nice airport', 'A shared drive with your group on arrival day.'),
  ('21000000-0000-4000-8000-000000000001', 3, 'Trains: Nice → Avignon → Paris', 'Reserved seats. Tickets in your app.'),
  ('21000000-0000-4000-8000-000000000001', 4, 'Châteauneuf-du-Pape wine afternoon', 'A small-producer tasting with a long lunch on day 5. Included in the price; join if you like.'),
  ('21000000-0000-4000-8000-000000000001', 5, 'Welcome drinks on night one', 'First round on us at a bar in the old town at 8 pm. Meet Your Group, then do what you want.'),
  ('21000000-0000-4000-8000-000000000001', 6, 'Your Guide, in the app', 'Your Route day by day, maps, our recommendations, Your Group chat and a human on support.');

insert into public.tour_excluded_items (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000001', 1, 'Flights', 'Fly into Nice (NCE) and out of Paris (CDG or ORY). We tell you exactly when to arrive.'),
  ('21000000-0000-4000-8000-000000000001', 2, 'Most meals', 'Breakfast is included. The rest is yours — we have recommendations.'),
  ('21000000-0000-4000-8000-000000000001', 3, 'Travel insurance', 'Required. Bring your own.'),
  ('21000000-0000-4000-8000-000000000001', 4, 'Museum and attraction tickets', 'Except where an experience is listed as included.'),
  ('21000000-0000-4000-8000-000000000001', 5, 'Optional add-ons', 'Boat day, cellar afternoon, farewell dinner, private transfer, extra night. Pick them at booking or any time in the app, and pay only for what you choose.');

insert into public.tour_faqs (tour_version_id, position, question, answer) values
  ('21000000-0000-4000-8000-000000000001', 1, 'Is there really no guide?', 'There is no tour guide. Your itinerary, maps, recommendations and support live in the Guideless app, and a small Guideless team is reachable whenever you need a human.'),
  ('21000000-0000-4000-8000-000000000001', 2, 'Do I have to do things with the group?', 'No. Group moments are optional. Many travelers do the welcome drinks and the wine afternoon and otherwise go their own way.'),
  ('21000000-0000-4000-8000-000000000001', 3, 'What if my train is late or a hotel has a problem?', 'Message support in the app. We see your trip, your location and your itinerary, and we fix it.'),
  ('21000000-0000-4000-8000-000000000001', 4, 'Can I book for two people?', 'Yes. Add each traveler at checkout. Everyone gets their own room unless two of you choose to share one, which lowers the price for both.'),
  ('21000000-0000-4000-8000-000000000001', 5, 'What are add-ons?', 'Optional extras with their own price: the Riviera boat day, a cellar afternoon in Châteauneuf, the farewell dinner, a private airport transfer, an extra night in Paris. Choose them when you book or later in the app. The app shows who else from Your Group is doing each one.'),
  ('21000000-0000-4000-8000-000000000001', 6, 'When do I meet the group?', 'Your Group opens in the app about a month before departure: see who is coming, say hello, or don''t. In person, it starts with welcome drinks at 8 pm on night one.');

-- Days
insert into public.tour_days (id, tour_version_id, day_number, destination_id, title, summary) values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 1, '10000000-0000-4000-8000-000000000001', 'Arrive in Nice', 'Land, meet the group on the welcome drive, settle in. Welcome drinks at eight if you feel like it.'),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 2, '10000000-0000-4000-8000-000000000001', 'Nice, your way', 'Old town, Cours Saleya market, the Promenade. Free all day.'),
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 3, '10000000-0000-4000-8000-000000000001', 'The coast', 'Villefranche, Èze or Antibes by train — pick one. Or stay and swim.'),
  ('22000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', 4, '10000000-0000-4000-8000-000000000002', 'Train to Avignon', 'Morning train along the coast and up the Rhône. Afternoon in the walled city.'),
  ('22000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 5, '10000000-0000-4000-8000-000000000002', 'Wine afternoon', 'Free morning. Châteauneuf-du-Pape tasting and lunch in the afternoon: included in the price, optional to join.'),
  ('22000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 6, '10000000-0000-4000-8000-000000000003', 'Train to Paris', 'TGV to Paris. Evening free.'),
  ('22000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000001', 7, '10000000-0000-4000-8000-000000000003', 'Paris', 'Free all day. Our recommendations are by neighborhood.'),
  ('22000000-0000-4000-8000-000000000008', '21000000-0000-4000-8000-000000000001', 8, '10000000-0000-4000-8000-000000000003', 'Paris, and a last dinner', 'Free day. Farewell dinner at eight for whoever added it.'),
  ('22000000-0000-4000-8000-000000000009', '21000000-0000-4000-8000-000000000001', 9, '10000000-0000-4000-8000-000000000003', 'Depart', 'Check out. Fly home or keep going.')
on conflict (id) do nothing;

-- Items (times are local, Europe/Paris). visibility public_preview = shown on the marketing page.
insert into public.tour_itinerary_items
  (tour_day_id, position, type, title, description, start_time, end_time, timezone, location_name, responsibility, is_optional, visibility)
values
  -- Day 1
  ('22000000-0000-4000-8000-000000000001', 1, 'flight',      'Arrive at Nice Côte d''Azur (NCE)', 'Land by 14:00 local time to make the welcome drive.', null, '14:00', 'Europe/Paris', 'Nice Côte d''Azur Airport', 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000001', 2, 'transfer',    'Welcome drive to the hotel', 'Meet your group at Terminal 2 arrivals. Look for the Guideless sign.', '14:30', '15:15', 'Europe/Paris', 'NCE Terminal 2', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000001', 3, 'check_in',    'Check in', null, '15:30', null, 'Europe/Paris', 'Your Nice hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000001', 4, 'free_time',   'Explore Nice', 'Walk to the water. It is ten minutes.', '16:00', '19:00', 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000001', 5, 'live_moment', 'Welcome drinks', 'First round on us at a bar in the old town. Come and go as you like; the app shows who''s coming.', '20:00', '22:00', 'Europe/Paris', 'Old town bar (exact spot in your app)', 'guideless', true, 'public_preview'),
  -- Day 2
  ('22000000-0000-4000-8000-000000000002', 1, 'meal',        'Breakfast at the hotel', null, '07:30', '10:00', 'Europe/Paris', 'Your Nice hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000002', 2, 'free_time',   'Old town and Cours Saleya market', 'Socca from Chez Thérésa. Climb Castle Hill for the view.', '10:00', '13:00', 'Europe/Paris', 'Vieux Nice', 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000002', 3, 'recommendation', 'Recommended lunch', 'See Explore for three options within a ten-minute walk.', '13:00', null, 'Europe/Paris', null, 'traveler', true, 'public_preview'),
  ('22000000-0000-4000-8000-000000000002', 4, 'free_time',   'Afternoon on the Promenade', 'Rent a bike, swim, or do nothing. Boat day is an optional add-on today for those who chose it.', '14:00', null, 'Europe/Paris', 'Promenade des Anglais', 'traveler', false, 'public_preview'),
  -- Day 3
  ('22000000-0000-4000-8000-000000000003', 1, 'free_time',   'Coastal day trip', 'Regional trains leave every 30 minutes. Villefranche is 8 minutes; Antibes is 25.', '09:00', null, 'Europe/Paris', 'Nice-Ville station', 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000003', 2, 'live_moment', 'Sunset at Castle Hill', 'Someone from the group will probably go. Join if you like.', '20:00', '21:00', 'Europe/Paris', 'Colline du Château', 'guideless', true, 'trip_member'),
  -- Day 4
  ('22000000-0000-4000-8000-000000000004', 1, 'check_out',   'Check out', 'Bags can be stored at reception until you leave for the station.', null, '10:00', 'Europe/Paris', 'Your Nice hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000004', 2, 'train',       'Train to Avignon', 'Reserved seats. Ticket in your app under Documents.', '10:52', '14:10', 'Europe/Paris', 'Nice-Ville → Avignon Centre', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000004', 3, 'check_in',    'Check in', 'Ten-minute walk inside the walls.', '15:00', null, 'Europe/Paris', 'Your Avignon hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000004', 4, 'free_time',   'Explore Avignon', 'Palais des Papes, the bridge, Place de l''Horloge.', '15:30', null, 'Europe/Paris', 'Intra-muros', 'traveler', false, 'public_preview'),
  -- Day 5
  ('22000000-0000-4000-8000-000000000005', 1, 'free_time',   'Free morning', 'Les Halles market opens at six.', '08:00', '12:00', 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000005', 2, 'meeting_point', 'Meet for the wine afternoon', 'Minibus leaves from the hotel. Fifteen minutes to the vineyards.', '12:15', '12:30', 'Europe/Paris', 'Hotel lobby', 'guideless', true, 'public_preview'),
  ('22000000-0000-4000-8000-000000000005', 3, 'activity',    'Châteauneuf-du-Pape tasting and lunch', 'Small producer, long table, four wines. Included; the cellar afternoon that follows is an optional add-on.', '13:00', '17:00', 'Europe/Paris', 'Châteauneuf-du-Pape', 'guideless', true, 'public_preview'),
  ('22000000-0000-4000-8000-000000000005', 4, 'free_time',   'Evening in Avignon', null, '18:00', null, 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  -- Day 6
  ('22000000-0000-4000-8000-000000000006', 1, 'check_out',   'Check out', null, null, '10:30', 'Europe/Paris', 'Your Avignon hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000006', 2, 'train',       'TGV to Paris', 'Avignon TGV station is outside the walls — shared transfer at 11:00.', '11:40', '14:20', 'Europe/Paris', 'Avignon TGV → Paris Gare de Lyon', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000006', 3, 'check_in',    'Check in', null, '15:30', null, 'Europe/Paris', 'Your Paris hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000006', 4, 'free_time',   'First evening in Paris', 'Walk the river. Eat late.', '17:00', null, 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  -- Day 7
  ('22000000-0000-4000-8000-000000000007', 1, 'free_time',   'Paris, all day', 'Our recommendations are organized by neighborhood — pick one and stay in it.', '09:00', null, 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  -- Day 8
  ('22000000-0000-4000-8000-000000000008', 1, 'free_time',   'Paris, again', null, '09:00', '19:00', 'Europe/Paris', null, 'traveler', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000008', 2, 'activity',    'Farewell dinner', 'A neighbourhood bistro, one long table. Optional add-on; reserve when you book or any time in the app.', '20:00', '22:30', 'Europe/Paris', 'Le Marais', 'guideless', true, 'public_preview'),
  -- Day 9
  ('22000000-0000-4000-8000-000000000009', 1, 'check_out',   'Check out', 'Bags can be stored if your flight is later.', null, '11:00', 'Europe/Paris', 'Your Paris hotel', 'guideless', false, 'public_preview'),
  ('22000000-0000-4000-8000-000000000009', 2, 'flight',      'Fly home', 'RER B to CDG is about 45 minutes; Orlyval to ORY about 35. Or add an extra night and leave tomorrow.', null, null, 'Europe/Paris', 'CDG / ORY', 'traveler', false, 'public_preview');
