-- 012_bookings
-- A booking is a customer's purchase of seats on a departure. booking_status and payment_status are
-- SEPARATE columns. Inventory (capacity - confirmed - held) is enforced here with a row lock so two
-- checkouts cannot overbook. Holds expire via hold_expires_at (released by a scheduled job).

create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             extensions.citext not null unique,
  description      text,
  percent_off      integer check (percent_off between 1 and 100),
  amount_off       bigint check (amount_off > 0),
  currency         public.currency_code,
  valid_from       timestamptz,
  valid_until      timestamptz,
  max_redemptions  integer check (max_redemptions > 0),
  redemptions      integer not null default 0 check (redemptions >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint coupons_one_kind check ((percent_off is null) <> (amount_off is null)),
  constraint coupons_amount_currency check ((amount_off is null) = (currency is null))
);

create table public.bookings (
  id                          uuid primary key default gen_random_uuid(),
  confirmation_number         text not null unique,
  customer_id                 uuid not null references auth.users (id) on delete restrict,
  departure_id                uuid not null references public.departures (id) on delete restrict,
  tour_version_id             uuid not null references public.tour_versions (id) on delete restrict,
  status                      public.booking_status not null default 'draft',
  payment_status              public.payment_status not null default 'unpaid',
  currency                    public.currency_code not null,
  subtotal_amount             bigint not null default 0 check (subtotal_amount >= 0),
  discount_amount             bigint not null default 0 check (discount_amount >= 0),
  total_amount                bigint not null default 0 check (total_amount >= 0),
  deposit_amount              bigint not null default 0 check (deposit_amount >= 0),
  amount_paid                 bigint not null default 0 check (amount_paid >= 0),
  amount_refunded             bigint not null default 0 check (amount_refunded >= 0),
  coupon_id                   uuid references public.coupons (id) on delete set null,
  hold_expires_at             timestamptz,
  stripe_customer_id          text,
  stripe_checkout_session_id  text unique,
  terms_accepted_at           timestamptz,
  terms_version               text,
  cancelled_at                timestamptz,
  cancellation_reason         text,
  refund_percentage           integer check (refund_percentage between 0 and 100),
  internal_notes              text,          -- staff-only; omitted from bookings_public view
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint bookings_total check (total_amount = subtotal_amount - discount_amount),
  constraint bookings_hold_when_pending check (status <> 'pending_payment' or hold_expires_at is not null),
  constraint bookings_cancelled_at check ((status in ('cancelled', 'refunded')) = (cancelled_at is not null))
);

create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_departure_status_idx on public.bookings (departure_id, status);
create index bookings_hold_idx on public.bookings (hold_expires_at) where status = 'pending_payment';

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Human-friendly, unambiguous confirmation numbers: GL-7K3M9Q2X (no 0/O/1/I).
create or replace function public.generate_confirmation_number()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'GL-';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.confirmation_number = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_confirmation_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.confirmation_number is null or new.confirmation_number = '' then
    new.confirmation_number := public.generate_confirmation_number();
  end if;
  return new;
end;
$$;

-- BEFORE INSERT triggers run before NOT NULL is checked, so clients may omit the column.
create trigger bookings_set_confirmation_number
  before insert on public.bookings
  for each row execute function public.set_confirmation_number();

create table public.booking_travelers (
  booking_id          uuid not null references public.bookings (id) on delete cascade,
  traveler_id         uuid not null references public.traveler_profiles (id) on delete restrict,
  departure_group_id  uuid references public.departure_groups (id) on delete set null,
  is_lead             boolean not null default false,
  created_at          timestamptz not null default now(),
  primary key (booking_id, traveler_id)
);
create index booking_travelers_traveler_idx on public.booking_travelers (traveler_id);
create index booking_travelers_group_idx on public.booking_travelers (departure_group_id);

create table public.booking_preferences (
  booking_id               uuid primary key references public.bookings (id) on delete cascade,
  room_preference          public.room_preference not null default 'no_preference',
  dietary_requirements     text check (char_length(dietary_requirements) <= 500),
  accessibility_needs      text check (char_length(accessibility_needs) <= 500),
  airport_transfer         public.transfer_preference not null default 'group_welcome_transfer',
  optional_experience_ids  uuid[] not null default '{}',
  updated_at               timestamptz not null default now()
);
create trigger booking_preferences_set_updated_at before update on public.booking_preferences
  for each row execute function public.set_updated_at();

-- Line items: base package per traveler, add-ons (wine tour, extra night), discounts.
create table public.booking_items (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  kind          text not null check (kind in ('base', 'add_on', 'discount')),
  title         text not null,
  quantity      integer not null default 1 check (quantity >= 1),
  unit_amount   bigint not null,                 -- negative for discounts
  total_amount  bigint not null,
  currency      public.currency_code not null,
  metadata      jsonb not null default '{}'::jsonb,
  constraint booking_items_total check (total_amount = unit_amount * quantity)
);
create index booking_items_booking_idx on public.booking_items (booking_id);

-- ── Inventory ────────────────────────────────────────────────────────────────
-- Seats are counted per traveler. Confirmed = bookings.status = 'confirmed'.
-- Held = pending_payment with an unexpired hold.

