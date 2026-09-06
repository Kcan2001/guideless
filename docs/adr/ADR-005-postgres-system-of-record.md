# ADR-005 — PostgreSQL is the single system of record

**Status:** Accepted
**Date:** 2026-09-06

## Context

Booking, payment, itinerary, chat, identity and document metadata could each drift into their own
store (Stripe as payment truth, a CMS as content truth, a chat SaaS as message truth). Parallel
sources of truth are the classic way small platforms become unmaintainable.

## Decision

All business state lives in Supabase Postgres. External systems are synchronized _into_ Postgres
(Stripe via webhooks, supplier confirmations via staff entry or adapters) and never read as truth
at request time. Business invariants (uniqueness, enums, capacity, cancellation tiers) are
enforced with constraints, functions and transactions in the database.

## Consequences

- One place to query, back up, audit and secure (RLS).
- Inventory and booking creation run in a single transaction (`create_booking()`), preventing
  overbooking without application-level locks.
- Enum values in `@guideless/types` must mirror Postgres enum types exactly; generated
  `database.ts` keeps the compiler honest.
- Reporting/analytics can read Postgres directly; product analytics (PostHog) and marketing
  analytics (GA4) remain separate, non-authoritative tools.

## Alternatives considered

- **Stripe as payment truth** — would make refunds/reporting depend on API calls and rate limits.
- **External CMS for tours** — rejected for MVP; structured content in Postgres with an admin UI.
- **Event-sourced architecture** — powerful but disproportionate for the team and stage.
