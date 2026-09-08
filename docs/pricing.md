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
  `system_settings.referral_discount_percent` (5). You cannot use your own code.
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

- `create_booking(..., p_stay_option_id, p_add_ons, p_code)` re-runs the quote inside the
  transaction, refuses on any problem (the code is in the exception hint), stores the totals and
  `booking_items` lines, writes travelers with `room_index`, `booking_add_ons` as `pending` with the
  seat hold's expiry, and a `pending` `referrals` row when a referral code was used.
- On `bookings.status → confirmed` (Stripe webhook): pending add-ons become `confirmed` (and get
  their `booking_items` lines), the coupon redemption is counted, applied credit is redeemed, and
  the referrer earns credit. On `draft` / `cancelled` / `refunded`: add-ons are cancelled and a
  pending referral is voided.
- **Later purchases**: `start_add_on_purchase(booking_id, add_ons)` (owner only, confirmed
  bookings) quotes just the add-ons on the booking's room layout, inserts `pending` rows sharing a
  `purchase_id` with a 30-minute hold and returns the amount; the web creates a Stripe Checkout
  session with `metadata.add_on_purchase_id`; the webhook calls `confirm_add_on_purchase(...)`
  (service role, idempotent on the payment intent) which records the `add_on` payment, confirms
  the rows, writes line items and raises the booking's subtotal, total and amount paid together.
  `release_expired_add_on_holds()` runs every 5 minutes.
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

## Tests

`supabase/tests/pricing_and_community.test.sql` (28 tests): quote math for rooms, tiers and
add-ons, capacity and tier conflicts, referral discount and self-referral refusal, booking
creation with all of the above, confirmation side effects, head-counts, credit application,
roster privacy, group opening and RLS on the catalog. `supabase/tests/cancellations.test.sql`
(14 tests): ownership, status and reason checks, one open request per booking, notifications,
withdraw and re-request, staff-only resolution, and the rate limiter's fixed window.
