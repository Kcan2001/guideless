-- Seed, 2026-09-10: where EU sales stop being a rounding error, recorded for ops.
--
-- Decision: we do not block EU customers and we do not buy insolvency protection yet. The exposure
-- is bounded and the expected loss is small — but it is NOT flat across the ladder, and that is the
-- part worth writing down somewhere a human will read it.
--
-- Under the Package Travel Directive a traveller may terminate without a fee, with a full refund
-- inside fourteen days, if a main characteristic of the package is significantly altered. A
-- cancelled Grand Prix is that, on a trip named after one — the hotel still being deliverable does
-- not help, because nobody bought five nights in Nice. What we lose is not the refund, it is what we
-- have already sunk and cannot recover:
--
--     Explorer + grandstand   refund  3,860   sunk ~ 2,500
--     Classic  + grandstand   refund  5,320   sunk ~ 3,600
--     Premium  + grandstand   refund 10,580   sunk ~ 6,800
--     Elite    + grandstand   refund 33,830   sunk ~20,400
--
-- Five EU travelers on the bottom two rungs is roughly $12,000 of exposure against an event that
-- has been cancelled once in living memory. One EU traveler on Elite is more exposure than twenty
-- on Explorer. So the guard belongs on the TIER, not on the continent.
--
-- THE TRIGGER: before selling a Premium or Elite seat to an EU resident, get insolvency protection
-- in place (Financial Failure Insurance, ~$2,000/year through a provider that covers non-EU sales
-- channels — it satisfies Article 17 without an EU establishment) and quote event cancellation
-- cover, which is the thing that actually answers the refund risk. FFI does not: it protects
-- travelers from OUR insolvency and is a separate product from the one that pays out if the race
-- is called off.
--
-- Not customer-facing. We are not going to advertise a restriction we do not check — that is the
-- mistake the 18+ rule made until a database trigger started enforcing it. If EU volume appears,
-- enforce it the same way and say it then.

update public.departure_tier_briefs set brief = brief ||
  ' EU SALES: fine on this rung — a cancelled Grand Prix would cost us roughly what we sank, which is small here. No protection needed before selling it to an EU resident.'
where departure_id = '30000000-0000-4000-8000-000000000004'
  and tier in ('explorer', 'classic');

update public.departure_tier_briefs set brief = brief ||
  ' EU SALES — CHECK FIRST: do not sell this rung to an EU resident until insolvency protection is in place and event cancellation cover is quoted. Under the Package Travel Directive a cancelled race entitles them to a full refund inside fourteen days, and the room is non-refundable and already bought. One booking here is more exposure than twenty on Explorer.'
where departure_id = '30000000-0000-4000-8000-000000000004'
  and tier in ('premium', 'elite');
