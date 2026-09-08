# Pricing, rooms, stay tiers and add-ons

_Migrations 029–031. One function computes money: `public.quote_booking()`. Web, mobile and admin
only display what it returns._

## Rules (decided 2026-09-06)

- **Own room by default.** `departures.price_amount` is the price per traveler in their own room.
  Two travelers on the same booking may share one room (never more than two); each then gets
  `shared_room_discount_amount` off. Rooms are `booking_travelers.room_index` (1-based); a
  deferred constraint trigger refuses a third occupant.
- **Stay tiers** (`departure_stay_options`) add `price_delta_amount` per traveler and may override
  the shared-room discount. A departure without tiers prices from the base columns; with tiers, the
  default (`is_default`) applies when none is chosen. Capacity per tier is enforced in the quote.
- **Add-ons** (`departure_add_ons`) are paid in full when chosen, at booking or any time later
  (including mid-trip), and never count toward the deposit. `pricing_basis` is `per_traveler`
  (named traveler indexes) or `per_booking` (quantity). `capacity` counts confirmed plus live
  pending units. `tier_group` makes choices mutually exclusive per traveler (race viewing:
  grandstand / terrace / yacht). Sales close `bookable_until_days_before` days before the add-on's
  date (`day_number` → departure date; undated → trip end); `0` means the day itself.
- **Codes.** A coupon (`coupons`) or a friend's referral code (`referral_codes`, `GL-XXXXXX`)
  discounts the base trip (never add-ons). Referral percent comes from
  `system_settings.referral_discount_percent` (5). You cannot use your own code. Coupons are
  managed at `/admin/coupons` (finance roles): a percentage or a fixed amount in one currency,
  never both, with an optional validity window and maximum. **Editing a coupon never changes a
  booking that already used it** — bookings snapshot their discount into `booking_items`, so a
  coupon change only affects future redemptions. A coupon that has been used can be deactivated
  but not deleted, which keeps the history intact. Codes are `citext`, so capitalisation is
  ignored when a traveler types one.
- **Credit.** Signed-in customers' `account_credits` balance in the booking currency is applied
  automatically to the base trip. Credit is earned when a referred booking is confirmed
  (`referral_reward_amount`, 7500 minor units) and redeemed when the crediting booking confirms.
- **Presentation is not pricing.** Migration 039 added `tagline`, `image_urls`, `includes`,
  `excludes`, `details`, `label` and `why_price_note` to stay tiers and `image_urls`, `includes`,
  `excludes`, `label`, `why_price_note`, `meeting_point`, `min_age` to add-ons, and made
  `departure_add_ons.kind` the enum `add_on_kind` (adding `group_moment`, `insurance`,
  `extension`). `quote_booking()` reads none of these; `supabase/tests/catalog_presentation.test.sql`
  pins the Monaco example total to prove it.
- **Deposit and due today.** Deposit = `departures.deposit_amount` × travelers. Due today =
  deposit + all add-ons (or the full total). Balance = total − due today.
- **Tiers are presentation too.** Migration 040 adds a public `tier` (Explorer / Classic / Premium /
  Elite) to stay options and add-ons. Every trip starts at the minimum: the base price covers the
  default (Explorer) stay option; other tiers are just price deltas or add-on prices as before. The
  tier is a level shown as a badge, distinct from the marketing `label`; untiered rows (transfers,
  dinners) leave it null. `quote_booking()` does not read it.

## `quote_booking(...)`

```
quote_booking(p_departure_id uuid, p_room_indexes int[], p_stay_option_id uuid, p_add_ons jsonb,
              p_code text, p_payment_option text, p_apply_credit boolean) → jsonb
```

`p_room_indexes` has one entry per traveler (`{1,1,2}` = a pair sharing plus one own room).
`p_add_ons` is `[{ "addOnId", "travelerIndexes": [1,2] } | { "addOnId", "quantity": 1 }]`.
Result (`BookingQuoteResult` in `@guideless/types`): `lines[]` (base / add_on / discount with the
ids they came from), `base_amount`, `add_ons_amount`, `subtotal_amount`, `discount_amount`,
`credit_amount`, `total_amount`, `deposit_amount`, `due_now_amount`, `balance_amount`, `rooms[]`,
and `problems[]` with codes `room_capacity`, `stay_option_full`, `add_on_sold_out`,
`add_on_closed`, `tier_conflict`, `code_invalid`, `code_own_referral`, `code_currency`. Callable
by `anon` (read-only, security definer); the checkout sidebar calls it from the browser.

