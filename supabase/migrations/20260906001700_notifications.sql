-- 017_notifications
-- In-app notification inbox, per-user channel preferences, Expo push tokens, and the email ledger.
-- Fan-out (push/email) is done by trusted code via notificationService; clients only read.

create table public.notification_preferences (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  -- Operational notifications are always delivered by push during a trip (spec §27).
  operational_email   boolean not null default true,
  social_push         boolean not null default true,
  social_email        boolean not null default false,
  marketing_push      boolean not null default false,
  marketing_email     boolean not null default false,
  quiet_hours_start   time,
  quiet_hours_end     time,
  updated_at          timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    public.notification_category not null,
  type        text not null,                     -- e.g. train_departure, new_message, itinerary_change
  title       text not null,
  body        text,
  deep_link   jsonb,                             -- DeepLink shape from @guideless/types
  trip_id     uuid references public.trips (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token         text not null unique,            -- ExponentPushToken[...]
  platform      text not null check (platform in ('ios', 'android', 'web')),
  device_name   text,
  app_version   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.email_events (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users (id) on delete set null,
  template              text not null,           -- booking-confirmed, payment-reminder, …
  recipient             text not null,
  provider              text not null default 'resend',
  provider_message_id   text,
  status                text not null default 'queued',
  payload               jsonb,
  error                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index email_events_user_idx on public.email_events (user_id, created_at desc);
create trigger email_events_set_updated_at before update on public.email_events
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.email_events enable row level security;

create policy "users manage their notification preferences" on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "users read their notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users mark notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete their notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
-- Inserts: service_role (notificationService) only.

create policy "users manage their push tokens" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "support reads email events" on public.email_events
  for select to authenticated
  using ((select public.has_any_role(array['support', 'admin', 'super_admin']::public.app_role[])));
