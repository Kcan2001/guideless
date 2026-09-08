# Guideless — strategy addendum (v3 direction)

_Captured 2026-09-07 from Kyle's planning notes. This is direction, not a spec: it records the
product thesis, the hotel-engine architecture, the marketing model and the business-readiness items
so later work can cite them. The executable plan remains `docs/guideless_travel_master_plan_v2.md`
and its audit `docs/plan-v2-audit.md`; §6 below says how each idea maps onto those milestones._

## 1. Product thesis

Guideless is not a tour company. It is a **social travel platform for curated, customizable group
experiences**. Reference model: Tomorrowland Global Journey — passes, accommodation tiers,
transport and surprises bundled at every price level, no guide, no hand-holding.

Three pillars: **Discover** (find an incredible trip) · **Customize** (make it yours) · **Connect**
(meet the people going).

Three entry modes on the same engine:

| Mode        | Customer state               | Entry                         |
| ----------- | ---------------------------- | ----------------------------- |
| **Build**   | "I know where I want to go." | Trip Builder on a tour page   |
| **Explore** | "I know what kind of trip."  | Interest/budget-led discovery |
| **Mystery** | "Surprise me."               | Parameters in, reveal later   |

Internal language: **Core + Freedom**. Core = what Guideless handles (accommodation, key
activities, transportation, tickets, itinerary, support, community, logistics). Freedom = what it
never controls (where you eat, when you wake, who you hang out with, what you skip, how long you
stay, how much you spend). Promise: _Everything you need. Nothing you don't._ Candidate brand
lines: _Go together. Be guided by no one._ · _Travel together. Explore freely._ · _Curated trips.
Complete freedom._

**Price brackets, one itinerary.** The same route sold at several levels (working names Explorer /
Classic / Premium / Elite): hostels and 3★ with public transport at the bottom, luxury hotels and
private transfers at the top. Everyone shares the core moments (welcome event, one major group
experience, final dinner); everything else is optional or independent. This is what our
`departure_stay_options` tiers plus add-on bundles already model.

**Solo but not alone.** The freedom of solo travel with the social benefits of a group: "82
Guideless travelers are in Tokyo tonight — ramen at 7 (12 going), Shibuya drinks at 9 (18 going)".
Travelers post "I'm doing this — anyone else?"; the network is temporary and purpose-bound. This
is Live Moments plus headcounts, generalized.

## 2. Mystery Trips

The customer chooses parameters, Guideless chooses the destination.

- Inputs: travel month, budget, departure airport, weather preference, interests (adventure / food
  / nightlife / culture), party type, hotel level, and a **risk slider** — Low (customer picks
  country + budget + dates), Medium (region + budget + interests), Full (budget + dates + airport).
- Products: Mystery Europe / World / Adventure / Food & Wine / Nightlife / Escape / Luxury, at
  fixed price points; **Mystery Drops** (100 spots, destination hidden, revealed when sold out) and
  **group reveals** where everyone on a departure learns the destination at the same moment.
- Selection is optimization, not randomness: flights, hotel rates, season, weather, events,
  activities, travel time, inventory and the traveler's preferences → best match, with the freedom
  to build the trip around exceptional inventory (a 5★ with an unusually good rate).
- The reveal is a product moment in the app (known facts first, then a cinematic destination
  reveal), and a marketing engine ("I gave an AI $3,000 and let it choose my vacation").
- Fits the existing model as a departure whose destination is hidden until `reveal_at`; the
  itinerary snapshot, group, chat and add-ons work unchanged after the reveal.

## 3. Hotel engine architecture (Phase 3 detail)

Supplier-agnostic hotel pricing service inside the Next.js/Supabase app — never three separate
systems, never microservices.

