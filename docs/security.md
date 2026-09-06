# Security

Derived from the master spec §8, §41–44, §63–64, §72, §77–79, §108–112.

## The boundary is the database

Row Level Security on every table is the authorization system. Frontend role checks are UX,
never security. Every migration that creates a table enables RLS and adds policies in the same
file. A table with RLS enabled and no policies is inaccessible — that is the safe default.

### Core policy patterns

```sql
-- A customer sees a trip only if they are a member.
create policy "trip members read their trip" on public.trips
  for select to authenticated
  using (exists (
    select 1 from public.trip_members m
    where m.trip_id = trips.id and m.user_id = auth.uid()
  ));

-- Chat: room members only.
create policy "room members read messages" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_members cm
    where cm.room_id = messages.room_id and cm.user_id = auth.uid() and cm.removed_at is null
  ));

-- Staff-only tables (trip_notes, supplier costs) use a role helper.
create policy "staff read notes" on public.trip_notes
  for select to authenticated
  using (public.has_any_role(array['trip_staff','support','admin','super_admin']));
```

`has_any_role()` is a `security definer` SQL function reading `user_roles`; it is stable and cheap.
Supplier cost columns live in `supplier_services` which has **no customer policy at all**;
customer-facing itinerary views never join it.

### Customers can never

Read another customer's booking · read staff notes · read supplier costs · modify payments ·
modify itinerary · modify other travelers · read admin data · read a chat room they are not in.
Removing a member (`chat_members.removed_at`) revokes access immediately.

## Keys

| Key                            | Where it may exist                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anon key                       | Browser, mobile, server — always subject to RLS                                                                                                                                                                       |
| Service role key               | Server Actions / Route Handlers / Edge Functions only. **Never** `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, or bundled into a client. `apps/web/lib/supabase/server.ts` → `createServiceRoleClient()` is the only entry point. |
| Stripe secret + webhook secret | Server only                                                                                                                                                                                                           |

## Authentication

- Customers: Google OAuth, email magic link, optional password. Sessions refreshed by `apps/web/proxy.ts`.
- Staff/admin: email + **MFA required** (Supabase Auth MFA), shorter session lifetime, `/admin` layout verifies role server-side on every request.
- Auth callbacks and deep links: web `/auth/callback`; mobile `guideless://auth/callback`.

## Payments

Stripe holds card data; we store Stripe ids and business state. Booking/payment state changes
happen only in the webhook handler, after signature verification, inside an idempotent
transaction keyed on `webhook_events (provider, event_id)`. A browser returning from Stripe never
marks anything paid.

## Input, uploads, rate limits

- All external input validated with Zod from `@guideless/validation` before it reaches the DB.
- Uploads: max size, MIME allow-list, randomized object names, private buckets, signed URLs,
  DB metadata row per file. Never trust the extension. Malware scanning as scale requires.
- Rate limit login, password reset, support creation, chat sends, contact form, booking attempts,
  coupon validation. Early scale: Supabase Auth limits + simple per-user counters in Postgres or
  Vercel edge middleware.

## HTTP hardening

`next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`. Add a CSP once third-party script needs (GA4, PostHog, Stripe, Maps) are
finalized. Server Actions carry Next.js CSRF protection; Route Handlers that mutate must check
origin or a signed token.

## Audit logging

`audit_logs (actor_id, action audit_action, entity_type, entity_id, metadata jsonb, ip, created_at)`
for: booking_created, booking_cancelled, refund_created, payment_updated, traveler_added,
traveler_removed, itinerary_changed, supplier_changed, admin_login, role_changed,
support_assignment, message_deleted. Insert-only; no update/delete policies for anyone but
`service_role`.

## Privacy

- Other travelers see only the public profile fields a traveler has opted into. Email, phone,
  DOB, passport, payment details are never exposed to peers.
- Moderation: report message/user, block user (hides their messages for the blocker), staff
  remove/suspend, all audited.
- Account deletion: verify → anonymize personal fields → retain legally required financial rows
  → disable auth user.

## Never log

Passwords, access tokens, Stripe secrets, card data, passport numbers, sensitive personal
information. Log ids and diagnostic metadata. Sentry scrubbing rules must be configured before
production traffic.

## Environments

Development uses local Supabase + Stripe test mode + test email. Staging mirrors production with
test keys. Production customer data never leaves production.
