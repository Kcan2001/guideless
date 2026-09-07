# Guideless Tours

**Travel organized. Explore independently.**

Guideless Tours is a minimal-intervention travel company. We book the hotels, the trains, the
transfers and a welcome evening for a small group. There is no tour guide; your route lives on
your phone, everything beyond the basics is optional, and you can see who else is going.

This monorepo contains the public and booking website, the admin platform, the mobile trip
companion, and the Supabase backend.

## What's here

| Surface         | Path                 | Highlights                                                                                                                                                 |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website         | `apps/web` (Next.js) | Tours and event weekends, departure pages with roster stats, checkout with rooms, stay tiers, add-ons and a live quote, account, `/host`, `/meetups`       |
| Admin           | `apps/web/app/admin` | Tours and versions, departures, stay options and add-ons with manifests, bookings, travelers, live itinerary, Live Moments, hosts, meetups, social queue   |
| Mobile app      | `apps/mobile` (Expo) | Your Trip, Map, Explore, Group (chat, Live Moments, welcome RSVP), Support, documents, notification inbox, add-ons with who's going                        |
| Backend         | `supabase/`          | Postgres with RLS on every table, pricing in `quote_booking()`, Stripe webhook, notification dispatcher and social publishing Edge Functions, pg_cron jobs |
| Shared packages | `packages/*`         | Types (generated from the database), Zod validation, design tokens and brand copy, money and time-zone utils                                               |

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), pnpm 10, Docker (for local Supabase).

```bash
pnpm install
cp .env.example apps/web/.env.local     # fill in values (local Supabase URL and keys)
cp .env.example apps/mobile/.env
pnpm db:start                           # local Supabase on :54321, Studio on :54323
pnpm dev:web                            # http://localhost:3000
pnpm dev:mobile                         # Expo dev server
```

Grant yourself staff access locally, then open `/admin`:

```sql
insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
```

## Everyday commands

```bash
pnpm check                    # lint + typecheck + test + build — run before finishing any task
pnpm db:reset                 # re-apply migrations and seeds (Southern France, Monaco GP, meetups)
pnpm db:test                  # pgTAP suites: RLS, booking RPC, notifications, pricing and community
pnpm db:types                 # regenerate packages/types/src/database.ts after a migration — commit it
pnpm --filter web build && pnpm --filter web test:e2e   # Playwright against local Supabase
pnpm --filter mobile test     # Jest
node scripts/mobile-assets.mjs           # regenerate app icons and splash from the brand logo
supabase functions serve notify-dispatch # run an Edge Function locally (Docker)
```

## Documentation

Start with [`docs/guideless_tours_architecture.md`](docs/guideless_tours_architecture.md), the
master specification, and [`docs/roadmap.md`](docs/roadmap.md) for where the product is going.

| Doc                                              | What it covers                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| [`docs/product.md`](docs/product.md)             | Users, surfaces, language, north-star metric                         |
| [`docs/pricing.md`](docs/pricing.md)             | Rooms, stay tiers, add-ons, codes and credit; `quote_booking()`      |
| [`docs/database.md`](docs/database.md)           | Schema, migration and RLS conventions                                |
| [`docs/api.md`](docs/api.md)                     | Data access patterns, checkout, webhooks, notifications, deep links  |
| [`docs/admin.md`](docs/admin.md)                 | Admin screens and conventions                                        |
| [`docs/mobile.md`](docs/mobile.md)               | App structure, behaviour, store assets, first EAS build              |
| [`docs/growth.md`](docs/growth.md)               | Host program, meetups, referrals, roster stats, event-anchored tours |
| [`docs/marketing.md`](docs/marketing.md)         | Instagram pipeline, GA4 consent mode, PostHog                        |
| [`docs/security.md`](docs/security.md)           | RLS model, headers and CSP, review findings                          |
| [`docs/deployment.md`](docs/deployment.md)       | Environments, variables and secrets, CI, observability               |
| [`docs/design-system.md`](docs/design-system.md) | Colors, type, components                                             |
| [`docs/adr/`](docs/adr/)                         | Decision records                                                     |

Engineering rules for AI-assisted work are in [`CLAUDE.md`](CLAUDE.md).