```
Guideless Hotel Catalog ("hotels Guideless sells")
        │
   ┌────┼────┐            one HotelSupplier interface; adapters:
   ↓    ↓    ↓            DuffelSupplier · ExpediaSupplier · HotelbedsSupplier
Duffel Expedia Hotelbeds  (Promise.allSettled, per-supplier timeout ≈ 4 s)
   └────┼────┘
        ↓  Rate Normalizer   → NormalizedHotelRate (room, bed, occupancy, currency, net, taxes,
        ↓                       fees, total, refundable, cancellation policy, breakfast,
        ↓                       pay_now|pay_at_property, commission, available)
        ↓  Hotel / room matching  (hotel_supplier_mappings, curated per destination — no global
        ↓                          hotel-identity problem on day one)
        ↓  Rate comparison   (compare equivalent rates only: fingerprint = hotel + room + bed +
        ↓                     occupancy + refundable + policy + breakfast + payment type)
        ↓  Value scoring     (price + cancellation + breakfast + reliability + margin; not
        ↓                     "cheapest")
        ↓  Pricing engine    (DB `pricing_rules`: destination, hotel, min / % / fixed markup,
        ↓                     priority, effective window — change prices without deploys)
        ↓  Recheck           (always re-validate the rate at checkout; price changed → tell the
        ↓                     customer and recalculate; never absorb supplier increases)
   Guideless offer → Stripe → supplier booking → confirmation
```

Code layout: `lib/hotels/{suppliers/*.ts, search, normalize, match, compare, pricing, recheck,
booking, cancellation}.ts`; routes `/api/hotels/{search,recheck,book,cancel}`. Tables: `hotels`,
`hotel_supplier_mappings`, `hotel_rooms`, `hotel_rates`, `hotel_searches`, `hotel_quotes`,
`hotel_bookings`, `hotel_cancellations`, `pricing_rules`, plus the existing `suppliers`. Supplier
cost never reaches the customer (CLAUDE.md rule 11).

Phasing: **Duffel only** end to end (search → normalize → price → recheck → book → cancel), then
add `ExpediaSupplier`, then `HotelbedsSupplier`; nothing else should change. Long-term payoff:
rate-shop our own catalog on every search.

## 4. AI layer (after the data is strong)

- **Concierge** with access to the traveler's real trip (itinerary, bookings, group, budget) —
  "what am I doing tomorrow", "can I skip this", "find me a nicer hotel", "I want two extra
  nights". Scoped by RLS; answers only from the traveler's own data and public catalog.
- **AI Trip Builder**: natural-language brief → three priced versions (Smart / Premium / Luxury)
  → customize. An onboarding path into the same builder, not a separate product.
- **Rate / value intelligence**: best value for this trip, not cheapest (price, rating, commute,
  breakfast, cancellation, itinerary fit, history). Requires the hotel engine first.
