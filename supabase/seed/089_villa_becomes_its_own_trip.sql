-- Seed, 2026-09-10 (evening): the Luberon villa comes off Southern France.
--
-- Kyle's decision, and it is the right read of the constraint. A villa that sleeps twelve lets by
-- the WEEK, Saturday to Saturday, and the Provence leg of Southern France is two nights. Seed 087
-- made that work by pricing seven nights across eight travelers, which is honest arithmetic for a
-- bad shape: you pay for five nights nobody sleeps in, and it shows up as a fat Elite price on a
-- trip whose other tiers are ordinary hotels.
--
-- The alternative Kyle picked is better: make the week the point. A shorter Provence-and-wine trip
-- built around a villa is a product where the minimum stay stops being waste and starts being the
-- reason to go — the group has a house, a kitchen, a pool and the Châteauneuf-du-Pape cellars half
-- an hour away, for the length the villa actually lets for.
--
-- So the bolted-on tier is retired here rather than left live at $2,449 while we agree it is the
-- wrong shape. `is_active = false` rather than a delete: it keeps the researched band, the pricing
-- basis and the supplier work intact for whoever builds the villa departure, and it is one flag to
-- reverse if that trip never gets built.
--
-- WHAT THE VILLA TRIP NEEDS, so the research is not lost:
--   * A contracted villa. Not sourceable through a hotel API — a live sweep of 1,335 Avignon-area
--     properties found only gites and holiday homes at $98-253 a night. Interhome, Le Collectionist,
--     Villanovo or a Luberon agency direct.
--   * Researched band, sleeping twelve: EUR 1,208-3,215 a night, Saturday to Saturday.
--   * Price per person against a CONSERVATIVE occupancy. A villa is the one component whose cost
--     per head rises as the group empties, which is backwards from everything else we sell.

update public.departure_stay_options set is_active = false
where id in (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000003'
);

update public.departure_tier_briefs set brief =
  'PARKED 2026-09-10. Elite on this route was a Luberon villa for the Provence days, retired because a villa lets by the week and the leg is two nights — paying for seven to use two is honest but is not a good product. The villa becomes its own Provence-and-wine departure instead, where the week minimum is the point rather than waste. Do not sell an Elite tier on Southern France until there is a researched answer that is not the villa: the top of the Paris market is wide and nothing on this route is hard to reach, so Elite here has to buy the room, not access.'
where tier = 'elite'
  and departure_id in (select id from public.departures where tour_id = '20000000-0000-4000-8000-000000000001');
