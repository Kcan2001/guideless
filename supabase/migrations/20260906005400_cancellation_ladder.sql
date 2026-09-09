-- Cancellation ladders on hotel rates.
--
-- `hotel_rates.cancellation_policy` held a single `deadline` and `penaltyAmount`. Real suppliers do
-- not work that way. Probing one LiteAPI hotel for one date range returned 200 rates: 116 of them
-- carried more than one cancellation window and the deepest had five. Collapsing that to one date
-- loses every middle rung, and the loss is money in both directions — believing a rate is free to
-- cancel on a day the supplier already charges for, or holding a traveler to a penalty we were
-- never charged.
--
-- The column stays jsonb and stays an object, so no data migration is needed. The ladder lives at
-- `windows`: an array of {from, penaltyAmount} ascending, where cancelling on or after `from` costs
-- `penaltyAmount` in minor units. `deadline` and `penaltyAmount` are still written by the adapters
-- for rows read by anything that has not been updated, and they mirror the first window.
--
-- What changes in SQL is the equivalent-product key. `suggest_stay_price()` grouped rates by
-- `cancellation_policy ->> 'deadline'`; it now groups by the day free cancellation ends, read from
-- the ladder with the legacy field as a fallback. `apps/web/lib/hotels/fingerprint.ts` mirrors this
-- exactly, and a rate whose ladder we cannot read groups under the empty key rather than guessing.

-- ── Reading the ladder ───────────────────────────────────────────────────────
create or replace function public.hotel_rate_free_until(policy jsonb)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    -- Earliest window start. Not windows->0: nothing guarantees the supplier sent them in order.
    (select min((w ->> 'from')::timestamptz)
     from jsonb_array_elements(case
            when jsonb_typeof(policy -> 'windows') = 'array' then policy -> 'windows'
            else '[]'::jsonb
          end) as w
     where (w ->> 'from') is not null),
    -- Rows written before ladders existed.
    case when (policy ->> 'deadline') is not null
         then (policy ->> 'deadline')::timestamptz
    end
  );
$$;

comment on function public.hotel_rate_free_until(jsonb) is
  'When free cancellation ends for a stored rate: the earliest ladder window, falling back to the legacy single deadline. Null means the ladder is empty — free to the wire, or never refundable, which refundable tells apart.';

create or replace function public.hotel_rate_penalty_at(policy jsonb, at timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select (w ->> 'penaltyAmount')::bigint
     from jsonb_array_elements(case
            when jsonb_typeof(policy -> 'windows') = 'array' then policy -> 'windows'
            else '[]'::jsonb
          end) as w
     where (w ->> 'from') is not null
       and (w ->> 'from')::timestamptz <= at
     order by (w ->> 'from')::timestamptz desc
     limit 1),
    0::bigint
  );
$$;

comment on function public.hotel_rate_penalty_at(jsonb, timestamptz) is
  'What cancelling a stored rate at a given moment costs us, in minor units: the latest window already started. Zero before the first window. A never-refundable rate has no windows and also returns zero, so read it with refundable.';

-- ── Group equivalent products by the day free cancellation ends ──────────────
-- Body identical to migration 0044 except the DISTINCT ON / ORDER BY key.
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
        (public.hotel_rate_free_until(r.cancellation_policy))::date, r.breakfast_included, r.payment_type)
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
             (public.hotel_rate_free_until(r.cancellation_policy))::date, r.breakfast_included, r.payment_type,
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
           'free_until', public.hotel_rate_free_until(p.cancellation_policy),
           'cancellation_windows', coalesce(jsonb_array_length(
             case when jsonb_typeof(p.cancellation_policy -> 'windows') = 'array'
                  then p.cancellation_policy -> 'windows' else '[]'::jsonb end), 0),
           'expires_at', p.expires_at
         ) order by p.total_amount + p.markup), '[]'::jsonb)
  into v_rates
  from priced p;

  return jsonb_build_object('rates', v_rates, 'rule_id', v_rule.id);
end;
$$;

revoke execute on function public.suggest_stay_price(uuid, date, date, integer) from public;
grant execute on function public.suggest_stay_price(uuid, date, date, integer) to authenticated, service_role;
