-- Buying experiences from a supplier instead of hand-building the extras catalog per departure.
--
-- The same problem as hotels, solved the same way and reusing the same words: search, rates,
-- recheck, book, cancel. Migration 0044 did it for beds; this does it for the things people do.
--
-- The one structural decision worth explaining is where the supplier lives. `departure_add_ons` is
-- readable by **anon** — it has to be, it is the extras list on a public tour page. So not one
-- byte of sourcing goes on it: not the net cost, not the supplier, not the supplier's product id.
-- A product id is not a price, but it is a link a customer could follow to buy the same ticket
-- direct, which makes it commercially sensitive in exactly the way rule 11 is about. All of it
-- lives in `add_on_sourcing`, behind staff-only policies, joined to the add-on by id.
--
-- That also means the public shape of an add-on does not change at all. A sourced add-on and a
-- hand-written one are the same row to a traveler, which is correct: they are buying an experience
-- from Guideless either way, and who we bought it from is our business, not theirs.

create type public.experience_supplier as enum ('mock', 'viator');

comment on type public.experience_supplier is 'Mirror of EXPERIENCE_SUPPLIERS in @guideless/types.';

-- ── What the supplier sells ──────────────────────────────────────────────────
-- A cache of products so staff can browse and compare without a billed call per keystroke, and so
-- an import has something stable to point at. Never customer-facing.
create table public.experience_products (
  id                  uuid primary key default gen_random_uuid(),
  supplier            public.experience_supplier not null,
  supplier_product_id text not null check (char_length(supplier_product_id) between 1 and 200),
  destination_id      uuid references public.destinations (id) on delete set null,
  title               text not null check (char_length(title) between 1 and 300),
  description         text check (description is null or char_length(description) <= 4000),
  duration_minutes    integer check (duration_minutes is null or duration_minutes between 0 and 20160),
  -- The supplier's own words for what kind of thing this is, kept raw. Mapping them onto our
  -- thirteen categories is a judgement call and belongs in the import, not in the cache.
  supplier_categories text[] not null default '{}',
  image_url           text,
  address             text,
  latitude            double precision check (latitude is null or latitude between -90 and 90),
  longitude           double precision check (longitude is null or longitude between -180 and 180),
  rating              numeric(2,1) check (rating is null or rating between 0 and 5),
  rating_count        integer check (rating_count is null or rating_count >= 0),
  -- What the traveler would pay the supplier directly, for staff to sanity-check a markup against.
  -- Staff-only table, so this is safe here and would not be on departure_add_ons.
  from_amount         bigint check (from_amount is null or from_amount >= 0),
  currency            public.currency_code,
  fetched_at          timestamptz not null default now(),
  raw                 jsonb,
  unique (supplier, supplier_product_id)
);

create index experience_products_destination_idx
  on public.experience_products (destination_id, fetched_at desc);

comment on table public.experience_products is
  'Supplier experience catalog, cached for staff to search and import from. Staff-only: it carries supplier prices and product ids, neither of which a customer may see.';

-- ── What it costs on a given day ─────────────────────────────────────────────
-- Modelled on hotel_rates, for the same reason: a price is only true for a date, and the number we
-- charge has to be traceable to the number we were quoted.
create table public.experience_rates (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.experience_products (id) on delete cascade,
  supplier            public.experience_supplier not null,
  -- A product usually has several bookable options: times, languages, group sizes.
  supplier_option_id  text not null check (char_length(supplier_option_id) between 1 and 200),
  option_name         text not null check (char_length(option_name) between 1 and 300),
  travel_date         date not null,
  start_time          time,
  currency            public.currency_code not null,
  net_amount          bigint not null check (net_amount >= 0),
  total_amount        bigint not null check (total_amount >= 0),
  -- Null means the supplier did not say, which is different from "unlimited".
  capacity            integer check (capacity is null or capacity >= 0),
  available           boolean not null default true,
  -- A ladder, as the hotel work established: suppliers rarely have a single deadline.
  cancellation_policy jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cancellation_policy) = 'object'),
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz,
  raw                 jsonb
);

create index experience_rates_lookup_idx
  on public.experience_rates (product_id, travel_date, fetched_at desc);

comment on table public.experience_rates is
  'Supplier prices for one product on one date. Staff-only — this is the cost side of what we sell.';

