-- 008_suppliers
-- Generic supplier model: hotels, rail, transfer companies, activity providers. Confirmations may be
-- API, email, PDF or phone. Costs and internal notes are STAFF-ONLY — customers have no policy here.

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null,            -- hotel | rail | transfer | activity | restaurant | other
  website       text,
  country_code  char(2),
  notes         text,                     -- internal
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index suppliers_name_trgm_idx on public.suppliers using gin (name extensions.gin_trgm_ops);
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.supplier_contacts (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id) on delete cascade,
  name         text not null,
  role         text,
  email        text,
  phone        text,
  is_primary   boolean not null default false
);
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id);

-- One booked service with a supplier for one departure (a hotel block, a train reservation…).
create table public.supplier_services (
  id                     uuid primary key default gen_random_uuid(),
  supplier_id            uuid not null references public.suppliers (id) on delete restrict,
  departure_id           uuid,                     -- FK added in 009_departures
  title                  text not null,
  status                 public.supplier_service_status not null default 'requested',
  confirmation_number    text,
  cost_amount            bigint check (cost_amount >= 0),   -- minor units, staff-only
  cost_currency          public.currency_code,
  reservation_date       date,
  service_start_at       timestamptz,
  service_end_at         timestamptz,
  cancellation_deadline  timestamptz,
  internal_notes         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint supplier_services_cost_pair check ((cost_amount is null) = (cost_currency is null))
);
create index supplier_services_supplier_idx on public.supplier_services (supplier_id);
create index supplier_services_departure_idx on public.supplier_services (departure_id);
create index supplier_services_deadline_idx on public.supplier_services (cancellation_deadline)
  where status in ('requested', 'pending', 'confirmed');
create trigger supplier_services_set_updated_at before update on public.supplier_services
  for each row execute function public.set_updated_at();

-- ── RLS ── staff only. Finance/admin/trip_staff write; all staff read. Customers: nothing.
create or replace function public.is_ops_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['trip_staff', 'finance', 'admin', 'super_admin']::public.app_role[]);
$$;
revoke execute on function public.is_ops_staff() from public;
grant execute on function public.is_ops_staff() to authenticated, service_role;

alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.supplier_services enable row level security;

create policy "staff read suppliers" on public.suppliers
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage suppliers" on public.suppliers
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "staff read supplier contacts" on public.supplier_contacts
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage supplier contacts" on public.supplier_contacts
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "staff read supplier services" on public.supplier_services
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage supplier services" on public.supplier_services
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));