create or replace function public.get_departure_availability(p_departure_id uuid)
returns table (capacity integer, confirmed integer, held integer, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  with seats as (
    select
      count(*) filter (where b.status = 'confirmed')::integer as confirmed,
      count(*) filter (where b.status = 'pending_payment' and b.hold_expires_at > now())::integer as held
    from public.booking_travelers bt
    join public.bookings b on b.id = bt.booking_id
    where b.departure_id = p_departure_id
  )
  select d.capacity, s.confirmed, s.held, greatest(d.capacity - s.confirmed - s.held, 0)
  from public.departures d, seats s
  where d.id = p_departure_id;
$$;
grant execute on function public.get_departure_availability(uuid) to anon, authenticated, service_role;

-- Lock the departure row and refuse if seats would exceed capacity.
create or replace function public.assert_departure_capacity(p_departure_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken    integer;
begin
  select capacity into v_capacity from public.departures where id = p_departure_id for update;
  if v_capacity is null then
    raise exception 'Departure % not found', p_departure_id using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_taken
  from public.booking_travelers bt
  join public.bookings b on b.id = bt.booking_id
  where b.departure_id = p_departure_id
    and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.hold_expires_at > now()));

  if v_taken > v_capacity then
    raise exception 'Departure is sold out (capacity %, requested %)', v_capacity, v_taken
      using errcode = 'check_violation', hint = 'departure_sold_out';
  end if;
end;
$$;

create or replace function public.booking_travelers_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_departure uuid;
begin
  select departure_id into v_departure from public.bookings where id = new.booking_id;
  perform public.assert_departure_capacity(v_departure);
  return new;
end;
$$;

create trigger booking_travelers_capacity
  after insert on public.booking_travelers
  for each row execute function public.booking_travelers_capacity_guard();

create or replace function public.bookings_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only when a booking starts occupying seats.
  if new.status in ('pending_payment', 'confirmed')
     and (old.status is distinct from new.status or old.hold_expires_at is distinct from new.hold_expires_at) then
    perform public.assert_departure_capacity(new.departure_id);
  end if;
  return new;
end;
$$;

create trigger bookings_capacity
  after update of status, hold_expires_at on public.bookings
  for each row execute function public.bookings_capacity_guard();

-- Release expired holds. Called by a scheduled job (pg_cron / Edge Function) — see docs/api.md.
create or replace function public.release_expired_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with released as (
    update public.bookings
    set status = 'draft', hold_expires_at = null
    where status = 'pending_payment' and hold_expires_at <= now()
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;
revoke execute on function public.release_expired_holds() from public;
grant execute on function public.release_expired_holds() to service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.coupons enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_travelers enable row level security;
alter table public.booking_preferences enable row level security;
alter table public.booking_items enable row level security;

-- Coupons are validated server-side (service role); customers never list them.
create policy "staff read coupons" on public.coupons
  for select to authenticated using ((select public.is_staff()));
create policy "finance manages coupons" on public.coupons
  for all to authenticated
  using ((select public.has_any_role(array['finance', 'admin', 'super_admin']::public.app_role[])))
  with check ((select public.has_any_role(array['finance', 'admin', 'super_admin']::public.app_role[])));

create policy "customers read their bookings" on public.bookings
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));

-- Customers create drafts only; the checkout Server Action (service role) moves them forward.
create policy "customers create draft bookings" on public.bookings
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'draft' and payment_status = 'unpaid'
              and amount_paid = 0 and amount_refunded = 0);

create policy "customers edit their drafts" on public.bookings
  for update to authenticated
  using (customer_id = (select auth.uid()) and status = 'draft')
  with check (customer_id = (select auth.uid()) and status = 'draft' and payment_status = 'unpaid');

create policy "ops staff manage bookings" on public.bookings
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "booking travelers follow booking" on public.booking_travelers
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_travelers.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))));
create policy "customers add travelers to drafts" on public.booking_travelers
  for insert to authenticated
  with check (exists (select 1 from public.bookings b where b.id = booking_travelers.booking_id
                      and b.customer_id = (select auth.uid()) and b.status = 'draft'));
create policy "customers remove travelers from drafts" on public.booking_travelers
  for delete to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_travelers.booking_id
                 and b.customer_id = (select auth.uid()) and b.status = 'draft'));
create policy "ops staff manage booking travelers" on public.booking_travelers
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "booking preferences follow booking" on public.booking_preferences
  for all to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_preferences.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))))
  with check (exists (select 1 from public.bookings b where b.id = booking_preferences.booking_id
                      and (b.customer_id = (select auth.uid()) or (select public.is_ops_staff()))));

create policy "booking items follow booking" on public.booking_items
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_items.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))));
create policy "ops staff manage booking items" on public.booking_items
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Customer-safe projection without internal_notes.
create view public.bookings_public
with (security_invoker = true) as
select id, confirmation_number, customer_id, departure_id, tour_version_id, status, payment_status,
       currency, subtotal_amount, discount_amount, total_amount, deposit_amount, amount_paid,
       amount_refunded, hold_expires_at, terms_accepted_at, cancelled_at, refund_percentage,
       created_at, updated_at
from public.bookings;
grant select on public.bookings_public to authenticated;
