# ADR-011 — Social publishing through the Meta Graph API, scheduled in Postgres

**Status:** Accepted
**Date:** 2026-09-06

## Context

Marketing starts with Instagram (`@guidelesstravel`). Photos arrive in batches from trips and need
to become a steady stream of posts without someone opening the Instagram app every day. The same
photos are also the website's imagery. We want captions reviewed by a person, a predictable
posting cadence, and a record of what was published where.

## Decision

Build the queue ourselves on the existing stack:

- `social_posts` (+ `social_accounts`) tables in Postgres, RLS-protected (content staff), with a
  public `social-media` storage bucket for normalized JPEGs.
- `scripts/social-import.mjs` turns `guideless_photos/` into draft posts (JPEG, EXIF/GPS stripped,
  Instagram aspect ratios) — the only place local files are touched.
- `/admin/social` for captions, hashtags, alt text and scheduling.
- `supabase/functions/social-publish` publishes due posts through the **Instagram API with
  Instagram Login** (container → publish), refreshes the 60-day token, respects the 100 posts /
  24 h quota, and records permalinks or errors on the row.
- `pg_cron` (every 10 minutes) → `pg_net` → the Edge Function, with the URL and shared secret in
  Supabase Vault. Claiming is atomic (`claim_due_social_posts`, `for update skip locked`).

## Consequences

- One system of record for marketing output; posts can link to `tours` / `destinations`, which
  later lets us correlate posts with GA4 traffic and bookings.
- Meta app review (`instagram_business_content_publish`) is required before publishing to the real
  account; until then the pipeline runs in dry-run mode. Instagram must be a Professional account.
- Adding Pinterest or Facebook is a new `social_platform` enum value plus an adapter in the
  function; the queue, admin and import do not change.
- We own token refresh and failure handling. Failures never retry blindly — a person re-schedules.
- Videos / Reels are out of scope (different upload API and processing); stills and carousels only.

## Alternatives considered

- **Buffer / Later / Hootsuite** — fast to start, but a monthly cost, a second place captions
  live, no link to our tours data, and their own approval flows. Reasonable fallback if Meta app
  review stalls.
- **Zapier / Make from Google Drive** — glue with no review step and poor failure visibility.
- **Browser automation of instagram.com** — violates Instagram's terms; accounts get disabled.
- **Vercel cron + Server Action** — works, but the database already has a scheduler we use for
  booking holds; one scheduling mechanism is enough (ADR-002).
