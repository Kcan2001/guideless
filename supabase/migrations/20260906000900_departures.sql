-- 009_departures
-- A departure is one execution of a tour version on specific dates, with explicit capacity and a
-- data-driven cancellation policy. Availability is computed in SQL (012_bookings), never in the client.

create table public.departures (
  id                    uuid primary key default gen_random_uuid(),
  tour_id               uuid not null references public.tours (id) on delete restrict,
  tour_version_id       uuid not null references public.tour_versions (id) on delete restrict,
  status                public.departure_status not null default 'draft',
  start_date            date not null,
  end_date              date not null,
  timezone              text not null,                   -- zone of the first destination
  capacity              integer not null check (capacity >= 0),
  minimum_travelers     integer not null default 6 check (minimum_travelers >= 0),
  price_amount          bigint not null check (price_amount >= 0),
  deposit_amount        bigint not null default 0 check (deposit_amount >= 0 and deposit_amount <= price_amount),
  currency              public.currency_code not null,
  booking_deadline      date,
  balance_due_date      date,
  -- [{"daysBeforeDeparture":60,"refundPercentage":100}, ...] validated by cancellationPolicySchema
  cancellation_policy   jsonb not null default '[
    {"daysBeforeDeparture": 60, "refundPercentage": 100},
    {"daysBeforeDeparture": 30, "refundPercentage": 75},
    {"daysBeforeDeparture": 15, "refundPercentage": 50},
    {"daysBeforeDeparture": 0,  "refundPercentage": 0}
  ]'::jsonb,
  internal_notes        text,                            -- staff-only (see policy note)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint departures_dates check (end_date >= start_date),
  constraint departures_deadline check (booking_deadline is null or booking_deadline <= start_date),
  constraint departures_policy_is_array check (jsonb_typeof(cancellation_policy) = 'array')
);

create index departures_tour_start_idx on public.departures (tour_id, start_date);
create index departures_status_start_idx on public.departures (status, start_date);

create trigger departures_set_updated_at before update on public.departures
  for each row execute function public.set_updated_at();

alter table public.supplier_services
  add constraint supplier_services_departure_fk
  foreign key (departure_id) references public.departures (id) on delete set null;

-- Refund percentage for a cancellation N days before departure. Data-driven; never hardcode in UI.
create or replace function public.refund_percentage_for(policy jsonb, days_before integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select (tier ->> 'refundPercentage')::integer
      from jsonb_array_elements(policy) as tier
      where (tier ->> 'daysBeforeDeparture')::integer <= greatest(days_before, 0)
      order by (tier ->> 'daysBeforeDeparture')::integer desc
      limit 1
    ),
    0
  );
$$;
grant execute on function public.refund_percentage_for(jsonb, integer) to anon, authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public sees bookable/visible departures of published tours. Staff see all; ops staff write.
-- NOTE: internal_notes is readable by anyone who can read the row; the customer-facing
-- `departures_public` view (below) omits it, and client code must select from the view.

alter table public.departures enable row level security;

create policy "open departures are public" on public.departures
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or (
      status in ('open', 'guaranteed', 'full', 'closed', 'in_progress', 'completed')
      and public.tour_version_is_public(tour_version_id)
    )
  );

create policy "ops staff manage departures" on public.departures
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Customer-safe projection (no internal_notes). Inherits RLS of departures via security_invoker.
create view public.departures_public
with (security_invoker = true) as
select id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity,
       minimum_travelers, price_amount, deposit_amount, currency, booking_deadline,
       balance_due_date, cancellation_policy, created_at, updated_at
from public.departures;

grant select on public.departures_public to anon, authenticated;
