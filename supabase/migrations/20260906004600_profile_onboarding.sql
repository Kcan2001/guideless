-- 046_profile_onboarding
-- The questions the app asks once, when a traveler first opens their group (plan v2 §43):
-- where they are travelling from, what they are looking forward to, and whether they are coming
-- solo, as a couple, with friends or with family. All optional, all traveler-controlled, and
-- shown to the group only — the same rules as the interests added in migration 029.
--
-- Avatars reuse the existing `user-avatars` bucket from migration 020, which is already public
-- with an own-folder write policy. Phones shoot HEIC and 2 MB is tight for a modern camera, so
-- the limit and the mime list are widened here rather than a second bucket being created.

alter table public.profiles
  add column traveling_from      text check (char_length(traveling_from) <= 80),
  add column excited_about       text check (char_length(excited_about) <= 280),
  add column party_type          text check (party_type in ('solo', 'couple', 'friends', 'family')),
  add column onboarded_at        timestamptz,
  add column show_traveling_from boolean not null default true;

comment on column public.profiles.traveling_from is
  'Free text city the traveler is coming from, e.g. "Santa Monica". Shown to the group when show_traveling_from.';
comment on column public.profiles.excited_about is
  'One line the traveler wrote about the trip. Group-visible; never used for matching.';
comment on column public.profiles.party_type is
  'Who they are travelling with. Drives the roster summary, never a price.';
comment on column public.profiles.onboarded_at is
  'Set when the app finishes the first-run questions, so it only asks once.';

-- ── Avatars ──────────────────────────────────────────────────────────────────
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'user-avatars';
