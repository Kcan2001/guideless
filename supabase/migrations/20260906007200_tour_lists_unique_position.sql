-- 0072_tour_lists_unique_position
--
-- The same bug as migration 0056, in the three tables that one missed.
--
-- 0056 found that `tour_itinerary_items` had no unique key while the catalog seeds insert with a
-- bare `on conflict do nothing` — which can only do nothing when there is a constraint to conflict
-- with — so every re-run appended another copy of day one. It fixed that table and its trip
-- snapshot, and stopped there. The three sibling tables written by the very same seed files have
-- the same bare `on conflict do nothing` and the same missing constraint:
--
--   tour_included_items      what the base trip includes, on every tour page
--   tour_excluded_items      what it does not
--   tour_faqs                the questions under it
--
-- Kyle found it on the live Monaco page: "5 nights in Nice or Monaco" three times, "Welcome drinks
-- Wednesday" six times, "Flights" seven times, "Most meals" six times. Locally the counts are 133,
-- 92 and 116 rows against a catalog of two tours. This is the most visible kind of defect we can
-- ship — it is on the page a traveler reads before deciding to give us $2,450 — and it has been
-- live since the repricing runs on 8 September.
--
-- The fix is 0056's, applied properly this time. Position is unique within a tour version by
-- design; the seeds have always written 1, 2, 3. Making that a constraint repairs the damage and
-- makes the seeds' idempotence claim true rather than aspirational.
--
-- `tour_version_destinations` uses the same bare clause but is unaffected: it already has a
-- composite primary key, which is exactly the constraint the others were missing.

-- Keep the earliest row for each position and drop the copies. `id` is a v4 uuid so it carries no
-- ordering; ctid is the physical row and the first insert wins, which is the original.
delete from public.tour_included_items a
  using public.tour_included_items b
 where a.tour_version_id = b.tour_version_id
   and a.position = b.position
   and a.ctid > b.ctid;

delete from public.tour_excluded_items a
  using public.tour_excluded_items b
 where a.tour_version_id = b.tour_version_id
   and a.position = b.position
   and a.ctid > b.ctid;

delete from public.tour_faqs a
  using public.tour_faqs b
 where a.tour_version_id = b.tour_version_id
   and a.position = b.position
   and a.ctid > b.ctid;

create unique index if not exists tour_included_items_version_position_idx
  on public.tour_included_items (tour_version_id, position);
create unique index if not exists tour_excluded_items_version_position_idx
  on public.tour_excluded_items (tour_version_id, position);
create unique index if not exists tour_faqs_version_position_idx
  on public.tour_faqs (tour_version_id, position);

comment on index public.tour_included_items_version_position_idx is
  'One item per position per tour version. Also what makes `on conflict do nothing` in the catalog '
  'seeds actually do nothing: without a constraint to conflict with, re-running a seed appends.';
comment on index public.tour_excluded_items_version_position_idx is
  'One item per position per tour version. See tour_included_items_version_position_idx.';
comment on index public.tour_faqs_version_position_idx is
  'One question per position per tour version. See tour_included_items_version_position_idx.';
