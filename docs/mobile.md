# Mobile app (Expo / React Native)

The trip companion (master spec §2B, §22–30, §49, §53, §98). Primary experience once booked;
booking itself stays on the web.

## Structure (`apps/mobile/src`)

```
app/_layout.tsx        providers (PostHog · TanStack Query · Session · fonts · theme), AuthGate,
                       push registration, root Stack
app/(auth)/login.tsx   email link (default) · password · new account
app/auth/callback.tsx  guideless://auth/callback — completes magic link / confirmation
app/(tabs)/            index (Trip) · explore · group · support · profile
app/itinerary/[tripId] full route, day by day
app/item/[itemId]      one item: when (local zone), where (Maps), instructions, "need a hand?"
app/chat/[roomId]      Realtime chat; long-press to report / block; announcements read-only
app/support/new        categorised request with trip + item context
app/support/[threadId] thread with live staff replies
lib/supabase.ts        anon client + AsyncStorage session
lib/auth/              SessionProvider (identify/reset analytics on auth changes), authService
lib/trips/             tripService (RLS-scoped reads), next-up.ts (pure "what's next" logic),
                       cache.ts (AsyncStorage offline copy + "last synced")
lib/chat/  lib/support/  lib/profile/  lib/explore/   service modules — components never call
                                                       supabase.from() directly
lib/notifications/     push.ts (Expo push token → push_tokens, tap → deep link), deep-links.ts
lib/analytics.ts       PostHog + optional Firebase (owned by the analytics work)
hooks/use-trip.ts      useMyTrips · useTrip (offline fallback) · useCurrentTrip
components/ui.tsx      Screen, Card, Button, Input, Row, Pill, EmptyState… (44pt targets, sunlight-legible)
components/itinerary-item.tsx, sync-badge.tsx, screen-tracker.tsx
```

## Behaviour

- **Trip home** answers "where am I, what's next, what are my options": greeting and city in the
  day's own time zone, hotel with check-out and Maps link, NOW / NEXT items with minutes-until,
  optional moments later today, group summary, link to the full route. Before the trip it shows
  the overview; after, the last day.
- **Offline**: the current trip is cached in AsyncStorage on every successful fetch; when the
  network fails the cached copy renders with "Offline · last synced 8 minutes ago". Chat needs
  connectivity.
- **Realtime**: `messages` and `support_messages` inserts stream via Postgres Changes (migration
  026 adds them to the `supabase_realtime` publication); RLS decides what a subscriber receives.
- **Push**: registers an Expo push token per device into `push_tokens` (needs a dev build and an
  EAS `projectId`; skipped quietly otherwise). Android channels: `operational`, `social`.
  Notification taps route through `deepLinkToPath()`.
- **Privacy**: group members see display name plus whatever a traveler toggled on (home country,
  bio). Never email, phone, DOB. Blocking hides a traveler's messages via RLS.
- **Live Moments** (Group tab): scheduled and live moments for the trip with a Join / Leave
  toggle (`live_moment_participants` upsert, counts from the `live_moment_counts` view) and
  realtime refresh on `live_moments` changes. "Suggest one" opens `moments/new`, a modal form
  (title, local date and time in the trip's zone, place, details, capacity) that inserts a
  member-visible, non-official moment and joins the creator. Official moments come from admin.
  Database triggers notify the other members when a moment is announced (migration 027).
- **Analytics** (`src/lib/analytics.ts`, PostHog): `app_opened`, `trip_opened`,
  `itinerary_item_viewed`, `map_opened` (item or accommodation), `recommendation_opened`,
  `live_moment_joined`, `chat_opened`, `message_sent`, `support_started`; screens are tracked by
  `ScreenTracker`. Ids only, never content or PII.
- **Crash reporting**: `@sentry/react-native`, enabled only with `EXPO_PUBLIC_SENTRY_DSN`;
  `sendDefaultPii: false`, network bodies dropped from breadcrumbs.
- **Notifications received**: pushes come from the `notify-dispatch` Edge Function (docs/api.md);
  the payload's `data.deepLink` is routed by `deepLinkToPath()` (`live_moment` → Group tab).
  Android channels `operational` (high) and `social` (default) are created at registration.
- **Store assets**: generated from the brand logo by `node scripts/mobile-assets.mjs` (sharp):
  `icon.png` (emblem on cloud), Android adaptive foreground / background / monochrome, splash icon
  (cloud background, ink in dark mode) and favicon. Re-run after replacing
  `apps/web/public/brand/guideless-logo.webp` and commit the PNGs.

## Running

```bash
cp .env.example apps/mobile/.env          # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (local: 127.0.0.1:54321)
pnpm dev:mobile                            # Expo dev server
pnpm --filter mobile test                  # jest-expo: next-up + deep-link logic
pnpm --filter mobile typecheck
```

On a physical device against local Supabase, replace `127.0.0.1` with your machine's LAN IP in
`.env` and in `supabase/config.toml` `[api] external_url` / `site_url` as needed.

## Not yet

Maps view, documents tab, photo sharing, offline queue for outgoing messages, in-app notification
inbox (rows exist; the app relies on push + Realtime today), E2E tests (Detox/Maestro), a real
device/simulator run, Sentry source-map upload (`@sentry/react-native/expo` plugin in
`app.config.ts`).
