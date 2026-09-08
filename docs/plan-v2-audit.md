# Plan v2 — Implementation audit and first milestone

_Answers §55 of `docs/guideless_travel_master_plan_v2.md`. Written 2026-09-07 from a read-only pass
over the web app, database, mobile app, admin and docs. No code was changed. Section numbers below
(§n) refer to the v2 plan._

## 1. Verdict in one paragraph

The plan's executive decision holds: nothing needs rebuilding. The database already models the exact
hierarchy the plan asks for (tour → version → departure → group → booking → travelers), prices
everything in one SQL function, holds inventory, snapshots purchases and lets two independent
bookings share one group. The seven-step checkout, post-booking add-on purchase, referral credit,
Stripe webhook, Expo app and admin catalog all exist and work in production. What is missing is
almost entirely **presentation and positioning** (homepage, Monaco page, builder UX, rich option
cards, real screenshots), a handful of **small catalog columns** (images, includes/excludes,
labels, hotel details), one **new domain object** (friend/group code), and one **new integration
layer** (hotel suppliers). The first milestone should therefore be Phase 1 of the plan, with the
catalog columns pulled forward so the Monaco page can show real detail instead of copy.

## 2. What exists and is reusable

### 2.1 Web (`apps/web`)

| Area                                | What exists                                                                                                                                                                                                                                                                                                                                                                                                                                | Reuse for                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Homepage `app/(marketing)/page.tsx` | Hero on real photo (`PhotoBackdrop`), 4-step "how it works", 3 `TourCard`s, event weekends, destinations grid, "Guideless handles / You book", sample day from real itinerary, 3-item FAQ, JSON-LD                                                                                                                                                                                                                                         | Keep components; replace section list and copy (§5)                                                                                                                            |
| Tour page `tours/[slug]/page.tsx`   | Hero, `PhotoGallery`, overview + route, "Make it yours" (`StayTiers`, `AddOnList`, `EventTierMenu`, `RoomRule`, `ReferralHint`), `ResponsibilityList`, `ItineraryTimeline` with anchor callout, `DepartureList`, DB-driven FAQ, `TouristTrip`/`Event`/`FAQ`/`Breadcrumb` JSON-LD, `view_tour` tracking                                                                                                                                     | Skeleton of the new Monaco page (§7–12); tier and race cards are upgrades of `StayTiers`/`EventTierMenu`                                                                       |
| Checkout `components/checkout/*`    | 7 steps (Travelers → Rooms & stay → Add-ons → Preferences → Account → Terms → Payment), react-hook-form + Zod, `useBookingQuote` (300 ms debounced client RPC to `quote_booking`, stale-response guard), sticky `OrderSummary` with lines/deposit/balance/problems and code entry, sessionStorage draft + `?step=` resume, `startCheckout` server action (booking + 30-min hold + Stripe session clamped to hold), `?cancelled=1` handling | Becomes the Trip Builder (§13–18) by re-ordering steps, moving it to `/tours/[slug]/build`, and enriching option cards. The quote plumbing and payment hand-off need no change |
| Account                             | `/account` (open trip, checklist, traveler edit, cancellation with refund preview, referral card, pay balance), `/account/bookings/[id]/add-ons` post-booking purchase via `start_add_on_purchase` + Stripe                                                                                                                                                                                                                                | §12 "add later" already works; needs the same rich cards                                                                                                                       |
| Analytics `lib/analytics.ts`        | 13 typed events (GA4 Consent Mode v2 + PostHog): `view_tour`, `view_departure`, `start_checkout`, `add_traveler`, `begin_payment`, `purchase`, `add_add_on`, `remove_add_on`, …                                                                                                                                                                                                                                                            | Extend, don't replace (§45)                                                                                                                                                    |
| Design system                       | Tokens in `packages/config`: ink `#0B2025`, aqua `#60E1BB`, cyan `#17B1DF`, teal, sand, cloud; Manrope headings, Inter body; flat bordered cards; the only glass surface is the sticky header; gradients only as photo scrims                                                                                                                                                                                                              | Already close to §47–50. See decision D1                                                                                                                                       |
| Photos                              | 30 curated JPEGs with alt + focal point (`public/photos/manifest.json`), 3 of 4 `sitePhotos` picks unused                                                                                                                                                                                                                                                                                                                                  | Enough for Phase 1                                                                                                                                                             |
| SEO                                 | Sitemap, robots, manifest, per-tour OG images, canonical + OG metadata                                                                                                                                                                                                                                                                                                                                                                     | Add new pages to sitemap                                                                                                                                                       |
| Legal                               | `/terms`, `/privacy` (Delaware governing law)                                                                                                                                                                                                                                                                                                                                                                                              | §6 asks for `/cancellation` and `/travel-insurance` too                                                                                                                        |

