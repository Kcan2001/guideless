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
- **Map tab** (`(tabs)/map.tsx`, `react-native-maps`): hotels, route items with coordinates, the
  welcome anchor (highlighted), Live Moments with a place, add-ons and Explore recommendations for
  the current destination, filtered by day (All / Today / each day). Tapping a callout opens native
  directions (`map_opened`, `source: "map_tab"`). Marker building, day filtering and the fitted
  region are pure helpers in `src/lib/map/markers.ts` (Jest-tested). iOS uses Apple Maps; Android
  needs a Google Maps key before a production build (see Store and device builds).
- **Documents** (`documents/index.tsx`, from Trip home): `trip_documents` grouped by kind, opened
  through five-minute signed Storage URLs in the in-app browser (`document_opened`). The list is
  cached in AsyncStorage so it opens offline; files need signal.
- **Inbox** (`notifications/index.tsx`, bell on Trip home with unread count): the user's
  `notifications` rows, unread first, Realtime refresh on inserts, mark-read on open, mark-all-read,
  taps routed by `deepLinkToPath()`. Pure sorting and relative-time helpers live in
  `src/lib/notifications/inbox-helpers.ts`.
- **Add-ons in the trip** (`components/add-on-card.tsx`, on Trip home "today" and under each
  itinerary day): the departure's active `departure_add_ons` with price, time, place, "N going"
  (`add_on_headcounts`) and who from your group is on it (`trip_add_on_participants`; "Maya, Tom
  and 4 others"). "You're in" when your booking holds it (`booking_add_ons`); "Add" opens the web
  purchase page `…/account/bookings/{bookingId}/add-ons?add={addOnId}` in the in-app browser; the
  app never takes card details. Closed once past `bookable_until_days_before`; Full at capacity.
- **Group before the trip** (Group tab without a trip): the customer's next confirmed booking and
  its anonymized roster from `departure_roster_stats` ("11 booked · 5 solo · 2 pairs · 4
  countries"), with the date the group opens (`departures.group_opens_days_before`). Once the trip
  exists the welcome anchor item (`is_anchor`) is pinned at the top with "I'll be there / Maybe"
  (`item_rsvps`, counts from `item_rsvp_counts`), and member cards show interests and travel style
  when a traveler has `show_interests` on.
- **Profile**: display name, bio, home country, interests (chips from `INTERESTS`), travel style,
  languages and the three visibility toggles, validated with `groupProfileSchema`; the traveler's
  referral code (`referral_codes`) with a share sheet and any earned credit
  (`account_credit_balance`).
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

## Store and device builds (EAS)

`react-native-maps` and `expo-notifications` need a development build; Expo Go is no longer enough.
`apps/mobile/eas.json` defines `development` (dev client, internal), `preview` (internal, Android
APK) and `production` profiles. Public config lives in **EAS environment variables** (Expo project
`guideless`, id `992a1489-97e2-4534-b832-18a51c312df7`, account `@guidelesstravel`), not in
`eas.json`: `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` and the two Firebase file
variables `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICE_INFO_PLIST` exist in development, preview and
production (`eas env:list --environment production`). Still to add there: `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (hosted projects) and `EXPO_PUBLIC_SENTRY_DSN`; `eas.json` must not
contain empty-string env values (the CLI rejects them).

First internal build, once:

```bash
npm i -g eas-cli
cd apps/mobile
eas login                                  # already done: @guidelesstravel; extra.eas.projectId is committed in app.json
eas env:list --environment development     # PostHog + Firebase files are there; add Supabase URL/anon key + Sentry DSN with `eas env:create`
eas build --profile development --platform ios      # or android
eas build --profile development --platform android
```

Install the build from the link EAS prints (TestFlight-free internal distribution), then run
`pnpm dev:mobile` and open the project from the dev client. Later builds: `eas build --profile
preview` for testers, `eas build --profile production` + `eas submit` for the stores.

Android maps: add the Google Maps key to `app.json` before an Android build:
`"android": { "config": { "googleMaps": { "apiKey": "<key>" } } }` (restrict the key to the
package `com.guidelesstours.app`). iOS uses Apple Maps and needs nothing. `app.config.ts` is owned
by the marketing/analytics work; if the key should come from an env var, add it there.

Verification on 2026-09-06: `npx expo-doctor` → 21/21 checks passed; `npx expo export --platform
ios --platform android` bundled both Hermes entries (7 MB / 7.3 MB) with no errors.

## Not yet

Photo sharing, offline queue for outgoing messages, E2E tests (Detox/Maestro), a real
device/simulator run (`eas build --profile development`, see above), Google Maps key for Android,
Sentry source-map upload (`@sentry/react-native/expo` plugin in `app.config.ts`).
