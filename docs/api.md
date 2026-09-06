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

| Operation                          | Where                                                 | Why privileged                                    |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Create Stripe Checkout session     | Server Action `createCheckout`                        | Stripe secret; writes booking hold                |
| Stripe webhook                     | Route Handler `/api/webhooks/stripe` or Edge Function | Signature verification, updates payments/bookings |
| Refund                             | Server Action (finance/admin)                         | Stripe secret, audit log                          |
| Notification fan-out               | Edge Function `notify`                                | Writes to many users                              |
| Release expired holds              | Scheduled (pg_cron → function)                        | Cross-customer inventory                          |
| Activate departure → trip snapshot | Server Action (trip_staff/admin)                      | Bulk copy across tables                           |
| Supplier API calls (Phase 3)       | Edge Function adapters                                | Vendor credentials                                |

Every privileged action: validates input with Zod → checks caller role (for admin actions) →
performs work in a transaction → writes `audit_logs` where sensitive → returns a human error on
failure and reports the technical one to Sentry.

## 3. Realtime

Supabase Realtime (Postgres changes / broadcast) for `messages`, `live_moments`,
`trip_itinerary_items`, `notifications`. Subscribers receive only rows RLS allows. Chat presence
uses Realtime presence channels keyed by room.

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
PostHog (product, web + mobile): `trip_opened, itinerary_item_viewed, recommendation_opened,
map_opened, live_moment_joined, chat_opened, message_sent, support_started, document_opened,
trip_completed`. No PII in either.