### 2.2 Database (`supabase/migrations`, 38 files, all applied to prod and staging)

| Plan requirement                                                 | Status                                                                                                                                                                                                                                                                                                                                                                                                 | Where                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Tour → version → departure → group → booking → travelers (§19)   | **Done.** `departure_groups` auto-creates "Group A"; `create_trip_for_group` admits every confirmed booking on a single-group departure, so two independent bookings share one group and one chat                                                                                                                                                                                                      | 001000, 002900:51      |
| Separate financial bookings per traveler party (§19)             | **Done.** Bookings are per party (1–8 travelers); nothing ties them financially                                                                                                                                                                                                                                                                                                                        | 001200                 |
| Authoritative server pricing (§23)                               | **Done.** `quote_booking(p_departure_id, p_room_indexes, p_stay_option_id, p_add_ons, p_code, p_payment_option, p_apply_credit)`: rooms (max 2), stay-tier delta + capacity, per-traveler/per-booking add-ons, `tier_group` exclusivity, capacity via `add_on_availability`, sales window, coupon or referral (base only), account credit, deposit vs full. `create_booking` re-runs it in-transaction | 003000                 |
| Inventory holds (§25)                                            | **Done.** 30-min seat hold (`system_settings.booking_hold_minutes`), add-on holds, cron release every 5 min, row-locked capacity assertion                                                                                                                                                                                                                                                             | 001200, 003000         |
| Purchased-item snapshots (§27)                                   | **Partial.** Add-on price snapshotted at creation, title only when confirmed; stay tier delta folded into the base line rather than its own line                                                                                                                                                                                                                                                       | 003000:363–422         |
| Booking status (§26)                                             | **Different by design.** `booking_status` has 6 values; `paid`/`partially_refunded` live on `payment_status`; `balance_due` is derivable. Keep the separation (CLAUDE.md rule 14)                                                                                                                                                                                                                      | 000100                 |
| Multiple departures per tour (§21)                               | **Done.** `departures` + `departures_public`, `DepartureList` on tour page                                                                                                                                                                                                                                                                                                                             | 000900                 |
| Add later, even mid-trip (§12)                                   | **Done.** `start_add_on_purchase` / `confirm_add_on_purchase`, mobile opens the web purchase page                                                                                                                                                                                                                                                                                                      | 003000                 |
| Real social counts (§17)                                         | **Done.** `add_on_headcounts` (confirmed "going"), `trip_add_on_participants` (names, trip-member gated), `departure_roster_stats` (booked/solo/pairs/countries/spots left, age band suppressed under 4)                                                                                                                                                                                               | 002800, 002900, 003000 |
| Tour versioning + trip snapshots (§28)                           | **Done.** ADR-008/009                                                                                                                                                                                                                                                                                                                                                                                  | 000600, 001400, 001500 |
| Suppliers with private cost (§34)                                | **Done** for manual ops: `suppliers`, `supplier_contacts`, `supplier_services` (cost staff-only), add-on → supplier service FK                                                                                                                                                                                                                                                                         | 000800, 002800         |
| Referral codes                                                   | **Done** as a discount + $75 credit (`GL-XXXXXX`) — not a group code                                                                                                                                                                                                                                                                                                                                   | 002900                 |
| Group opens N days before (§42)                                  | **Done.** `group_opens_days_before`, daily `open_due_groups()`                                                                                                                                                                                                                                                                                                                                         | 002900                 |
| Cancellation self-service, rate limits, support inbox, documents | **Done**                                                                                                                                                                                                                                                                                                                                                                                               | 003400, 003500         |
| Tests                                                            | 8 pgTAP files, 157 assertions; CI runs them on a fresh database                                                                                                                                                                                                                                                                                                                                        | `supabase/tests`       |

