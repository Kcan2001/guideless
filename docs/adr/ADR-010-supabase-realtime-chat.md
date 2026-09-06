# ADR-010 — Supabase Realtime for group chat

**Status:** Accepted
**Date:** 2026-09-06

## Context

Each departure group needs a private chat (Trip Group, Announcements, Optional Activities) that
works before, during and after the trip, supports moderation, and must respect the same access
rules as everything else (members only, removed members lose access, staff can moderate).

## Decision

Messages are rows in Postgres (`messages`, `chat_rooms`, `chat_members`) protected by RLS.
Clients subscribe to Supabase Realtime (Postgres Changes) filtered by room; Realtime honors RLS so
a subscriber receives only rows they may read. Sends are plain inserts (or a small RPC for
attachments). Presence and typing indicators use Realtime broadcast/presence channels keyed by
room. Push notifications for new messages are fanned out by a database trigger → Edge Function.

## Consequences

- Chat history, moderation (`deleted_at`, reports, blocks) and audit are ordinary SQL — no second
  system of record (ADR-005).
- Membership revocation is immediate because the policy is evaluated per row.
- Feature parity with dedicated chat SaaS (read receipts, threads, rich media) is ours to build;
  MVP scope is text + photos + reactions, which is enough for small groups.
- Realtime connection limits are generous for our group sizes; revisit if departures scale to
  hundreds of concurrent trips.

## Alternatives considered

- **Stream / Sendbird / Twilio Conversations** — excellent products, but a second identity model,
  a second permission system and a monthly cost that scales with MAU before we have revenue.
- **Custom WebSocket server** — the server fleet we chose not to run (ADR-002).
- **Polling** — poor UX during a trip; unnecessary given Realtime is included.
