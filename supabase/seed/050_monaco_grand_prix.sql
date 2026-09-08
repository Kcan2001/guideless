-- Seed: "Monaco Grand Prix Weekend" — the event-anchored product. One group of up to 50, two stay
-- tiers (Nice or Monte Carlo), race viewing as mutually exclusive ticket tiers, welcome drinks on
-- night one. Race weekend 4–6 June 2027; trip Wed 2 → Mon 7 June. Prices in USD minor units.
-- Dates and prices were set from research at the foot of this file; read that before changing them.

insert into public.destinations
  (id, slug, name, country_code, country_name, region, timezone, latitude, longitude, summary, emergency_numbers, is_published)
values
  ('10000000-0000-4000-8000-000000000004', 'monaco', 'Monaco', 'MC', 'Monaco', 'Côte d''Azur', 'Europe/Monaco',
   43.7384, 7.4246,
   'Two square kilometres of harbour, hairpins and hotel terraces. Loudest in June.',
   '{"general":"112","police":"17","ambulance":"18","fire":"18"}', true)
on conflict (id) do nothing;

insert into public.tours (id, slug, name, duration_days, group_size_min, group_size_max, activity_level, is_published,
                          kind, event_name, event_starts_on, event_ends_on, event_location)
values ('20000000-0000-4000-8000-000000000002', 'monaco-grand-prix', 'Monaco Grand Prix Weekend', 5, 12, 50, 'relaxed', true,
        'event', 'Formula 1 Monaco Grand Prix 2027', '2027-06-04', '2027-06-06', 'Circuit de Monaco')
on conflict (id) do nothing;

insert into public.tour_versions
  (id, tour_id, version_number, status, tagline, summary, description, why_this_trip,
   starting_price_amount, starting_price_currency, seo_title, seo_description, published_at)
values
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1, 'published',
   'Race weekend with a group. Your hotel, your seat, your call.',
   'Four nights on the Riviera for the Monaco Grand Prix, 3 to 7 June 2027. Stay in Nice for value or in Monaco for the full show. Pick your race view, grandstand, terrace or yacht, and meet up to fifty people doing the same weekend fifty different ways.',
   'We book the hotels, your train pass between Nice and Monaco, and welcome drinks on Thursday night. Practice is Friday, qualifying Saturday, the race Sunday at 3 pm. Race viewing is an add-on, so you pay only for the view you want. Couples meet couples, solos meet solos, and everyone compares notes at the harbour on Sunday night.',
   'Nobody else sells the group. Package operators sell luxury; we sell the weekend you actually want, with people to share it.',
   189000, 'USD',
   'Monaco Grand Prix 2027 Group Trip — Nice or Monaco Hotels | Guideless Travel',
   'A social group trip for the 2027 Monaco Grand Prix: hotels in Nice or Monaco, race viewing tiers as add-ons, welcome drinks, no tour guide.',
   now())
on conflict (id) do nothing;

update public.tours set current_version_id = '21000000-0000-4000-8000-000000000002'
where id = '20000000-0000-4000-8000-000000000002';

