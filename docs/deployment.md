# Deployment and environments

Derived from the master spec §68–69, §113.

## Targets

| Component                                  | Platform       | Trigger                                                                            |
| ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `apps/web`                                 | Vercel         | PR → preview deploy · `main` → production                                          |
| Database / Auth / Storage / Edge Functions | Supabase       | Migrations applied by CI via Supabase CLI on `main`; Edge Functions deployed by CI |
| `apps/mobile`                              | Expo EAS       | EAS Build for store binaries; EAS Update for OTA JS                                |
| CI                                         | GitHub Actions | `.github/workflows/ci.yml`                                                         |

## Environments

| Env         | Supabase                        | Stripe    | Email                          | Analytics          |
| ----------- | ------------------------------- | --------- | ------------------------------ | ------------------ |
| development | local (`pnpm db:start`, Docker) | test mode | Resend test / Inbucket (local) | disabled           |
| staging     | staging project                 | test mode | Resend (staging domain)        | staging GA/PostHog |
| production  | production project              | live mode | Resend                         | production         |

Production customer data is never copied to development or staging.

## Environment variables

See [`.env.example`](../.env.example). Web reads `NEXT_PUBLIC_*` (public) and unprefixed
server secrets; mobile reads `EXPO_PUBLIC_*` only — it must never hold a secret.
`apps/web/lib/env.ts` validates variables with Zod at startup.

Secrets live in Vercel project settings, Supabase project secrets (`supabase secrets set`) and
EAS secrets. Never in git.

## CI pipeline (`ci.yml`)

```
PR / push main
 ├── check:    pnpm install → format:check → lint → typecheck → test → build (web)
 └── database: supabase db start (applies migrations) → supabase db lint
```

Add when the corresponding code exists: Playwright E2E against the Vercel preview; Expo
`eas build --profile preview` on release branches; `supabase db push` and
`supabase functions deploy` on `main` (guarded by the `production` GitHub environment).

## Release flow

1. Feature branch → PR. CI green + review required.
2. Merge to `main` → Vercel production deploy, migrations pushed, Edge Functions deployed.
3. Mobile: JS-only changes ship via `eas update --branch production`; native changes require an
   `eas build` + store submission. Keep `runtimeVersion` policy `appVersion`.

## Migrations

`pnpm db:migration <name>` creates `supabase/migrations/<timestamp>_<name>.sql`. Migrations are
forward-only and reviewed like code. Never edit a live database by hand. After a migration run
`pnpm db:types` and commit the regenerated `packages/types/src/database.ts`.

## Local development

```bash
nvm use               # Node 24 (.nvmrc)
pnpm install
pnpm db:start         # Postgres :54322 · API :54321 · Studio :54323 · Inbucket :54324
pnpm dev:web          # http://localhost:3000
pnpm dev:mobile       # Expo dev server; scan QR with Expo Go or a dev build
```

## Observability

Sentry (web + mobile) for errors and performance; PostHog for product analytics; Vercel and
Supabase dashboards for infrastructure. Operational metrics to expose in admin: booking success
rate, payment failure rate, support response time, trip issue count, supplier confirmation rate,
push delivery rate.
