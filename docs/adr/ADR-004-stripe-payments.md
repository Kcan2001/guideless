# ADR-004 — Stripe for payments; webhooks are authoritative

**Status:** Accepted
**Date:** 2026-09-06

## Context

Bookings involve deposits, remaining balances, refunds by data-driven cancellation tiers,
multiple currencies and receipts. Card data must never touch our database (PCI scope).

## Decision

Use Stripe Checkout (hosted) for MVP payments, Stripe for refunds and receipts, and store only
Stripe ids plus business state in Postgres. Payment and booking state change **only** in the
Stripe webhook handler, after signature verification, inside an idempotent transaction keyed on
`webhook_events (provider, event_id)`. The browser returning from Stripe never marks anything paid.
Money is stored as integer minor units with an ISO currency code.

## Consequences

- PCI scope stays at SAQ-A; no card data in our systems or logs.
- Duplicate or replayed webhooks are harmless; a missed redirect is harmless because the webhook
  still lands.
- Deposits/balances map to multiple PaymentIntents against one booking; `payment_status` is
  separate from `booking_status`.
- Stripe Elements can replace Checkout later for a fully in-brand flow without touching the
  webhook contract.

## Alternatives considered

- **Adyen / Braintree** — comparable, heavier integration for a small team; fewer examples with
  Next.js/Supabase.
- **Trusting the success redirect** — race-prone and spoofable; rejected.
- **Custom payment processor** — rejected by the master spec (§93).
