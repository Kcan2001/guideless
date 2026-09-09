# Guideless Travel: the whole thing in one document

Written 2026-09-08. This is the orientation document. It explains what the business sells, why
anyone buys it, how the money moves, and how the software is put together, in that order, because
that is the order the decisions were made in.

It is deliberately the shallowest document in `docs/`. Every section ends with a pointer to the
deeper one. If you are new here, read this once and then go where you need to.

---

## Part one: the business

### What we sell

**A group without a guide.**

We book the hotels, the trains and one or two anchoring moments. A welcome drink at 8 pm in Nice on
day one. Everything else is optional and visible: you can see who else is going, what they added,
and choose to join them or not. There is no guide holding an umbrella, and nobody counts you onto a
coach.

The tagline is _Travel with a plan. Not a tour guide._ The secondary line is _Everything planned.
Nothing forced._ The brand signature is _Go together. Be guided by no one._ Those live in
`packages/config/src/brand.ts`, which is the single source of truth for brand copy.

"Minimal intervention travel" is category language for describing the business to other people in
the industry. It is not a headline and never appears as one.

### Who it is for

People who want the logistics solved and the days their own. They are comfortable travelling but
tired of planning, or they are travelling alone and want the option of company without being
assigned it. The Monaco product skews toward people who want an event weekend with other people
doing the same weekend. The France product skews toward people who would otherwise have booked it
all themselves and did not want to.

### The two products, as they actually exist

**Southern France, 8 nights.** Nice, Avignon, Paris. Hotels with breakfast, both train legs, a
shared airport transfer, a Chateauneuf-du-Pape wine afternoon and welcome drinks. Two accommodation
tiers. Optional extras: a Riviera boat day, a second cellar tasting, a private transfer, an extra
Paris night, a farewell dinner. Three departures in 2027, $3,495 with your own room.

**Monaco Grand Prix, 5 nights.** Wednesday 2 to Monday 7 June 2027. One group of up to fifty. Stay
in Nice for value or Monte Carlo for the full show. Race viewing is a menu rather than a fixed
inclusion: a three-day grandstand pass, a catered harbour terrace, or a day on an Amber Lounge
yacht. Two harbour parties on top. $2,450 base.

Monaco is the sharper product because it proves the thesis. Everyone is on the same weekend, at
wildly different price points, in one group.

### Why anyone buys it rather than the alternatives

| Alternative                                               | What it gets wrong for this customer                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Booking it yourself**                                   | Works, and takes fifteen hours. You still arrive knowing nobody.                                |
| **A guided tour** (Trafalgar, Globus, Contiki)            | You pay for a guide you did not want, on a schedule you did not choose.                         |
| **A premium small-group tour** (Flash Pack, Intrepid)     | Closer, and still escorted. Single supplements of 30 to 100% punish solo travelers.             |
| **A peer-hosted trip** (JoinMyTrip, TrovaTrip)            | Real community, no logistics muscle. The host is an amateur and it shows when something breaks. |
| **An event package operator** (Roadtrips, F1 Experiences) | Sells Monaco as luxury from about $8,895 and sells no community at all.                         |

The gap nobody occupies: _the group, without a guide, pay only for what you do._ Guided operators
charge for the guide. Peer platforms cannot run the logistics. That gap is the whole positioning.

Two structural choices follow from it, and both are load-bearing:

1. **Your own room is the default**, not a paid upgrade. Most of the field charges solo travelers a
   supplement for existing. We price the room in and discount it if two people choose to share.
2. **Tiers sit inside one group.** The traveler in the Nice hotel and the traveler in Monte Carlo
   are on the same trip, in the same group chat, at the same welcome drinks. Nobody else does this
   because escorted operators cannot run one coach at two price points. We do not have a coach.

See `docs/roadmap.md` §1 to §3 for the full competitive read.

### How the money works

Revenue is the margin between what a traveler pays and what the trip costs to buy. There is no
guide salary, which is where a large part of a conventional operator's cost sits.

