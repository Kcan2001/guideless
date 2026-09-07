# API and data access

Derived from the master spec §51–54, §65–67, §72.

There is deliberately **no general REST API**. Data access happens through three channels, in
order of preference.

## 1. Supabase with the user's session (default)

- **Web (public pages):** `createPublicClient()` from `apps/web/lib/supabase/public.ts` — anon key,
  no cookies, so marketing/tour/destination pages are statically generated and revalidated
  (`revalidate = 300`). Query modules live in `apps/web/lib/data/` (`tours.ts`, `destinations.ts`);
  pure filtering logic in `tour-filters.ts` is unit-tested.
- **Web (signed-in):** Server Components read via `createClient()` from
  `apps/web/lib/supabase/server.ts`. Mutations go through Server Actions that validate with Zod
  then call Supabase.
- **Mobile:** a small service layer under `apps/mobile/src/lib/` wraps `supabase`:

  ```
  lib/auth/        signIn, signOut, session
  lib/trips/       tripService.getCurrentTrip(), getItinerary(tripId), getDay(tripId, date)
  lib/bookings/    bookingService.list(), get(id)
  lib/chat/        chatService.subscribe(roomId), sendMessage(roomId, body)
  lib/notifications/ registerPushToken(), preferences
  lib/support/     supportService.createThread(), reply()
  ```

  Components never call `supabase.from(...)` directly.

RLS enforces authorization for everything in this channel.

## 2. Trusted server code (privileged)

Server Actions / Route Handlers (web) or Edge Functions (`supabase/functions/`) using the
service role, for operations that must bypass or exceed the user's own permissions:

| Operation                          | Where                                                         | Why privileged                                    |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Create Stripe Checkout session     | Server Action `createCheckout`                                | Stripe secret; writes booking hold                |
| Stripe webhook                     | Route Handler `/api/webhooks/stripe` or Edge Function         | Signature verification, updates payments/bookings |
| Refund                             | Server Action (finance/admin)                                 | Stripe secret, audit log                          |
| Notification fan-out               | Edge Function `notify`                                        | Writes to many users                              |
| Release expired holds              | Scheduled (pg_cron → function)                                | Cross-customer inventory                          |
| Publish due social posts           | Scheduled (pg_cron → pg_net → Edge Function `social-publish`) | Instagram token; writes `social_posts` result     |
| Activate departure → trip snapshot | Server Action (trip_staff/admin)                              | Bulk copy across tables                           |
| Supplier API calls (Phase 3)       | Edge Function adapters                                        | Vendor credentials                                |

Every privileged action: validates input with Zod → checks caller role (for admin actions) →
performs work in a transaction → writes `audit_logs` where sensitive → returns a human error on
failure and reports the technical one to Sentry.

## 3. Realtime

Supabase Realtime (Postgres changes / broadcast) for `messages`, `live_moments`,
`trip_itinerary_items`, `notifications`. Subscribers receive only rows RLS allows. Chat presence
uses Realtime presence channels keyed by room.

## Checkout (Milestones 4 and 9, implemented)

```
/checkout/[departureId]  (client wizard, draft in sessionStorage)
  travelers → rooms & stay → add-ons → preferences → account (LoginForm, next=?step=6) → terms → review & pay
       │                                   ▲
       │   live quote: browser rpc quote_booking(p_room_indexes, p_stay_option_id, p_add_ons, p_code,
       │   p_payment_option, p_apply_credit) debounced 300 ms (apps/web/lib/quote-client.ts). The
       │   sidebar renders the lines the database returns; the client never computes money.
       ▼ startCheckout() Server Action  (apps/web/lib/bookings/actions.ts)
  1. Zod: createBookingSchema (travelers,  4. stripe.checkout.sessions.create (amount_due_now,
     roomIndexes, stayOptionId, addOns, code)  metadata.booking_id, expires_at = hold)
  2. refuse if Stripe not configured        5. service role: bookings.stripe_checkout_session_id
  3. rpc create_booking(… p_stay_option_id, 6. redirect → Stripe
     p_add_ons, p_code) — re-quotes inside   on Stripe error: hold released immediately (→ draft)
     the transaction, stores line items,
     booking_add_ons (pending, same hold)
/checkout/[departureId]/confirmation?booking=…   reads via RLS; shows "processing" until the
                                                  webhook lands; fires GA4 purchase when confirmed
```

Pricing rules live in migration 031 (`quote_booking`): own room by default and a per-traveler
shared-room discount for pairs (two per room max), a stay-tier delta per traveler, add-ons paid in
full today and never part of the deposit, one coupon **or** referral code (GL-XXXXXX) off the base
trip, and a signed-in customer's account credit applied automatically. Problems come back as
`problems[]` codes (`room_capacity`, `stay_option_full`, `add_on_sold_out`, `add_on_closed`,
`tier_conflict`, `code_invalid`, `code_own_referral`, …) which the UI maps to plain copy
(`apps/web/lib/bookings/add-on-selection.ts`).

**Add-ons after booking** (account page → `/account/bookings/[bookingId]/add-ons`, also linked
from the app with `?add=<addOnId>`; allowed until each add-on's sales window closes, even
mid-trip): `startAddOnPurchase()` → rpc `start_add_on_purchase(p_booking_id, p_add_ons)` (prices via
`quote_booking` on the booking's own room layout, no codes or credit; rows pending with a 30-minute
hold) → Stripe Checkout with `metadata: { booking_id, add_on_purchase_id, payment_option: 'add_on' }`
→ webhook `checkout.session.completed` calls `confirm_add_on_purchase(purchase_id, amount_total,
payment_intent, session_id)` (service role; idempotent on the payment intent; records a payment of
kind `add_on`, confirms the rows, writes line items, raises the booking totals). `checkout.session.expired`
on such a session cancels the pending rows; the 5-minute cron `release_expired_add_on_holds()` is
the backstop.

