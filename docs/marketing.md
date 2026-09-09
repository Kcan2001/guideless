# Marketing, social and analytics

How Guideless acquires travelers and measures it. Companion to the master spec §45–47 (SEO,
GA4, PostHog) and ADR-011 (social publishing). Brand voice rules live in `docs/design-system.md`.

**This document is the machinery — accounts, pipelines, events, UTMs, consent. The plan is
`docs/marketing-plan.md`: what we are trying to do in the 2027 season, in what order, and what we
are deliberately not doing yet. Read that first; this one answers "how do I actually post it".**

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

Our core market is US customers traveling to Europe, but we sell to anyone. GDPR is therefore
not the primary regime, yet EU visitors will book, US state privacy laws keep tightening, and
Google requires Consent Mode for any EEA traffic. A light consent gate costs little and keeps us
clean:

- GA4 loads with **Consent Mode v2 defaults = denied** (cookieless pings only). PostHog is not
  initialised until consent. `<ConsentBanner />` stores the choice in `localStorage`
  (`guideless-consent-v1`) and `<AnalyticsProvider />` replays it on every load.
- "Essential only" keeps sign-in, checkout and Stripe working; nothing else is set.
- Mobile: PostHog + Firebase run by default (no cookies), with `setEnabled(false)` wired for a
  future "share usage data" toggle in Settings. Store listings must declare analytics collection.
- The banner links to `/privacy`; `/terms` and `/privacy` are static pages with copy in
  `apps/web/content/legal/` (entity: Guideless LLC, version = `brand.termsVersion`).

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

Instagram bio link: `https://guidelesstravel.com/?utm_source=instagram&utm_medium=bio`.

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

- [x] GA4 account + property **Guideless Travel** (owner kyleacannon@gmail.com, reporting zone
      America/New_York, USD, industry Travel) → web stream "Guideless Travel website"
      (`https://guidelesstravel.com`, stream id 15730411550) → measurement id **`G-YSBNKPW5Z6`**.
      Enhanced measurement on. Set `NEXT_PUBLIC_GA_ID=G-YSBNKPW5Z6` in Vercel when the project
      exists (already in the local `.env.local`). Still to do in GA: mark `purchase` as a key
      event once the first events arrive; link Search Console.
- [x] Firebase project **Guideless Travel** (project id `guideless-tours` — immutable; Spark plan,
      Gemini off) linked to the existing GA4
      property (552977422). Apps registered: **Guideless iOS** (`com.guidelesstours.app`, app id
      `1:45917505904:ios:5a084a921389e87740e7b5`) and **Guideless Android**
      (`com.guidelesstours.app`). `GoogleService-Info.plist` + `google-services.json` are in
      `apps/mobile/` (git-ignored) — `app.config.ts` now includes the Firebase plugins, so the
      next `eas build` / prebuild ships GA4 in the app. Both files are uploaded as EAS **file**
      environment variables `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICE_INFO_PLIST` (development,
      preview, production; `app.config.ts` reads the path from the variable first). Expo Go cannot
      load Firebase (use a dev client).
- [x] PostHog **US cloud** project "Guideless Travel", id `596884` (owner kyleacannon@gmail.com),
      project API key
      `phc_Cod6FWi284wzpmiA2xCDJrBCLPFgjRtPUm6iu8Xuyt6t` (public write-only token, safe in client
      code). Set as `NEXT_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_KEY` with host
      `https://us.i.posthog.com` — set in the local env files, in Vercel, and as EAS environment
      variables (`EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`, all three environments).
- [x] Google Search Console: domain property **`guidelesstravel.com` verified** (2026-09-06) via a
      TXT record at Squarespace Domains (`@` →
      `google-site-verification=T6AyZ03KwM1YjNV_uE0nJO0rI9H4sbCwMR--55YeMl8`; do not delete it).
      Still to do once the site is live: submit `/sitemap.xml`, link the property to GA4 (Admin →
      Product links).