-- ── What we did with it ──────────────────────────────────────────────────────
-- The join between a customer-facing add-on and the supplier behind it. Its own table precisely so
-- the customer-facing one can stay readable by anon without leaking any of this.
create table public.add_on_sourcing (
  add_on_id           uuid primary key references public.departure_add_ons (id) on delete cascade,
  product_id          uuid not null references public.experience_products (id) on delete restrict,
  supplier            public.experience_supplier not null,
  supplier_option_id  text not null,
  -- What we were quoted when the add-on was created, and what we decided to charge. Keeping both
  -- is what makes "is this still worth selling" answerable a month later.
  net_amount          bigint not null check (net_amount >= 0),
  currency            public.currency_code not null,
  -- The rate row the price came from, so a margin can be traced to a quote rather than asserted.
  source_rate_id      uuid references public.experience_rates (id) on delete set null,
  last_checked_at     timestamptz,
  -- Set when a recheck found the supplier price had moved. Staff decide; nothing auto-reprices a
  -- live add-on, because a price a traveler is looking at should not change under them.
  drift_amount        bigint,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index add_on_sourcing_product_idx on public.add_on_sourcing (product_id);

create trigger add_on_sourcing_set_updated_at before update on public.add_on_sourcing
  for each row execute function public.set_updated_at();

comment on table public.add_on_sourcing is
  'Which supplier product an add-on came from and what it cost us. Staff-only and deliberately not a column on departure_add_ons, which anon can read.';

comment on column public.add_on_sourcing.drift_amount is
  'How far the supplier price has moved since we set ours, from the last recheck. Informational: nothing reprices a live add-on automatically.';

alter table public.experience_products enable row level security;
alter table public.experience_rates enable row level security;
alter table public.add_on_sourcing enable row level security;

create policy "staff read experience products" on public.experience_products
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage experience products" on public.experience_products
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "staff read experience rates" on public.experience_rates
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage experience rates" on public.experience_rates
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "staff read add-on sourcing" on public.add_on_sourcing
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage add-on sourcing" on public.add_on_sourcing
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- ── Pricing ──────────────────────────────────────────────────────────────────
-- `pricing_rules` already expresses "markup, by destination, with a priority and a date window".
-- An experience needs exactly that, so it gets a scope column rather than a second table: two
-- tables of markup rules is how a company ends up with two different margins by accident.
alter table public.pricing_rules
  add column applies_to text not null default 'hotel'
    check (applies_to in ('hotel', 'experience', 'any'));

comment on column public.pricing_rules.applies_to is
  'Which cost this rule marks up. Existing rows default to hotel, which is what they were written for.';

/**
 * What to charge for an experience, from what it costs us.
 *
 * Deliberately the same shape as `suggest_stay_price`: the highest-priority matching rule wins,
 * percentage and fixed markups add, and a minimum markup floors the result. It suggests — a person
 * still types the number, because a supplier's price plus arithmetic is not the same thing as what
 * a trip should cost.
 */
create or replace function public.suggest_experience_price(
  p_product_id uuid,
  p_net_amount bigint
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_destination uuid;
  v_rule        public.pricing_rules%rowtype;
  v_price       bigint;
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = 'insufficient_privilege';
  end if;

  select destination_id into v_destination
  from public.experience_products where id = p_product_id;

  select * into v_rule
  from public.pricing_rules r
  where r.is_active
    and r.applies_to in ('experience', 'any')
    and (r.destination_id is null or r.destination_id = v_destination)
    and (r.effective_from is null or r.effective_from <= current_date)
    and (r.effective_to is null or r.effective_to >= current_date)
  order by (r.destination_id is not null) desc, r.priority desc
  limit 1;

  if not found then
    -- No rule is not an error; it means nobody has decided a margin for this destination yet.
    return null;
  end if;

  v_price := p_net_amount
           + round(p_net_amount * v_rule.percentage_markup / 100.0)::bigint
           + v_rule.fixed_markup_amount;

  if v_price - p_net_amount < v_rule.min_markup_amount then
    v_price := p_net_amount + v_rule.min_markup_amount;
  end if;

  return v_price;
end;
$$;

revoke execute on function public.suggest_experience_price(uuid, bigint) from public;
grant execute on function public.suggest_experience_price(uuid, bigint) to authenticated, service_role;

comment on function public.suggest_experience_price(uuid, bigint) is
  'Suggested customer price for an experience given what it costs us. Highest-priority matching pricing rule wins; null when nobody has set a margin for that destination yet. Staff only — it takes a supplier cost as an argument.';