## Booking lifecycle

- `create_booking(..., p_stay_option_id, p_add_ons, p_code, p_group_code)` re-runs the quote inside
  the transaction, refuses on any problem (the code is in the exception hint), stores the totals and
  `booking_items` lines, writes travelers with `room_index`, `booking_add_ons` as `pending` with the
  seat hold's expiry, and a `pending` `referrals` row when a referral code was used.
- **Line items are a snapshot (migration 041).** The accommodation tier is its own `stay` line
  (`unit = price_delta_amount`, `quantity = travelers`) and the base lines shrink by the same total,
  so `sum(base + stay) + add-ons − discounts = subtotal/total` to the cent; the line's metadata keeps
  `stay_option_id`, `tier` and `label` as sold. An included tier still writes a zero `stay` line.
  `booking_add_ons.title_snapshot` holds each add-on's title at purchase; `booking_items` add-on
  lines are written from it, so a later catalog rename never changes what a customer bought.
- **Group codes never price (migration 042).** `p_group_code` (e.g. `KYLE-MONACO-27`) links the
  new booking to a friend's `group_codes` row on the same departure and increments `uses`; an invalid
  code raises with hint `group_code_invalid`. `quote_booking` does not know about codes. Owners mint
  a code with `create_group_code(booking_id)` (one per booking, first name + tour token + year);
  anyone can look one up with `check_group_code(code, departure_id)` → `{valid, reason, owner_first_name, joined}`.
- On `bookings.status → confirmed` (Stripe webhook): pending add-ons become `confirmed` (and get
  their `booking_items` lines), the coupon redemption is counted, applied credit is redeemed, and
  the referrer earns credit. On `draft` / `cancelled` / `refunded`: add-ons are cancelled and a
  pending referral is voided.
- **Later purchases**: `start_add_on_purchase(booking_id, add_ons)` (owner only, confirmed
  bookings) quotes just the add-ons on the booking's room layout, inserts `pending` rows sharing a
  `purchase_id` with a 30-minute hold and returns the amount; the web creates a Stripe Checkout
  session with `metadata.add_on_purchase_id`; the webhook calls `confirm_add_on_purchase(...)`
  (service role, idempotent on the payment intent) which records the `add_on` payment, confirms
  the rows, writes line items and raises the booking's subtotal, total and amount paid together,
  then writes one operational notification ("Added to your trip", deduped per payment intent).
  `release_expired_add_on_holds()` runs every 5 minutes.
- **Payment notification**: the webhook calls `notify_booking_paid(booking_id, payment_intent, kind)`
  after recording a booking payment — "Your trip is confirmed" for a deposit/full payment, "Payment
  received" for a balance — once per intent (`notifications.dedupe_key = 'payment:<intent>'`).
- **Social signal**: `add_on_headcounts` (public, aggregate) and `trip_add_on_participants(trip_id)`
  (trip members and staff: who from the group is on each add-on).

## Group opening and roster

- `departures.group_opens_days_before` (default 30). `open_due_groups()` runs daily: a viable
  departure (status open/guaranteed/full/closed, confirmed travelers ≥ minimum) inside its window
  gets a trip per group via `create_trip_for_group()`, and members receive a `group_opened`
  notification. Admin can still activate earlier.
- `departure_roster_stats(departure_id)` is public and anonymized: booked, solo / pairs / groups,
  distinct countries, an age range rounded to five years shown only from four travelers up, spots
  left, `groupOpensOn`, `groupOpen`. Never names.

## Cancellations (customer self-service)

- The account page shows, per confirmed booking, today's refund before anyone commits:
  `refund_percentage_for(policy, days_before)` on what was paid toward the base trip, plus each
  confirmed add-on refunded in full until its own `cancellable_until_days_before` deadline
  (`apps/web/lib/bookings/cancellations.ts` mirrors the SQL for the preview).
