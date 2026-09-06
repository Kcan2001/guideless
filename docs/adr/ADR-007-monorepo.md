# ADR-007 — pnpm + Turborepo monorepo

**Status:** Accepted
**Date:** 2026-09-06

## Context

Web (Next.js), mobile (Expo), Supabase migrations/functions and shared domain code must stay in
lock-step: the same enums, the same Zod schemas, the same design tokens, the same generated
database types. Separate repositories drift within weeks.

## Decision

One repository with pnpm workspaces and Turborepo: `apps/web`, `apps/mobile`, `packages/*`,
`supabase/`, `docs/`. Shared packages ship TypeScript source (no build step); Next.js compiles
them via `transpilePackages`, Metro via workspace symlinks with `nodeLinker: hoisted`.
Turbo runs `lint`, `typecheck`, `test`, `build` with caching; CI runs `pnpm check`.

## Consequences

- A migration, its generated types, the Zod schema, the web UI and the mobile UI land in one PR.
- Hoisted node_modules keeps React Native/Metro happy at the cost of pnpm's strictest isolation.
- Node ≥ 22.13 required (React Native 0.86 and Supabase JS engines); `.nvmrc` pins 24.
- `packages/ui` is deferred until a second consumer needs shared React components; premature
  extraction is a known trap.

## Alternatives considered

- **Polyrepo with published packages** — versioning overhead and drift for a team of one to three.
- **Nx** — more machinery than needed; Turborepo's task graph is sufficient.
- **npm/yarn workspaces** — workable; pnpm chosen for speed and disk efficiency.
