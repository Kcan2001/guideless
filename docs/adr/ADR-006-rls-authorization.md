# ADR-006 — Row Level Security is the authorization boundary

**Status:** Accepted
**Date:** 2026-09-06

## Context

Web, mobile and (later) integrations all talk to the same database. Customers must never see
another customer's booking, staff notes, supplier costs or a chat room they are not in. Enforcing
that in three clients and a set of server actions independently is error-prone.

## Decision

Every table has RLS enabled in the migration that creates it, with policies in the same file.
Policies pivot on `auth.uid()`, `trip_members`, `chat_members` and a `has_any_role()` helper over
`user_roles`. Client code (web, mobile) uses the anon key and inherits these policies. The service
role key is used only in trusted server code for explicitly privileged workflows and is never
shipped to a client. Frontend role checks exist for UX only.

## Consequences

- A bug in UI or a forgotten check in a Server Action cannot leak data; the database refuses.
- Staff-only data (supplier costs, internal notes) is modeled as separate tables/columns with
  no customer policy, not filtered in application code.
- Permission tests run against a local Supabase instance as different users (master spec §71).
- Some queries need `security definer` functions or views to stay fast; policies must be indexed.
- Developers must understand Postgres policies; onboarding covers this first.

## Alternatives considered

- **Application-layer authorization only** — every client re-implements it; one miss is a breach.
- **API gateway enforcing auth** — requires the REST layer we chose not to build.
- **Separate databases per tenant** — Guideless is single-tenant; unnecessary.