- [x] **Domain.** Canonical domain is **`guidelesstravel.com`** (Squarespace Domains, Google Cloud
      DNS, matches the Instagram handle); the repo was renamed to it in de489e5. **`guidelesstours.com`**
      is also owned (Squarespace, registered until 2029-09-06) and forwards with a permanent
      301, path preserved, to `https://guidelesstravel.com` (Squarespace Domains → Website → Domain
      Forwarding). Keep both renewals on autopay.
- [ ] Google Business Profile for Guideless Travel (reviews + Maps presence).

Instagram / Meta

- [x] `@guidelesstravel` is a **Professional (Business)** account (verified 2026-09-06).
- [x] Meta app **Guideless Travel** (Instagram sub-app label still reads "Guideless Tours-IG";
      cosmetic, use "Sync app name" on the API setup page) — app id `1761518544890433`, Instagram app id
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
- [x] Facebook Page **Guideless Travel** created 2026-09-07 (id `61594000960629`,
      facebook.com/profile.php?id=61594000960629; category Travel Company; website, hello@ email,
      bio, logo + Nice cover photo set; `FACEBOOK_PAGE_ID` in `supabase/.env`). It is the ad identity
      for Meta Ads later and the Page behind the Instagram account. @guidelesstravel is **linked** to the Page (Page settings → Linked accounts), and both sit in
      the Meta **business portfolio** id `1412763007475543` (`META_BUSINESS_PORTFOLIO_ID`;
      business.facebook.com/settings) that Meta created during the link. The portfolio owns the developer app 1761518544890433 (Accounts → Apps) and has the Page as
      its primary Page. Still to do: vanity username (Meta gates it for new Pages), action button →
      website, business verification when Meta offers it (needed for Advanced Access / ads at
      scale). Business details are filled in (legal name Guideless LLC, the IRS-registered Philadelphia
      address, business phone, website, EIN — the EIN lives only in Meta). Meta currently reports
      "your organization does not need to be verified"; the verification flow appears when the
      developer app requests Advanced Access, and the Certificate of Formation or the IRS EIN
      letter (both in ZenBusiness) is the document to upload then.

Email

- [x] Resend account (kyleacannon@gmail.com). Domain `guidelesstravel.com` added (id
      `1b70b40a-bc07-43a9-b355-43f8dd8b3b62`, region us-east-1) with DKIM TXT `resend._domainkey`,
      CNAME `rsend` / `send` → `*.forge.rmta.net` and TXT `_dmarc` (`p=none`) at Squarespace Domains
      (2026-09-07). Inbound MX deliberately **not** added so the domain stays free for a real
      mailbox. API key "guideless-web" (full access) → `RESEND_API_KEY`; default audience "General"
      → `RESEND_AUDIENCE_ID=230d58be-db8a-4077-8be6-83fdaa65f03c`. Both in the local env files;
      add to Vercel + Supabase function secrets. **Check:** domain status was "pending" right after
      the records were added — confirm it reads "Verified" in Resend → Domains.
- [ ] DMARC: once mail flows, tighten `_dmarc` to `p=quarantine; rua=mailto:hello@guidelesstravel.com`.

Pinterest

- [x] Business account **@guideless_travel** (2026-09-07; "guidelesstravel" was taken on Pinterest;
      display name "Guideless Travel", type Service provider, website guidelesstravel.com — claim the
      website in Settings → Claimed accounts once the site is live). Board **"Europe trips,
      organized"** (id `1134766574768036100`, `PINTEREST_BOARD_ID` in `supabase/.env`) is the
      default `metadata.board_id`.
- [x] Developer app **Guideless Travel Publisher**, app id `1609269`
      (developers.pinterest.com/apps/1609269), trial access requested 2026-09-07 with use case
      "Pin creation & scheduling", personal API access, own Pins/Boards only.
