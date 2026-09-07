# Go-live runbook: guidelesstravel.com

_The domain is managed in Squarespace DNS; the code lives at github.com/Kcan2001/guideless. This is
the ordered list of what must exist before the first customer can book, and how deploys flow._

## 1. Branch model and CI/CD

```
feature/* ──PR──▶ develop ──(auto)──▶ staging   Supabase project + Vercel preview URL
                      │
                      └──PR──▶ production ──(auto)──▶ live  Supabase project + guidelesstravel.com
```

- **`develop`** is the default branch. Every PR runs `ci.yml` (format, lint, typecheck, unit tests,
  build, pgTAP on a fresh local Supabase, Playwright). Merging to `develop` runs `deploy.yml` against
  the **staging** GitHub environment.
- **`production`** deploys live. Only fast-forward it from `develop` via a PR; protect it in GitHub
  (Settings → Branches → add rule for `production`: require PR, require status checks `CI`, no
  force pushes, no deletions). Do the same for `develop` minus the PR requirement if you like.
- `deploy.yml` order: verify → **database** (`supabase db push`, `functions deploy`) → **web**
  (`vercel pull/build/deploy`, then a smoke test of `/`, `/tours`, `/sitemap.xml`). Steps skip
  themselves until their secrets exist, so the pipeline is safe to enable before every account is
  ready. Vercel's own Git integration is disabled (`apps/web/vercel.json`) so nothing deploys the
  web before the schema.
- **GitHub environments**: create `staging` and `production` (Settings → Environments). Put
  production-only secrets under `production` and add yourself as a required reviewer if you want a
  manual gate. Secrets per environment:

| Secret                          | Where it comes from                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`         | supabase.com → Account → Access Tokens (one token, both environments)                 |
| `SUPABASE_PROJECT_REF`          | Project → Settings → General (different per environment)                              |
| `SUPABASE_DB_PASSWORD`          | Project → Settings → Database                                                         |
| `VERCEL_TOKEN`                  | vercel.com → Account Settings → Tokens                                                |
| `VERCEL_ORG_ID`                 | `vercel link` in `apps/web` writes `.vercel/project.json` with both ids               |
| `VERCEL_PROJECT_ID`             | same                                                                                  |
| `VERCEL_PROTECTION_BYPASS`      | Optional; Vercel → Project → Deployment Protection → bypass token, for the smoke test |
| `SENTRY_AUTH_TOKEN/ORG/PROJECT` | Optional; enables source-map upload                                                   |

## 2. Accounts and one-time setup (in this order)

### 2.1 Supabase (two projects: `guideless-staging`, `guideless-prod`)

1. Create both projects (region close to customers: `eu-west` for France-based trips or
   `us-east` for a US customer base; pick one and keep it).
2. `supabase link --project-ref <prod>` then `supabase db push` once by hand, or let the first
   `production` deploy do it. Seeds are **not** pushed by `db push`; production starts empty and
   tours are created in `/admin`. (Staging: run the seed files by hand if you want demo data.)
3. Authentication → URL configuration: Site URL `https://guidelesstravel.com`, redirect URLs
   `https://guidelesstravel.com/**`, `https://*.vercel.app/**` (staging), `guideless://**` (app).
4. Authentication → SMTP: use Resend (host `smtp.resend.com`, port 465, user `resend`, password =
   API key, sender `Guideless Tours <hello@guidelesstravel.com>`) so auth emails come from the
   domain.
5. Edge Function secrets (`supabase secrets set --project-ref <ref> ...`): `NOTIFY_DISPATCH_SECRET`
   (random 32+ chars), `RESEND_API_KEY`, `EMAIL_FROM="Guideless Tours <hello@guidelesstravel.com>"`,
   `SITE_URL=https://guidelesstravel.com`, optional `EXPO_ACCESS_TOKEN`; plus the social publishing
   secrets in docs/marketing.md.
6. Vault (SQL editor, once per project):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-dispatch', 'notify_dispatch_url');
   select vault.create_secret('<NOTIFY_DISPATCH_SECRET>', 'notify_dispatch_secret');
   -- and social_publish_url / social_publish_secret (docs/marketing.md)
   ```
7. Grant the first admin: `insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '<you>';`
8. Storage buckets `trip-documents` and `support-attachments` exist from migrations; confirm they
   are private.

### 2.2 Vercel (one project: `guideless-web`)

1. Import `Kcan2001/guideless`, **Root Directory** `apps/web`, framework Next.js, Node 24. Because
   `vercel.json` disables Git deployments, deploys come only from GitHub Actions.
2. Environment variables (Production, and Preview for staging):

| Variable                                                                   | Production value                              |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                 | `https://<prod-ref>.supabase.co`              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                            | prod anon key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                                                | prod service role key (server only)           |
| `NEXT_PUBLIC_SITE_URL`                                                     | `https://guidelesstravel.com`                 |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                 | live keys (test keys on Preview)              |
| `STRIPE_WEBHOOK_SECRET`                                                    | from the webhook endpoint below               |
| `RESEND_API_KEY`, `EMAIL_FROM`                                             | `Guideless Tours <hello@guidelesstravel.com>` |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics (docs/marketing.md)                 |
| `NEXT_PUBLIC_SENTRY_DSN`                                                   | Sentry web project                            |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY`                                              | optional                                      |

3. Domains: add `guidelesstravel.com` (primary) and `www.guidelesstravel.com` (redirect to the
   apex). Vercel shows the records to add; they are the ones in §3.
4. `vercel link` locally in `apps/web` once to obtain `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` for
   GitHub secrets. Create a token for `VERCEL_TOKEN`.

### 2.3 Stripe

1. Activate the account; set the statement descriptor to `GUIDELESS`.
2. Webhook endpoint `https://guidelesstravel.com/api/webhooks/stripe` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `checkout.session.async_payment_failed`,
   `payment_intent.payment_failed`, `charge.refunded`. Copy the signing secret to
   `STRIPE_WEBHOOK_SECRET`. Repeat with test keys for the staging preview URL.
