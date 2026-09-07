-- Seed: monthly city evenings — the funnel. Past and prospective travelers, one bar, no agenda.
insert into public.meetups (id, title, description, city, country_code, venue_name, address, starts_at, ends_at, timezone, capacity, is_published)
values
  ('33000000-0000-4000-8000-000000000001', 'Guideless Evening · New York',
   'Drinks with people who have travelled with us and people thinking about it. Ask anything about the Riviera or race weekend. First round on us.',
   'New York', 'US', 'The Wren', '344 Bowery, New York, NY 10012', '2026-10-15 23:00+00', '2026-10-16 01:30+00', 'America/New_York', 40, true),
  ('33000000-0000-4000-8000-000000000002', 'Guideless Evening · London',
   'An informal evening for solo travellers and couples curious about group trips without a guide. Come alone; that is rather the point.',
   'London', 'GB', 'The Culpeper', '40 Commercial St, London E1 6LP', '2026-10-22 18:30+00', '2026-10-22 21:00+00', 'Europe/London', 40, true),
  ('33000000-0000-4000-8000-000000000003', 'Grand Prix Weekend preview · Austin',
   'How the Monaco weekend works: hotels, viewing tiers, what the group actually does. Past travellers answer questions; nobody sells you anything.',
   'Austin', 'US', 'Cosmic Coffee + Beer Garden', '121 Pickle Rd, Austin, TX 78704', '2026-11-05 00:00+00', '2026-11-05 02:00+00', 'America/Chicago', 30, true)
on conflict (id) do nothing;
