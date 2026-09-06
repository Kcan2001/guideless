-- 021_system
-- Audit log, feature flags, system settings.

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       public.audit_action not null,
  entity_type  text not null,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,   -- ids and diagnostic data only; never PII/secrets
  ip_address   inet,
  created_at   timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- The one sanctioned way to write an audit row from SQL, triggers or RPC.
create or replace function public.log_audit(
  p_action      public.audit_action,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke execute on function public.log_audit(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.log_audit(public.audit_action, text, uuid, jsonb) to authenticated, service_role;

-- Automatic audit entries for the highest-value events.
create or replace function public.audit_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('booking_created', 'booking', new.id,
      jsonb_build_object('departure_id', new.departure_id, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
      perform public.log_audit('booking_cancelled', 'booking', new.id,
        jsonb_build_object('from', old.status, 'to', new.status, 'refund_percentage', new.refund_percentage));
    end if;
    if new.payment_status <> old.payment_status or new.amount_paid <> old.amount_paid then
      perform public.log_audit('payment_updated', 'booking', new.id,
        jsonb_build_object('payment_status', new.payment_status, 'amount_paid', new.amount_paid));
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_audit after insert or update on public.bookings
  for each row execute function public.audit_bookings();

create or replace function public.audit_refunds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_audit('refund_created', 'refund', new.id,
    jsonb_build_object('booking_id', new.booking_id, 'amount', new.amount, 'currency', new.currency));
  return new;
end;
$$;
create trigger refunds_audit after insert on public.refunds
  for each row execute function public.audit_refunds();

create or replace function public.audit_trip_itinerary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_audit('itinerary_changed', 'trip_itinerary_item', coalesce(new.id, old.id),
    jsonb_build_object('op', tg_op, 'trip_id', coalesce(new.trip_id, old.trip_id)));
  return coalesce(new, old);
end;
$$;
create trigger trip_itinerary_items_audit after insert or update or delete on public.trip_itinerary_items
  for each row execute function public.audit_trip_itinerary();

create or replace function public.audit_supplier_services()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_audit('supplier_changed', 'supplier_service', coalesce(new.id, old.id),
    jsonb_build_object('op', tg_op, 'status', coalesce(new.status, old.status)));
  return coalesce(new, old);
end;
$$;
create trigger supplier_services_audit after insert or update or delete on public.supplier_services
  for each row execute function public.audit_supplier_services();

create or replace function public.audit_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_audit('role_changed', 'user', coalesce(new.user_id, old.user_id),
    jsonb_build_object('op', tg_op, 'role', coalesce(new.role, old.role)));
  return coalesce(new, old);
end;
$$;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_user_roles();

create or replace function public.audit_trip_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('traveler_added', 'trip', new.trip_id, jsonb_build_object('user_id', new.user_id));
  elsif tg_op = 'UPDATE' and new.removed_at is not null and old.removed_at is null then
    perform public.log_audit('traveler_removed', 'trip', new.trip_id, jsonb_build_object('user_id', new.user_id));
  elsif tg_op = 'DELETE' then
    perform public.log_audit('traveler_removed', 'trip', old.trip_id, jsonb_build_object('user_id', old.user_id));
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trip_members_audit after insert or update of removed_at or delete on public.trip_members
  for each row execute function public.audit_trip_members();

create or replace function public.audit_message_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_audit('message_deleted', 'message', new.id,
      jsonb_build_object('room_id', new.room_id, 'deleted_by', new.deleted_by));
  end if;
  return new;
end;
$$;
create trigger messages_audit_deletion after update of deleted_at on public.messages
  for each row execute function public.audit_message_deletion();

-- ── Feature flags & settings ─────────────────────────────────────────────────
create table public.feature_flags (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  enabled      boolean not null default false,
  description  text,
  -- Optional targeting: {"roles":["trip_staff"],"userIds":[...],"percentage":10}
  rollout      jsonb not null default '{}'::jsonb,
  updated_by   uuid references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now()
);
create trigger feature_flags_set_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, enabled, description) values
  ('live_moments',    false, 'Live Moments during a trip (Phase 2)'),
  ('chat',            true,  'Group chat rooms'),
  ('recommendations', false, 'Destination recommendations in Explore (Phase 2)'),
  ('post_trip',       false, 'Post-trip community, recap and photo sharing (Phase 2)'),
  ('new_checkout',    false, 'Checkout redesign toggle'),
  ('new_homepage',    false, 'Homepage redesign toggle');

create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger system_settings_set_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

insert into public.system_settings (key, value, description) values
  ('booking_hold_minutes', '30'::jsonb, 'How long a checkout hold reserves seats'),
  ('default_currency', '"USD"'::jsonb, 'Currency for new departures'),
  ('support_email', '"hello@guidelesstours.com"'::jsonb, 'Reply-to for customer email');

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_settings enable row level security;

create policy "admins read audit logs" on public.audit_logs
  for select to authenticated using ((select public.is_admin()));
-- Insert only via log_audit (security definer). No update/delete for anyone but service_role.

create policy "flags are readable" on public.feature_flags
  for select to anon, authenticated using (true);
create policy "admins manage flags" on public.feature_flags
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "staff read settings" on public.system_settings
  for select to authenticated using ((select public.is_staff()));
create policy "admins manage settings" on public.system_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
