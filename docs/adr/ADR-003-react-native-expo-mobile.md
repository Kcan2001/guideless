# ADR-003 — React Native + Expo for the mobile app

**Status:** Accepted
**Date:** 2026-09-06

## Context

The mobile app is the primary trip experience: itinerary, maps, group chat, live moments, push,
support, offline access. It must ship to iOS and Android from a small TypeScript team that also
owns the Next.js web app.

## Decision

Build the app with React Native on Expo (managed workflow, Expo Router, EAS Build/Update).
Share domain types, validation and design tokens with web through the monorepo packages.
Use Supabase Auth/Realtime directly from the app with the anon key; business logic sits in a
small service layer under `src/lib/`.

## Consequences

- One language and one mental model across web and mobile; shared `@guideless/*` packages
  prevent drift in enums, schemas and tokens.
- EAS Update lets us ship JS fixes to travelers mid-trip without a store review.
- Expo modules cover push, maps, location, secure storage, SQLite for offline cache.
- Native-module edge cases require `expo prebuild` / dev builds rather than Expo Go.
- Metro + pnpm needs `nodeLinker: hoisted` in the workspace; accepted.

## Alternatives considered

- **Native Swift + Kotlin** — two codebases, two skill sets; too slow for the team size.
- **Flutter** — good product, but no code sharing with the Next.js web app or Zod schemas.
- **PWA only** — push, offline, maps and background behaviors are materially worse on iOS.
