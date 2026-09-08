-- 039_catalog_presentation
-- Plan v2 Milestone 1 (docs/plan-v2-audit.md §4): the catalog needs enough detail to sell an
-- option honestly — photos, what is and isn't included, a label, hotel practicalities and a plain
-- explanation of why an upgrade costs more. Pricing is untouched: quote_booking() reads none of
-- these columns.
--
--   option_label                 admin-controlled badge (BEST VALUE / MOST POPULAR / SOCIAL / LUXURY)
--   add_on_kind                  departure_add_ons.kind promoted from a check constraint to an enum,
--                                gaining group_moment / insurance / extension
--   departure_stay_options       tagline, image_urls, includes, excludes, details, label, why_price_note
--   departure_add_ons            image_urls, includes, excludes, label, why_price_note, meeting_point, min_age

create type public.option_label as enum ('best_value', 'most_popular', 'social', 'luxury');

create type public.add_on_kind as enum (
  'activity', 'ticket', 'transfer', 'dinner', 'extra_night', 'room_upgrade',
  'group_moment', 'insurance', 'extension', 'other'
);

-- ── departure_add_ons.kind → enum ────────────────────────────────────────────
alter table public.departure_add_ons drop constraint departure_add_ons_kind_check;
alter table public.departure_add_ons alter column kind drop default;
alter table public.departure_add_ons
  alter column kind type public.add_on_kind using kind::public.add_on_kind;
alter table public.departure_add_ons alter column kind set default 'activity'::public.add_on_kind;

-- ── Stay options ─────────────────────────────────────────────────────────────
alter table public.departure_stay_options
  add column tagline        text check (char_length(tagline) <= 160),
  add column image_urls     text[] not null default '{}' check (cardinality(image_urls) <= 12),
  add column includes       text[] not null default '{}' check (cardinality(includes) <= 12),
  add column excludes       text[] not null default '{}' check (cardinality(excludes) <= 12),
  -- Practicalities shown on the tier card. Documented keys: neighborhood, station_distance,
  -- train_time, breakfast, room_type, hotel_confirmed (boolean). Free-form on purpose; the
  -- customer-facing component renders only the keys it knows.
  add column details        jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  add column label          public.option_label,
  add column why_price_note text check (char_length(why_price_note) <= 500);

-- ── Add-ons ──────────────────────────────────────────────────────────────────
alter table public.departure_add_ons
  add column image_urls     text[] not null default '{}' check (cardinality(image_urls) <= 12),
  add column includes       text[] not null default '{}' check (cardinality(includes) <= 12),
  add column excludes       text[] not null default '{}' check (cardinality(excludes) <= 12),
  add column label          public.option_label,
  add column why_price_note text check (char_length(why_price_note) <= 500),
  add column meeting_point  text check (char_length(meeting_point) <= 200),
  add column min_age        integer check (min_age is null or min_age between 0 and 99);

comment on column public.departure_stay_options.details is
  'Tier-card practicalities: neighborhood, station_distance, train_time, breakfast, room_type, hotel_confirmed (boolean).';
comment on column public.departure_add_ons.min_age is 'Minimum traveler age, null when unrestricted.';

-- RLS: unchanged. "anyone reads active stay options" / add-ons policies (migration 029) already
-- expose whole rows, and none of the new columns is staff-only.
