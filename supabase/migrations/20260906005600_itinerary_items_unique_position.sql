-- Stop the catalog seed duplicating itinerary items.
--
-- `tour_itinerary_items` had no unique key, and the seeds insert with a bare `on conflict do
-- nothing`, which can only do nothing when there is a constraint to conflict with. So every re-run
-- of a seed file appended another copy of every row. Pushing the repriced catalog to a hosted
-- project a few times left **eight** "Welcome drinks" on day one of the Monaco trip in production,
-- and eight "Check in" beside them. A traveler reading their own itinerary would have seen it.
--
-- Position is unique within a day by design — the seeds have always written 1, 2, 3 — so making
-- that a constraint both repairs the damage and makes the seeds genuinely idempotent, which is what
-- they always claimed to be.
--
-- Trip snapshots are cleaned the same way. No trip has been created yet, but a snapshot taken from
-- a duplicated template would have carried the duplicates to a real traveler's phone.

-- ── Repair ───────────────────────────────────────────────────────────────────
-- Keep the earliest row per (day, position); the copies are identical apart from their id.
-- tour_itinerary_items has no created_at, so the surviving row is chosen by id. The copies are
-- identical apart from that id, so which one survives does not matter; that it is deterministic
-- does.
delete from public.tour_itinerary_items a
using public.tour_itinerary_items b
where a.tour_day_id = b.tour_day_id
  and a.position = b.position
  and a.id > b.id;

delete from public.trip_itinerary_items a
using public.trip_itinerary_items b
where a.trip_day_id = b.trip_day_id
  and a.position = b.position
  and (a.created_at, a.id) > (b.created_at, b.id);

-- ── Prevent ──────────────────────────────────────────────────────────────────
create unique index if not exists tour_itinerary_items_day_position_idx
  on public.tour_itinerary_items (tour_day_id, position);

create unique index if not exists trip_itinerary_items_day_position_idx
  on public.trip_itinerary_items (trip_day_id, position);

comment on index public.tour_itinerary_items_day_position_idx is
  'One item per position per day. Also what makes `on conflict do nothing` in the catalog seeds actually do nothing: without a constraint to conflict with, re-running a seed appended duplicates.';
