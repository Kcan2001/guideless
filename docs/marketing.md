# Marketing, social and analytics

How Guideless acquires travelers and measures it. Companion to the master spec §45–47 (SEO,
GA4, PostHog) and ADR-011 (social publishing). Brand voice rules live in `docs/design-system.md`.

## 1. Stack

| Concern              | Tool                                                    | Where it lives                                                        |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Marketing analytics  | GA4 (one property, web + app data streams)              | `apps/web/components/analytics/*`, `apps/mobile/src/lib/analytics.ts` |
| Product analytics    | PostHog (web + mobile)                                  | same modules; explicit events only, no autocapture                    |
| Errors / performance | Sentry                                                  | (Milestone 7)                                                         |
| Social publishing    | Instagram Graph API, our own queue                      | `social_posts`, `/admin/social`, `supabase/functions/social-publish`  |
| Photos               | `guideless_photos/` → `social-media` bucket             | `scripts/social-import.mjs`                                           |
| Email                | Resend (transactional today; Broadcasts for newsletter) | `apps/web/lib/email/*`                                                |
| Search presence      | Google Search Console, Google Business Profile          | manual setup, see §6                                                  |

Principle: **GA4 answers "where do visitors come from and do they book"; PostHog answers "what do
travelers do in the product"**. Neither is an operational system — those numbers come from Postgres.

## 2. Consent

We sell to EU travelers, so analytics are consent-gated:

- GA4 loads with **Consent Mode v2 defaults = denied** (cookieless pings only). PostHog is not
  initialised until consent. `<ConsentBanner />` stores the choice in `localStorage`
  (`guideless-consent-v1`) and `<AnalyticsProvider />` replays it on every load.
- "Essential only" keeps sign-in, checkout and Stripe working; nothing else is set.
- Mobile: PostHog + Firebase run by default (no cookies), with `setEnabled(false)` wired for a
  future "share usage data" toggle in Settings. Store listings must declare analytics collection.
- The banner links to `/privacy` — that page is still to be written (Milestone 7 legal pages).

## 3. Events

GA4 marketing events (spec §46), fired with `track()` from `apps/web/lib/analytics.ts`:
`view_tour, view_departure, start_checkout, add_traveler, begin_payment, purchase, search_tours,
filter_tours, view_destination`, plus `newsletter_signup`, `social_link_click`. `purchase` carries
`tour_id, departure_id, currency, value` — never names or emails.

PostHog product events (spec §47), fired with `track()` from `apps/mobile/src/lib/analytics.ts`:
`trip_opened, itinerary_item_viewed, recommendation_opened, map_opened, live_moment_joined,
chat_opened, message_sent, support_started, document_opened, trip_completed, app_opened`. Screen
views are automatic (`<ScreenTracker />`). Identify with the Supabase user id only.

Adding an event: add it to the union type in the relevant `analytics.ts`, fire it from a service
module or a thin component, document it here. Both sinks receive the same name.

## 4. UTM conventions

Every link we control carries UTMs so GA4 attribution is readable (`utm` in `packages/config`):

| Parameter      | Values                                                      | Example                       |
| -------------- | ----------------------------------------------------------- | ----------------------------- |
| `utm_source`   | `instagram`, `pinterest`, `newsletter`, `google`, `partner` | `instagram`                   |
| `utm_medium`   | `social`, `bio`, `email`, `cpc`, `referral`                 | `bio` (link in Instagram bio) |
| `utm_campaign` | theme or departure, kebab-case                              | `southern-france-2027`        |
| `utm_content`  | optional creative id                                        | `carousel-nice-day3`          |

Instagram bio link: `https://guidelesstours.com/?utm_source=instagram&utm_medium=bio`.

## 5. Instagram pipeline

```
guideless_photos/            pnpm social:import           /admin/social              pg_cron (10 min)
  nice-old-town.jpg   ──►  JPEG · EXIF stripped · ratio  ──►  caption · hashtags ──►  social-publish
  nice-old-town.txt         4:5…1.91:1 · ≤1440px               schedule (tz)         Graph API → permalink
  day-3-avignon/            upload → social-media bucket        publish now
    caption.txt             insert social_posts (draft)         cancel / delete
```

- **Folder = carousel** (2–10 images, name order). **File = single post.** A `.txt` next to a
  file (or `caption.txt` in a folder) seeds the caption; `#tags` in it become hashtags.
- Import is idempotent (`guideless_photos/.imported.json`). The folder is git-ignored; back it up.
- Publishing happens only from `scheduled` rows whose time has passed; the function claims them
  atomically, so overlapping runs cannot double-post. A failed post is marked `failed` with the
  Meta error and waits for a person — no automatic retry.