- A traveler pays a **deposit** at booking, then the **balance** by a published date, or pays in
  full at booking. Both go through Stripe Checkout.
- **Optional extras** are bought at booking or later from the app, and each carries its own price,
  capacity and cancellation window.
- **Accommodation tiers** are a price delta on the base departure price, not separate products.
- Sharing a room applies a **shared-room discount** to both travelers.
- **Referral credit** is real money against a future booking, earned by bringing someone.

Prices are derived from researched supplier costs, and the working for every number is in
`docs/pricing.md`. That document also records what could not be verified, which is most 2027 hotel
inventory and every group rate we have not yet negotiated.

Two commercial facts worth knowing before touching a price:

- **Stripe keeps its processing fee on a refund.** That is why no cancellation tier is 100%. A full
  refund is a guaranteed loss on every cancellation.
- **We hold no supplier allocations yet.** Everything is bought at retail, so a traveler can
  sometimes buy an extra directly for less than we charge. The Amber Lounge yacht is the live
  example, and it is written up as an open decision rather than papered over.

### The rules we hold ourselves to

These are not aspirations. They are enforced in code, in the schema, or in review, and several of
them exist because we broke them once.

- **Never publish a price nobody derived.** Live Stripe keys mean a placeholder is a real charge.
- **Never name a hotel or a star rating we have not contracted.** Tier cards say "property named at
  booking" and carry `hotel_confirmed: false` until a contract exists.
- **Never state a policy the product does not implement.** The September 2026 audit found six
  claims that described behaviour nothing in the code could deliver. All were corrected.
- **Never show a customer a document with review markers in it.** A contract full of brackets tells
  a traveler we do not know our own terms.
- **Supplier costs never reach a customer.** Enforced by row-level security and public projections,
  not by the UI choosing what to render.
- **Tests assert behaviour, never a price.** Six tests were rewritten in one day for pinning a
  business number as a literal. A legitimate reprice should never fail a build.

---

## Part two: the architecture

### The shape of it

A pnpm workspace with Turborepo. Two applications and four shared packages.

| Package               | What it is                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js App Router. The marketing site, the Trip Builder and checkout, the customer account, the staff admin platform, the Stripe webhook and one cron route. |
| `apps/mobile`         | Expo and React Native. The trip companion, used during the trip rather than to buy one.                                                                       |
| `packages/config`     | Design tokens, typography, and `brand.ts`: the brand copy, the product vocabulary and the terms version a booking accepted.                                   |
| `packages/types`      | Domain enums, domain types, and the generated database types.                                                                                                 |
| `packages/utils`      | Money as integer minor units, time zones, formatting.                                                                                                         |
| `packages/validation` | Zod schemas shared by web, mobile and the edge functions, so one shape is validated once.                                                                     |
| `supabase/`           | 53 forward-only migrations, seven catalog seed files, two edge functions, 21 pgTAP suites.                                                                    |

The rule that keeps this honest is that **Supabase is the system of record and there is no second
source of truth.** Not a cache that drifts, not a spreadsheet, not a field the client is trusted to
set. Every table has row-level security. The service-role key never reaches a browser or a phone.

### The data model, in five layers

Each layer depends only on the one above it, and the boundaries are where the interesting rules
live.

**1. Catalog: what we sell.** `tours` name a product. `tour_versions` hold its content, and they
are versioned deliberately: `tour_days`, itinerary items, inclusions, exclusions and FAQs all hang
off a version, not off the tour. Editing a tour must never mutate a trip somebody already bought.

**2. Departure: a dated instance.** `departures` carry capacity, price, deposit, the cancellation
ladder, the booking deadline and the timezone. Two tables make the product what it is:
`departure_stay_options` are the accommodation tiers, priced as a delta rather than as separate
products, which is what lets two price points sit in one group. `departure_add_ons` are the
optional extras, each with a price, a capacity, a sales window and its own cancellation window.
Extras in the same `tier_group` are mutually exclusive, which is how "pick one race view" works.

