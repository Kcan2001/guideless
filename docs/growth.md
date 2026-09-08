# Growth: how Guideless sells the group

_Companion to docs/roadmap.md §4 Milestone 13 and docs/product.md. Everything here is public
behaviour a traveler can see; the mechanics live in migrations 029–031._

## The pitch in one line

Everything planned. Nothing forced. A group that meets on night one, no guide, and you pay only
for what you do.

## Event-anchored tours

`tours.kind = 'event'` with `event_name`, `event_starts_on`, `event_ends_on`, `event_location`.
The tour page renders an event hero (name, dates, location), a "Race weekend, your way" tier
menu (stay options × the mutually exclusive `tier_group` add-ons) and a schema.org `Event`
alongside the `TouristTrip`. The home page lists event tours in an "Event weekends" section.
First product: Monaco Grand Prix Weekend 2027 (seed `050_monaco_grand_prix.sql`) — Nice 3★ or
Monaco 5★, grandstand / terrace / yacht, welcome drinks Thursday.

## "Make it yours" on every trip

The tour page (`/tours/[slug]`) sells the shape of the purchase before the itinerary, in this
order: hero with the promise, next dates, length, group size and "from" price and a **Build my
trip** CTA (the Trip Builder at `/tours/[slug]/build?departure=…`, see `docs/booking.md`) → **Base trip includes** (the
version's included items plus the app, the group with its opening date from
`group_opens_days_before`, and support) → a two-column **compare block** (one package or one
guided itinerary vs. Guideless essentials plus choices) → **stay tier cards**
(`components/tours/stay-tier-cards.tsx`) → **race/experience cards**
(`components/tours/experience-cards.tsx`; `tier_group` add-ons render as the large "choose one"
set, the rest as "Also optional") → the **add-later callout** → day by day → dates & prices → who
handles what → FAQ.

Cards read only migration-039 presentation columns (`tagline`, `image_urls`, `includes`,
`excludes`, `details`, `label`, `why_price_note`, `meeting_point`, `min_age`) plus live counts:
"N from your group are going" appears only from 3 (`add_on_headcounts`, aggregate), "N left" only
at 5 or fewer, star ratings only when set, and an unconfirmed property says "Property confirmed at
booking". Stay-tier scarcity is never shown because no public view exposes it. The departure page
keeps the compact `StayTiers`/`AddOnList` lists, the room rule and the referral hint. The room
rule is derived from `quote_booking()` for one traveler vs. two sharing, so the saving shown
equals the saving charged.

Pricing rules the copy must never contradict:

- Base price is per traveler in their **own room**. Two travelers may share (never more) and each
  save the departure's `shared_room_discount_amount` (a tier may override it).
- Add-ons are optional, chosen at booking or later (even mid-trip, until each add-on's
  `bookable_until_days_before`), paid in full when chosen, never part of the deposit.
- Deposit + balance apply to the base trip; cancellation tiers are on the departure page.

## Roster stats (the purchase trigger nobody else shows)

`departure_roster_stats(departure_id)` is public and returns only aggregates: booked, solo,
pairs, groups of 3+, distinct nationalities, capacity, spots left, `groupOpensOn`, `groupOpen`.
Age range appears only with four or more booked travelers, rounded to 5 years, never individual
ages. Names, bookings and profiles are never exposed here. The departure page renders it as the
roster strip; the mobile app uses the same RPC before the group opens.

## The group opens on a date, not at booking

`departures.group_opens_days_before` (default 30; Monaco 45). `open_due_groups()` runs daily and
activates the trip (chat rooms, roster, Live Moments) once the departure is viable and the date
has arrived, then notifies members. Rationale: opening at booking would leave the first buyers
alone in an empty room.

## Referrals

- Every profile gets a `referral_codes` row (`GL-XXXXXX`) at creation.
- A friend enters the code in the builder's summary panel ("Have a code?"): `referral_discount_percent` (system setting, default 5)
  off the **base** trip, shown as a quote line. Self-referral and unknown codes are rejected.
- When that booking is confirmed the referrer earns `referral_reward_amount` (default 7500 minor
  units = $75) as `account_credits`, applied automatically to their next quote. Refunded or
  cancelled bookings void the pending referral.
- Marketing surfaces only hint ("Booking with a friend's code? Enter it at checkout for 5% off");
  the code and balance live on the account page.
- Distinct from referral codes: **trip codes** (`KYLE-MONACO-27`, migration 042) put separate
  bookings in the same departure group without any discount. Travelers find theirs on `/account`
  ("Bring friends along") and enter a friend's on the builder's travelers step.

## Host program ("bring 8, travel free")

Public page `/host` explains the deal and collects `host_applications` (anonymous inserts allowed;
signed-in applicants are linked). Staff review at `/admin/hosts` (approve / decline, private
notes). Threshold: `system_settings.host_free_spot_threshold` (default 8). That table is
staff-only, so the public page uses the constant `HOST_FREE_SPOT_THRESHOLD = 8` in
`apps/web/lib/data/community.ts`; keep the two in sync. Rewards for hosts (`account_credits`
source `host_reward`) are granted manually by admins for now.

## City evenings (meetups)

`meetups` + `meetup_rsvps` (+ `meetup_rsvp_counts` view). Public list at `/meetups` grouped by
city with times in the meetup's own zone, detail at `/meetups/[id]` with Event JSON-LD, RSVP for
signed-in users (signed-out visitors are sent to sign in and come back). Staff create, publish and
see RSVPs at `/admin/meetups` (content or ops roles). Seeded: New York, London, Austin
(`060_meetups.sql`). Both routes are in the sitemap.

## Copy rules

Brand terms only: Your Trip, Your Route, Your Group, Live Moments, Included, Optional. Calm and
concrete; every optional thing says it is optional. Never "mandatory", never "tour guide".

## Launch SEO checklist

What is already in the code: canonical URLs and Open Graph tags on every public page, `TouristTrip`,
`FAQPage`, `BreadcrumbList` and `Organization` JSON-LD on tours, `Event` JSON-LD on event tours
and meetups, `sitemap.xml` (tours, departures, destinations, host, meetups, legal) and `robots.txt`
that blocks checkout, account, trips, admin and API. Images and an image sitemap arrive with the
photo pass.

Do once, in this order, after the first production deploy:

1. **Google Search Console**: add `guidelesstravel.com` as a Domain property (DNS TXT at
   Squarespace) or as a URL-prefix property using the meta tag: set
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel (root layout reads it via
   `lib/site-verification.ts`), redeploy, verify. Submit `/sitemap.xml`. Request indexing for the
   home page and both tour pages.
2. **Bing Webmaster Tools**: import from Search Console, or set `NEXT_PUBLIC_BING_SITE_VERIFICATION`.
3. **Google Business Profile** for Guideless Travel (Guideless LLC): category "Tour operator" /
   "Travel agency", website with `?utm_source=google&utm_medium=referral&utm_campaign=gbp`.
4. **Instagram bio link**: `https://guidelesstravel.com/?utm_source=instagram&utm_medium=bio&utm_campaign=profile`
   (UTM vocabulary in `packages/config/src/brand.ts`).
5. **Rich results test** on one tour page and the Monaco event page after deploy; fix any warnings.
6. Watch Search Console for the first two weeks: coverage errors, Core Web Vitals (the LCP is the
   hero image once photos land), and the queries that bring people to `/tours`.
