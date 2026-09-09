-- Seed: open departures for Southern France v1. Prices in USD minor units ($3,495 / $750 deposit),
-- per traveler in their own room; seed 040 adds the shared-room saving, stay tiers and add-ons.
-- The default group is created automatically by trigger.
insert into public.departures
  (id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity, minimum_travelers,
   price_amount, deposit_amount, currency, booking_deadline, balance_due_date)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-05-14', '2027-05-22', 'Europe/Paris', 14, 6, 349500, 75000, 'USD', '2027-04-14', '2027-03-15'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-06-11', '2027-06-19', 'Europe/Paris', 14, 6, 369500, 75000, 'USD', '2027-05-11', '2027-04-12'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-09-17', '2027-09-25', 'Europe/Paris', 12, 6, 349500, 75000, 'USD', '2027-08-17', '2027-07-19')
on conflict (id) do nothing;

-- Cancellation tiers, set from what the money actually does rather than from a round number.
-- Stripe keeps its processing fee on a refund, so a 100% tier is a loss on every cancellation; the
-- top tier is deliberately below it. Southern France carries little sunk cost until about a month
-- out — hotels there release close in and the trains are bought late — so the early tiers are
-- generous, and they fall away as our own commitments become non-recoverable.
update public.departures d
set cancellation_policy = '[
  {"daysBeforeDeparture": 90, "refundPercentage": 90},
  {"daysBeforeDeparture": 60, "refundPercentage": 70},
  {"daysBeforeDeparture": 30, "refundPercentage": 40},
  {"daysBeforeDeparture": 15, "refundPercentage": 20},
  {"daysBeforeDeparture": 0,  "refundPercentage": 0}
]'::jsonb
from public.tours t
where t.id = d.tour_id and t.kind is distinct from 'event';
-- Southern France runs three departures on ordinary dates, so its ladder is the usual one: the room
-- and the address, not access.
insert into public.departure_tier_briefs (departure_id, tier, brief)
select d.id, b.tier::public.option_tier, b.brief
from public.departures d
cross join (values
  ('explorer', 'Comfortable, well located, walkable to the centre of each city. Researched band, per night with breakfast: Nice 150-185, Avignon 110-120, Paris 165-195 EUR. Never the cheapest room in town, and never priced above the band just because a property is nicer.'),
  ('classic',  'A clearly better room or a better street than Explorer, in the same neighbourhoods. NO RESEARCHED BAND YET: this rung has no supplier figures behind it and must not be sold until it does. Sits between the Explorer and Premium bands.'),
  ('premium',  'Design-led properties in the best part of each city. Researched band, per night with breakfast: Nice 225-290, Avignon 175-190, Paris 230-270 EUR. Buys quality Classic cannot, not proximity, because nothing on this route is hard to reach.'),
  ('elite',    'The best in each city for these dates: on this trip that means the room and the building, since access is not scarce in May, June or September. NO RESEARCHED BAND YET, and the top of the Paris market is wide. Do not sell until researched.')
) as b(tier, brief)
where d.tour_id = '20000000-0000-4000-8000-000000000001'
on conflict (departure_id, tier) do update set brief = excluded.brief;