3. Checkout branding: logo, ink `#0B2025`, aqua `#60E1BB`.

### 2.4 Resend

Add the domain `guidelesstravel.com`; Resend gives DNS records (see §3). Verify, then create the
API key used by Vercel and the Edge Function.

### 2.5 Sentry, PostHog, GA4

Create the web and mobile Sentry projects (DSNs into Vercel / EAS), the PostHog project and the
GA4 property (docs/marketing.md has the GA4/PostHog steps already done for the marketing work).

### 2.6 Expo / EAS (app)

`docs/mobile.md` → "First device build": `eas login`, `eas init`, fill `eas.json` env values with
the **production** Supabase URL/anon key and `EXPO_PUBLIC_SITE_URL=https://guidelesstravel.com`,
`eas build --profile production`, then `eas submit`. Deep links use `guideless://`; add
`https://guidelesstravel.com` as an associated domain later for universal links.

## 3. DNS records in Squarespace

Squarespace → Domains → guidelesstravel.com → DNS Settings. Delete the default Squarespace
website records for `@` and `www` (the four `A` records to 198.185.159.x / 198.49.23.x and the
`www` CNAME to `ext-cust.squarespace.com`) unless you still host a Squarespace site there; a
domain can only point one way.

| Type  | Host                        | Value                                                    | Purpose                                                                     |
| ----- | --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| A     | `@`                         | `76.76.21.21`                                            | Vercel apex (confirm in Vercel → Domains)                                   |
| CNAME | `www`                       | `cname.vercel-dns.com`                                   | Vercel www → redirects to apex                                              |
| TXT   | `_vercel`                   | value shown by Vercel                                    | Only if Vercel asks to verify ownership                                     |
| TXT   | `resend._domainkey`         | DKIM value from Resend                                   | Email signing                                                               |
| MX    | `send` (or as Resend shows) | `feedback-smtp.<region>.amazonses.com`, priority 10      | Resend bounce handling                                                      |
| TXT   | `send`                      | `v=spf1 include:amazonses.com ~all`                      | SPF for Resend                                                              |
| TXT   | `_dmarc`                    | `v=DMARC1; p=none; rua=mailto:hello@guidelesstravel.com` | DMARC (tighten to `quarantine` later)                                       |
| MX    | `@`                         | your mailbox provider                                    | Receiving mail at hello@ (Google Workspace, Fastmail, or Squarespace email) |

`guidelesstours.com` is also owned and should 301-redirect to `guidelesstravel.com` (Squarespace
→ Domains → Forwarding, or add it as a redirect domain in Vercel). The app's bundle identifier stays
`com.guidelesstours.app`; it is an identifier already registered with Firebase, not a URL.

Propagation is minutes to an hour. Vercel issues the TLS certificate automatically once the A/CNAME
resolve. Keep Squarespace as the registrar and DNS host; nothing needs to transfer.

## 4. First production release, step by step

1. Create the GitHub environments and secrets from §1 (Supabase and Vercel at minimum).
2. Set `develop` as the default branch and protect `production` (GitHub → Settings).
3. Merge a PR from `develop` into `production`. Watch **Actions → Deploy**: database pushes 33
   migrations, both Edge Functions deploy, Vercel builds and deploys, smoke test returns 200s.
4. Add the DNS records (§3) and the domains in Vercel; wait for the certificate.
5. Sign up on the live site, grant yourself `admin`, create the first tour, version, departure,
   stay options and add-ons in `/admin`, publish.
6. Test a real booking with a 100% coupon or a $1 test departure, confirm the webhook marks it
   paid, the confirmation email arrives from `hello@guidelesstravel.com`, and the notification
   dispatcher delivers (Vault secrets set).
7. Switch Stripe to live keys in Vercel when ready to take money.

## 5. What is intentionally not automated yet

- Mobile builds (`eas build` needs an interactive login the first time; add `EXPO_TOKEN` and an
  `eas build --non-interactive` job later).
- Seeding production (tours are authored in admin).
- Rollbacks: Vercel keeps every deployment (promote a previous one in the dashboard); database
  migrations are forward-only, so write a new migration to undo.