insert into public.tour_version_destinations (tour_version_id, destination_id, position, nights) values
  ('21000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 4),
  ('21000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 2, 0)
on conflict do nothing;

insert into public.tour_included_items (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000002', 1, '4 nights in Nice or Monaco', 'Choose your tier at booking: a 3-star by the port in Nice or a 5-star in Monte Carlo. Breakfast included either way, your own room unless you choose to share.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'Welcome drinks Thursday', 'First round on us at a harbour bar. Meet the group before the noise starts.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'Train passes Nice ↔ Monaco', 'Unlimited regional trains Friday to Sunday. Twenty minutes each way; the trains beat every road that weekend.'),
  ('21000000-0000-4000-8000-000000000002', 4, 'Your Guide, in the app', 'Session timings, which gate, where Your Group is, and what to do with Saturday morning.')
on conflict do nothing;

insert into public.tour_faqs (tour_version_id, position, question, answer) values
  ('21000000-0000-4000-8000-000000000002', 1, 'Are race tickets included?', 'No. Race viewing is an add-on so you pay only for the view you want: a grandstand seat, a harbour terrace with lunch, or a berthed yacht on race day. Each covers the sessions listed on it. Pick one per traveler at booking or later in the app while seats last.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'Nice or Monaco: which should I choose?', 'Nice is the value tier: a good 3-star by the port, twenty minutes by train from the circuit, and where the welcome drinks are. Monaco is the full show: four nights in a 5-star in Monte Carlo, walking distance to the track. One group, two prices; everyone meets at the harbour on Sunday night.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'I am coming alone. Will I be on my own all weekend?', 'Only if you want to be. You get your own room by default, welcome drinks on Thursday bring everyone together, the app shows who from Your Group chose the same race view, and the harbour debrief on Sunday is open to all. Nothing is mandatory.'),
  ('21000000-0000-4000-8000-000000000002', 4, 'Do I need a car?', 'No. Your train pass covers Nice to Monaco and back all weekend, and the circuit is a walk from Monaco station. If you land late, a private airport transfer is an optional add-on.')
on conflict do nothing;

insert into public.tour_excluded_items (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000002', 1, 'Race tickets', 'Sold as add-ons so you pay for the view you want: grandstand, terrace or yacht.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'Flights', 'Fly into Nice (NCE). We tell you when to arrive.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'Most meals', 'Breakfast is included; the Riviera does the rest.')
on conflict do nothing;

insert into public.tour_days (id, tour_version_id, day_number, destination_id, title, summary) values
  ('22000000-0000-4000-8000-000000000011', '21000000-0000-4000-8000-000000000002', 1, '10000000-0000-4000-8000-000000000001', 'Arrive on the Riviera', 'Land in Nice by five, check in wherever you chose to stay, welcome drinks at 8 pm at the harbour in Nice.'),
  ('22000000-0000-4000-8000-000000000012', '21000000-0000-4000-8000-000000000002', 2, '10000000-0000-4000-8000-000000000004', 'Practice day', 'Friday: free practice in Monaco if your race view includes it, or a slow day on the coast. Trains run every 20 minutes.'),
  ('22000000-0000-4000-8000-000000000013', '21000000-0000-4000-8000-000000000002', 3, '10000000-0000-4000-8000-000000000004', 'Qualifying', 'Saturday in Monaco: qualifying at 4 pm, the harbour, the terraces. Leave Nice by 9:30 to beat the queues.'),
  ('22000000-0000-4000-8000-000000000014', '21000000-0000-4000-8000-000000000002', 4, '10000000-0000-4000-8000-000000000004', 'Race day', 'Sunday, lights out at 3 pm. Your seat, your view. Group debrief at the harbour afterwards, optional as ever.'),
  ('22000000-0000-4000-8000-000000000015', '21000000-0000-4000-8000-000000000002', 5, '10000000-0000-4000-8000-000000000001', 'Home', 'Check out by 11. Late flight? We hold your bags at the Nice hotel until 6 pm.')
on conflict (id) do nothing;

insert into public.tour_itinerary_items
  (tour_day_id, position, type, title, description, start_time, end_time, timezone, location_name, responsibility, is_optional, visibility, is_anchor)
values
  ('22000000-0000-4000-8000-000000000011', 1, 'flight',      'Arrive at Nice Côte d''Azur (NCE)', 'Land by 17:00 to make welcome drinks.', null, '17:00', 'Europe/Paris', 'Nice Côte d''Azur Airport', 'traveler', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000011', 2, 'check_in',    'Check in', 'Nice or Monaco, whichever you chose.', '15:00', null, 'Europe/Paris', 'Your hotel', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000011', 3, 'live_moment', 'Welcome drinks', 'First round on us at a harbour bar in Nice, 8 pm. Fifty people, one weekend, no agenda.', '20:00', '22:30', 'Europe/Paris', 'Port Lympia, Nice', 'guideless', true, 'public_preview', true),
  ('22000000-0000-4000-8000-000000000012', 1, 'free_time',   'Free practice or free day', 'Trains to Monaco every 20 minutes with your pass; grandstand and terrace add-ons cover Saturday and Sunday, so Friday is yours. Or Villefranche and a swim.', null, null, 'Europe/Paris', null, 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000013', 1, 'train',       'Nice → Monaco', 'Any TER with your pass. Leave by 09:30 to beat the queues.', '09:30', '10:00', 'Europe/Paris', 'Nice-Ville station', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000013', 2, 'activity',    'Qualifying', 'Your race-view add-on covers Saturday too.', '16:00', '17:00', 'Europe/Monaco', 'Circuit de Monaco', 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 1, 'train',       'Nice → Monaco', 'Race day trains are busy. The group meets at the station café at 09:00 if you want company.', '09:15', '09:45', 'Europe/Paris', 'Nice-Ville station', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 2, 'activity',    'Race', 'Lights out at 15:00. Your view depends on your add-on: grandstand K, the harbour terrace or the yacht.', '15:00', '17:00', 'Europe/Monaco', 'Circuit de Monaco', 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 3, 'live_moment', 'Harbour debrief', 'Whoever wants to, at the harbour after the podium. Your Group, one last time.', '19:30', '22:00', 'Europe/Monaco', 'Port Hercule', 'guideless', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000015', 1, 'check_out',   'Check out', 'By 11:00. We hold bags at the Nice hotel until 18:00.', null, '11:00', 'Europe/Paris', 'Your hotel', 'guideless', false, 'public_preview', false)
on conflict do nothing;

-- The departure: 50 seats, $1,890 per traveler in their own Nice 3★ room, $500 deposit, share and save $300.
insert into public.departures
  (id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity, minimum_travelers,
   price_amount, deposit_amount, currency, booking_deadline, balance_due_date, shared_room_discount_amount, group_opens_days_before)
values
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002',
   'open', '2027-06-03', '2027-06-07', 'Europe/Paris', 50, 12, 189000, 50000, 'USD', '2027-04-20', '2027-03-31', 30000, 45)
on conflict (id) do nothing;

insert into public.departure_stay_options
  (id, departure_id, name, description, hotel_name, area, star_rating, destination_id, price_delta_amount, shared_room_discount_amount, capacity, position, is_default)
values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'Nice, 3★ near the port',
   'A good three-star ten minutes from Nice-Ville station. 20 minutes by train to the circuit, a fraction of Monaco prices, and the group''s base for drinks.',
   null, 'Port area, Nice', 3, '10000000-0000-4000-8000-000000000001', 0, 30000, 34, 1, true),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 'Monaco, 5★ in Monte Carlo',
   'Walk to the circuit. Four nights in a five-star during race week; this is the tier for people who want the full show.',
   null, 'Monte Carlo, Monaco', 5, '10000000-0000-4000-8000-000000000004', 395000, 180000, 16, 2, false)
on conflict (id) do nothing;

-- Race viewing: pick one per traveler (tier_group). Thursday drinks are included, so no add-on.
insert into public.departure_add_ons
  (id, departure_id, title, description, kind, price_amount, currency, pricing_basis, capacity, day_number, start_time, end_time,
   location_name, latitude, longitude, bookable_until_days_before, cancellable_until_days_before, tier_group, position, is_featured)
values
  ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'Grandstand K (Sat + Sun)',
   'Reserved seats over the swimming-pool section for Saturday qualifying and Sunday''s race. The classic view and the loudest one.',
   'ticket', 129000, 'USD', 'per_traveler', 30, 4, '15:00', '17:00', 'Grandstand K, Circuit de Monaco', 43.7346, 7.4229, 14, 30, 'race_view', 1, true),
  ('32000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 'Terrace with lunch (Sat + Sun)',
   'A private terrace above the harbour chicane for Saturday and Sunday, with lunch and an open bar both days. Sit down when you want to.',
   'ticket', 349000, 'USD', 'per_traveler', 20, 4, '11:00', '18:00', 'Harbour terrace, Port Hercule', 43.7355, 7.4266, 14, 30, 'race_view', 2, true),
  ('32000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', 'Yacht in the harbour (Sun)',
   'Sunday on a circuit-berthed yacht: brunch, bar, the cars at eye level. Shared with the members of Your Group who choose it.',
   'ticket', 595000, 'USD', 'per_traveler', 12, 4, '10:00', '18:00', 'Port Hercule berth', 43.7361, 7.4270, 14, 45, 'race_view', 3, true),
  ('32000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'Friday coast boat to Monaco',
   'Skip the train once: a group boat from Nice along the coast into the harbour for practice day, with a swim stop off Cap Ferrat.',
   'activity', 21000, 'USD', 'per_traveler', 12, 2, '10:00', '13:00', 'Port Lympia, Nice', 43.6955, 7.2851, 1, 7, null, 4, false),
  ('32000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', 'Private airport transfer',
   'Your own car from the airport to your hotel, Nice or Monaco.',
   'transfer', 12000, 'USD', 'per_booking', null, 1, null, null, 'Nice Côte d''Azur Airport', null, null, 2, 3, null, 5, false)
on conflict (id) do nothing;

-- ── Presentation (migration 039) ─────────────────────────────────────────────
-- Updates rather than inserts so existing databases pick these up too. Honesty rules: no star
-- rating or property name until a hotel is contracted; nothing listed that isn't in the price.
update public.departure_stay_options set
  name = 'Nice, near the port',
  tagline = 'Spend less on the room. Spend more on the weekend.',
  description = 'A comfortable hotel in the port quarter, the group''s base for drinks and a short hop to Nice-Ville for the train to the circuit. A fraction of Monaco race-week prices.',
  star_rating = null,
  label = 'best_value',
  includes = array['4 nights', 'Breakfast', 'Train pass Nice ↔ Monaco', 'Property named at booking'],
  excludes = array['Flights', 'Race tickets (choose below)'],
  details = jsonb_build_object(
    'neighborhood', 'Port Lympia / Old Town',
    'station_distance', '10–15 min to Nice-Ville by tram or taxi',
    'train_time', '20–25 min Nice → Monaco',
    'breakfast', 'Included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false),
  why_price_note = 'This is the base trip: the hotel, the train pass and the welcome drinks are already in the price. Nothing to add unless you want to.',
  image_urls = array['/photos/nice-old-town-evening.jpg', '/photos/nice-promenade-dusk.jpg']
where id = '31000000-0000-4000-8000-000000000001';

update public.departure_stay_options set
  name = 'Monaco, Monte Carlo',
  tagline = 'Wake up in the middle of the action.',
  description = 'Four nights in Monte Carlo during race week, walking distance to the circuit. No train in the morning, and the harbour at your door at night.',
  star_rating = null,
  label = null,
  includes = array['4 nights in Monte Carlo', 'Breakfast', 'Walk to the circuit', 'Property confirmed at booking'],
  excludes = array['Flights', 'Race tickets (choose below)'],
  details = jsonb_build_object(
    'neighborhood', 'Monte Carlo',
    'station_distance', 'Walking distance to the circuit; Monaco-Monte-Carlo station nearby',
    'train_time', 'None needed on race days',
    'breakfast', 'Included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false),
  why_price_note = 'Four nights in Monte Carlo during race week, walking distance to the circuit; race-week hotel pricing.',
  image_urls = array['/photos/monaco-casino-square.jpg', '/photos/monaco-harbour-rock.jpg']
where id = '31000000-0000-4000-8000-000000000002';

update public.departure_add_ons set
  label = 'most_popular',
  includes = array['Grandstand K seat Saturday + Sunday', 'Access both days'],
  excludes = array['Food and drinks', 'Transfers to the circuit'],
  meeting_point = 'Grandstand K entrance, Circuit de Monaco',
  why_price_note = 'Official two-day grandstand seating over the swimming-pool section, at face value plus our booking.',
  image_urls = array['/photos/monaco-trackside-barriers.jpg', '/photos/monaco-hairpin-race.jpg']
where id = '32000000-0000-4000-8000-000000000001';

update public.departure_add_ons set
  includes = array['Terrace access Saturday + Sunday', 'Lunch both days', 'Open bar both days'],
  excludes = array['Transfers to the circuit'],
  meeting_point = 'Harbour terrace, Port Hercule (exact entrance in your app)',
  why_price_note = 'A private terrace with catering above the harbour chicane for two race days; hospitality pricing, shared with the members of Your Group who choose it.'
where id = '32000000-0000-4000-8000-000000000002';

update public.departure_add_ons set
  includes = array['Sunday on a circuit-berthed yacht', 'Brunch and bar', 'Cars at eye level'],
  excludes = array['Saturday qualifying', 'Transfers to the harbour'],
  meeting_point = 'Port Hercule berth (exact berth in your app)',
  why_price_note = 'Race-day yacht berths in the harbour are the scarcest seats in Monaco; the price is the berth, the boat, the crew and the catering divided by the twelve people on board.',
  image_urls = array['/photos/monaco-harbour-yachts.jpg', '/photos/monaco-yacht-deck-view.jpg']
where id = '32000000-0000-4000-8000-000000000003';

update public.departure_add_ons set
  label = 'social',
  includes = array['Shared boat Nice → Monaco', 'Skipper', 'Swim stop near Cap Ferrat', 'Arrival in Monaco harbour for practice day'],
  excludes = array['Lunch', 'Drinks', 'Return (your train pass covers it)'],
  meeting_point = 'Port Lympia, Nice · 10:00',
  why_price_note = 'The boat and skipper for the morning, split across up to twelve travelers.',
  image_urls = array['/photos/nice-beach-castle-hill.jpg']
where id = '32000000-0000-4000-8000-000000000004';

update public.departure_add_ons set
  includes = array['Private car, airport to your hotel', 'Driver meets you at arrivals'],
  excludes = array['Return to the airport'],
  meeting_point = 'Nice Côte d''Azur Airport, arrivals hall',
  why_price_note = 'One car per booking, so it costs the same whether you travel alone or as a pair.'
where id = '32000000-0000-4000-8000-000000000005';

-- Marketing copy on the version follows the same rule: no star ratings for unconfirmed properties.
update public.tour_included_items
set description = 'Choose your tier at booking: a well-located hotel by the port in Nice, or a hotel in Monte Carlo within walking distance of the circuit. Breakfast included either way, your own room unless you choose to share. Properties are named in your confirmation.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and position = 1;
update public.tour_faqs
set answer = 'Nice is the value tier: a comfortable hotel by the port, twenty minutes by train from the circuit, and where the welcome drinks are. Monaco is the full show: four nights in Monte Carlo, walking distance to the track, at race-week prices. One group, two prices; everyone meets at the harbour on Sunday night. Hotels are named in your confirmation.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and question = 'Nice or Monaco: which should I choose?';

-- ── Public tiers (migration 040) ─────────────────────────────────────────────
-- Explorer / Classic / Premium / Elite. The transfer has no tier: it is not a level of anything.
update public.departure_stay_options set tier = 'explorer' where id = '31000000-0000-4000-8000-000000000001';
update public.departure_stay_options set tier = 'elite'    where id = '31000000-0000-4000-8000-000000000002';
update public.departure_add_ons set tier = 'explorer' where id = '32000000-0000-4000-8000-000000000001'; -- Grandstand K
update public.departure_add_ons set tier = 'classic'  where id = '32000000-0000-4000-8000-000000000002'; -- Terrace with lunch
update public.departure_add_ons set tier = 'elite'    where id = '32000000-0000-4000-8000-000000000003'; -- Yacht in the harbour
update public.departure_add_ons set tier = 'premium'  where id = '32000000-0000-4000-8000-000000000004'; -- Friday coast boat
update public.departure_add_ons set tier = null       where id = '32000000-0000-4000-8000-000000000005'; -- Private airport transfer

-- An event weekend is a different risk from a touring route, so it gets its own ladder. Race-week
-- rooms in Nice and Monaco are prepaid and non-refundable well before departure, and the weekend
-- cannot be resold to anyone else once we are close, so the tiers step down earlier and reach zero
-- two months out rather than two weeks.
update public.departures
set cancellation_policy = '[
  {"daysBeforeDeparture": 120, "refundPercentage": 70},
  {"daysBeforeDeparture": 90,  "refundPercentage": 45},
  {"daysBeforeDeparture": 60,  "refundPercentage": 20},
  {"daysBeforeDeparture": 0,   "refundPercentage": 0}
]'::jsonb
where id = '30000000-0000-4000-8000-000000000004';

-- Race viewing is bought in our travelers' names months ahead and the event does not take it back,
-- so it is non-refundable from purchase and now says so. The boat and the transfer are ordinary
-- suppliers and keep a real window.
update public.departure_add_ons
set cancellable_until_days_before = null
where departure_id = '30000000-0000-4000-8000-000000000004'
  and tier_group = 'race_view';

-- ── Real dates, real prices, and the yacht (2026-09-08) ──────────────────────
-- The 2027 Grand Prix runs Friday 4 to Sunday 6 June, the race at 15:00 Sunday. Kyle set the trip
-- Wednesday to Monday, so it is 2–7 June 2027: five nights, arriving two days before the track
-- opens and leaving the morning after the race. That adds a night and a whole free Thursday.
--
-- Every price below replaces a placeholder. They are built from published figures: 2026 grandstand
-- face values plus about 9% into 2027, Amber Lounge's own per-day yacht rates, race-week room rates
-- in Nice and Monte Carlo, and the TER fare. Two assumptions run through all of it, both recorded
-- in docs/pricing.md: roughly 1.09 USD to the euro, and no trade discount agreed with any supplier
-- yet, so these are retail costs with our margin on top.

update public.tours
set duration_days = 6
where id = '20000000-0000-4000-8000-000000000002';

update public.tour_versions set
  summary = 'Five nights on the Riviera for the Monaco Grand Prix, 2 to 7 June 2027. Stay in Nice for value or in Monaco for the full show. Pick your race view, grandstand, terrace or yacht, and meet up to fifty people doing the same weekend fifty different ways.',
  description = 'We book the hotels, your train pass between Nice and Monaco, and welcome drinks on Wednesday night. You get a free Thursday on the coast before the track opens. Practice is Friday, qualifying Saturday, the race Sunday at 3 pm. Race viewing is an add-on, so you pay only for the view you want. Couples meet couples, solos meet solos, and everyone compares notes at the harbour on Sunday night.',
  starting_price_amount = 245000
where id = '21000000-0000-4000-8000-000000000002';

update public.tour_version_destinations set nights = 5
where tour_version_id = '21000000-0000-4000-8000-000000000002'
  and destination_id = '10000000-0000-4000-8000-000000000001';

update public.tour_included_items
set title = '5 nights in Nice or Monaco'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and position = 1;

update public.tour_included_items
set title = 'Welcome drinks Wednesday',
    description = 'First round on us at a harbour bar the night everyone lands. Meet the group two days before the noise starts.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and position = 2;

update public.tour_included_items
set description = 'Unlimited regional trains Thursday to Sunday. Twenty minutes each way; the trains beat every road that weekend.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and position = 3;

update public.tour_faqs
set answer = 'Nice is the value tier: a comfortable hotel by the port, twenty minutes by train from the circuit, and where the welcome drinks are. Monaco is the full show: five nights in Monte Carlo, walking distance to the track, at race-week prices. One group, two prices; everyone meets at the harbour on Sunday night. Hotels are named in your confirmation.'
where tour_version_id = '21000000-0000-4000-8000-000000000002'
  and question = 'Nice or Monaco: which should I choose?';

update public.tour_faqs
set answer = 'Your train pass covers Nice to Monaco and back from Thursday to Sunday, and the circuit is a walk from Monaco station. If you land late, a private airport transfer is an optional add-on. The one thing trains will not do is bring you home from an evening party in the harbour, so plan a taxi if you book one of those.'
where tour_version_id = '21000000-0000-4000-8000-000000000002'
  and question = 'Do I need a car?';

-- Six days now. Renumber downward first so nothing collides, then Thursday drops into the gap.
update public.tour_days set day_number = 6 where id = '22000000-0000-4000-8000-000000000015';
update public.tour_days set day_number = 5 where id = '22000000-0000-4000-8000-000000000014';
update public.tour_days set day_number = 4 where id = '22000000-0000-4000-8000-000000000013';
update public.tour_days set day_number = 3 where id = '22000000-0000-4000-8000-000000000012';

insert into public.tour_days (id, tour_version_id, day_number, destination_id, title, summary) values
  ('22000000-0000-4000-8000-000000000016', '21000000-0000-4000-8000-000000000002', 2,
   '10000000-0000-4000-8000-000000000001', 'A day before it starts',
   'Thursday, before the track opens. Villefranche, Eze or the old town, and the harbour filling with boats while you watch.')
on conflict (id) do nothing;

insert into public.tour_itinerary_items
  (tour_day_id, position, type, title, description, start_time, end_time, timezone, location_name, responsibility, is_optional, visibility, is_anchor)
values
  ('22000000-0000-4000-8000-000000000016', 1, 'free_time', 'The Riviera, before the noise',
   'The quietest day of the weekend and the best one for the coast. Trains along the corniche run all day on your pass, and Monaco is still walkable on a Thursday.',
   null, null, 'Europe/Paris', null, 'traveler', true, 'public_preview', false)
on conflict do nothing;

update public.tour_days
set title = 'Arrive on the Riviera',
    summary = 'Wednesday. Land in Nice by five, check in wherever you chose to stay, welcome drinks at 8 pm at the harbour in Nice.'
where id = '22000000-0000-4000-8000-000000000011';

update public.tour_days
set summary = 'Friday: free practice in Monaco if your race view covers it, or a slow day on the coast. Trains run every 20 minutes.'
where id = '22000000-0000-4000-8000-000000000012';

update public.tour_itinerary_items
set description = 'Trains to Monaco every 20 minutes with your pass. The three-day grandstand pass covers Friday; the terrace and yacht days start Saturday. Or Villefranche and a swim.'
where tour_day_id = '22000000-0000-4000-8000-000000000012' and position = 1;

update public.tour_itinerary_items
set description = 'Land by 17:00 on Wednesday to make welcome drinks.'
where tour_day_id = '22000000-0000-4000-8000-000000000011' and position = 1;

update public.tour_itinerary_items
set description = 'First round on us at a harbour bar in Nice, 8 pm Wednesday. Fifty people, one weekend, no agenda.'
where tour_day_id = '22000000-0000-4000-8000-000000000011' and position = 3;

-- ── The departure ────────────────────────────────────────────────────────────
-- Five nights near the port in Nice during race week costs about EUR 280 a night, plus the regional
-- train pass, the welcome round and the ops behind it: roughly USD 1,650 landed. $2,450 is that with
-- our margin. The old $1,890 was a four-night placeholder and did not cover the fifth night.
update public.departures
set start_date = '2027-06-02',
    end_date = '2027-06-07',
    price_amount = 245000,
    deposit_amount = 60000,
    shared_room_discount_amount = 45000,
    balance_due_date = '2027-03-24'
where id = '30000000-0000-4000-8000-000000000004';

update public.departure_stay_options set
  shared_room_discount_amount = 45000,
  description = 'A comfortable hotel in the port quarter, the group''s base for drinks and a short hop to Nice-Ville for the train to the circuit. A fraction of Monaco race-week prices.',
  includes = array['5 nights', 'Breakfast', 'Train pass Nice to Monaco', 'Property named at booking'],
  details = jsonb_build_object(
    'neighborhood', 'Port Lympia / Old Town',
    'station_distance', '10–15 min to Nice-Ville by tram or taxi',
    'train_time', '20–25 min Nice to Monaco',
    'breakfast', 'Included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false)
where id = '31000000-0000-4000-8000-000000000001';

-- Monte Carlo runs EUR 900–1,200 a night in race week against EUR 280 in Nice: five nights is a
-- landed difference of about USD 3,900. $4,450 is that difference with margin.
update public.departure_stay_options set
  price_delta_amount = 445000,
  shared_room_discount_amount = 190000,
  description = 'Five nights in Monte Carlo during race week, walking distance to the circuit. No train in the morning, and the harbour at your door at night.',
  includes = array['5 nights in Monte Carlo', 'Breakfast', 'Walk to the circuit', 'Property confirmed at booking'],
  why_price_note = 'Five nights in Monte Carlo during race week, walking distance to the circuit, at race-week hotel pricing.',
  details = jsonb_build_object(
    'neighborhood', 'Monte Carlo',
    'station_distance', 'Walking distance to the circuit; Monaco-Monte-Carlo station nearby',
    'train_time', 'None needed on race days',
    'breakfast', 'Included',
    'room_type', 'Double or twin',
    'hotel_confirmed', false)
where id = '31000000-0000-4000-8000-000000000002';

-- ── Race viewing, repriced ───────────────────────────────────────────────────
-- Monaco sells grandstand seats as three-day passes. There is no Saturday-and-Sunday ticket, so the
-- old title described a product that does not exist. K1–K2 face value was EUR 1,420 for 2026; at
-- about 9% into 2027 that is EUR 1,548, roughly USD 1,690 before we have an allocation of our own.
update public.departure_add_ons set
  title = 'Grandstand K (three-day pass)',
  description = 'Reserved seats over the swimming-pool section for all three days: practice Friday, qualifying Saturday, the race Sunday. The classic view and the loudest one. Monaco sells this as a three-day pass; there is no single-day version of this seat.',
  price_amount = 219000,
  day_number = 3,
  includes = array['Reserved seat Friday, Saturday and Sunday', 'The same seat all three days'],
  excludes = array['Food and drinks', 'Transfers to the circuit'],
  why_price_note = 'Official three-day grandstand seating over the swimming-pool section, at face value plus our booking. We hold no allocation of our own, so this moves with what the circuit charges.'
where id = '32000000-0000-4000-8000-000000000001';

update public.departure_add_ons set
  price_amount = 545000,
  day_number = 4,
  description = 'A private terrace above the harbour chicane for Saturday and Sunday, with lunch and an open bar both days. Sit down when you want to.'
where id = '32000000-0000-4000-8000-000000000002';

-- The yacht is Amber Lounge's, at their published day rate. Their quotes exclude 20% French VAT and
-- a 3% card fee, which is why Sunday lands near USD 6,000 a head at cost and the old $5,950 was
-- below what we would pay for it. See docs/pricing.md: we have no trade rate, so a traveler can
-- currently buy this direct for less than we sell it.
update public.departure_add_ons set
  title = 'Amber Lounge yacht, race day',
  description = 'Sunday on a yacht berthed on the circuit at Tabac: breakfast, lunch, unlimited champagne and the cars at eye level from late morning until the podium. Tender transfers from the quay. Shared with whoever in Your Group chooses it.',
  price_amount = 675000,
  day_number = 5,
  capacity = 12,
  includes = array['Breakfast, lunch and afternoon tea', 'Unlimited champagne and open bar', 'Tender transfers from the quay', 'The race from the mooring'],
  excludes = array['Getting to Monaco', 'Saturday qualifying', 'The evening parties'],
  meeting_point = 'Quai Antoine 1er, tender from 10:30',
  why_price_note = 'Amber Lounge charge a per-person day rate for race day and add 20% French VAT and a 3% card fee on top. This is that, plus our booking. It is the most expensive seat in Monaco and the price reflects it.'
where id = '32000000-0000-4000-8000-000000000003';

insert into public.departure_add_ons
  (id, departure_id, title, description, kind, price_amount, currency, pricing_basis, capacity, day_number, start_time, end_time,
   location_name, latitude, longitude, bookable_until_days_before, cancellable_until_days_before, tier_group, position, is_featured,
   includes, excludes, meeting_point, label, tier, why_price_note, image_urls)
values
  ('32000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000004', 'Amber Lounge yacht, qualifying day',
   'Saturday on the same yacht at a fraction of Sunday''s price. Qualifying in Monaco is the session people argue matters more than the race, because nobody overtakes here.',
   'ticket', 495000, 'USD', 'per_traveler', 12, 4, '11:00', '18:30', 'Port Hercule berth', 43.7361, 7.4270, 21, null, 'race_view', 6, false,
   array['Breakfast, lunch and afternoon tea', 'Unlimited champagne and open bar', 'Tender transfers from the quay', 'Qualifying from the mooring'],
   array['Getting to Monaco', 'Sunday race day', 'The evening parties'],
   'Quai Antoine 1er, tender from 10:30', null, 'premium',
   'Saturday costs less than Sunday because the yacht charges less for it, not because it is a lesser day. Same boat, same catering.',
   array['/photos/monaco-harbour-yachts.jpg']),

  ('32000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000004', 'Amber Lounge yacht, both days',
   'Saturday and Sunday on the yacht. Two days aboard for less than two single days cost, because that is how the boat prices the pair.',
   'ticket', 1140000, 'USD', 'per_traveler', 8, 4, '11:00', '18:30', 'Port Hercule berth', 43.7361, 7.4270, 21, null, 'race_view', 7, true,
   array['Both days aboard', 'Breakfast, lunch and afternoon tea each day', 'Unlimited champagne and open bar', 'Tender transfers from the quay'],
   array['Getting to Monaco', 'The evening parties'],
   'Quai Antoine 1er, tender from 10:30', 'luxury', 'elite',
   'Both yacht days bought together. It saves about $300 against booking the two days separately, and it is the only way to keep the same spot on the boat across the weekend.',
   array['/photos/monaco-harbour-yachts.jpg', '/photos/monaco-yacht-deck-view.jpg']),

  ('32000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000004', 'Friday night on the water',
   'The Friday party on a superyacht in the harbour: DJs, cocktails and canapes, 9 pm until 1 am. It is separate from race viewing, so you can come without buying a yacht day.',
   'ticket', 169000, 'USD', 'per_traveler', 20, 3, '21:00', null, 'Port Hercule', 43.7361, 7.4270, 21, null, null, 8, false,
   array['Superyacht venue in Port Hercule', 'Signature cocktails and spirits', 'Canapes', 'Resident DJs'],
   array['Getting back to Nice'],
   'Quai Antoine 1er, from 20:45', 'social', 'premium',
   'The venue price plus our booking. Worth knowing before you buy: the last train to Nice leaves well before this ends, so budget for a taxi or stay in Monaco.',
   array['/photos/monaco-harbour-yachts.jpg']),

  ('32000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000004', 'Sunday night after the flag',
   'The closing party once the podium is done: live artists, international DJs and champagne on a superyacht in the harbour, 9 pm until 2 am. The last thing that happens all weekend.',
   'ticket', 229000, 'USD', 'per_traveler', 20, 5, '21:00', null, 'Port Hercule', 43.7361, 7.4270, 21, null, null, 9, false,
   array['Superyacht venue in Port Hercule', 'Live artists and international DJs', 'Premium champagne and cocktails'],
   array['Getting back to Nice'],
   'Quai Antoine 1er, from 20:45', null, 'elite',
   'The most expensive night in Monaco, and this is what it costs. Same warning as Friday: no train home, plan a taxi or stay in Monaco.',
   array['/photos/monaco-harbour-yachts.jpg'])
on conflict (id) do nothing;

-- The Friday boat now falls on day 3, and a private car on the Riviera has never cost $120.
update public.departure_add_ons
set day_number = 3
where id = '32000000-0000-4000-8000-000000000004';

update public.departure_add_ons set
  price_amount = 15000,
  why_price_note = 'One car per booking, so it costs the same whether you travel alone or as a pair. A private car from Nice airport runs EUR 90 to 140 depending on the vehicle; this is that, not a markup on a shared shuttle.'
where id = '32000000-0000-4000-8000-000000000005';

-- Everything in race_view is bought in a traveler's name months ahead and no supplier takes it
-- back, the yacht least of all. Re-run here so the new rows inherit it too.
update public.departure_add_ons
set cancellable_until_days_before = null
where departure_id = '30000000-0000-4000-8000-000000000004'
  and tier_group = 'race_view';

-- The two parties are the same kind of commitment: a named guest list, paid up front.
update public.departure_add_ons
set cancellable_until_days_before = null
where id in ('32000000-0000-4000-8000-000000000008', '32000000-0000-4000-8000-000000000009');
