-- Hotel inventory (Milestone 3, docs/strategy-v3-direction.md §3).
--
-- Guideless sells a curated set of hotels per destination and tier. Supplier APIs (Duffel Stays
-- first, then Expedia Rapid, then Hotelbeds) feed availability and NET rates behind the scenes;
-- the customer only ever sees the Guideless tier price and the hotel's public profile. Rules:
--   * net rates, supplier ids and markup rules are staff-only (CLAUDE.md rule 11) — public
--     projection goes through hotels_public / stay_option_hotels_public;
--   * money is integer minor units + ISO currency, dates are ISO dates, timestamps UTC;
--   * a rate is never trusted at payment time — the service layer rechecks it (see docs/booking.md);
--   * pricing rules live in the database so staff can change markups without a deploy.
-- Customer prices remain departure_stay_options.price_delta_amount; suggest_stay_price() only
-- proposes a number for staff to enter there.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.hotel_supplier as enum ('duffel', 'expedia', 'hotelbeds', 'manual');
create type public.hotel_payment_type as enum ('pay_now', 'pay_at_property');
create type public.hotel_booking_status as enum ('quoted', 'booked', 'confirmed', 'cancelled', 'failed');

comment on type public.hotel_supplier is 'Mirror of HOTEL_SUPPLIERS in @guideless/types.';
comment on type public.hotel_payment_type is 'Mirror of HOTEL_PAYMENT_TYPES in @guideless/types.';
comment on type public.hotel_booking_status is 'Mirror of HOTEL_BOOKING_STATUSES in @guideless/types.';

-- ── Finance helper (pricing rules are a finance decision) ────────────────────
create or replace function public.is_finance_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['finance', 'admin', 'super_admin']::public.app_role[]);
$$;
revoke execute on function public.is_finance_staff() from public;
grant execute on function public.is_finance_staff() to authenticated, service_role;

