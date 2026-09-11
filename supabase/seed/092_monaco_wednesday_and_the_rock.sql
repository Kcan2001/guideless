-- Seed, 2026-09-10: the two holes in the Monaco weekend, both found by pricing the competition.
--
-- ── 1. THE EXPLORER TIER CANNOT AFFORD TO WATCH THE RACE ─────────────────────
-- The Monaco trip starts at $1,603 and the cheapest way to see a car was Grandstand K at $2,190 —
-- a hundred and thirty-seven per cent of the trip price. A traveler on the entry rung was being
-- sold a Grand Prix weekend with no Grand Prix in it they could pay for.
--
-- Meanwhile Monaco sells a general-admission ticket and we were not offering it. Secteur Rocher,
-- the hill between Rascasse and the Palace, is the only GA zone on the circuit and the cheapest
-- official ticket there is: EUR 45 Friday, EUR 75 Saturday, EUR 130 Sunday for 2026, roughly ten
-- per cent off as a three-day combination. That is about EUR 225, or $261 at 1.16. Sold at $395.
--
-- It is a hill, not a seat, and the copy says so. You stand on grass and rock, you arrive at dawn
-- to get a rail, and you see the harbour section from above rather than a car at fifty metres.
-- That is a real product for the right person and a bad one for anybody who thinks they bought a
-- seat, so the description leads with the compromise instead of burying it.
--
-- ── 2. WEDNESDAY HAD NOTHING TO BUY ──────────────────────────────────────────
-- Seed 081 left Wednesday deliberately empty: welcome drinks are included and free, and the point
-- of night one is that everybody is at the same thing. That reasoning still holds, and it is why
-- this adds ONE thing, starting at ten, after the drinks have done their job — not a menu.
--
-- The Casino de Monte-Carlo is the right night-one thing precisely because it is not a club: EUR 20
-- to walk into the gaming rooms, EUR 10 of that back as credit, and the only dress code and ID
-- check on the trip. Those requirements are the valuable part of the listing. A traveler who turns
-- up in trainers with a photo of their passport is not getting in, and finding that out at the door
-- of the Hôtel de Paris at eleven at night is the sort of thing a trip company exists to prevent.
--
-- Sources, 10 September 2026: montecarlosbm.com (prices and conditions of entry),
-- monaco-tribune.com (2026 viewing prices), monaco-grandprix.com / ACM, 44 rue Grimaldi.
--
-- PRICES ARE RESEARCHED, NOT CONTRACTED, exactly as in seed 081. We hold no allocation at the
-- Hôtel de Paris and no ticket block with the Automobile Club de Monaco. See docs/experiences.md
-- for what has to happen before either takes real money.

-- ── The race-viewing ladder, re-tiered around the new entry point ────────────
-- With a standing ticket at the bottom, the badges now describe the ladder rather than the order
-- they happened to be created in: standing, then a seat, then catered or afloat, then the yacht.
update public.departure_add_ons set tier = 'classic', position = 2
where id = '32000000-0000-4000-8000-000000000001';  -- Grandstand K, three-day pass
update public.departure_add_ons set tier = 'premium', position = 3
where id = '32000000-0000-4000-8000-000000000002';  -- Terrace with lunch (Sat + Sun)

insert into public.departure_add_ons
  (id, departure_id, title, description, kind, price_amount, currency, pricing_basis, capacity,
   day_number, start_time, end_time, location_name, latitude, longitude,
   bookable_until_days_before, cancellable_until_days_before, tier_group, position, is_featured,
   includes, excludes, meeting_point, label, tier, min_age, why_price_note, image_urls)
