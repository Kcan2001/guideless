-- 20260910002000_add_on_families
--
-- The tour page and the builder answer different questions, and until now they were forced to
-- answer them with the same rows.
--
-- A Monaco traveler reading the tour page wants to know "can I watch this from a yacht?". What we
-- showed them was three rows — "Amber Lounge yacht, qualifying day", "…, race day", "…, both days"
-- — which reads as three products and makes a four-card grid into a twelve-card wall. The choice
-- between qualifying and race day is a real choice, but it is a *builder* choice: you make it once
-- you have committed to the trip and you are picking your weekend.
--
-- `tier_group` already exists and does not solve this. It marks the mutually exclusive set (you get
-- one race view), and all three yacht rows plus both grandstand rows sit inside the same group. The
-- family is the axis underneath it: which *thing* this is, independent of which variant.
--
--   tier_group = 'race_view'   ->  you may pick one of these
--   family     = 'Yacht'       ->  these are the same thing on different days
--
-- The tour page groups by family and prices it "From" the cheapest variant, because a Friday yacht
-- and a Sunday yacht are not the same price and quoting the dearest would be a lie in the other
-- direction. The builder keeps every row exactly as it is.
--
-- Nullable on purpose: an add-on with no family is its own family, which is the common case
-- (a transfer, a dinner, the welcome drinks). Only sets with real variants need to say so.

alter table public.departure_add_ons
  add column family text
    check (family is null or char_length(family) between 2 and 80),
  -- One sentence describing the family rather than any one variant. A variant's own description
  -- says "Saturday and Sunday, with lunch and an open bar both days", which is wrong on a card
  -- that stands for all three yacht days. Null falls back to the cheapest variant's description.
  add column family_summary text
    check (family_summary is null or char_length(family_summary) <= 400);

comment on column public.departure_add_ons.family is
  'Generic name for a set of variants of the same thing (yacht on Saturday vs Sunday). The tour '
  'page shows one card per family priced "From" the cheapest variant; the builder shows every row. '
  'Null means the add-on stands alone and its title is its own family.';

comment on column public.departure_add_ons.family_summary is
  'Family-level copy for the tour page. Describes the set, not the variant. Falls back to the '
  'cheapest variant''s description when null.';

-- Grouping is always scoped to a departure, and the partial index keeps the common null case out.
create index departure_add_ons_family_idx
  on public.departure_add_ons (departure_id, family)
  where family is not null;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Only the sets that genuinely have variants today. Everything else stays null and keeps standing
-- on its own. Matching on the title prefix rather than a hardcoded id list so this survives the
-- catalogue being reseeded, which it is on every price refresh.
update public.departure_add_ons
set family = 'Yacht'
where family is null
  and title ilike 'Amber Lounge yacht%';

update public.departure_add_ons
set family = 'Grandstand K'
where family is null
  and title ilike 'Grandstand K%';

-- RLS: no new policy. `family` is catalogue copy on a table whose existing policies already decide
-- who may read a departure's add-ons, and it carries no supplier cost or internal note.
