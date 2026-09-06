# ADR-001 — Next.js (App Router) for the web application and admin

**Status:** Accepted
**Date:** 2026-09-06

## Context

The web surface has three jobs with different needs: SEO-critical marketing and tour pages,
an authenticated booking/account experience, and an internal admin/operations platform. The team
is small and wants one deployable, one framework, one design system.

## Decision

Use Next.js with the App Router and TypeScript for all three, hosted on Vercel. Marketing and
tour pages are server-rendered/statically generated for SEO and Core Web Vitals. Admin lives
under `/admin` in the same app, gated by role. Data access uses Server Components and Server
Actions talking to Supabase; no separate REST layer.

## Consequences

- One codebase, one deploy, shared components and tokens across marketing, customer and admin.
- Server Actions give us privileged server code without standing up an API server.
- Admin traffic and public traffic share a deployment; if admin complexity grows, it can be split
  into its own app in the monorepo without changing the data layer.
- We accept Vercel + Next.js coupling in exchange for speed.

## Alternatives considered

- **Remix / SvelteKit / Nuxt** — capable, but smaller ecosystem for shadcn/ui, Supabase SSR
  helpers and Stripe examples; less familiar to future contributors.
- **Separate admin SPA** — explicitly rejected for v1 by the master spec (§2C, §93).
- **Static site + separate API** — more infrastructure for no gain at this scale.