- **Trip optimization**: reallocate savings inside a budget toward a better experience.
- **Friend suggestions**: only from voluntarily shared interests, phrased as shared activities ("3
  others are interested in the Fuji hike"), never as matching.
- **Support chatbot** for FAQ-level questions, escalating to the existing support threads.

Rule stays: AI is the invisible intelligence behind the product, not the brand.

## 5. Marketing model

Thesis: **don't advertise trips to people; give people trips worth sharing.** The traveler is the
marketer: Company → Customer → Trip → Friends → Customers.

| Lever                   | Shape                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Trip of the Week        | One exceptional trip published weekly, remixable ("See the trip → Customize it")                                                          |
| "Build my trip" content | "$3k vs $5k vs $10k Japan", "what I'd do with two weeks in Japan", screen-recorded builds; CTA **Build this trip** / **I want this trip** |
| Short-form video        | Aspirational, practical (exact costs), comparative, contrarian, educational, product                                                      |
| Creators                | Creators publish their own Guideless trips and earn ~5% of bookings; later creator storefronts `/@creator`                                |
| Destination ambassadors | Revenue share for destination experts — a distributed sales force                                                                         |
| Referral                | Tiered rewards (1 → $100, 2 → $250, 3 → $400, 4 → $500 + experience) and two-sided "Give $100, get $100"; invite framed as "come with me" |
| Group unlocks           | At 5 travelers a free experience, at 8 a room upgrade, at 10 private transport — the group recruits                                       |
| Leaderboard             | For group trips, top host wins a credit or free trip (use sparingly)                                                                      |
| Email                   | Inspiration, abandoned trip, price drop, new departure, "Sarah invited you" — never generic discounts                                     |
| SEO                     | Pages that map to bookable trips ("14 day Japan itinerary", "Japan trip cost"), each ending in **Build this trip**; later programmatic    |
| Pinterest / Reddit      | Itinerary pins to trips; authentic destination help on Reddit, itineraries shown occasionally                                             |
| Communities / B2B2C     | Running clubs, alumni groups, coworking, photography groups; later company retreats with one dashboard                                    |
| Trip drops & waitlists  | Dated drops with limited spots; every sold-out or future trip collects destination + dates + party + preferences                          |
| UGC                     | Post-trip share card (route, days, traveler) → "Plan yours"                                                                               |
| Quizzes                 | "Which Japan trip are you?" → a trip → shared                                                                                             |

Target mix: organic/SEO 20 · referral 20 · creators 20 · social 15 · paid 15 · partnerships 10.
Unit economics to model: ~$3,500 average booking, ~$600 contribution before acquisition; referral
at $100–200 beats paid at $400 by roughly 2.5×, so viral acquisition is a core assumption, not a
nice-to-have.

## 6. How this maps onto the milestones

| Idea                                            | Where it lands                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Positioning, "Core + Freedom", solo-not-alone   | **Milestone 1 (shipped)** homepage/pages; brand line decision pending (see §7)                                                                |
| Build mode, price brackets, "why it costs more" | **Milestone 2 Trip Builder** — tiers already exist as stay options; bundles as add-on `tier_group`s                                           |
| Referral tiers, give/get, group codes           | **Milestone 2** (group codes) then Milestone 6 (tiered rewards; `referral_codes` + `account_credits` extend)                                  |
| Waitlists, trip drops                           | Milestone 6 growth — `departure_waitlist` table + notification; drops = departure `opens_at` + hidden destination                             |
| Group unlocks                                   | Milestone 5/6 — threshold rules on a departure evaluated by the roster stats job                                                              |
| Hotel engine, Duffel first                      | **Milestone 3** exactly as §3                                                                                                                 |
| Creator trips / storefronts / ambassadors       | Post-M6; needs reviews, photos and affiliate attribution first                                                                                |
| Explore mode, quizzes, programmatic SEO         | Milestone 6 once ≥ 3 tours exist; until then, static itinerary pages per tour                                                                 |
| Mystery Trips                                   | New product line after M3 (needs live inventory to optimize); a small "Mystery Drop" pilot could run on a manually chosen destination earlier |
| AI concierge / builder / value intelligence     | After M3–M4; concierge first (reads existing trip data), value intelligence needs the hotel engine                                            |
| Company retreats                                | Later; separate buyer                                                                                                                         |

## 7. Decisions to take with Kyle

1. **Brand line.** Current tagline "Travel with a plan. Not a tour guide." vs "Go together. Be
   guided by no one." The second is closer to the new thesis; the first tests better with a
   stranger who has never heard of Guideless. Proposal: keep the current H1, adopt "Go together.
   Be guided by no one." as the brand signature (footer, OG, app splash) and revisit after the
   first bookings.
2. **Tier naming.** Explorer / Classic / Premium / Elite as the public names for stay tiers across
   tours (labels exist in migration 039 as best_value / most_popular / social / luxury; a
   tier-name field per option would follow).
3. **Mystery pilot.** Whether to run one manually operated Mystery Drop in 2027 before the hotel
   engine exists.

## 8. Business readiness (Kyle's own list, for tracking — not code)

- **Banking**: fund the business checking once approved; card; ACH/wire; alerts; no personal
  spending through it.
- **Accounting**: QuickBooks (~$20/mo), connected to checking and Stripe. Chart of accounts:
  Revenue (trip bookings, hotel, activity, transportation, add-ons) · COGS (hotels, activities,
  transportation, supplier fees, hotel API fees) · Payment costs (Stripe, bank, FX) · Opex
  (software, advertising, insurance, legal, accounting, travel, contractors, office). The number
  that matters is **gross profit per trip**. No bookkeeper yet; CPA review at meaningful revenue.
- **Insurance**: Travel Agent E&O / professional liability first (industry average ≈ $40/mo at
  $1M/$1M; expect more as a package organizer), get two to three quotes, one with general
  liability bundled; describe the business as selling curated travel arrangements booked through
  third-party suppliers with customers paying Guideless directly. Do not buy "tour operator"
  packages before the legal structure is settled.
- **Legal**: travel-business attorney review — agency vs tour operator / package organizer;
  seller-of-travel registrations by state; supplier agreements; customer booking agreement;
  liability review. Terms, privacy and cancellation pages exist; supplier and booking agreements
  do not.
- **Customer travel insurance**: never sell or solicit it ourselves (PA limited-lines producer
  rules); partner with a provider later. `/travel-insurance` recommends without endorsing.
- Everything else on the list (domain, GitHub, Supabase, Vercel, Workspace, Stripe, Resend, Expo,
  Sentry) is done; Google Maps needs a billing account before the Android key exists.
