-- Trip requirements: what a traveler must be able to satisfy before they can join.
--
-- Until now the only age concept in the schema was `departure_add_ons.min_age`, which gates one
-- optional purchase. There was nothing that said "this trip needs a valid passport" or "you must
-- be 18", so both live products sold without stating either. These are conditions of sale, not
-- marketing copy, so they live on the tour version (they are snapshotted with it and versioned
-- with it) rather than on the departure.
--
-- Two separate things, deliberately:
--   * `tour_versions.minimum_age` is a number the application can check and display.
--   * `tour_requirements` is the human list shown on the tour page and in the app, so we can say
--     "a passport valid for six months beyond your return date" rather than a boolean.

alter table public.tour_versions
  add column minimum_age integer
    check (minimum_age is null or minimum_age between 0 and 99);

comment on column public.tour_versions.minimum_age is
  'Minimum traveler age in years for this trip, null when unrestricted. Displayed and enforced at booking.';

create table public.tour_requirements (
  id               uuid primary key default gen_random_uuid(),
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  position         integer not null default 0,
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 600)
);
create index tour_requirements_version_idx on public.tour_requirements (tour_version_id, position);

comment on table public.tour_requirements is
  'Conditions of joining a trip (passport, age, insurance). Public with the published version.';

alter table public.tour_requirements enable row level security;

create policy "requirements follow version" on public.tour_requirements
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage requirements" on public.tour_requirements
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

-- The lesson of migrations 0056 and 0072, applied before it can bite a third time. The catalog
-- seeds insert with a bare `on conflict do nothing`, which can only do nothing when there is a
-- constraint to conflict with. Without these two indexes, re-running seed 080 appends another copy
-- of every requirement and re-running 081 appends another copy of every recommendation — and both
-- are read straight off the tour page.
--
-- `recommendations` predates this migration and has been empty until now, so it has never shown the
-- bug; it has the same missing constraint and the same seeding pattern, so it gets the same fix.
-- Its natural key is the place itself, not a position: a destination does not have two entries for
-- the same restaurant, but positions get renumbered as staff reorder the list.

delete from public.tour_requirements a
  using public.tour_requirements b
 where a.tour_version_id = b.tour_version_id
   and a.position = b.position
   and a.ctid > b.ctid;

delete from public.recommendations a
  using public.recommendations b
 where a.destination_id = b.destination_id
   and a.title = b.title
   and a.ctid > b.ctid;

create unique index if not exists tour_requirements_version_position_idx
  on public.tour_requirements (tour_version_id, position);
create unique index if not exists recommendations_destination_title_idx
  on public.recommendations (destination_id, title);

comment on index public.tour_requirements_version_position_idx is
  'One requirement per position per tour version. Also what makes `on conflict do nothing` in the '
  'catalog seeds actually do nothing. See tour_included_items_version_position_idx.';
comment on index public.recommendations_destination_title_idx is
  'One entry per place per destination. Same reason as tour_requirements_version_position_idx.';