- [ ] **Trial access was DENIED** on 2026-09-07, within the hour (reason arrives by email to
      kyleacannon@gmail.com). Pinterest lists two denial reasons: "Privacy policy is inaccurate or
      not accessible" and "App description is incomplete or unclear". Ours is the first:
      guidelesstravel.com still points at Squarespace and returns 404, so the privacy-policy URL on
      the application could not be opened. Re-apply once the site is live (appeal via a Help Center
      ticket, or Details tab → Save / Connect app again; one open request at a time). While
      denied/pending the app secret and the redirect-URI field are locked. When it is approved: add redirect URIs `http://localhost:8765/callback`
      (one-time token script) and `https://guidelesstravel.com/api/social/pinterest/callback`,
      copy the secret into `supabase/.env` (`PINTEREST_APP_SECRET`) and the function secrets
      (`PINTEREST_APP_ID` / `PINTEREST_APP_SECRET`), run the OAuth flow once with scopes
      `pins:write boards:read user_accounts:read` to get an access + refresh token, then insert
      the `social_accounts` row (`platform = .pinterest.`, `external_id` = Pinterest user id,
      `metadata = {"board_id": "…", "refresh_token": "…"}`).
- [ ] Trial-access Pins are **sandbox entities visible only to their creator** (Pinterest rule), so
      the publisher cannot reach anyone until **Standard access** is granted. That upgrade is
      requested from the app dashboard and needs a short video demonstrating the OAuth flow and
      the integration; plan it right after trial access is approved.

## 7. Channels and priorities

| Channel                 | Why                                                                                                                                                            | When                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Instagram               | Visual, travel-native, where the audience already plans trips                                                                                                  | Now                                   |
| Pinterest               | Trip planning intent; pins live for months; links straight to tours; same photo pipeline (`platform = pinterest`, "Also post to Pinterest" in `/admin/social`) | Built — needs the account (§6)        |
| Email newsletter        | Owned channel; "new departures" announcements convert best                                                                                                     | Next (needs form + Resend Broadcasts) |
| SEO / destination pages | Long-tail "small group trip France" searches; CMS tables exist                                                                                                 | Continuous                            |
| Google Business Profile | Trust + reviews + Maps                                                                                                                                         | Now (free)                            |
| Reels / TikTok          | Reach, but requires video from trips                                                                                                                           | When we have footage                  |
| YouTube                 | "A day with Guideless" long-form; strong SEO                                                                                                                   | Later                                 |
| Facebook                | Only as the Page behind Instagram + ads retargeting                                                                                                            | With paid                             |
| Paid search / Meta ads  | Branded + high-intent terms once the funnel converts                                                                                                           | After first departures                |
| Referral credit         | Small groups sell by word of mouth; travelers invite friends                                                                                                   | Phase 2 (coupons/referrals in spec)   |
| Partnerships            | Slow-travel newsletters and bloggers with affiliate codes                                                                                                      | Phase 2                               |
| Reviews                 | Google / Trustpilot request from the app after `trip_completed`                                                                                                | Phase 2                               |

Skip for now: X, Threads, LinkedIn (unless we sell corporate retreats).

## 8. Content rules for social

Brand voice: calm, specific, never salesy. Show the _day_, not the logo. Terminology from
`packages/config/brand.ts` — "Your Route", "Free time", "Included / Optional"; never "tour guide".
Always: alt text, location context, one soft call to action ("Departures for spring are open").
Never: traveler faces without consent, passport/booking documents, hotel room numbers, exact
live locations of an active group (post live moments after the day, not during).

## 9. Newsletter

The list lives in Postgres (`newsletter_subscribers`, migration 036); Resend Broadcasts sends to a
mirrored audience. Never edit the Resend audience by hand — it is a projection.

```
footer <NewsletterForm />  ──►  subscribeNewsletterAction (Zod, honeypot, rate limit 5/h per IP)
                                    └─► rpc subscribe_newsletter(email, source)   [security definer]
                                    └─► POST resend.com/audiences/{id}/contacts  (optional, soft-fail)
newsletter email footer  ──►  /newsletter/unsubscribe?token=…  ──►  rpc unsubscribe_newsletter(token)
                                                                └─► PATCH Resend contact unsubscribed
```