- `request_cancellation(booking_id, reason)` (owner only, confirmed bookings, trip not started)
  opens one `cancellation_requests` row per booking (partial unique index on pending), quotes the
  tier on that day and writes a `cancellation_requested` notification. Customers can
  `withdraw_cancellation_request()` while it is pending.
- Staff resolve requests from `/admin/bookings/[id]`: perform the cancellation with the existing
  admin action (which computes and issues the refund), then call
  `resolve_cancellation_request(request_id, 'approved' | 'declined', notes)`, which records the
  decision and notifies the customer. Wiring that button in admin is a small follow-up.
- Money never moves from the request itself; the request is a ticket with the quote attached.

## Refund tiers versus what suppliers allow — unresolved (2026-09-09)

The seeded departures refund **100% at 60+ days**, 75% at 30–59, 50% at 15–29 and nothing inside 15.
That is more generous than the suppliers behind a Monaco weekend will be. Grandstand tickets are
non-refundable once issued, and race-week accommodation is normally prepaid and non-refundable too
(`docs/legal/schedule-d-event-tickets.md` D4). A traveler cancelling at 61 days would currently be
refunded in full for components Guideless can no longer recover, and the loss is ours.

Two things have to happen before a Monaco departure opens for sale, and neither is a code change:

1. Set that departure's tiers in admin to match the supplier terms actually signed.
2. Mark the non-refundable extras as such at the point of sale. Clause 7 of the Booking Agreement
   already carves them out of the percentage, and carries a `[CONFIRM PER DEPARTURE]` marker so the
   two cannot quietly disagree.

The Southern France departures are lower risk — hotels and experiences there are usually cancellable
much closer in — but the tiers should still be checked against the signed rates rather than assumed.

## Hotel inventory (migration 044)

Supplier rates never set a customer price directly. The chain is:

```
supplier adapters → hotel_rates (NET, staff-only) → suggest_stay_price() → staff copies a number
into departure_stay_options.price_delta_amount → quote_booking() as before
```

- `hotels`, `hotel_rooms` hold the curated catalog; customers read them only through the
  `hotels_public` and `stay_option_hotels_public` views (name, city, photos, amenities, star rating
  when confirmed). `departure_stay_options.hotel_id` links a tier to its property.
- `hotel_rates` rows are what Guideless would pay: `net_amount + taxes_amount + fees_amount =
total_amount`, integer minor units in `currency`, with `refundable`, `cancellation_policy`,
  `breakfast_included`, `payment_type`, `fetched_at`, `expires_at`. Ops and finance read; only the
  service role writes. Cost never reaches a customer (CLAUDE.md rule 11).
- `pricing_rules` (finance-managed): `markup = max(min_markup_amount, round(total ×
percentage_markup / 100) + fixed_markup_amount)`. A hotel rule beats a destination rule beats a
  global rule; ties go to `priority` desc, then the newest rule; `effective_from/to` are judged on
  the check-in date. `apps/web/lib/hotels/pricing.ts` mirrors this exactly so admin previews match.
- `suggest_stay_price(hotel, check_in, check_out, adults)` (staff only) returns the latest
  unexpired rate per equivalent product — same room, bed, occupancy, refundability, cancellation
  deadline day, breakfast and payment type — with the markup applied: `{rates: [{rate_id, room_name,
refundable, breakfast_included, payment_type, net_total, markup, customer_total, currency,
expires_at}], rule_id}`. Equivalent-product grouping is the same fingerprint used by
  `apps/web/lib/hotels/fingerprint.ts`, so a non-refundable room-only rate is never compared with
  a refundable rate that includes breakfast.
- Offer choice is not "cheapest": `apps/web/lib/hotels/compare.ts` scores price, free
  cancellation, breakfast, supplier reliability and margin with documented default weights.
- A rate is rechecked with the supplier before any payment (service layer); `hotel_bookings`
  freezes the purchased rate in `rate_snapshot`.

## Tests