-- ── hotels ───────────────────────────────────────────────────────────────────
create table public.hotels (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations (id) on delete restrict,
  name            text not null check (char_length(name) between 2 and 160),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  address         text check (address is null or char_length(address) <= 400),
  city            text not null check (char_length(city) between 1 and 120),
  country_code    char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  latitude        double precision check (latitude is null or latitude between -90 and 90),
  longitude       double precision check (longitude is null or longitude between -180 and 180),
  star_rating     smallint check (star_rating is null or star_rating between 1 and 5),
  description     text check (description is null or char_length(description) <= 4000),
  image_urls      text[] not null default '{}' check (cardinality(image_urls) <= 24),
  amenities       text[] not null default '{}' check (cardinality(amenities) <= 40),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index hotels_destination_idx on public.hotels (destination_id) where is_active;
create trigger hotels_set_updated_at before update on public.hotels
  for each row execute function public.set_updated_at();

alter table public.hotels enable row level security;
-- Public rows are read through hotels_public (below); direct table access is staff only so a
-- future supplier column can never leak by accident.
create policy "staff read hotels" on public.hotels
  for select to authenticated using ((select public.is_staff()));
create policy "content or ops staff manage hotels" on public.hotels
  for all to authenticated
  using ((select public.is_content_staff()) or (select public.is_ops_staff()))
  with check ((select public.is_content_staff()) or (select public.is_ops_staff()));

-- ── hotel_rooms ──────────────────────────────────────────────────────────────
create table public.hotel_rooms (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 120),
  bed_type       text check (bed_type is null or char_length(bed_type) <= 60),
  max_occupancy  smallint not null default 2 check (max_occupancy between 1 and 8),
  description    text check (description is null or char_length(description) <= 2000),
  image_urls     text[] not null default '{}' check (cardinality(image_urls) <= 12),
  position       smallint not null default 1 check (position between 1 and 50),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index hotel_rooms_hotel_idx on public.hotel_rooms (hotel_id, position);
create trigger hotel_rooms_set_updated_at before update on public.hotel_rooms
  for each row execute function public.set_updated_at();

alter table public.hotel_rooms enable row level security;
create policy "staff read hotel rooms" on public.hotel_rooms
  for select to authenticated using ((select public.is_staff()));
create policy "content or ops staff manage hotel rooms" on public.hotel_rooms
  for all to authenticated
  using ((select public.is_content_staff()) or (select public.is_ops_staff()))
  with check ((select public.is_content_staff()) or (select public.is_ops_staff()));

-- ── hotel_supplier_mappings ──────────────────────────────────────────────────
-- One Guideless hotel (and optionally room) ↔ one supplier's identifiers. Curated by hand for the
-- hotels we sell; there is no global hotel-identity problem to solve.
create table public.hotel_supplier_mappings (
  id                uuid primary key default gen_random_uuid(),
  hotel_id          uuid not null references public.hotels (id) on delete cascade,
  supplier          public.hotel_supplier not null,
  supplier_hotel_id text not null check (char_length(supplier_hotel_id) between 1 and 120),
  hotel_room_id     uuid references public.hotel_rooms (id) on delete cascade,
  supplier_room_id  text check (supplier_room_id is null or char_length(supplier_room_id) <= 120),
  created_at        timestamptz not null default now()
);
create unique index hotel_supplier_mappings_unique_idx
  on public.hotel_supplier_mappings (supplier, supplier_hotel_id, coalesce(supplier_room_id, ''));
create index hotel_supplier_mappings_hotel_idx on public.hotel_supplier_mappings (hotel_id);

alter table public.hotel_supplier_mappings enable row level security;
create policy "ops staff read supplier mappings" on public.hotel_supplier_mappings
  for select to authenticated using ((select public.is_ops_staff()));
create policy "ops staff manage supplier mappings" on public.hotel_supplier_mappings
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- ── hotel_rates ──────────────────────────────────────────────────────────────
-- Net rates as fetched from a supplier. Staff-only; written by the service role (adapters run on
-- the server). `raw` keeps the supplier payload for reconciliation, never for display.
create table public.hotel_rates (
  id                         uuid primary key default gen_random_uuid(),
  hotel_id                   uuid not null references public.hotels (id) on delete cascade,
  hotel_room_id              uuid references public.hotel_rooms (id) on delete set null,
  supplier                   public.hotel_supplier not null,
  supplier_rate_id           text not null check (char_length(supplier_rate_id) between 1 and 200),
  room_name                  text not null check (char_length(room_name) between 1 and 160),
  bed_type                   text check (bed_type is null or char_length(bed_type) <= 60),
  occupancy_adults           smallint not null check (occupancy_adults between 1 and 8),
  occupancy_children         smallint not null default 0 check (occupancy_children between 0 and 6),
  check_in                   date not null,
  check_out                  date not null,
  currency                   public.currency_code not null,
  net_amount                 bigint not null check (net_amount >= 0),
  taxes_amount               bigint not null default 0 check (taxes_amount >= 0),
  fees_amount                bigint not null default 0 check (fees_amount >= 0),
  total_amount               bigint not null check (total_amount >= 0),
  refundable                 boolean not null,
  cancellation_policy        jsonb not null default '{}'::jsonb check (jsonb_typeof(cancellation_policy) = 'object'),
  breakfast_included         boolean not null default false,
  payment_type               public.hotel_payment_type not null,
  supplier_commission_amount bigint check (supplier_commission_amount is null or supplier_commission_amount >= 0),
  available                  boolean not null default true,
  fetched_at                 timestamptz not null default now(),
  expires_at                 timestamptz,
  raw                        jsonb,
  constraint hotel_rates_dates_check check (check_out > check_in)
);
create index hotel_rates_lookup_idx on public.hotel_rates (hotel_id, check_in, check_out, fetched_at desc);
create index hotel_rates_supplier_rate_idx on public.hotel_rates (supplier, supplier_rate_id);

alter table public.hotel_rates enable row level security;
create policy "ops staff read hotel rates" on public.hotel_rates
  for select to authenticated using ((select public.is_ops_staff()));
-- No insert/update/delete policy for authenticated: only service_role (which bypasses RLS) writes.

-- ── pricing_rules ────────────────────────────────────────────────────────────
-- Markup = max(min_markup_amount, round(net × percentage / 100) + fixed_markup_amount).
-- Specificity: hotel rule > destination rule > global rule; then priority desc; then newest.
create table public.pricing_rules (
  id                   uuid primary key default gen_random_uuid(),
  destination_id       uuid references public.destinations (id) on delete cascade,
  hotel_id             uuid references public.hotels (id) on delete cascade,
  min_markup_amount    bigint not null default 0 check (min_markup_amount >= 0),
  percentage_markup    numeric(5,2) not null default 0 check (percentage_markup between 0 and 500),
  fixed_markup_amount  bigint not null default 0 check (fixed_markup_amount >= 0),
  priority             integer not null default 0,
  effective_from       date,
  effective_to         date,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint pricing_rules_window_check check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create index pricing_rules_hotel_idx on public.pricing_rules (hotel_id) where hotel_id is not null;
create index pricing_rules_destination_idx on public.pricing_rules (destination_id) where destination_id is not null;

alter table public.pricing_rules enable row level security;
create policy "staff read pricing rules" on public.pricing_rules
  for select to authenticated using ((select public.is_staff()));
create policy "finance staff manage pricing rules" on public.pricing_rules
  for all to authenticated using ((select public.is_finance_staff())) with check ((select public.is_finance_staff()));

-- ── hotel_bookings ───────────────────────────────────────────────────────────
-- A supplier reservation made for a Guideless booking. rate_snapshot freezes what was bought.
create table public.hotel_bookings (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id) on delete restrict,
  stay_option_id        uuid references public.departure_stay_options (id) on delete set null,
  hotel_id              uuid not null references public.hotels (id) on delete restrict,
  supplier              public.hotel_supplier not null,
  supplier_booking_id   text check (supplier_booking_id is null or char_length(supplier_booking_id) <= 200),
  status                public.hotel_booking_status not null default 'quoted',
  rate_snapshot         jsonb not null check (jsonb_typeof(rate_snapshot) = 'object'),
  confirmation_number   text check (confirmation_number is null or char_length(confirmation_number) <= 120),
  cancellation_deadline timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index hotel_bookings_booking_idx on public.hotel_bookings (booking_id);
create index hotel_bookings_status_idx on public.hotel_bookings (status) where status in ('quoted', 'booked');
create trigger hotel_bookings_set_updated_at before update on public.hotel_bookings
  for each row execute function public.set_updated_at();

alter table public.hotel_bookings enable row level security;
create policy "ops staff read hotel bookings" on public.hotel_bookings
  for select to authenticated using ((select public.is_ops_staff()));
-- Writes: service_role only (booking service / webhook), no authenticated policy.

-- ── Link tiers to hotels ─────────────────────────────────────────────────────
alter table public.departure_stay_options
  add column hotel_id uuid references public.hotels (id) on delete set null,
  add column hotel_room_id uuid references public.hotel_rooms (id) on delete set null;
create index departure_stay_options_hotel_idx on public.departure_stay_options (hotel_id) where hotel_id is not null;

-- ── Public projections ───────────────────────────────────────────────────────
-- security_invoker = false: the view runs as its owner and exposes exactly these columns of
-- active hotels; no rate, supplier or internal column is reachable from it.
create or replace view public.hotels_public
with (security_invoker = false) as
  select h.id, h.destination_id, h.name, h.slug, h.address, h.city, h.country_code,
         h.latitude, h.longitude, h.star_rating, h.description, h.image_urls, h.amenities
  from public.hotels h
  where h.is_active;
grant select on public.hotels_public to anon, authenticated;

create or replace view public.stay_option_hotels_public
with (security_invoker = false) as
  select o.id as stay_option_id, o.departure_id, h.id as hotel_id, h.name as hotel_name, h.slug as hotel_slug,
         h.city, h.country_code, h.star_rating, h.image_urls, h.amenities,
         r.name as room_name, r.bed_type, r.max_occupancy
  from public.departure_stay_options o
  join public.hotels h on h.id = o.hotel_id and h.is_active
  left join public.hotel_rooms r on r.id = o.hotel_room_id
  where o.is_active;
grant select on public.stay_option_hotels_public to anon, authenticated;

-- ── suggest_stay_price ───────────────────────────────────────────────────────
-- For staff: the latest unexpired net rate per equivalent product (fingerprint) for a hotel,
-- stay and occupancy, with the applicable pricing rule applied. Returns
-- {rates: [{rate_id, room_name, refundable, breakfast_included, payment_type, net_total, markup,
--           customer_total, currency, expires_at}], rule_id}. Nothing here is customer-facing.
create or replace function public.suggest_stay_price(
  p_hotel_id uuid,
  p_check_in date,
  p_check_out date,
  p_adults integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_destination uuid;
  v_rule        public.pricing_rules%rowtype;
  v_rates       jsonb;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff only' using errcode = 'insufficient_privilege', hint = 'staff_required';
  end if;

  select destination_id into v_destination from public.hotels where id = p_hotel_id;
  if v_destination is null then
    raise exception 'Unknown hotel' using errcode = 'no_data_found', hint = 'hotel_not_found';
  end if;

  -- Most specific active rule in its effective window: hotel > destination > global, then priority.
  select * into v_rule
  from public.pricing_rules pr
  where pr.is_active
    and (pr.hotel_id = p_hotel_id or (pr.hotel_id is null and pr.destination_id = v_destination)
         or (pr.hotel_id is null and pr.destination_id is null))
    and (pr.effective_from is null or pr.effective_from <= p_check_in)
    and (pr.effective_to is null or pr.effective_to >= p_check_in)
  order by (pr.hotel_id is not null) desc, (pr.destination_id is not null) desc, pr.priority desc, pr.created_at desc
  limit 1;

  with latest as (
    select distinct on (
        lower(regexp_replace(r.room_name, '\s+', ' ', 'g')), lower(coalesce(r.bed_type, '')),
        r.occupancy_adults, r.occupancy_children, r.refundable,
        (r.cancellation_policy ->> 'deadline')::date, r.breakfast_included, r.payment_type)
      r.*
    from public.hotel_rates r
    where r.hotel_id = p_hotel_id
      and r.check_in = p_check_in
      and r.check_out = p_check_out
      and r.occupancy_adults = p_adults
      and r.available
      and (r.expires_at is null or r.expires_at > now())
    order by lower(regexp_replace(r.room_name, '\s+', ' ', 'g')), lower(coalesce(r.bed_type, '')),
             r.occupancy_adults, r.occupancy_children, r.refundable,
             (r.cancellation_policy ->> 'deadline')::date, r.breakfast_included, r.payment_type,
             r.fetched_at desc
  ),
  priced as (
    select l.*,
           case when v_rule.id is null then 0
                else greatest(v_rule.min_markup_amount,
                              round(l.total_amount * v_rule.percentage_markup / 100)::bigint + v_rule.fixed_markup_amount)
           end as markup
    from latest l
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rate_id', p.id,
           'room_name', p.room_name,
           'bed_type', p.bed_type,
           'supplier', p.supplier,
           'refundable', p.refundable,
           'breakfast_included', p.breakfast_included,
           'payment_type', p.payment_type,
           'net_total', p.total_amount,
           'markup', p.markup,
           'customer_total', p.total_amount + p.markup,
           'currency', p.currency,
           'expires_at', p.expires_at
         ) order by p.total_amount + p.markup), '[]'::jsonb)
  into v_rates
  from priced p;

  return jsonb_build_object('rates', v_rates, 'rule_id', v_rule.id);
end;
$$;
revoke execute on function public.suggest_stay_price(uuid, date, date, integer) from public, anon;
grant execute on function public.suggest_stay_price(uuid, date, date, integer) to authenticated, service_role;

comment on table public.hotels is 'Curated hotels Guideless sells. Public profile via hotels_public; never holds supplier data.';
comment on table public.hotel_rates is 'Supplier NET rates. Staff-only; the customer price is the tier''s price_delta_amount.';
comment on table public.pricing_rules is 'Markup rules: hotel > destination > global, priority desc. Changed by finance without a deploy.';
comment on table public.hotel_bookings is 'Supplier reservations per Guideless booking with the purchased rate frozen in rate_snapshot.';
