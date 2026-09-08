# Guideless Travel — Engineering Guide for Claude

Guideless Travel is a "minimal intervention" travel company. We organize the logistics
(hotels, trains, transfers, selected experiences, small groups); there is no tour guide.
Tagline: **Travel organized. Explore independently.** / **Everything planned. Nothing forced.**

The master specification is `docs/guideless_tours_architecture.md`. Read it before any
non-trivial work. Shorter topic docs live in `docs/` and decisions in `docs/adr/`.

## Stack (do not deviate without an ADR)

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Web       | Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui   |
| Mobile    | React Native + Expo + Expo Router + TypeScript                |
| Backend   | Supabase (Postgres, Auth, RLS, Storage, Realtime, Edge Funcs) |
| Payments  | Stripe (webhooks are authoritative)                           |
| Email     | Resend                                                        |
| Analytics | GA4 (marketing) + PostHog (product) + Sentry (errors)         |
| Hosting   | Vercel + Supabase + Expo EAS                                  |
| Repo      | pnpm workspaces + Turborepo                                   |

## Repo layout

```
apps/web        Next.js: marketing, booking, customer account, /admin
apps/mobile     Expo: the trip companion app
packages/types  Shared enums + domain types (+ generated database.ts)
packages/validation  Zod schemas shared by web, mobile, edge functions
packages/config Design tokens (colors, type scale, brand copy) + shared tsconfig
packages/utils  Money (integer minor units), time zones, formatting
supabase/       migrations/, seed/, functions/, config.toml
docs/           architecture, product, database, security, api, design-system, deployment, adr/
```

## Commands

```
pnpm install
pnpm dev:web            # Next.js on :3000
pnpm dev:mobile         # Expo dev server
pnpm db:start           # local Supabase (needs Docker)
pnpm db:reset           # re-apply migrations + seed
pnpm db:test            # pgTAP suite in supabase/tests (RLS + invariants) — run after any migration
pnpm db:types           # regenerate packages/types/src/database.ts — commit the result
pnpm check              # format + lint + typecheck + test + build (run before finishing any task)
```

## Admin (/admin) — see docs/admin.md

Staff-only via `requireStaff(roles)` in `apps/web/lib/auth/staff.ts`; role groups CONTENT / OPS /
FINANCE mirror the SQL helpers. Mutations are Server Actions in `apps/web/lib/admin/actions/*`:
`requireStaff` → `parseForm(zod)` → Supabase as the staff user (RLS) → `revalidatePath` → `flash()`.
Grant a role locally: `insert into public.user_roles (user_id, role) select id, 'admin' from
auth.users where email = '…';`

## Migration conventions (see docs/database.md)

- One migration per concern: `supabase/migrations/<timestamp>_<name>.sql`. Forward-only.
- Every table: `enable row level security` + all policies **in the same file**. Wrap helper calls as
  `(select public.is_staff())` so Postgres caches them per statement.
- Helpers: `is_staff()`, `is_admin()`, `is_ops_staff()`, `is_content_staff()`, `is_support_staff()`,
  `is_moderator()`, `is_trip_member(trip_id)`, `is_departure_member(departure_id)`,
  `is_chat_member(room_id)`, `shares_trip_with(user_id)`, `has_any_role(app_role[])`.
- New enum value → `alter type … add value` migration **and** `packages/types/src/enums.ts`.
- Staff-only data (supplier costs, internal notes) goes in its own table or is projected away by a
  `*_public` view. Never rely on the client to hide a column.
- Add or extend a pgTAP test in `supabase/tests/` for any new policy or invariant.

## Non-negotiable engineering rules

1. TypeScript strict mode. No `any` unless justified in a comment.
2. Supabase is the system of record. No parallel sources of truth.
3. **RLS is mandatory** on every table. Never trust the client to enforce authorization.
4. `SUPABASE_SERVICE_ROLE_KEY` never reaches browser or mobile code. Server/Edge only.
5. Stripe webhooks are authoritative for payment state. Never mark paid from a redirect.
6. Money is integer minor units + ISO currency code. Never floats.
7. Timestamps in UTC plus the event's IANA time zone. Display in the event's zone.
8. Validate all external/user input with Zod (schemas in `packages/validation`).
9. Business logic lives in service modules / database, not in UI components.
10. Schema changes only via `supabase/migrations`. Never edit a live database by hand.
11. Never expose supplier costs or internal notes to customers.
12. Webhooks and financial operations must be idempotent (`webhook_events` table).
13. Do not add a dependency, abstraction, REST layer, or server if the existing stack solves it.
14. Booking state and payment state are separate enums. Do not mix them.
15. Tours are versioned; trips get snapshots. Editing a tour must not mutate booked trips.
16. The itinerary is the core domain model. `free_time` is a first-class item type.
17. Tests are required for pricing, cancellation, state transitions, time zones, permissions.
18. Audit-log sensitive actions. Never log secrets, tokens, passport numbers, or card data.

## Feature workflow

Understand existing architecture → identify DB / RLS / shared types / service / web / mobile /
analytics / tests → migration → RLS → service layer → web → mobile → tests →
`pnpm check` → document (update docs or add an ADR).

## Definition of done

Types, Zod validation, RLS, loading/empty/error states, responsive, accessible (WCAG 2.2 AA),
analytics events where relevant, tests for business logic, audit logging if sensitive,
Sentry-safe error handling, docs updated.

## Brand quick reference

Colors: ink `#0B2025`, aqua `#60E1BB`, cyan `#17B1DF`, teal `#40B4BD`, sand `#DAD9D0`,
cloud `#F5F6F2`, white. Ratio ≈ 70% neutral / 20% ink / 10% accent. Fonts: Inter (UI/body),
Manrope (headings). Restrained, calm, premium, international. Not a SaaS, not a hostel.

Terminology: Your Trip, Your Route, Your Group, Live Moments, Explore, Recommendations,
Included, Optional, Your Next Stop. "Your Guide" = the digital itinerary, never a person.
