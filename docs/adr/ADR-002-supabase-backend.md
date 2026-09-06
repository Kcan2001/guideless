# ADR-002 — Supabase as the backend platform

**Status:** Accepted
**Date:** 2026-09-06

## Context

Guideless needs Postgres, authentication, file storage, realtime chat, background functions and
scheduled jobs — but does not want to operate a server fleet. The founder's preference is
"something light, not an entire server".

## Decision

Use Supabase for PostgreSQL, Auth, Row Level Security, Storage, Realtime and Edge Functions.
Scheduled work uses pg_cron / Supabase cron invoking Edge Functions. Local development runs the
Supabase CLI stack in Docker; migrations live in `supabase/migrations` and are applied by CI.

## Consequences

- Zero servers to patch. Auth, storage and realtime are solved problems on day one.
- RLS becomes the natural (and mandatory) authorization layer — see ADR-006.
- Privileged logic lives in Edge Functions (Deno) or Next.js Server Actions, not a custom API.
- Vendor coupling is real but bounded: everything is standard Postgres + JWT auth, and the schema
  is portable. Realtime and Storage would need replacement if we ever left.
- Team must learn Postgres well (policies, functions, constraints). That is a feature.

## Alternatives considered

- **Firebase** — NoSQL is a poor fit for a relational booking/itinerary domain; weaker SQL, no RLS.
- **Custom Node/NestJS API + managed Postgres** — flexible but recreates auth, storage,
  realtime and hosting; explicitly rejected by the master spec (§93).
- **PlanetScale / Neon + Clerk + Pusher + S3** — four vendors to integrate instead of one.
