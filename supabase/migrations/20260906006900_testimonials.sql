-- 0069_testimonials
--
-- Monaco weekends have been run before, just not under this company name. That is the strongest
-- credibility we have and none of it can go through `reviews`: submit_review() requires a
-- completed Guideless booking, deliberately, and those rows feed tour_review_stats which feeds the
-- AggregateRating in a tour page's structured data. Telling a search engine that a rating averages
-- trips this entity did not sell is the one version of this with real downside, and it would also
-- break the promise on /reviews that every review is written by someone who took the trip.
--
-- So testimonials are a separate thing, and the separation is structural rather than a convention
-- somebody has to remember:
--
--   * There is no rating column. Not "nullable" — absent. A number nobody can store is a number
--     nobody can average into the aggregate by accident later.
--   * They live in their own table with their own moderation state, and reach the public only
--     through testimonials_public, which selects display columns from published rows.
--   * The base table is staff-only, because it carries the things a customer must never read:
--     where the quote came from and whether the person actually agreed to be quoted. RLS is
--     row-level, not column-level, so a public policy on this table would publish those columns
--     along with the quote. (`reviews` has exactly that shape today — see the note at the bottom.)
--
-- Attribution of who ran the earlier trips is deliberately left off the row (Kyle's call,
-- 9 Sep 2026). `trip_label` carries the neutral context a reader sees — "Monaco, 2025" — and the
-- provenance lives in the staff-only `source_note` so the record exists internally regardless.

create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  -- What they said. Not a review: no rating, no verified-booking claim, no star anywhere.
  quote        text not null check (char_length(quote) between 20 and 1200),
  -- First name only, like a review byline. A quote is somebody's word, not their identity document.
  author_name  text not null check (char_length(author_name) between 1 and 60),
  -- The neutral context shown next to the quote, e.g. "Monaco, 2025".
  trip_label   text not null check (char_length(trip_label) between 2 and 80),
  -- Which tour page this belongs beside, when it maps onto one we now sell. Null is fine: a
  -- general testimonial still earns its place on /reviews.
  tour_id      uuid references public.tours (id) on delete set null,
  -- Sorting only, and staff-only, so the public page cannot be read as a dated claim.
  happened_in  smallint check (happened_in between 2000 and 2100),
  -- Optional photo, already-public URL (the social-media bucket). No new storage policy needed.
  image_url    text check (image_url is null or image_url ~ '^https://'),
  position     integer not null default 0,
  status       public.review_status not null default 'pending',
  published_at timestamptz,

  -- ── Staff-only from here down. Never selected by testimonials_public. ──────────────────────
  -- Whether the person actually said yes to being quoted in public. Publishing without it is
  -- refused by the constraint below rather than by a code path somebody could forget.
  consent_confirmed boolean not null default false,
  -- Where this came from, who ran that trip, when consent was given and by what means.
  source_note  text check (char_length(source_note) <= 1000),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint testimonials_published_at check ((status = 'published') = (published_at is not null)),
  constraint testimonials_consent_before_publish
    check (status <> 'published' or consent_confirmed)
);

create index testimonials_public_idx on public.testimonials (tour_id, position)
  where status = 'published';
create index testimonials_status_idx on public.testimonials (status, created_at desc);

create trigger testimonials_set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

comment on table public.testimonials is
  'Quotes from trips run before Guideless existed. Not reviews: no rating, never in '
  'tour_review_stats, never in AggregateRating. Staff-only — the public reads testimonials_public.';
comment on column public.testimonials.consent_confirmed is
  'The person agreed to be quoted publicly. A row cannot be published without it.';
comment on column public.testimonials.source_note is
  'Staff-only provenance: where the quote came from, who ran the trip, how consent was recorded.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- No public policy at all. Everything a visitor sees comes through the view below.
alter table public.testimonials enable row level security;

create policy "staff read testimonials" on public.testimonials
  for select to authenticated
  using ((select public.is_staff()));

create policy "content staff manage testimonials" on public.testimonials
  for all to authenticated
  using ((select public.is_content_staff()))
  with check ((select public.is_content_staff()));

-- ── The public projection ────────────────────────────────────────────────────
-- security_invoker = false so an anonymous visitor can read it without a policy on the table,
-- which is what keeps the tour page statically generatable. Display columns only: no consent
-- flag, no source note, no year, no rating — because there is no rating.
create view public.testimonials_public
with (security_invoker = false) as
  select id,
         quote,
         author_name,
         trip_label,
         tour_id,
         image_url,
         position,
         published_at
  from public.testimonials
  where status = 'published';

revoke all on public.testimonials_public from public;
grant select on public.testimonials_public to anon, authenticated;

comment on view public.testimonials_public is
  'Published testimonials, display columns only. Deliberately carries no rating: these are not '
  'reviews and must never reach tour_review_stats or the AggregateRating on a tour page.';

-- ── Related fix ────────────────────────────────────────────────────
-- Found while building the above, and the same mistake this migration exists to avoid.
--
-- `reviews` and `trip_photos` each granted anon SELECT on published rows, and each row carries
-- `staff_note` — an internal moderation note a moderator writes when publishing or rejecting —
-- and `user_id`, which ties a published review to an auth user id. RLS is row-level, so "published
-- rows are public" published those columns too: anyone could read them straight off the REST
-- endpoint. CLAUDE.md rule 11 says internal notes never reach a customer.
--
-- Narrowing the policy to rows with an empty note would hide any review a moderator annotated,
-- which is worse than the leak. The fix is the one this file already uses: the public reads a
-- projection, and the table stops being anon-readable at all. tour_review_stats is unaffected —
-- it is security_invoker = false and never depended on the policy.
drop policy "published reviews are public" on public.reviews;
drop policy "published photos are public" on public.trip_photos;

create view public.reviews_public
with (security_invoker = false) as
  select id,
         tour_id,
         rating,
         title,
         body,
         would_repeat,
         published_at,
         author_name,
         trip_end_date
  from public.reviews
  where status = 'published';

revoke all on public.reviews_public from public;
grant select on public.reviews_public to anon, authenticated;

comment on view public.reviews_public is
  'Published reviews without staff_note or user_id. Public pages read this, never the table.';

create view public.trip_photos_public
with (security_invoker = false) as
  select id,
         tour_id,
         storage_path,
         caption,
         published_at,
         author_name
  from public.trip_photos
  where status = 'published';

revoke all on public.trip_photos_public from public;
grant select on public.trip_photos_public to anon, authenticated;

comment on view public.trip_photos_public is
  'Published traveler photos without staff_note or user_id. Public pages read this, never the table.';
