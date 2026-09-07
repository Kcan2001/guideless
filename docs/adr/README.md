# Architecture Decision Records

One file per decision, numbered, never deleted. Superseded ADRs get `Status: Superseded by ADR-0xx`.

| ADR                                                | Decision                                         | Status   |
| -------------------------------------------------- | ------------------------------------------------ | -------- |
| [ADR-001](./ADR-001-nextjs-for-web.md)             | Next.js (App Router) for web + admin             | Accepted |
| [ADR-002](./ADR-002-supabase-backend.md)           | Supabase as the backend platform                 | Accepted |
| [ADR-003](./ADR-003-react-native-expo-mobile.md)   | React Native + Expo for mobile                   | Accepted |
| [ADR-004](./ADR-004-stripe-payments.md)            | Stripe for payments; webhooks authoritative      | Accepted |
| [ADR-005](./ADR-005-postgres-system-of-record.md)  | PostgreSQL is the single system of record        | Accepted |
| [ADR-006](./ADR-006-rls-authorization.md)          | Row Level Security is the authorization boundary | Accepted |
| [ADR-007](./ADR-007-monorepo.md)                   | pnpm + Turborepo monorepo                        | Accepted |
| [ADR-008](./ADR-008-tour-versioning.md)            | Tours are versioned                              | Accepted |
| [ADR-009](./ADR-009-trip-snapshots.md)             | Departures snapshot into trips                   | Accepted |
| [ADR-010](./ADR-010-supabase-realtime-chat.md)     | Supabase Realtime for group chat                 | Accepted |
| [ADR-011](./ADR-011-social-publishing-in-house.md) | Social publishing via Meta Graph API + pg_cron   | Accepted |

## Template

```markdown
# ADR-0xx — Title

**Status:** Proposed | Accepted | Superseded by ADR-0yy
**Date:** YYYY-MM-DD

## Context

## Decision

## Consequences

## Alternatives considered
```