values
  -- ── The Rock ───────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000004',
   'Secteur Rocher, three days standing',
   'Monaco''s only general-admission ticket, and the cheapest way anybody watches this race. The Rocher is the hill between the Rascasse corner and the Palace: you stand on grass, rock and pavement, looking down on the harbour section from above. Read that again before you buy it — there is no seat, no shade and no allocated spot. What you get for it is the whole weekend, all three days, from the one place in Monaco where you can see a long stretch of circuit at once and hear the rest of it echo off the buildings. Get up there by seven on Sunday and the rail is yours.',
   'ticket', 39500, 'USD', 'per_traveler', 20, 3, '09:00', null,
   'Secteur Rocher, Monaco-Ville', 43.7314, 7.4256,
   21, null, 'race_view', 1, false,
   array['General admission, Friday, Saturday and Sunday', 'A walking route from the station that avoids the worst of the queue', 'We tell you what time to be up there'],
   array['A seat — this is standing on a hill', 'Shade, food or anywhere to sit down', 'Getting back to Nice after the race'],
   'Monaco-Ville, we send the meeting point and the time the night before',
   'best_value', 'explorer', null,
   'Face value for 2026 was EUR 45 Friday, EUR 75 Saturday and EUR 130 Sunday, about ten per cent off as a three-day combination: roughly EUR 225, or $261. Our price is that plus our booking. Researched from the Automobile Club de Monaco''s published prices, not contracted — we hold no allocation.',
   array['/photos/monaco-harbour-rock.jpg', '/photos/monaco-trackside-barriers.jpg']),

  -- ── Wednesday ──────────────────────────────────────────────────────────────
  ('32000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000004',
   'Wednesday at the Bar Américain, and the Casino after',
   'Night one, after the welcome drinks have done their work. A reserved table at the Bar Américain in the Hôtel de Paris — live jazz every night, the same room since 1910, and the one bar in Monaco worth being in before the town fills up — and then across the square into the gaming rooms of the Casino de Monte-Carlo. It is the opposite of the rest of the week: no queue, no guest list, no bass. Just the room everybody has seen in a film, on the one night of the weekend when it is not full.',
   'ticket', 11000, 'USD', 'per_traveler', 12, 1, '22:00', null,
   'Hôtel de Paris Monte-Carlo, Place du Casino', 43.7396, 7.4276,
   7, 7, 'night_wed', 10, false,
   array['A reserved table at the Bar Américain', 'Your first round', 'Casino de Monte-Carlo entry, of which EUR 10 comes back as playing credit'],
   array['Anything you lose at the tables', 'Dinner'],
   'Place du Casino, by the fountain, from 21:45',
   'social', 'classic', 18,
   'Two rounds at Monte Carlo bar prices is about EUR 55 and casino entry is EUR 20 with EUR 10 of it returned as credit, so roughly EUR 65 or $75. Our price is that plus our booking. Researched, not contracted: we hold no table allocation at the Hôtel de Paris.',
   array['/photos/monaco-casino-square.jpg', '/photos/monaco-casino-night.jpg'])
on conflict (id) do update set
  title = excluded.title, description = excluded.description, price_amount = excluded.price_amount,
  capacity = excluded.capacity, includes = excluded.includes, excludes = excluded.excludes,
  why_price_note = excluded.why_price_note, tier = excluded.tier, position = excluded.position,
  image_urls = excluded.image_urls;

-- Renumber the whole Monaco menu from a rule rather than by hand. Positions had accreted in the
-- order rows were created, which is why two add-ons shared a 3 and two shared a 10; inserting
-- anything new made it worse. The rule is: race viewing first, cheapest first, then the things
-- that belong to no night, then the nights in calendar order with the cheapest option on each.
-- It is idempotent, so the next insert only has to run this again.
with ordered as (
  select id,
         row_number() over (
           order by case tier_group
                      when 'race_view' then 1
                      when 'night_wed' then 3
                      when 'night_thu' then 4
                      when 'night_fri' then 5
                      when 'night_sat' then 6
                      when 'night_sun' then 7
                      else 2
                    end,
                    price_amount,
                    title
         ) as n
    from public.departure_add_ons
   where departure_id = '30000000-0000-4000-8000-000000000004'
)
update public.departure_add_ons a
   set position = o.n
  from ordered o
 where o.id = a.id;

-- ── What the casino actually requires ────────────────────────────────────────
-- A trip requirement rather than add-on copy, because it applies to anybody who wanders up to the
-- casino on their own and because the app surfaces requirements before booking, which is where a
-- dress code is useful. The 18+ rule already has its own requirement row (seed 086); this is about
-- the door.
insert into public.tour_requirements (tour_version_id, title, description, position)
values
  ('21000000-0000-4000-8000-000000000002',
   'The Casino has a dress code and checks ID at the door',
   'If you plan to go into the gaming rooms of the Casino de Monte-Carlo — on our Wednesday night or on your own — bring your actual passport or EU identity card. A photo of it on your phone is refused, and so is a photocopy. Entry is EUR 20 from 2 pm, EUR 10 of which comes back as playing credit, and you must be at least a day past your eighteenth birthday. No shorts, ripped jeans, sportswear, trainers, flip-flops, sandals or beachwear at any time, and no t-shirts or sweatshirts after 7 pm. The Café de Paris casino across the square is more relaxed if you would rather not dress up.',
   4)
on conflict (tour_version_id, position) do update set
  title = excluded.title, description = excluded.description;
