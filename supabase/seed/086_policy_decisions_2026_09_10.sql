-- Seed, 2026-09-10: Kyle's answers to the open policy questions, written into the product.
--
-- These were sitting as "needs Kyle" in a readiness review. They are decided now, and the decisions
-- share a spine: we sell a product, an app and a group. We do not buy growth by giving trips away,
-- and we do not write a promise whose cost scales with the price of a Monte Carlo room.

-- ── Age: enforced, and the consequence of lying is stated ────────────────────
-- The 18+ rule is enforced in the database (migration 20260910000200) on the departure date, not
-- today. What was missing is what happens if somebody lies to get past it. Saying so is the whole
-- deterrent: an age gate nobody can see the teeth of is a suggestion.
update public.tour_requirements set
  description = 'Everyone on this trip books their own room by default, the group moments run late, and the race-viewing and evening add-ons are all licensed venues with their own age checks. We check your date of birth against the departure date when you book, so you may book at 17 if you turn 18 before 2 June 2027. If you give us a false date of birth: you lose your deposit, the booking is cancelled without refund, and any venue that turns you away at the door is not something we can refund or be held responsible for. We do not take under-18s on this departure, with or without a parent.'
where tour_version_id = '21000000-0000-4000-8000-000000000002' and title = 'You must be 18 or over';

update public.tour_requirements set
  description = 'Everyone books their own room by default, the wine afternoon is a tasting, and the trip is built around travelers exploring three cities independently. We check your date of birth against the departure date, so you may book at 17 if you turn 18 before you travel. If you give us a false date of birth: you lose your deposit, the booking is cancelled without refund, and anywhere that turns you away on age is not something we can refund or be held responsible for. We do not take under-18s.'
where tour_version_id = '21000000-0000-4000-8000-000000000001' and title = 'You must be 18 or over';

-- ── The Monaco Grand Prix happens once a year ────────────────────────────────
-- The marketing plan leaned on "Monaco weekends have been run before, several times" as the
-- strongest trust asset on the page. There is one Grand Prix in Monaco per year, so "several"
-- is a claim about a decade, not a track record, and it is not one we should make in the copy of
-- a company that has not yet run a departure. The FAQ now says what is actually true: the format
-- is not new to us, the company is.
-- A new question rather than an edit: the "am I going to be on my own all weekend" answer is a
-- good one and is about something else entirely.
insert into public.tour_faqs (tour_version_id, position, question, answer) values
  ('21000000-0000-4000-8000-000000000002', 5,
   'Have you actually run this before?',
   'Guideless is new; the weekend is not. Monaco runs one Grand Prix a year, so nobody has a long history of these — we have run this format before, a group across price tiers with the hotels and trains booked and nobody herded, under other arrangements rather than under this name. We would rather say that plainly than imply a track record we do not have. What is not in doubt is the logistics: your hotel, your train pass and your race viewing are booked and named before you travel, and the money is held to the cancellation terms on this page.')
on conflict (tour_version_id, position) do update set
  question = excluded.question, answer = excluded.answer;