**3. Booking: the order and the money.** `bookings` hold status, payment status, totals and the
seat hold. `booking_travelers` are the seats. `booking_items` are the priced lines. `booking_add_ons`
are what was bought, each carrying a `title_snapshot` so a later catalog rename cannot rewrite what
somebody purchased. `payments` and `refunds` mirror Stripe one row per object, and `webhook_events`
is the idempotency ledger.

**4. Trip: the snapshot.** When a group opens, `create_trip_for_group()` copies the departure's
days and itinerary into `trips`, `trip_days` and `trip_itinerary_items`. From that point the trip
is its own object. Staff can change a live itinerary without touching the catalog, and changing the
catalog cannot reach into a trip in progress.

**5. Community: the reason people book.** `chat_rooms` and `messages` over Supabase Realtime,
`live_moments` for optional group meet-ups, `item_rsvps` so people can see who else is going,
`reviews` and `trip_photos` behind moderation, and `user_blocks` and `reports` because any product
with a group chat needs them on day one.

### The booking flow, end to end

This is the most important path in the system, so it is worth following precisely.

1. A traveler lands on `/tours/[slug]`, then a departure page showing an **anonymised** roster: who
   is coming, described in aggregate, never named.
2. `/tours/[slug]/build` is the Trip Builder. The steps are derived from the data rather than
   hard-coded: a race-viewing step appears only when extras carry a tier group, a transfers step
   only when a transfer extra exists. Progress is saved per user and departure in `builder_drafts`.
3. The running total comes from `quote_booking()`, a database function. **The same function is
   re-run server-side inside `create_booking`**, so the browser cannot set a price. That is the
   single pricing authority; nothing else computes a total.
4. Submitting calls the `startCheckout` server action, which refuses immediately if Stripe is not
   configured, so a failure never leaves an orphaned seat hold. It then rechecks the live hotel
   rate with the supplier before anything is created.
5. `create_booking()` does everything else in one transaction: locks the departure, refuses a
   closed or past one, validates any group code, re-quotes, takes a **seat hold** (30 minutes by
   default, from `system_settings`), writes the booking, the line items, the travelers, the extras
   as pending, the preferences and a pending referral. Capacity is enforced by a trigger, so two
   simultaneous bookings cannot oversell.
6. Stripe Checkout is created for the amount due now, with the session expiring no later than the
   seat hold. If Stripe errors, the booking is reverted immediately rather than waiting for a cron.
7. **The webhook is authoritative.** Nothing is ever marked paid from a redirect. The confirmation
   page says "processing" until the webhook lands, which is the honest thing to show.
8. On payment, a trigger cascade confirms the pending extras, redeems any account credit, counts
   the coupon and settles the referral. Cancelling reverses all of it.
9. Some weeks before departure, a nightly job opens the group and takes the trip snapshot.

The seat hold has three independent releases: a cron sweep every five minutes, the Stripe
`checkout.session.expired` event, and the error path in the action itself. Any one of them alone
would be a leak.

### Money

Every amount is an integer in minor units with an ISO currency. No floats anywhere.

Stripe is touched in exactly three places for taking money: the deposit or full payment at
booking, the balance payment from the account page, and buying extras after booking. Refunds are
issued from admin, split across succeeded payments newest first, with the percentage coming from
the departure's own cancellation ladder and overridable only by finance.

**Idempotency has three layers**, because a webhook that runs twice is a double charge or a double
refund. The `webhook_events` table rejects a duplicate event id outright. Payment-intent dedupe
catches a replay that slipped past. And the add-on confirmation function is idempotent in SQL on
the payment intent. Non-2xx is returned only for genuine failures, so Stripe retries the right
things and not the wrong ones.

Reconciliation at `/admin/finance` pages Stripe's payment intents and compares them against the
ledger, reporting five kinds of discrepancy. It is **read-only on both sides**: it never writes to
Stripe and never repairs the ledger. It reports how many records it checked, so a clean result is
evidence rather than an absence.

### Who can see what