Auth: `/login` (magic link default, password, sign-up, Google), `/auth/callback` exchanges the
code, `signOut` Server Action. `proxy.ts` refreshes sessions and gates /account, /trips, /admin.

## Webhooks and idempotency

```
receive → verify signature → insert webhook_events (provider, event_id, payload_hash)
        → on conflict do nothing → if inserted: process in transaction → mark processed
        → else: return 200 (already handled)
```

Stripe events handled in MVP: `checkout.session.completed`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`. Replays are safe.

## Notifications

One entry point: `notificationService.send({ userId, type, category, title, body, deepLink })`.
It writes `notifications` (in_app), enqueues push via Expo (respecting `push_tokens`), and email
via Resend (templates in `supabase/functions/_shared/email/`), honoring
`notification_preferences` — except operational notifications during an active trip.

Two database triggers (migration 027) write `notifications` rows without application code,
through the `service_role`-only function `notify_trip_members(trip_id, category, type, title,
body, deep_link, exclude_user)`:

- `live_moments_notify`: a moment inserted as, or moved from draft to, `scheduled` or `live`
  notifies every current member except its creator (`social` / `live_moment`, deep link
  `{kind:'live_moment', tripId, momentId}`). `staff_only` moments never notify.
- `trip_items_notify`: an itinerary item whose status, start time, title or location changed
  notifies all members (`operational` / `itinerary_change`, deep link
  `{kind:'itinerary_item', tripId, itemId}`).

Lifecycle rows are created by the daily job `run_lifecycle_notifications()` (pg_cron, 06:15 UTC):

- `enqueue_payment_reminders()`: confirmed bookings with a balance, 14 and 3 days before the
  departure's `balance_due_date` and once a day overdue (`payment_reminder`, deep link
  `{kind:'payment', bookingId}`).
- `enqueue_trip_reminders()`: T-30 / T-7 / T-1 (`trip_upcoming`), day of (`trip_started`), day
  after (`trip_completed`) to every member, and trip status automation (upcoming → active →
  completed by date).
- `support_messages_notify` trigger: a staff reply (not an internal note) notifies the customer
  (`support_response`).

All enqueues are idempotent through `notifications.dedupe_key` (unique), so re-running a job or
replaying a trigger never duplicates a message.

**Delivery** is the `notify-dispatch` Edge Function (`supabase/functions/notify-dispatch`), called
every minute by pg_cron → pg_net while undispatched rows exist (`invoke_notify_dispatch()`; URL
and shared secret in Vault). It calls `claim_pending_notifications(50)` (service role only; marks
rows `dispatched_at`, skip-locked), then per row:

| Channel | Sent when                                                                                     | Provider                                                                           |
| ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| push    | operational always; social / marketing per `notification_preferences` and outside quiet hours | Expo push API; `DeviceNotRegistered` disables the token                            |
| email   | operational unless opted out; social / marketing only when opted in                           | Resend (generic template: title, body, CTA to the web equivalent of the deep link) |

Every attempt writes one `notification_deliveries` row per channel (`sent` / `skipped` /
`failed`, provider id, reason). Admins can read it; customers cannot. The app reads
`notifications` directly (Realtime-enabled) for the in-app channel.

## Support and trip documents (admin)

- Staff work threads in `/admin/support`. A staff reply is a plain `support_messages` insert with
  `is_from_staff = true`: the `support_message_touch_thread` trigger stamps `first_response_at`,
  moves the thread to `waiting_on_customer`, and `support_messages_notify` writes the traveler's
  `support_response` notification. Internal notes (`is_internal_note`) never reach the customer
  (RLS). `support_threads.assigned_to` is the live owner; `support_assignments` keeps the history.
- Trip documents: the browser uploads directly to the private `trip-documents` bucket under
  `trips/{tripId}/{uuid}-{name}` (Storage RLS: ops staff write, members read their own), then
  `recordTripDocumentAction` inserts the `trip_documents` row. The `trip_documents_notify` trigger
  writes a `document_added` notification to the traveler the file is for, or to every member,
  and nothing for `staff_only`. The app's Documents screen and inbox read those rows directly.

## Deep links

`guideless://trip/{tripId}` · `guideless://trip/{tripId}/itinerary/{itemId}` ·
`guideless://chat/{roomId}` · `guideless://support/{threadId}` ·
`guideless://trip/{tripId}/moment/{momentId}` · `guideless://booking/{bookingId}/payment`.
Web equivalents under `/trips/…`, `/account/…`. Typed as `DeepLink` in `@guideless/types`.

## Errors

User-facing: plain language, states whether money moved
("We couldn't complete that booking. Your payment was not charged."). Technical detail → Sentry
with ids only, never PII.

## Analytics events

GA4 (web marketing): `view_tour, view_departure, start_checkout, add_traveler, begin_payment,
purchase(tour_id, departure_id, currency, value), search_tours, filter_tours, view_destination`.
PostHog (product, web + mobile): `app_opened, trip_opened, itinerary_item_viewed,
recommendation_opened, map_opened, live_moment_joined, chat_opened, message_sent,
support_started, document_opened, trip_completed`. Mobile events carry ids and enum values only
(`trip_id`, `item_id`, `type`, `source`, `category`, `moment_id`). No PII in either.