- Limits enforced: 2,200-char caption, 30 hashtags, 10 carousel items, 100 API posts / 24 h.
- Website reuse: the bucket is public; `social_posts.media_paths` URLs can feed a "From our
  travelers" strip or destination pages without re-uploading.
- Dry run: `SOCIAL_DRY_RUN=1` claims and logs, calls nothing, restores `scheduled`. Local and
  staging run this way.

### Manual run

```bash
curl -X POST "$SUPABASE_URL/functions/v1/social-publish" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

## 6. Account setup checklist (one-time, human)

Analytics

- [ ] GA4 property "Guideless Tours" → **web data stream** → `NEXT_PUBLIC_GA_ID` (Vercel).
      Enable enhanced measurement; mark `purchase` as a key event; link Search Console.
- [ ] Firebase project linked to the same GA4 property → iOS + Android apps
      (`com.guidelesstours.app`) → download `GoogleService-Info.plist` / `google-services.json`
      into `apps/mobile/` (git-ignored) and as EAS file env vars. Build with `eas build` (dev
      client); Expo Go cannot load Firebase.
- [ ] PostHog project → `NEXT_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`. US or EU cloud:
      pick EU if most travelers are European (host `https://eu.i.posthog.com`).
- [ ] Google Search Console (verify via the GA tag), submit `/sitemap.xml`.
- [ ] Google Business Profile for Guideless Tours (reviews + Maps presence).

Instagram / Meta

- [x] `@guidelesstravel` is a **Professional (Business)** account (verified 2026-09-06).
- [x] Meta app **Guideless Tours** — app id `1761518544890433`, Instagram app id
      `1756467348826660`, use case "Manage messaging & content on Instagram" (Instagram Login
      variant). Permissions ready for testing: `instagram_business_basic`,
      `instagram_business_content_publish`, `instagram_business_manage_messages`.
      `guidelesstravel` accepted the Instagram Tester invite. Developer account: kyleacannon@gmail.com.
- [x] Long-lived token generated 2026-09-06 (expires ~2026-11-06; the function refreshes it).
      IG user id `17841437028367890` (the API also reports app-scoped id `28010618715225300`; both
      work). Stored in git-ignored `supabase/.env` and in the local `social_accounts` row. **Still
      to do per hosted environment:** insert into that project's `social_accounts` + Vault secrets
      (docs/deployment.md).
- [ ] Request **Advanced Access** for `instagram_business_basic` +
      `instagram_business_content_publish` (app review, screencast of `/admin/social`). Until
      approved, publishing works only for accounts added as testers — which is enough for us.
- [ ] Optional later: a Facebook Page linked to the account (needed for Meta ads and the
      "Facebook Login for Business" variant with hashtag search).

Email

- [ ] Resend: verify `guidelesstours.com` (SPF, DKIM, DMARC). Create a "Newsletter" audience;
      the site's opt-in form writes to it and fires `newsletter_signup`.

## 7. Channels and priorities

| Channel                 | Why                                                                                                                             | When                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Instagram               | Visual, travel-native, where the audience already plans trips                                                                   | Now                                   |
| Pinterest               | Trip planning intent; pins live for months; links straight to tours; same photo pipeline (add `pinterest` to `social_platform`) | Next                                  |
| Email newsletter        | Owned channel; "new departures" announcements convert best                                                                      | Next (needs form + Resend Broadcasts) |
| SEO / destination pages | Long-tail "small group trip France" searches; CMS tables exist                                                                  | Continuous                            |
| Google Business Profile | Trust + reviews + Maps                                                                                                          | Now (free)                            |
| Reels / TikTok          | Reach, but requires video from trips                                                                                            | When we have footage                  |
| YouTube                 | "A day with Guideless" long-form; strong SEO                                                                                    | Later                                 |
| Facebook                | Only as the Page behind Instagram + ads retargeting                                                                             | With paid                             |
| Paid search / Meta ads  | Branded + high-intent terms once the funnel converts                                                                            | After first departures                |
| Referral credit         | Small groups sell by word of mouth; travelers invite friends                                                                    | Phase 2 (coupons/referrals in spec)   |
| Partnerships            | Slow-travel newsletters and bloggers with affiliate codes                                                                       | Phase 2                               |
| Reviews                 | Google / Trustpilot request from the app after `trip_completed`                                                                 | Phase 2                               |

Skip for now: X, Threads, LinkedIn (unless we sell corporate retreats).

## 8. Content rules for social

Brand voice: calm, specific, never salesy. Show the _day_, not the logo. Terminology from
`packages/config/brand.ts` — "Your Route", "Free time", "Included / Optional"; never "tour guide".
Always: alt text, location context, one soft call to action ("Departures for spring are open").
Never: traveler faces without consent, passport/booking documents, hotel room numbers, exact
live locations of an active group (post live moments after the day, not during).
