# Architecture

Derived from the master spec: [`guideless_tours_architecture.md`](./guideless_tours_architecture.md) §2–6, §51–57, §94, §120.

## Shape

Guideless is a **modular monolith** on deliberately boring infrastructure:

```
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  apps/web  (Next.js, Vercel) │      │  apps/mobile (Expo / RN)     │
│  marketing · booking ·       │      │  trip companion              │
│  account · /admin            │      │                              │
└──────────────┬───────────────┘      └──────────────┬───────────────┘
               │  anon key + RLS (user context)       │  anon key + RLS
               │  service role (server only)          │
               ▼                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│  Supabase — SYSTEM OF RECORD                                        │
│  Postgres · Auth · RLS · Storage · Realtime · Edge Functions        │
└──────┬───────────────────┬──────────────────┬───────────────────────┘
       ▼                   ▼                  ▼
    Stripe              Resend         Expo Push / Maps
  (webhooks are        (email)
   authoritative)
```

Analytics (GA4, PostHog) and errors (Sentry) hang off both apps.

## Layers and responsibilities

| Layer          | Owns                                                                 | Must not                                         |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Postgres       | All business state, invariants (constraints), authorization (RLS)    | Hold card data                                   |
| Supabase Auth  | Identity (`auth.users`) — profiles/roles live in public tables       |                                                  |
| Next.js        | Rendering, Server Actions, Route Handlers, admin UI                  | Be a second source of truth; bypass RLS casually |
| Edge Functions | Stripe webhooks, notification fan-out, scheduled jobs, supplier APIs | Contain UI                                       |
| Expo app       | Trip experience, offline cache, realtime chat, push                  | Hold the service role key                        |
| Stripe         | Payment, refunds, receipts                                           |                                                  |

## Domain hierarchy

```
TOUR → TOUR VERSION → DEPARTURE → GROUP → TRIP → TRAVELER

TRIP ├── Itinerary (days → items; free_time is first-class)
     ├── Hotels · Transportation · Activities
     ├── Documents · Recommendations
     ├── Live Moments · Group Chat · Support
```

Two rules make this scale from one France trip to hundreds of departures:

1. **Tour versioning** — editing a tour creates/edits a draft version; booked departures keep the version they were sold on ([ADR-008](./adr/ADR-008-tour-versioning.md)).
2. **Trip snapshots** — when a departure becomes operational, the itinerary is copied into `trip_*` tables so staff edit the trip, not the template ([ADR-009](./adr/ADR-009-trip-snapshots.md)).

## Data access patterns

- **Ordinary reads/writes** — Server Components / Server Actions (web) or the mobile service layer call Supabase with the user's session. RLS enforces access. This is the default.
- **Privileged workflows** — Stripe operations, refunds, notification fan-out, admin bulk ops go through a Server Action or Edge Function using the service role. Never from a client.
- **Realtime** — mobile/web subscribe to `messages`, `live_moments`, `trip_itinerary_items` via Supabase Realtime; RLS still applies to what a subscriber receives.
- **No REST layer by default.** Introduce a Route Handler only for webhooks and integrations that need a URL.

## Monorepo

pnpm workspaces + Turborepo. Shared packages ship TypeScript source (no build step):

| Package                 | Contents                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| `@guideless/types`      | Enums (mirrored as Postgres enums), domain types, generated `database.ts` |
| `@guideless/validation` | Zod schemas for every external input                                      |
| `@guideless/config`     | Design tokens, typography, brand copy                                     |
| `@guideless/utils`      | Money (integer minor units), time zones — pure, tested                    |

Next.js compiles them via `transpilePackages`; Metro resolves them through workspace symlinks (pnpm `nodeLinker: hoisted`).

## Cross-cutting rules

- Money: integer minor units + ISO currency. Time: UTC instant + IANA zone, displayed in the event's zone.
- Booking state ≠ payment state. Two enums, two columns.
- Every webhook is idempotent via `webhook_events`.
- Feature flags are a database table until that stops being enough.
- Supplier costs and internal notes are staff-only at the RLS level.

## What we are explicitly not building in v1

Custom CRM, custom payments, custom chat infra, microservices, Kubernetes, custom auth, AI itinerary generation, supplier marketplace, separate backend fleet, separate admin frontend. See master spec §93.