### 2.3 Mobile (`apps/mobile`)

Tabs today: **Trip (= Today) · Map · Explore · Group · Support**, plus stack routes for full
itinerary, item detail, chat rooms, support threads, Live Moment suggestion, documents, inbox,
hidden profile tab. Today screen answers "where am I, what's next" (now/next with minutes-until,
free-time card, today's add-ons, hotel, group summary). Offline itinerary and document caches,
push registration with operational/social channels, deep links, three chat room types, Live Moments
with RSVP and realtime, private support with itinerary-item context, privacy toggles for home
country/bio/interests. Add-on purchase hands off to the web account page (no card data in the app).

### 2.4 Admin

Tours, versions (template itinerary editor), departures (travelers, bookings, groups/trips, stays,
add-ons, suppliers, notes), add-on manifests with CSV, live itinerary editor (edits auto-notify
travelers through a DB trigger), rooms, documents, Live Moments, bookings (money, refunds, manual
payment, cancellation requests), customers, support inbox, social queue, hosts, meetups. Add-on and
stay-option CRUD covers title, description, kind, price, basis, capacity, day/time/place, sales and
cancellation windows, tier group, supplier link, featured flag.

## 3. Gaps against the plan

### 3.1 Positioning and homepage (§4–5) — the main problem

| Plan section                                 | Live site today                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero "Travel with a plan. Not a tour guide." | "Travel organized. Explore independently." with eyebrow "Minimal intervention travel" (category language the plan says to drop)                                    |
| The problem / three-way comparison           | Absent                                                                                                                                                             |
| Four "Why Guideless" blocks                  | Absent; a 4-step "how it works" list instead                                                                                                                       |
| Real app screenshots                         | Absent. **No device or simulator build has ever run** (`docs/go-live.md`, `docs/mobile.md`), so there are no screenshots to use, and the plan forbids fake mockups |
| Configurator example with real prices        | Absent                                                                                                                                                             |
| "Independent, not alone"                     | Absent                                                                                                                                                             |
| Trust: founder story, philosophy             | Absent                                                                                                                                                             |
| FAQ (17 questions)                           | 3 generic questions                                                                                                                                                |

### 3.2 Information architecture (§6)

Missing public routes: `/why-guideless`, `/about`, `/faq`, `/contact`, `/group-travel`,
`/cancellation`, `/travel-insurance`, `/reviews`, `/journal`, `/trips` (index exists as `/tours`),
`/tours/[slug]/build`. Extra routes not in the plan that should stay: `/host`, `/meetups`,
`/tours/[slug]/departures/[id]`. Customer routes differ in naming only (`/account/bookings/[id]/add-ons`
vs `/account/trips/[id]/add`); no separate payments page (pay-balance is a form on `/account`).

### 3.3 Monaco page (§7–12)

Hero is the tour name; CTAs are in-page anchors and "Book" goes straight to checkout. No
"base trip includes" block, no package-operator comparison, no "add later" callout. Stay options
render as name / area / star rating only (no hotel photos, station distance, train time, breakfast,
room type). Race options render as priced rows (no section, view, includes/not-included, photos).
The seed calls the Monaco tier "5★ in Monte Carlo" with no property behind it, which §10 forbids.

### 3.4 Trip Builder (§13–18)

| Plan                                                                                             | Today                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Steps: Dates → Stay → Race → Experiences → Transfers → Travelers → Review → Payment              | Travelers → Rooms & stay → Add-ons → Preferences → Account → Terms → Payment (dates chosen on the tour page) |
| URL `/tours/[slug]/build`                                                                        | `/checkout/[departureId]`, noindex                                                                           |
| Rich option cards (photos, includes, meeting point, capacity, cancellation, "why it costs more") | Title, description, price, day, "Popular" badge; no images; cancellation window is an integer                |
| "N people from your group added this" in the builder                                             | Data exists (`add_on_headcounts`) but is only shown in the app, not in checkout                              |
| Sticky mobile total                                                                              | Desktop sticky aside exists; mobile behaviour not verified                                                   |
| Save / resume                                                                                    | sessionStorage only (same browser); no server-side draft, no cross-device resume                             |
| Friend / group code (§20)                                                                        | **Absent.** Referral code is a discount, not a group link                                                    |
| Explain price differences (§18)                                                                  | Only free-text `description`                                                                                 |

### 3.5 Data model (§24–29)

| Plan                                                  | Today                                                                                                                                                               | Recommendation                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic `products` / `product_variants` / `inventory` | `departure_stay_options` + `departure_add_ons` (+ `booking_add_ons`); kinds: activity, ticket, transfer, dinner, extra_night, room_upgrade, other; capacity per row | **Do not migrate.** The two tables already behave as products with variants (`tier_group`) and inventory. Add missing kinds (`group_moment`, `insurance`, `extension`) to the check constraint and promote it to a real enum |
| Images, includes/excludes, labels, hotel details      | None                                                                                                                                                                | New migration (see §4)                                                                                                                                                                                                       |
| Hotels / rooms / rates / supplier mappings            | None; hotel is free text on the stay option                                                                                                                         | Phase 3 tables                                                                                                                                                                                                               |
| Extensions as first-class                             | `extra_night` add-on kind only                                                                                                                                      | Phase 2: `extension` kind + pre/post dates; no new table needed                                                                                                                                                              |
| Reviews, traveler photos                              | None                                                                                                                                                                | Phase 6 tables                                                                                                                                                                                                               |
| Group code                                            | None                                                                                                                                                                | Phase 2 table                                                                                                                                                                                                                |
| `ADD_ON_KINDS` is a check constraint, not a PG enum   | Violates `enums.ts` header rule                                                                                                                                     | Fix in the catalog migration                                                                                                                                                                                                 |

### 3.6 Hotel inventory (§30–34)

Zero integration code. Needs a `packages/suppliers` adapter layer (server-only), the four hotel
tables, a link from `departure_stay_options` to a curated hotel, rate refresh at selection and
revalidation before Stripe. Expedia Rapid requires partner approval; Duffel Stays has a self-serve
sandbox, so the proof of concept should start there. **Both need Kyle to open accounts.**

### 3.7 Analytics (§45–46)

Events exist under different names (`view_tour`, `start_checkout`, `begin_payment`, `purchase`,
`add_add_on`, `remove_add_on`). Missing: `departure_selected`, `builder_*`, `hotel_selected`,
`race_option_selected`, `addon_viewed`, `quote_updated`, `post_booking_addon_*`. No funnel view in
admin.

### 3.8 Mobile (§35–44)

Missing: Live Moments on Today, add-ons on Explore (they render on Trip/itinerary), activity-scoped
chat rooms (one shared "optional activities" room today), onboarding questions (traveling from,
excited about, solo/couple/friends), photo upload (initial-letter avatars only), replacement-item
change notices (only "Updated"/"Cancelled" pills), post-trip review/photos/recap, any device build,
Android Maps key, real EAS env values (placeholders in `eas.json`; the other session has since set
them in EAS).

### 3.9 Admin

No option labels beyond `is_featured` → "Popular"; no images; no coupon UI; no content/CMS or
journal UI (tables exist); no analytics/funnel screen; hosts and meetups exist but are not in the
nav.

## 4. Required migrations (all forward-only, each with pgTAP)

| #   | Migration              | Phase | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 039 | `catalog_presentation` | **1** | `departure_stay_options`: `image_urls text[]`, `includes text[]`, `excludes text[]`, `details jsonb` (station distance, train time, breakfast, room type, neighbourhood), `label` (enum `option_label`: best_value, most_popular, social, luxury), `why_price_note text`. `departure_add_ons`: `image_urls`, `includes`, `excludes`, `label`, `why_price_note`, `meeting_point text`, `min_age int`. Promote `kind` to enum `add_on_kind` and add `group_moment`, `insurance`, `extension`. Mirror in `enums.ts`, Zod admin schemas, admin forms. Seed 050 updated with Monaco details |
| 040 | `booking_snapshots`    | 2     | Snapshot add-on title at creation; write the stay tier as its own `booking_items` line with the delta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 041 | `group_codes`          | 2     | `group_codes(id, code, departure_id, owner_user_id, label, max_uses, expires_at)`, `bookings.group_code_id`, RLS, `redeem_group_code()`; codes shape `KYLE-MONACO-27`. Does not touch money                                                                                                                                                                                                                                                                                                                                                                                            |
| 042 | `builder_drafts`       | 2     | Server-side saved configurations per user/departure for cross-device resume                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 043 | `hotels`               | 3     | `hotels`, `hotel_rooms`, `hotel_supplier_mappings`, `hotel_rates` (supplier, ids, currency, amount, taxes, fees, cancellation policy, fetched_at, expires_at, occupancy, dates), `departure_stay_options.hotel_id`                                                                                                                                                                                                                                                                                                                                                                     |
| 044 | `activity_chat_rooms`  | 4     | `chat_rooms.add_on_id`; membership from confirmed `booking_add_ons`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 045 | `profiles_onboarding`  | 4     | `avatar_url`, `traveling_from`, `excited_about`, `party_type`; avatars storage bucket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 046 | `reviews_photos`       | 6     | `reviews`, `trip_photos`, moderation flags                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Not recommended: a generic `products` table, or changing `booking_status`. Both would replace
working, tested logic for no customer-visible gain.

## 5. Required integrations

| Integration                                                                                 | Phase       | Owner action needed                                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duffel Stays sandbox (proof of concept), then Expedia Rapid partner application             | 3           | Kyle opens the accounts; keys go in Vercel and `supabase/.env`, never in the client                                                                                             |
| EAS development build / simulator run (to capture real screenshots and unblock mobile work) | 1           | Expo account exists (EAS project id set); needs Apple/Google developer enrolment for device builds, which the other session is working through. A simulator build needs neither |
| Stripe live keys                                                                            | independent | Kyle completes "Account representative" in Stripe                                                                                                                               |
| Optional later: Viator / GetYourGuide for experiences                                       | 5+          | none now                                                                                                                                                                        |

## 6. UI changes by surface

- **Homepage**: new section list per §5; reuse `PhotoBackdrop`, `TourCard`, `Faq`, `JsonLd`. The
  configurator example should be computed from the real Monaco seed through `quote_booking` so the
  numbers on the homepage can never drift from the builder.
- **Monaco page**: new hero and facts strip, "base trip includes", comparison block, tier cards,
  race cards, "add later" callout, primary CTA "Build my trip". Requires migration 039 to have
  something real to show.
- **New pages**: `/why-guideless`, `/faq`, `/contact`, `/group-travel`, `/cancellation`,
  `/travel-insurance`, `/about`. Defer `/reviews` and `/journal` until there is real content (the
  plan forbids invented reviews).
- **Navigation and footer**: add the new pages. These files are owned by the parallel session; the
  change must be coordinated.
- **Builder (Phase 2)**: new route wrapping the existing wizard state machine with reordered steps
  and enriched cards; `OrderSummary` gains a sticky mobile variant; headcounts shown inline.
- **Admin**: image upload and new fields on option forms; label picker; coupons page; nav links for
  hosts/meetups.
- **Mobile (Phase 4)**: Today gets Live Moments; Explore gets add-ons; onboarding flow; activity
  chats; replacement notices.

## 7. Risks

1. **No app screenshots exist and the plan forbids fakes.** The homepage "show the actual app"
   section depends on a simulator build in Milestone 1. If that slips, ship the section as a
   feature list with real web screenshots of the account trip view and add the app shots later.
2. **Hotel claims.** The Monaco "5★ Monte Carlo" tier has no property or rate behind it. Either
   Kyle names the contracted hotels for both tiers before the Monaco page ships, or the copy is
   softened to "3★ near the port, property confirmed at booking" and the luxury tier is hidden.
3. **Social proof at zero bookings.** `add_on_headcounts` are real but currently zero. Show counts
   only above a threshold (for example 3) and never show scarcity that is not from `capacity`.
4. **Two sessions editing shared files.** Layout, header, footer, analytics union and consent are
   the other session's territory; the new pages need nav entries. Agree ownership before starting.
5. **Palette drift.** The plan's hex values (§47) differ from the shipped tokens, which were also
   derived from the logo. Changing tokens touches every surface; see decision D1.
6. **Builder step reorder changes tested flows.** The Playwright checkout spec and the sessionStorage
   draft shape will need updating in Phase 2; keep the quote/payment code untouched.
7. **Hotel APIs gate Phase 3 on external approvals.** Start with Duffel's sandbox so the adapter and
   tables can be built before Expedia approves.

## 8. Recommended order

1. **Milestone 1 — Positioning** (this proposal): homepage, new pages, Monaco page, catalog
   presentation migration, first simulator build for screenshots, analytics additions for the new
   CTAs. No booking-logic changes.
2. **Milestone 2 — Trip Builder**: `/tours/[slug]/build`, reordered steps, rich cards, headcounts,
   sticky mobile summary, group codes, server drafts, snapshot fixes, builder analytics.
3. **Milestone 3 — Hotel inventory**: supplier abstraction, Duffel proof of concept, hotel tables,
   rate refresh and revalidation, admin hotel curation.
4. **Milestone 4 — Mobile**: first emulator/device build and the six homepage app screenshots
   (moved here from Milestone 1), Today/Explore changes, onboarding, activity chats, change
   notices, store listings.
5. **Milestone 5 — Operations**: coupons UI, inventory screen, manifests/rooming polish, alerts,
   reconciliation.
6. **Milestone 6 — Growth**: reviews, photos, journal, destination SEO, funnel dashboard.

## 9. Milestone 1 proposal — "A stranger understands why in 10 seconds"

**Scope (web + one migration, no booking logic):**

1. Homepage rebuilt to §5: hero, problem/comparison, four Why blocks, app section (real
   screenshots if the simulator build lands, otherwise feature list plus real account screenshots),
   configurator example computed live from the Monaco departure, "independent, not alone" using
   `departure_roster_stats` only when non-zero, trip cards, trust block (founder story supplied by
   Kyle), 17-question FAQ with `FAQPage` JSON-LD.
2. New pages: `/why-guideless`, `/faq`, `/contact`, `/group-travel`, `/cancellation`,
   `/travel-insurance`, `/about`; sitemap updated; nav/footer entries coordinated with the other
   session.
3. Monaco page rebuilt to §7–12 with tier cards, race cards, base-includes, comparison, "add
   later"; CTA "Build my trip" points at the existing checkout until Milestone 2 replaces it.
4. Migration 039 `catalog_presentation` + enum promotion + admin form fields + pgTAP + Monaco seed
   filled with real details (hotel names, sections, includes/excludes, why-price notes).
5. ~~First Expo simulator build and a screenshot set~~ — **deferred by Kyle on 2026-09-07 to
   Milestone 4 (Mobile)**. The homepage app section renders text cards until
   `apps/web/public/app/{today,itinerary,map,group,add-on,support}.png` exist; the Map shot also
   needs a Google Maps Android key (Google Cloud billing account required).
6. Analytics: add `cta_click` (with placement), `faq_expanded`, `compare_viewed`; keep existing
   names.
7. Definition of done: `pnpm check` green, pgTAP for 039, Playwright smoke on the new pages,
   Lighthouse accessibility ≥ 95 on home and Monaco, no fabricated numbers anywhere, docs updated
   (`design-system.md`, `growth.md`, `admin.md`).

**Explicitly out of scope for Milestone 1:** builder route and step reorder, group codes, hotel
APIs, mobile feature changes, generic product model, booking status changes, reviews/journal pages.

**Decisions needed from Kyle before starting:**

- **D1 Palette.** Keep the shipped tokens (ink `#0B2025`, aqua `#60E1BB`, cyan `#17B1DF`) or adopt
  the v2 hex values (navy `#071C25`, aqua `#22D6C5`, cyan `#24B9E8`, mint `#5BE0B1`)? Recommendation:
  keep the shipped tokens; they came from the same logo and every surface already passes contrast.
- **D2 Hotels for Monaco.** Names of the contracted Nice and Monaco properties, or permission to
  soften the copy and hide the luxury tier until a property exists.
- **D3 Founder story.** Three to five sentences and one photo for the trust block.
- **D4 Screenshots.** OK to spend part of the milestone on the first simulator build? If not, the
  app section ships without device shots.
- **D5 Nav ownership.** Confirm the other session hands over header/footer edits for this milestone,
  or I send it the exact entries to add.
