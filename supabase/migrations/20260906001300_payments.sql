-- 013_payments
-- Mirrors of Stripe objects plus the idempotency ledger. Rows here change ONLY from the Stripe
-- webhook handler (service role). Card data never touches this database.

create table public.payments (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references public.bookings (id) on delete restrict,
  kind                        text not null check (kind in ('deposit', 'balance', 'full', 'add_on')),
  amount                      bigint not null check (amount > 0),
  currency                    public.currency_code not null,
  stripe_payment_intent_id    text unique,
  stripe_checkout_session_id  text,
  stripe_charge_id            text,
  stripe_status               text not null default 'requires_payment_method',
  receipt_url                 text,
  failure_code                text,
  failure_message             text,
  paid_at                     timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id) on delete restrict,
  payment_id         uuid references public.payments (id) on delete set null,
  amount             bigint not null check (amount > 0),
  currency           public.currency_code not null,
  reason             text,
  stripe_refund_id   text unique,
  stripe_status      text not null default 'pending',
  requested_by       uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index refunds_booking_idx on public.refunds (booking_id);
create trigger refunds_set_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- Idempotency ledger for every inbound webhook (Stripe today, suppliers later).
create table public.webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,
  event_id       text not null,
  event_type     text not null,
  status         public.webhook_event_status not null default 'received',
  payload_hash   text not null,
  payload        jsonb,
  error          text,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  unique (provider, event_id)
);
create index webhook_events_status_idx on public.webhook_events (status, received_at);

-- ── RLS ── customers read their own payments/refunds; nobody writes except service_role.
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;

create policy "customers read their payments" on public.payments
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = payments.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))));

create policy "customers read their refunds" on public.refunds
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = refunds.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))));

-- Finance may record a refund request row; Stripe state still arrives via webhook.
create policy "finance requests refunds" on public.refunds
  for insert to authenticated
  with check ((select public.has_any_role(array['finance', 'admin', 'super_admin']::public.app_role[]))
              and requested_by = (select auth.uid()));

create policy "admins read webhook events" on public.webhook_events
  for select to authenticated using ((select public.is_admin()));
-- No insert/update policies: service_role only.