- **Single opt-in** with clear purpose text ("one email when a new trip or date opens") and a
  one-click unsubscribe token in every send (also use it as the `List-Unsubscribe` header).
  Switch to double opt-in later by adding a `confirmed_at` gate in the RPC if EU volume grows.
- Sources: `footer`, `checkout`, `account`, `admin`, `import`. Signed-in subscribers are linked by
  `user_id`. `profiles.marketing_opt_in` (migration 003) is legacy; treat this table as the truth
  and fold the profile flag into it when the account page gets a newsletter toggle.
- Sending: Resend Broadcasts from the "Newsletter" audience, from
  `Guideless Travel <hello@guidelesstravel.com>`, plain and short, one departure or theme per email,
  every link with `utm_source=newsletter&utm_medium=email&utm_campaign=<theme>`.
- Staff can see and export the list in Supabase (content roles); an admin screen is not needed yet.

## 11. The mailing list and campaigns (migration 0071)

We had been collecting addresses in five places and sending to none of them. `/admin/email` is
where that stops.

### One list, with what each address is for

`mailing_list` unions every address we hold and marks it:

| Segment             | `can_market` | They agreed to            |
| ------------------- | ------------ | ------------------------- |
| `newsletter`        | yes          | anything                  |
| `destination_alert` | yes          | **that destination only** |
| `waitlist`          | yes          | **that trip only**        |
| `host_applicant`    | no           | their application         |
| `testimonial`       | no           | their testimonial         |

The consent split is the point and it is not a setting. Somebody who applied to host, or sent a
quote about a weekend in 2025, gave us an address to do that one thing; putting them in a blast is
how a sending domain gets burned and it is a promise we never made. `sendCampaign()` throws rather
than sends if a segment's `can_market` is false, and the composer will not offer those segments.
Purpose is narrower still: a campaign with a `context` of "Lisbon" reaches only the people who
asked about Lisbon.

### Unsubscribe, which two lists did not have

`destination_alerts` and `departure_waitlist` both take an email from somebody with **no account** —
that is their whole point — but the only way to stop either was a button on the account page. Both
now carry an `unsubscribe_token` and a token-based stop function, and `/unsubscribe?kind=…&token=…`
acts on GET without a sign-in or a confirmation step, because mail clients do not post forms and a
link that needs a second click leaves people subscribed. An unknown token gets the same answer as a
good one, so the link cannot be used to check whether an address is on a list.

### Writing one

Plain text in a textarea, blank lines between paragraphs. There is no HTML field and no rich text
editor on purpose. `lib/email/layout.ts` renders it: `renderEmail()` takes blocks (`text`,
`bullets`, `facts`, `quote`, `rule`) and produces the HTML **and** the text part from the same
input, so the text version cannot drift. `kind: "marketing"` requires an `unsubscribeUrl` — the
type will not compile without one.

`email_campaign_sends` has a primary key of (campaign, email), so a send that dies halfway can be
run again and nobody gets it twice. And a campaign cannot be sent until it has been sent to the
author first: that guard protects Kyle rather than the recipient, and it costs one click.

Legacy note: `templates/booking-confirmed.ts` predates the layout kit and still builds its own
HTML. It works and is left alone; migrate it the next time it needs a change.

### What sends automatically

Only one thing: a note to the support mailbox when a testimonial submission arrives, so ten links
sent out do not mean checking `/admin/testimonials` all week. Departure-opening and destination
alerts are **not** automatic — with a list this size, a person deciding to press send is better
than a cron that emails the wrong forty people, and the composer's segment picker is that
mechanism. Revisit when the list is big enough that it stops being feasible.

## 10. Pinterest

Same queue as Instagram. A post's `platform` decides the adapter in `social-publish`; pins add a
`title` (≤100) and a destination `link_url` (defaults to the site with Pinterest UTMs). Carousel
posts become multi-image pins. Tokens last 30 days and are refreshed with the stored
`refresh_token` and the app credentials. Use "Also post to Pinterest" on any Instagram post to
create the Pinterest draft with the same media; give it a search-friendly title and a tour link.
