-- Seed: "Monaco Grand Prix Weekend" — the event-anchored product. One group of up to 50, two stay
-- tiers (Nice 3★ or Monaco 5★), race viewing as mutually exclusive ticket tiers, welcome drinks on
-- night one. Race weekend 4–6 June 2027; trip Thu 3 → Mon 7 June. Prices in USD minor units.

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
   'Four nights on the Riviera for the Monaco Grand Prix. Stay in Nice for value or in Monaco for the full show. Pick your race view — grandstand, terrace or yacht — and meet fifty people doing the same weekend fifty different ways.',
   'We book the hotels, the trains between Nice and Monaco, and welcome drinks on Thursday night. Race tickets are add-ons so you pay only for the view you want. Couples meet couples, solos meet solos, and everyone compares notes at the harbour on Sunday night.',
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
  ('21000000-0000-4000-8000-000000000002', 1, '4 nights in Nice or Monaco', 'Choose your tier at booking. Breakfast included either way.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'Welcome drinks Thursday', 'First round on us at a harbour bar. Meet the group before the noise starts.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'Train passes Nice ↔ Monaco', 'Unlimited TER travel Friday to Sunday; the trains beat every road.'),
  ('21000000-0000-4000-8000-000000000002', 4, 'Your Guide in the app', 'Timings, gates, where the group is, and what to do on Saturday morning.')
on conflict do nothing;

insert into public.tour_excluded_items (tour_version_id, position, title, description) values
  ('21000000-0000-4000-8000-000000000002', 1, 'Race tickets', 'Sold as add-ons so you pay for the view you want: grandstand, terrace or yacht.'),
  ('21000000-0000-4000-8000-000000000002', 2, 'Flights', 'Fly into Nice (NCE). We tell you when to arrive.'),
  ('21000000-0000-4000-8000-000000000002', 3, 'Most meals', 'Breakfast is included; the Riviera does the rest.')
on conflict do nothing;

insert into public.tour_days (id, tour_version_id, day_number, destination_id, title, summary) values
  ('22000000-0000-4000-8000-000000000011', '21000000-0000-4000-8000-000000000002', 1, '10000000-0000-4000-8000-000000000001', 'Arrive on the Riviera', 'Land in Nice, check in wherever you chose to stay, welcome drinks at 8.'),
  ('22000000-0000-4000-8000-000000000012', '21000000-0000-4000-8000-000000000002', 2, '10000000-0000-4000-8000-000000000004', 'Practice day', 'Free practice in Monaco, or a slow day on the coast. Trains run every 20 minutes.'),
  ('22000000-0000-4000-8000-000000000013', '21000000-0000-4000-8000-000000000002', 3, '10000000-0000-4000-8000-000000000004', 'Qualifying', 'Saturday in Monaco: qualifying, the harbour, the terraces.'),
  ('22000000-0000-4000-8000-000000000014', '21000000-0000-4000-8000-000000000002', 4, '10000000-0000-4000-8000-000000000004', 'Race day', 'Your seat, your view. Group debrief at the harbour afterwards, optional as ever.'),
  ('22000000-0000-4000-8000-000000000015', '21000000-0000-4000-8000-000000000002', 5, '10000000-0000-4000-8000-000000000001', 'Home', 'Check out. Late flights: we hold your bags.')
on conflict (id) do nothing;

insert into public.tour_itinerary_items
  (tour_day_id, position, type, title, description, start_time, end_time, timezone, location_name, responsibility, is_optional, visibility, is_anchor)
values
  ('22000000-0000-4000-8000-000000000011', 1, 'flight',      'Arrive at Nice Côte d''Azur (NCE)', 'Land by 17:00 to make welcome drinks.', null, '17:00', 'Europe/Paris', 'Nice Côte d''Azur Airport', 'traveler', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000011', 2, 'check_in',    'Check in', 'Nice or Monaco, whichever you chose.', '15:00', null, 'Europe/Paris', 'Your hotel', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000011', 3, 'live_moment', 'Welcome drinks', 'First round on us at a harbour bar in Nice, 8 pm. Fifty people, one weekend, no agenda.', '20:00', '22:30', 'Europe/Paris', 'Port Lympia, Nice', 'guideless', true, 'public_preview', true),
  ('22000000-0000-4000-8000-000000000012', 1, 'free_time',   'Free practice or free day', 'Trains to Monaco every 20 minutes with your pass. Or Villefranche and a swim.', null, null, 'Europe/Paris', null, 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000013', 1, 'train',       'Nice → Monaco', 'Any TER with your pass. Leave by 09:30 to beat the queues.', '09:30', '10:00', 'Europe/Paris', 'Nice-Ville station', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000013', 2, 'activity',    'Qualifying', 'Your race-view add-on covers Saturday too.', '16:00', '17:00', 'Europe/Monaco', 'Circuit de Monaco', 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 1, 'train',       'Nice → Monaco', 'Race day trains are busy. The group meets at the station café at 09:00 if you want company.', '09:15', '09:45', 'Europe/Paris', 'Nice-Ville station', 'guideless', false, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 2, 'activity',    'Race', 'Lights out 15:00. Your view depends on your add-on.', '15:00', '17:00', 'Europe/Monaco', 'Circuit de Monaco', 'traveler', true, 'public_preview', false),
  ('22000000-0000-4000-8000-000000000014', 3, 'live_moment', 'Harbour debrief', 'Whoever wants to, at the harbour after the podium.', '19:30', '22:00', 'Europe/Monaco', 'Port Hercule', 'guideless', true, 'public_preview', false),
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
   'Reserved seats over the swimming-pool section for qualifying and the race. The classic view and the loudest one.',
   'ticket', 129000, 'USD', 'per_traveler', 30, 4, '15:00', '17:00', 'Grandstand K, Circuit de Monaco', 43.7346, 7.4229, 14, 30, 'race_view', 1, true),
  ('32000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 'Terrace with lunch (Sat + Sun)',
   'A private terrace above the harbour chicane with lunch and an open bar both days. Sit down when you want to.',
   'ticket', 349000, 'USD', 'per_traveler', 20, 4, '11:00', '18:00', 'Harbour terrace, Port Hercule', 43.7355, 7.4266, 14, 30, 'race_view', 2, true),
  ('32000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', 'Yacht in the harbour (Sun)',
   'Race day on a circuit-berthed yacht: brunch, bar, the cars at eye level. Shared with the group members who choose it.',
   'ticket', 595000, 'USD', 'per_traveler', 12, 4, '10:00', '18:00', 'Port Hercule berth', 43.7361, 7.4270, 14, 45, 'race_view', 3, true),
  ('32000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'Friday coast boat to Monaco',
   'Skip the train once: a group boat from Nice along the coast into the harbour for practice day, with a swim stop off Cap Ferrat.',
   'activity', 21000, 'USD', 'per_traveler', 12, 2, '10:00', '13:00', 'Port Lympia, Nice', 43.6955, 7.2851, 1, 7, null, 4, false),
  ('32000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', 'Private airport transfer',
   'Your own car from the airport to your hotel, Nice or Monaco.',
   'transfer', 12000, 'USD', 'per_booking', null, 1, null, null, 'Nice Côte d''Azur Airport', null, null, 2, 3, null, 5, false)
on conflict (id) do nothing;
