# Guideless Tours

**Travel organized. Explore independently.**

Guideless Tours is a minimal-intervention travel company. We organize hotels, trains,
transfers, selected experiences and a small group. There is no tour guide; the itinerary
lives on your phone.

This monorepo contains the public/booking website, the admin platform, the mobile trip
companion, and the Supabase backend.

## Structure

```
apps/web         Next.js — marketing, booking, customer account, /admin
apps/mobile      Expo / React Native — trip companion
packages/*       Shared types, validation, design tokens, utils
supabase/        Migrations, seed data, Edge Functions
docs/            Architecture, product, database, security, design system, ADRs
```

## Getting started

Prerequisites: Node 20+, pnpm 10, Docker (for local Supabase).

```bash
pnpm install
cp .env.example apps/web/.env.local     # fill in values
cp .env.example apps/mobile/.env
pnpm db:start                           # local Supabase on :54321, Studio on :54323
pnpm dev:web                            # http://localhost:3000
pnpm dev:mobile                         # Expo dev server
```

Run `pnpm check` (lint, typecheck, test, build) before opening a pull request.

## Documentation

Start with [`docs/guideless_tours_architecture.md`](docs/guideless_tours_architecture.md),
the master specification. Topic docs and decision records are in [`docs/`](docs/).
Engineering rules for AI-assisted work are in [`CLAUDE.md`](CLAUDE.md).
