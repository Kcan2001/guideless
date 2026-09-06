-- 028_notification_delivery
-- Delivery of `notifications` rows by push (Expo) and email (Resend), plus the lifecycle events
-- that create them without any application code (spec §65–66, §85):
--
--   notifications.dispatched_at / dedupe_key   claim + idempotent enqueue
--   notification_deliveries                    one row per (notification, channel) attempt
--   push_tokens.disabled_at                    Expo said DeviceNotRegistered
--   claim_pending_notifications(limit)         service_role only; used by the notify-dispatch Edge Function
--   notify_trip_members(..., p_dedupe_prefix)  now idempotent per member when a prefix is given
--   support_messages_notify                    staff reply → operational notification to the customer
--   enqueue_payment_reminders()                balance due in 14 / 3 days, or 1 day overdue
--   enqueue_trip_reminders()                   T-30 / T-7 / T-1 / start / completed, plus trip status automation
--   cron: dispatch every minute (pg_net → Edge Function), lifecycle enqueue daily 06:15 UTC

-- ── Columns ──────────────────────────────────────────────────────────────────
alter table public.notifications
  add column dispatched_at timestamptz,
  add column dedupe_key    text;
create unique index notifications_dedupe_key_idx on public.notifications (dedupe_key) where dedupe_key is not null;
create index notifications_pending_idx on public.notifications (created_at) where dispatched_at is null;

alter table public.push_tokens add column disabled_at timestamptz;

