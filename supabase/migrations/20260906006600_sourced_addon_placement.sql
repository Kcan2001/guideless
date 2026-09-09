-- Two decisions taken after 0065 was written, both of which change it.
--
-- 0065 assumed the hotel model: buy at a net rate, add a markup, sell at our price. Two answers
-- from Kyle moved it:
--
--   1. Sourced activities appear **in the trip, not in the shop**. Guideless sells a curated
--      product — four or five things somebody chose and negotiated. A long tail of commodity
--      tickets on the pre-sale tour page would read like an OTA and would cheapen the things that
--      are actually ours. They belong where the free time is: Explore, and the assistant, once
--      somebody is travelling.
--
--   2. We **match the supplier's public price** and earn the partner commission, rather than
--      marking up. A traveler can check the same activity in one search, and finding it cheaper
--      elsewhere is corrosive to a brand whose whole argument is that you are not being handled.
--      Less per sale; nothing to explain.
--
-- Together those make the markup machinery in 0065 the exception rather than the default, and give
-- an add-on a place to say where it may be shown.

-- ── Where a sourced extra is allowed to appear ───────────────────────────────
alter table public.departure_add_ons
  add column in_trip_only boolean not null default false;

comment on column public.departure_add_ons.in_trip_only is
  'True for extras that belong in the trip rather than in the shop: shown in the app''s Explore and by the assistant, hidden from the public tour page and the builder. Sourced activities default to true; anything hand-curated stays false.';

create index departure_add_ons_shop_idx
  on public.departure_add_ons (departure_id, position)
  where is_active and not in_trip_only;

-- ── Pricing: match, do not mark up ───────────────────────────────────────────
-- The old signature took a net cost and returned cost-plus. Under a commission model the number we
-- want is the supplier's own public price, and a markup is a deliberate exception — so the argument
-- is the retail price and the default answer is to return it unchanged.
drop function if exists public.suggest_experience_price(uuid, bigint);

create or replace function public.suggest_experience_price(
  p_product_id uuid,
  p_retail_amount bigint
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

  -- Only a rule written specifically for experiences applies. `any` is deliberately excluded here:
  -- a markup somebody set for hotels must not quietly start marking up activities as well.
  select * into v_rule
  from public.pricing_rules r
  where r.is_active
    and r.applies_to = 'experience'
    and (r.destination_id is null or r.destination_id = v_destination)
    and (r.effective_from is null or r.effective_from <= current_date)
    and (r.effective_to is null or r.effective_to >= current_date)
  order by (r.destination_id is not null) desc, r.priority desc
  limit 1;

  -- No rule is the normal case and the intended one: match the public price, keep the commission.
  if not found then
    return p_retail_amount;
  end if;

  v_price := p_retail_amount
           + round(p_retail_amount * v_rule.percentage_markup / 100.0)::bigint
           + v_rule.fixed_markup_amount;

  if v_price - p_retail_amount < v_rule.min_markup_amount then
    v_price := p_retail_amount + v_rule.min_markup_amount;
  end if;

  return v_price;
end;
$$;

revoke execute on function public.suggest_experience_price(uuid, bigint) from public;
grant execute on function public.suggest_experience_price(uuid, bigint) to authenticated, service_role;

comment on function public.suggest_experience_price(uuid, bigint) is
  'What to charge for a sourced experience. Defaults to the supplier''s own public price, because a traveler can check it in one search and we earn the partner commission instead of a markup. A pricing rule scoped to experiences overrides that deliberately. Staff only.';

comment on column public.add_on_sourcing.net_amount is
  'What the activity effectively costs us: under a commission model that is the retail price less our commission, not a wholesale rate. Recorded so margin is traceable to a quote rather than asserted. Confirm which of the two a supplier actually returns before trusting it — see scripts/viator-probe.mjs.';

comment on column public.experience_rates.total_amount is
  'The supplier''s public price — what a traveler would pay booking direct. This is the number we match.';
