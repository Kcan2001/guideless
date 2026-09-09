-- Trip character and tier briefs (ADR-014).
--
-- Two gaps this closes, both found while asking why a supplier API cannot pick a hotel for us.
--
-- 1. Nothing described what kind of trip this is. `tours.activity_level` is pace (relaxed /
--    moderate / active) and `tours.style` is the company's operating model, defaulted to
--    'minimal_intervention' on every row and never varied. Neither says whether a trip is a race
--    weekend where people want a rooftop bar or a slow week in Provence where they want quiet. A
--    calm five-star is the right room for one and the wrong room for the other, and no amount of
--    star rating, price or breakfast flag can tell them apart.
--
-- 2. Nothing recorded what a tier means for a given departure. Explorer / Classic / Premium / Elite
--    are market positions, not property attributes: during the Monaco Grand Prix a three-star in
--    Monte Carlo is Premium because on that weekend the tier is set by access and scarcity, while
--    the same property is Explorer the following Tuesday. That judgement existed only in Kyle's
--    head. It is now an artifact somebody else can apply, argue with, or inherit.
--
-- Character lives on the tour version because it is content and it is versioned. The tier brief
-- lives on the departure because it is true of specific dates, not of the product.

-- ── Trip character ───────────────────────────────────────────────────────────
create type public.trip_character as enum (
  'social',     -- people meet; the group is part of the point
  'nightlife',  -- evenings matter; a bar in the building earns its keep
  'slow',       -- unhurried; quiet is a feature, not an absence
  'culinary',   -- built around food and wine
  'cultural',   -- museums, architecture, old towns
  'outdoors',   -- coast, mountains, water, on foot
  'scenic',     -- the view is a reason to be there
  'event'       -- anchored to a fixture whose dates we do not control
);

comment on type public.trip_character is
  'Mirror of TRIP_CHARACTERS in @guideless/types. What kind of trip this is, used to judge whether a property fits it. Distinct from activity_level, which is pace.';

alter table public.tour_versions
  add column character public.trip_character[] not null default '{}';

alter table public.tour_versions
  add constraint tour_versions_character_len check (cardinality(character) <= 5);

comment on column public.tour_versions.character is
  'What kind of trip this is, at most five. Drives whether a property fits: a nightlife trip wants a bar in the building, a slow trip wants quiet. Never a tier and never a pace.';

create index tour_versions_character_idx on public.tour_versions using gin (character);

-- ── Tier briefs ──────────────────────────────────────────────────────────────
-- One short statement per rung of what that rung means in this market on these dates.
--
-- Its own table, not a column on `departures`, and for a reason this repo already learned once:
-- the "open departures are public" policy lets anonymous clients read the departures row, so any
-- staff-only column on it leaks to anyone who asks for it by name. Migration 0023 moved
-- `internal_notes` off `departures` into `departure_notes` for exactly this. A *_public view does
-- not help when the base table is readable.
create table public.departure_tier_briefs (
  departure_id  uuid not null references public.departures (id) on delete cascade,
  tier          public.option_tier not null,
  brief         text not null check (char_length(brief) between 10 and 2000),
  updated_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (departure_id, tier)
);

create trigger departure_tier_briefs_set_updated_at before update on public.departure_tier_briefs
  for each row execute function public.set_updated_at();

comment on table public.departure_tier_briefs is
  'Staff-only. What each tier means for THIS departure on THESE dates: the instruction a curation step works from, the thing a human reviews, and the record of why a property sits in a tier. Never shown to a traveler.';
comment on column public.departure_tier_briefs.brief is
  'A tier is a market position, not a property attribute. During the Monaco Grand Prix a three-star in Monte Carlo is Premium because on that weekend the tier is set by access and scarcity; the same property is Explorer the following Tuesday. Write what the rung means here, on these dates.';

alter table public.departure_tier_briefs enable row level security;
create policy "staff only tier briefs" on public.departure_tier_briefs
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
