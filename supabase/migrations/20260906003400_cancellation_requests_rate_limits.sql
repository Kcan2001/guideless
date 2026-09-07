-- 034_cancellation_requests_rate_limits
-- Customer self-service (docs/pricing.md → Cancellations) and abuse protection for public forms.
--
--   cancellation_requests            a customer asks to cancel; staff decide in /admin/bookings/[id]
--   request_cancellation()           validates ownership/status, quotes the refund tier, notifies
--   withdraw_cancellation_request()  customer changes their mind while the request is pending
--   resolve_cancellation_request()   staff approve/decline (the refund itself is the existing admin cancel)
--   rate_limits + check_rate_limit() fixed-window counter keyed by a hashed caller id + form name

-- ── Cancellation requests ────────────────────────────────────────────────────
create table public.cancellation_requests (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null references public.bookings (id) on delete cascade,
  customer_id               uuid not null references auth.users (id) on delete cascade,
  reason                    text not null check (char_length(reason) between 3 and 2000),
  refund_percentage_quoted  integer not null check (refund_percentage_quoted between 0 and 100),
  status                    text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  requested_at              timestamptz not null default now(),
  decided_by                uuid references auth.users (id) on delete set null,
  decided_at                timestamptz,
  staff_notes               text check (char_length(staff_notes) <= 2000),
  updated_at                timestamptz not null default now()
);
create unique index cancellation_requests_one_open on public.cancellation_requests (booking_id) where status = 'pending';
create index cancellation_requests_customer_idx on public.cancellation_requests (customer_id, requested_at desc);
create index cancellation_requests_status_idx on public.cancellation_requests (status, requested_at);
create trigger cancellation_requests_set_updated_at before update on public.cancellation_requests
  for each row execute function public.set_updated_at();

alter table public.cancellation_requests enable row level security;
create policy "customers read their cancellation requests" on public.cancellation_requests
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy "staff update cancellation requests" on public.cancellation_requests
  for update to authenticated
  using ((select public.is_ops_staff()) or (select public.is_admin()))
  with check ((select public.is_ops_staff()) or (select public.is_admin()));
-- Inserts and customer status changes go through the functions below (security definer).

create or replace function public.request_cancellation(p_booking_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_dep      public.departures%rowtype;
  v_tour     text;
  v_pct      integer;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'Tell us briefly why' using errcode = 'check_violation', hint = 'reason';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'no_data_found', hint = 'not_found';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be cancelled here' using errcode = 'check_violation', hint = 'not_cancellable';
  end if;
  select * into v_dep from public.departures where id = v_booking.departure_id;
  if v_dep.start_date < current_date then
    raise exception 'This trip has already started' using errcode = 'check_violation', hint = 'started';
  end if;
  select name into v_tour from public.tours where id = v_dep.tour_id;

  v_pct := public.refund_percentage_for(v_dep.cancellation_policy, (v_dep.start_date - current_date));

  begin
    insert into public.cancellation_requests (booking_id, customer_id, reason, refund_percentage_quoted)
    values (p_booking_id, v_uid, trim(p_reason), v_pct)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A cancellation request is already open for this booking'
      using errcode = 'unique_violation', hint = 'already_requested';
  end;

  insert into public.notifications (user_id, category, type, title, body, deep_link)
  values (
    v_uid, 'operational', 'cancellation_requested',
    'We received your cancellation request',
    'For ' || coalesce(v_tour, 'your trip') || ' (' || v_booking.confirmation_number || '). '
      || 'At today''s date the policy refunds ' || v_pct || '% of the trip price. We''ll confirm within two business days.',
    jsonb_build_object('kind', 'payment', 'bookingId', p_booking_id)
  );
  return v_id;
end;
$$;
revoke execute on function public.request_cancellation(uuid, text) from public, anon;
grant execute on function public.request_cancellation(uuid, text) to authenticated, service_role;

create or replace function public.withdraw_cancellation_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  update public.cancellation_requests
  set status = 'withdrawn', decided_at = now()
  where id = p_request_id and customer_id = v_uid and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;
revoke execute on function public.withdraw_cancellation_request(uuid) from public, anon;
grant execute on function public.withdraw_cancellation_request(uuid) to authenticated, service_role;

-- Staff decision. Approving records the decision and tells the customer; the money and the
-- booking status still move through the existing admin cancel action (refund_percentage_for,
-- Stripe refund, audit log), which is where /admin/bookings/[id] should call this from.
create or replace function public.resolve_cancellation_request(p_request_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req  public.cancellation_requests%rowtype;
  v_conf text;
begin
  if not ((select public.is_ops_staff()) or (select public.is_admin())) then
    raise exception 'Staff only' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('approved', 'declined') then
    raise exception 'Status must be approved or declined' using errcode = 'check_violation';
  end if;
  update public.cancellation_requests
  set status = p_status, decided_by = auth.uid(), decided_at = now(), staff_notes = coalesce(p_notes, staff_notes)
  where id = p_request_id and status = 'pending'
  returning * into v_req;
  if not found then
    raise exception 'Request is not pending' using errcode = 'no_data_found';
  end if;
  select confirmation_number into v_conf from public.bookings where id = v_req.booking_id;
  insert into public.notifications (user_id, category, type, title, body, deep_link)
  values (
    v_req.customer_id, 'operational', 'cancellation_' || p_status,
    case p_status when 'approved' then 'Your cancellation is confirmed' else 'About your cancellation request' end,
    case p_status
      when 'approved' then 'Booking ' || v_conf || ' is cancelled. Any refund due (' || v_req.refund_percentage_quoted || '% of the trip price) goes back to your original payment method within 10 business days.'
      else 'We could not process the cancellation for ' || v_conf || ' as requested. Reply to this note or email us and we''ll sort it out together.'
    end,
    jsonb_build_object('kind', 'payment', 'bookingId', v_req.booking_id)
  );
end;
$$;
revoke execute on function public.resolve_cancellation_request(uuid, text, text) from public, anon;
grant execute on function public.resolve_cancellation_request(uuid, text, text) to authenticated, service_role;

-- ── Rate limits (fixed window) ───────────────────────────────────────────────
-- Keys are opaque (form name + salted hash of the caller); no IPs are stored.
create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;   -- no policies: only the function touches it

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_key is null or p_limit is null or p_window_seconds is null or p_window_seconds <= 0 then
    return true;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (key, window_start, count)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Opportunistic pruning: roughly one call in a hundred clears windows that can no longer matter.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - make_interval(secs => p_window_seconds * 2);
  end if;
  return v_count <= p_limit;
end;
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated, service_role;
