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

Observability variables (all optional; the features are no-ops when unset):

| Variable                                              | Where           | Purpose                                                           |
| ----------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`                              | web             | Enables Sentry on the browser, Node and Edge runtimes             |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`   | web (CI/Vercel) | Source-map upload at build time; skipped when the token is absent |
| `EXPO_PUBLIC_SENTRY_DSN`                              | mobile          | Enables `@sentry/react-native` (wraps the root layout)            |
| `NEXT_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_KEY` | web / mobile    | Product analytics (see docs/api.md, Analytics events)             |

Secrets live in Vercel project settings, Supabase project secrets (`supabase secrets set`) and
EAS secrets. Never in git.

Notification delivery (Edge Function secrets, `supabase secrets set …`):

| Secret                         | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `NOTIFY_DISPATCH_SECRET`       | Shared secret pg_cron sends as `x-cron-secret`; also stored in Vault       |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email channel (skipped, and recorded as skipped, when absent)              |
| `EXPO_ACCESS_TOKEN`            | Optional; Expo push security ("enhanced security" on the Expo project)     |
| `SITE_URL`                     | Base for links in notification emails (default https://guidelesstours.com) |
| `NOTIFY_DRY_RUN=1`             | Claims and records `skipped` without calling Expo or Resend                |

Vault entries the cron job needs (run once per environment in the SQL editor):

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-dispatch', 'notify_dispatch_url');
select vault.create_secret('<same value as NOTIFY_DISPATCH_SECRET>', 'notify_dispatch_secret');
```

Until both exist the minute job is a no-op and rows simply wait with `dispatched_at is null`.

## CI pipeline (`ci.yml`)

```
PR / push main
 ├── check:    pnpm install → format:check → lint → typecheck → test → build (web)
 ├── database: supabase start (migrations + seeds) → supabase db lint → supabase test db (pgTAP)
 └── e2e:      (after check) supabase start → next build against local Supabase → playwright test
```

End-to-end tests live in `apps/web/e2e/` (`pnpm --filter web test:e2e`). `playwright.config.ts`
does not build: it starts `next start -p 3100` from the existing `.next` output, so run
`pnpm --filter web build` first. Two projects run, desktop Chromium and a Pixel 7 emulation for
the marketing spec. Specs cover the marketing funnel (home, list filters, tour detail with
JSON-LD, 404, departure page, sitemap/robots, security headers) and the customer funnel (sign
up, wizard, payment step refused cleanly without Stripe, protected-route redirects).

Add when the corresponding code exists: Expo `eas build --profile preview` on release branches;
`supabase db push` and `supabase functions deploy` on `main` (guarded by the `production`
GitHub environment). Functions to deploy today: `social-publish`, `notify-dispatch`.

Local smoke test of the dispatcher (Docker edge runtime):

```bash
supabase functions serve notify-dispatch --no-verify-jwt --env-file <file with NOTIFY_DISPATCH_SECRET=…>
curl -X POST http://127.0.0.1:54321/functions/v1/notify-dispatch -H "x-cron-secret: …" -d '{}'
# → {"claimed":n,"push":{...},"email":{...}}; rows appear in notification_deliveries
```

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

## Payments locally (Stripe test mode)

1. Put `STRIPE_SECRET_KEY=sk_test_…` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` in
   `apps/web/.env.local`. Without them checkout stops at the payment step with a clear message and
   creates no booking or hold.
2. Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and copy the
   printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Pay with `4242 4242 4242 4242`. The webhook confirms the booking; `/account` and the
   confirmation page reflect it. Replaying the event (`stripe events resend <id>`) is a no-op
   thanks to `webhook_events`.
4. Emails: with no `RESEND_API_KEY` the booking-confirmed email is recorded in `email_events`
   as `skipped` and logged to the server console.

## Social publishing (per environment)

The `social-publish` Edge Function runs only where these exist (see docs/marketing.md):

```bash
supabase secrets set SOCIAL_PUBLISH_SECRET=<random-64-hex> SOCIAL_DRY_RUN=0   # staging: SOCIAL_DRY_RUN=1
supabase functions deploy social-publish
# in the SQL editor of that project:
select vault.create_secret('https://<ref>.supabase.co/functions/v1/social-publish', 'social_publish_url');
select vault.create_secret('<same random>', 'social_publish_secret');
insert into public.social_accounts (platform, external_id, username, access_token, token_expires_at)
values ('instagram', '<ig-user-id>', 'guidelesstravel', '<long-lived-token>', now() + interval '60 days');
```

Staging publishes nothing (dry run) but exercises claiming, so a broken queue shows up before prod.

## Observability

Sentry (web + mobile) for errors and performance; PostHog for product analytics; Vercel and
Supabase dashboards for infrastructure.

- **Web Sentry**: `instrumentation.ts` (server and edge init plus `onRequestError`),
  `instrumentation-client.ts` (browser init plus router transitions), `app/global-error.tsx`.
  Session Replay is off (sample rates 0); traces sampled at 10%. Everything passes through
  `lib/sentry-scrub.ts`.
- **Mobile Sentry**: initialised in `src/app/_layout.tsx` only when `EXPO_PUBLIC_SENTRY_DSN` is
  set; the root layout is wrapped with `Sentry.wrap` so navigation breadcrumbs and native crashes
  are captured. Add the `@sentry/react-native/expo` config plugin to `app.config.ts` (with
  `SENTRY_AUTH_TOKEN` in EAS secrets) when source-map upload is wanted.
- **Lighthouse (2026-09-06, mobile emulation, local production build, after the Milestone 7
  fixes)**: home 78 / 100 / 100 / 100, trips list 73 / 100 / 100 / 100, tour detail
  84 / 100 / 100 / 100, how-it-works 87 / 100 / 100 / 100 (performance / accessibility / best
  practices / SEO). Fixes: link and muted-text tokens darkened to clear WCAG AA contrast, card
  heading levels follow the page outline, image links carry their visible text in the accessible
  name, the mobile menu toggle is a real button, Zod runs jitless so the CSP reports no `eval`
  probe, and Manrope ships as one variable font file. LCP is the hero `h1` waiting on that web
  font under simulated slow 4G; remaining performance debt is unused JavaScript from the Sentry
  and PostHog client bundles (about 190 KiB).