`supabase/tests/pricing_and_community.test.sql` (28 tests): quote math for rooms, tiers and
add-ons, capacity and tier conflicts, referral discount and self-referral refusal, booking
creation with all of the above, confirmation side effects, head-counts, credit application,
roster privacy, group opening and RLS on the catalog. `supabase/tests/cancellations.test.sql`
(14 tests): ownership, status and reason checks, one open request per booking, notifications,
withdraw and re-request, staff-only resolution, and the rate limiter's fixed window.
`supabase/tests/hotels.test.sql` (27 tests): public projections vs staff-only tables, rate privacy,
rule selection and markup math in `suggest_stay_price()`, and the tier ↔ hotel link. Unit tests for
the TypeScript mirror live next to `apps/web/lib/hotels/*.ts`.

## Monaco Grand Prix 2027: where the numbers came from (2026-09-08)

The catalog shipped with placeholder prices against live Stripe keys, which meant any booking was
a real charge at an invented number. These are the replacements and the reasoning behind each, so
the next person to change them knows what they are overriding.

**Dates.** The 2027 Grand Prix runs Friday 4 to Sunday 6 June, race at 15:00 Sunday. The trip is
Wednesday 2 to Monday 7 June, five nights. Wednesday arrival puts welcome drinks two days before
the track opens and gives the group a free Thursday on the coast; Monday departure means nobody
flies out the evening of the race.

**Assumptions.** Roughly 1.09 USD to the euro. Ticket prices about 9% above 2026, which is the
year-on-year step the circuit has held recently. No trade rate agreed with any supplier, so every
cost below is retail plus our margin.

| Line                                  | Cost basis                                                                                   | We charge |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| Base trip, Nice, 5 nights             | Room about EUR 280/night race week, plus train pass, welcome round, ops: about $1,650 landed | $2,450    |
| Monte Carlo upgrade                   | EUR 900–1,200/night against EUR 280: about $3,900 more over five nights                      | $4,450    |
| Grandstand K, three-day pass          | 2026 K1–K2 face EUR 1,420, plus 9%: about $1,690                                             | $2,190    |
| Terrace, Saturday and Sunday, catered | Hospitality rate about EUR 2,300/day                                                         | $5,450    |
| Amber Lounge yacht, Sunday            | EUR 4,500 + 20% VAT + 3% card fee = EUR 5,562, about $6,060                                  | $6,750    |
| Amber Lounge yacht, Saturday          | EUR 3,200 grossed up = EUR 3,955, about $4,310                                               | $4,950    |
| Amber Lounge yacht, both days         | EUR 7,700 grossed up = EUR 9,518, about $10,370                                              | $11,400   |
| Friday night party                    | EUR 1,100 grossed up, about $1,480                                                           | $1,690    |
| Sunday after party                    | EUR 1,500 grossed up, about $2,020                                                           | $2,290    |
| Private airport transfer              | A car from Nice airport runs EUR 90–140                                                      | $150      |

**Grandstand K was described as a product that does not exist.** Monaco sells grandstand seats as
three-day passes covering Friday, Saturday and Sunday. There is no Saturday-and-Sunday seat. The
add-on now says three days and is priced as one.

**The yacht has a commercial problem worth deciding on.** Amber Lounge publish a per-person day
rate and add 20% French VAT and a 3% card fee on top, so their advertised EUR 4,500 race day is
really EUR 5,562. Our $6,750 is that plus about 11%. A traveler who checks amberlounge.com will
find they can book the same day directly for less than we charge, and nothing stops them. Three
ways out, none taken yet:

1. Negotiate a trade rate or an allocation. This is the real fix and needs a conversation with
   Amber Lounge before the trip goes on sale with the yacht attached.
2. Sell it at cost and make the margin on the trip. Defensible: the yacht is a reason to book the
   weekend with us, not a profit centre.
3. Drop it and point people at the operator. Honest, and it costs us the tier.

Until one of those is chosen, the yacht add-ons are priced above what a customer can find
themselves. That is a claim risk as much as a pricing one.

**Refunds.** Race viewing and both parties are non-refundable from purchase
(`cancellable_until_days_before` is null), because they are bought in a named traveler's name
months ahead and no supplier takes them back. The boat and the transfer keep real windows. The
departure runs the event cancellation ladder, which reaches zero sixty days out rather than the
fifteen a touring route gets.
