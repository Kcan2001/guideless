# Product

Derived from the master spec §1, §7, §14–15, §22–30, §84–86, §90–93, §99–103.

## What Guideless is

A minimal-intervention travel company. We organize the logistics (hotels, trains, transfers,
selected experiences, a small group); the traveler books their own flights and owns their free
time. There is no tour guide. The digital itinerary is "Your Guide".

**Travel organized. Explore independently.** · **Everything planned. Nothing forced.**

Five principles: organized not escorted · useful not noisy · social but optional · human support
when it matters · the itinerary is the product.

## Users

| Role                      | Sees                                                                       | Never sees                                         |
| ------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Visitor (unauthenticated) | Marketing, tours, destinations, itinerary previews, availability, checkout | Anything private                                   |
| Customer / Traveler       | Own bookings, payments, trips, itinerary, documents, group chat, support   | Other customers' data, staff notes, supplier costs |
| Trip / Operations staff   | Trips, groups, itinerary, travelers, suppliers, support, live moments      | Finance/admin functions by default                 |
| Admin                     | Everything incl. users, roles, pricing, refunds, audit log, settings       |                                                    |

Roles: `customer, trip_staff, support, content_editor, finance, admin, super_admin`.

One account is not one traveler: a customer can book for a spouse or friend. Travelers are
separate records from auth users.

## Surfaces

### Web (Next.js) — optimizes the first half of the lifecycle

| Route                                        | Purpose                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`                                          | Hero, how it works, featured trips, destinations, included / not included, social proof, sample itinerary, FAQ           |
| `/how-it-works`                              | Pick → Book → Fly in → Meet group → Follow itinerary → Explore → Optional experiences → Travel on → Stay connected       |
| `/tours`                                     | Filterable listing (destination, region, duration, month, price, activity level, group size, style)                      |
| `/tours/[slug]`                              | The key page. Itinerary, hotels, included/optional, transport, dates, price, **Guideless handles vs You book**, FAQ, CTA |
| `/tours/[tourSlug]/departures/[departureId]` | Date, availability, price, group size, deadline, payment schedule                                                        |
| `/destinations`, `/destinations/[slug]`      | SEO pages                                                                                                                |
| `/checkout/*`                                | 7-step booking flow (below)                                                                                              |
| `/account/*`                                 | Overview, bookings, upcoming/past trips, payments, documents, profile, support, settings                                 |
| `/trips/[tripId]`                            | Web mirror of the mobile trip experience                                                                                 |
| `/admin/*`                                   | Operations platform                                                                                                      |

### Mobile (Expo) — optimizes the second half

Tabs: **Trip · Explore · Group · Support · Profile**.

The Trip home screen answers _"What do I need to know right now?"_: greeting, city + date,
hotel + checkout day, NEXT item, RECOMMENDED nearby, TONIGHT (optional moment), YOUR GROUP
(members, unread). Never make the traveler dig through a calendar.

### Admin (inside Next.js)

Dashboard · Tours · Departures · Trips · Customers · Bookings · Payments · Suppliers ·
Itineraries · Live Moments · Support · Messages · Content · Analytics · Settings · Audit Log.
The operations dashboard leads with upcoming departures and an **Issues** feed that makes risk
visible (missing documents, pending supplier confirmations, departures below minimum…).

## Booking flow

1. Choose departure → 2. Traveler(s) → 3. Preferences → 4. Account → 5. Terms → 6. Payment (Stripe) → 7. Confirmation.

Collect only what operations needs. Deposits and remaining balances are supported; the payment
schedule is shown on the departure page and in the account.

## Trip experience features

- **Itinerary** — typed items; `free_time` is first class; each item carries its own time zone.
- **Recommendations** — curated per destination/category/time-of-day. Manual in v1.
- **Group chat** — Trip Group, Announcements, Optional Activities rooms; moderation built in.
- **Live Moments** — temporary, optional, staff- or traveler-created ("Sunset walk at 7:45").
- **Support** — categorized threads; staff see trip, location, current item, booking, history.
- **Emergency** — local numbers per destination; clear "contact local services first" screen.
- **Notifications** — operational (always on during a trip), social, marketing (opt-in).
- **Progressive disclosure** — 90 / 30 / 7 days before and during the trip reveal more detail.
- **Post-trip** — chat stays open, photos, recap, invitation to the next trip.

## Language

Use: Your Trip, Your Route, Your Group, Your Guide (digital), Live Moments, Explore,
Recommendations, Included, Optional, Your Next Stop, Free time.
Avoid: "mandatory", "tour guide instructions", spammy marketing pushes during a trip.

Every screen has an intentional empty state (copy lives in `@guideless/config` → `emptyStates`).

## Scope

**MVP** — web: home, how it works, tours, tour detail, departures, checkout, Stripe, auth,
account, trip dashboard, admin. Mobile: auth, trip home, itinerary, hotel, transport, group,
chat, push, support, profile. Backend: everything above plus notifications.

**Phase 2** — Live Moments, recommendations, post-trip social, photos, supplier management,
coupons, referrals, reviews, advanced ops dashboard.

**Phase 3** — supplier APIs, automated booking, AI assistant, weather-aware recommendations,
loyalty, more currencies, CRM.

## North-star metric

**Successful independent trips**: booked → itinerary accessed → logistics delivered → completed
→ few critical support incidents → satisfied. Supporting: booking/checkout conversion, app
activation, trip engagement, live-moment participation, support rate, repeat booking, NPS.

## Copy refresh (2026-09-07)

The seeded catalog copy (`supabase/seed/010`–`060`) had a customer-eyes pass: the welcome drinks are
consistently 8 pm on night one at a bar in the old town (the anchor Live Moment), the farewell dinner
is an optional add-on rather than "included", the Châteauneuf wine afternoon is "included, optional
to join" with the cellar visit as the paid extension, Monaco's weekend states practice Friday,
qualifying Saturday and the race Sunday at 3 pm, both tours gained FAQs about rooms, add-ons and
when Your Group opens, and every mention of the brand is Guideless Travel. Seeds are the source of
truth until the first production seeding (`scripts/seed-catalog.mjs`); after that, edit in `/admin`.
