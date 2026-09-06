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

## Checkout (Milestone 4, implemented)

```
/checkout/[departureId]  (client wizard, draft in sessionStorage)
  travelers → preferences → account (inline LoginForm, next=?step=4) → terms → review & pay
       │
       ▼ startCheckout() Server Action  (apps/web/lib/bookings/actions.ts)
  1. Zod: createBookingSchema            4. stripe.checkout.sessions.create (amount_due_now,
  2. refuse if Stripe not configured        metadata.booking_id, expires_at = hold)
  3. rpc create_booking(...)  ──────────► 5. service role: bookings.stripe_checkout_session_id
     (security definer; pending_payment    6. redirect → Stripe
      + 30-min hold; capacity trigger)
                                          on Stripe error: hold released immediately (→ draft)
/checkout/[departureId]/confirmation?booking=…   reads via RLS; shows "processing" until the
                                                  webhook lands; fires GA4 purchase when confirmed
```

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