Authorization is in the database, not in the UI. Row-level security is on every table, and the
policies call small security-definer helpers: `is_staff`, `is_ops_staff`, `is_finance_staff`,
`is_trip_member`, `is_chat_member`, `shares_trip_with` and a few more. Staff roles are grouped as
content, ops and finance, and the same grouping is mirrored in the admin.

Two patterns do the heavy lifting:

- **Public projections.** Anything with a staff-only column is exposed through a view that projects
  it away: `departures_public`, `bookings_public`, `hotels_public`. Supplier costs and internal
  notes are not hidden by the UI declining to render them; they are not in the query result.
- **Security-definer RPCs for anything that must be atomic**, such as booking, add-on purchase,
  group codes and review submission. The client calls one function and cannot get between its
  steps.

### The mobile app

Expo Router, and deliberately narrow: it is for the trip you already booked. Your Trip, a map, an
Explore tab that sells extras, the group with chat and Live Moments, support with local emergency
numbers first, and a profile. The itinerary works offline; documents list offline but need signal
to open.

It authenticates with the anon key only. The service-role key does not exist in this app, so every
query it makes is subject to the same row-level security as everything else.

### Work that runs on its own

Six pg_cron jobs and one Vercel cron. Seat holds and add-on holds are swept every five minutes.
Notifications are dispatched every minute through an edge function that claims rows with
skip-locked so two runs cannot double-send. Lifecycle notifications run daily at 06:15 UTC and are
what opens groups and sends payment reminders. Social posts publish every ten minutes. Builder
drafts are purged nightly. Hotel rates refresh nightly from Vercel.

### How it ships

Three branches. `main` is where work lands and gets CI. `develop` deploys to staging. `production`
deploys live. The deploy pipeline moves the **database first, then the web build that expects the
new schema**, and every step that needs an account is skipped rather than failed when its secret is
absent, so services can be adopted one at a time.

One thing that catches everyone: **catalog seeds do not deploy.** Migrations and functions ship
through CI; prices and trip content reach a hosted database only through
`scripts/seed-catalog.mjs`. Tour pages then revalidate on a five-minute window.

### Testing

Roughly 625 checks in four suites: 145 web unit tests, 17 Playwright end-to-end tests, 22 utility
tests, 37 mobile tests, and 404 pgTAP assertions covering row-level security and database
invariants. The database suite is the one that matters most, because that is where the money and
the permissions live.

The standing rule, learned expensively: **tests assert behaviour, never a business number.** A test
that pins a price turns a legitimate reprice into a failing build.

### What is deliberately not finished

Honest list, so nobody discovers these the hard way.

- **No hotel supplier is live.** The Duffel adapter is written from public documentation and
  exercised only against fixtures. `expedia` and `hotelbeds` exist as enum values with no adapter
  behind them; the admin dropdown says so. The checkout rate recheck is a no-op today because no
  catalog tier is linked to a hotel.
- **Hotel booking is a staff action**, not automatic on payment.
- **Waitlist notification writes the record but does not send the email.**
- **Reviews are empty and will stay empty** until real travelers write them. Nothing is ever
  seeded, so an empty reviews page is the truth rather than a bug.
- **Route art and the founder image are placeholders** until real photography lands.
- A few enum values are dead: `admin_login` is never written, and two recommendation categories are
  never used.

### Where to go next

| Question                                           | Document                                |
| -------------------------------------------------- | --------------------------------------- |
| The full specification                             | `docs/guideless_tours_architecture.md`  |
| Why the product is shaped this way                 | `docs/roadmap.md`, `docs/product.md`    |
| How prices were derived, and what is unverified    | `docs/pricing.md`                       |
| Schema and migration conventions                   | `docs/database.md`                      |
| The booking and payment path in detail             | `docs/booking.md`                       |
| Hotel inventory and the supplier engine            | `docs/hotels.md`                        |
| Where accommodation comes from, and why not Airbnb | `docs/accommodation-sourcing.md`        |
| Deploying, and the go-live runbook                 | `docs/deployment.md`, `docs/go-live.md` |
| Row-level security model                           | `docs/security.md`                      |
| Decisions and their reasoning                      | `docs/adr/`                             |