-- ── Deliveries ───────────────────────────────────────────────────────────────
create table public.notification_deliveries (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references public.notifications (id) on delete cascade,
  channel          public.notification_channel not null,
  status           text not null check (status in ('sent', 'skipped', 'failed')),
  provider_id      text,                       -- Expo ticket id / Resend message id
  detail           text,                       -- skip reason or provider error (never message content)
  attempted_at     timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_status_idx on public.notification_deliveries (status, attempted_at desc);

alter table public.notification_deliveries enable row level security;
-- Written only by the dispatcher (service_role bypasses RLS). Admins may inspect delivery health.
create policy "admins read notification deliveries" on public.notification_deliveries
  for select to authenticated using ((select public.is_admin()));

-- ── Money formatting for notification copy ───────────────────────────────────
create or replace function public.format_money(p_amount bigint, p_currency text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(p_currency)
           when 'EUR' then '€' when 'USD' then '$' when 'GBP' then '£' else upper(p_currency) || ' '
         end
         || case when upper(p_currency) in ('JPY', 'KRW')
              then to_char(p_amount, 'FM999G999G999G990')
              else to_char(p_amount / 100.0, 'FM999G999G999G990.00')
            end;
$$;

-- ── Claim a batch for delivery ───────────────────────────────────────────────
-- Marks rows dispatched atomically (skip locked, so concurrent runs never double-send) and returns
-- everything the dispatcher needs: recipient email, preferences (defaults when no row), live push
-- tokens and the trip's time zone for quiet hours.
create or replace function public.claim_pending_notifications(p_limit integer default 50)
returns table (
  id                 uuid,
  user_id            uuid,
  category           public.notification_category,
  type               text,
  title              text,
  body               text,
  deep_link          jsonb,
  trip_id            uuid,
  created_at         timestamptz,
  recipient_email    text,
  display_name       text,
  operational_email  boolean,
  social_push        boolean,
  social_email       boolean,
  marketing_push     boolean,
  marketing_email    boolean,
  quiet_hours_start  time,
  quiet_hours_end    time,
  push_tokens        text[],
  trip_timezone      text,
  trip_active        boolean
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notifications n
    set dispatched_at = now()
    where n.id in (
      select p.id from public.notifications p
      where p.dispatched_at is null
      order by p.created_at
      limit greatest(1, least(p_limit, 200))
      for update skip locked
    )
    returning n.*
  )
  select c.id, c.user_id, c.category, c.type, c.title, c.body, c.deep_link, c.trip_id, c.created_at,
         u.email::text,
         pr.display_name,
         coalesce(np.operational_email, true),
         coalesce(np.social_push, true),
         coalesce(np.social_email, false),
         coalesce(np.marketing_push, false),
         coalesce(np.marketing_email, false),
         np.quiet_hours_start,
         np.quiet_hours_end,
         coalesce((select array_agg(pt.token order by pt.last_seen_at desc)
                   from public.push_tokens pt
                   where pt.user_id = c.user_id and pt.disabled_at is null), '{}'::text[]),
         tr.timezone,
         (tr.status = 'active')
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles pr on pr.id = c.user_id
  left join public.notification_preferences np on np.user_id = c.user_id
  left join public.trips tr on tr.id = c.trip_id
  order by c.created_at;
$$;
revoke execute on function public.claim_pending_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(integer) to service_role;

-- ── notify_trip_members: add an idempotency prefix ───────────────────────────
-- Same behaviour as migration 027, plus `p_dedupe_prefix`: when given, each member's row gets
-- dedupe_key '<prefix>:<user_id>' and re-running the enqueue never duplicates.
drop function public.notify_trip_members(uuid, public.notification_category, text, text, text, jsonb, uuid);
create or replace function public.notify_trip_members(
  p_trip_id        uuid,
  p_category       public.notification_category,
  p_type           text,
  p_title          text,
  p_body           text,
  p_deep_link      jsonb,
  p_exclude        uuid default null,
  p_dedupe_prefix  text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, category, type, title, body, deep_link, trip_id, dedupe_key)
  select m.user_id, p_category, p_type, p_title, p_body, p_deep_link, p_trip_id,
         case when p_dedupe_prefix is null then null else p_dedupe_prefix || ':' || m.user_id end
  from public.trip_members m
  where m.trip_id = p_trip_id
    and m.removed_at is null
    and (p_exclude is null or m.user_id <> p_exclude)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.notify_trip_members(uuid, public.notification_category, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.notify_trip_members(uuid, public.notification_category, text, text, text, jsonb, uuid, text) to service_role;

-- ── Support replies ──────────────────────────────────────────────────────────
create or replace function public.support_messages_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread record;
begin
  if not new.is_from_staff or new.is_internal_note then return new; end if;
  select customer_id, subject, trip_id into v_thread from public.support_threads where id = new.thread_id;
  if v_thread.customer_id is null then return new; end if;
  insert into public.notifications (user_id, category, type, title, body, deep_link, trip_id)
  values (
    v_thread.customer_id,
    'operational',
    'support_response',
    'Guideless replied: ' || v_thread.subject,
    left(new.body, 140) || case when char_length(new.body) > 140 then '…' else '' end,
    jsonb_build_object('kind', 'support_thread', 'threadId', new.thread_id),
    v_thread.trip_id
  );
  return new;
end;
$$;
create trigger support_messages_notify after insert on public.support_messages
  for each row execute function public.support_messages_notify();

-- ── Payment reminders ────────────────────────────────────────────────────────
-- Confirmed bookings with an outstanding balance: 14 and 3 days before the departure's balance
-- due date, and once when it is a day overdue. Idempotent per booking and stage.
create or replace function public.enqueue_payment_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select b.id, b.customer_id, b.currency::text as currency,
           (b.total_amount - b.amount_paid) as balance,
           d.balance_due_date, t.name as tour_name,
           case
             when d.balance_due_date = current_date + 14 then 'due-14'
             when d.balance_due_date = current_date + 3  then 'due-3'
             when d.balance_due_date = current_date - 1  then 'overdue'
           end as stage
    from public.bookings b
    join public.departures d on d.id = b.departure_id
    join public.tours t on t.id = d.tour_id
    where b.status = 'confirmed'
      and b.total_amount > b.amount_paid
      and d.balance_due_date in (current_date + 14, current_date + 3, current_date - 1)
  loop
    insert into public.notifications (user_id, category, type, title, body, deep_link, dedupe_key)
    values (
      r.customer_id,
      'operational',
      'payment_reminder',
      case r.stage
        when 'overdue' then 'Your balance is overdue'
        else 'Balance due ' || to_char(r.balance_due_date, 'FMMonth FMDD')
      end,
      public.format_money(r.balance, r.currency) || ' remaining for ' || r.tour_name
        || case r.stage
             when 'overdue' then '. Pay from your account to keep your place.'
             else '. Pay from your account whenever you like — no action needed at the door.'
           end,
      jsonb_build_object('kind', 'payment', 'bookingId', r.id),
      'payment_reminder:' || r.id || ':' || r.stage
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.enqueue_payment_reminders() from public, anon, authenticated;

-- ── Trip reminders and status automation ─────────────────────────────────────
-- Dates compare in UTC (the daily job runs at 06:15 UTC, i.e. morning in Europe). Good enough for
-- reminders; in-trip timing uses the day's own zone in the app.
create or replace function public.enqueue_trip_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  update public.trips set status = 'active'
  where status = 'upcoming' and start_date <= current_date and end_date >= current_date;
  update public.trips set status = 'completed'
  where status in ('upcoming', 'active') and end_date < current_date;

  for r in
    select t.id, t.name, t.start_date, t.end_date,
           case
             when t.start_date = current_date + 30 then 'T-30'
             when t.start_date = current_date + 7  then 'T-7'
             when t.start_date = current_date + 1  then 'T-1'
             when t.start_date = current_date      then 'start'
             when t.end_date   = current_date - 1  then 'end'
           end as stage
    from public.trips t
    where t.status in ('upcoming', 'active', 'completed')
      and (t.start_date in (current_date + 30, current_date + 7, current_date + 1, current_date)
           or t.end_date = current_date - 1)
  loop
    v_count := v_count + public.notify_trip_members(
      r.id,
      'operational',
      case r.stage when 'start' then 'trip_started' when 'end' then 'trip_completed' else 'trip_upcoming' end,
      case r.stage
        when 'T-30'  then 'A month to go: ' || r.name
        when 'T-7'   then 'Seven days to go: ' || r.name
        when 'T-1'   then 'Tomorrow: ' || r.name
        when 'start' then 'Welcome to ' || r.name
        else 'Thank you for traveling with Guideless'
      end,
      case r.stage
        when 'T-30'  then 'Check your traveler details and get the Guideless app. Your route and group are waiting.'
        when 'T-7'   then 'Final details are in your trip: arrival time, first hotel and where to meet.'
        when 'T-1'   then 'Your route, hotel and first stop are in the app. Safe travels.'
        when 'start' then 'Your route is live. Open your trip to see what is next.'
        else 'How was it? Reply to this note or tell us in the app — it shapes the next route.'
      end,
      jsonb_build_object('kind', 'trip', 'tripId', r.id),
      null,
      'trip:' || r.id || ':' || r.stage
    );
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.enqueue_trip_reminders() from public, anon, authenticated;

create or replace function public.run_lifecycle_notifications()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.enqueue_payment_reminders();
  select public.enqueue_trip_reminders();
$$;
revoke execute on function public.run_lifecycle_notifications() from public, anon, authenticated;

-- ── Dispatcher invocation (pg_cron → pg_net → Edge Function) ─────────────────
-- Same shape as invoke_social_publish(): URL and shared secret live in Vault, so nothing sensitive
-- is in this file. Until both exist (local dev, fresh environments) the job is a no-op.
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-dispatch', 'notify_dispatch_url');
--   select vault.create_secret('<random>', 'notify_dispatch_secret');
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_notify_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.notifications where dispatched_at is null) then return; end if;
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'notify_dispatch_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_dispatch_secret' limit 1;
  if v_url is null or v_secret is null then
    raise notice 'notify-dispatch: vault secrets not configured; skipping';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function public.invoke_notify_dispatch() from public, anon, authenticated;

select cron.schedule('dispatch-notifications', '* * * * *', $$ select public.invoke_notify_dispatch(); $$);
select cron.schedule('enqueue-lifecycle-notifications', '15 6 * * *', $$ select public.run_lifecycle_notifications(); $$);
