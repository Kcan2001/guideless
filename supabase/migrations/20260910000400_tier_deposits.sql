-- Per-tier deposits.
--
-- THE BUG
-- `departures.deposit_amount` is one number for the whole departure, so Monaco's Elite tier took
-- the same $600 deposit as its cheapest tier — $600 collected at booking against a Monte Carlo room
-- that costs $19,626 and, like nearly every race-week rate, is non-refundable from purchase. If
-- that traveler walked away before the balance date we would be roughly $19,000 down on a booking
-- that had paid us $600.
--
-- THE RULE THIS ENCODES
-- A deposit exists to cover what we cannot get back. That is a property of the TIER, not of the
-- departure: Nice has hundreds of available rooms and refundable rates, so we need not commit
-- early and a small deposit is honest. Inside Monaco there is one room, it is non-refundable, and
-- we must buy it the moment a traveler confirms — so the deposit has to cover the room.
--
-- `departure_stay_options.deposit_amount` is nullable and falls back to the departure's figure, so
-- every existing departure behaves exactly as it did. quote_booking() is redefined below with one
-- line changed; the rest is copied verbatim from migration 20260906005000, which is the current
-- definition. `v_stay` was already loaded as a %rowtype, so the new column needed no other change.

alter table public.departure_stay_options
  add column deposit_amount bigint
    check (deposit_amount is null or deposit_amount >= 0);

comment on column public.departure_stay_options.deposit_amount is
  'Per-traveler deposit for this tier, in minor units. Null falls back to departures.deposit_amount. '
  'Set it to at least what we sink irrecoverably when a traveler on this tier confirms.';

create or replace function public.quote_booking(
  p_departure_id    uuid,
  p_room_indexes    integer[],
  p_stay_option_id  uuid default null,
  p_add_ons         jsonb default '[]'::jsonb,
  p_code            text default null,
  p_payment_option  text default 'deposit',
  p_apply_credit    boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := auth.uid();
  v_dep            public.departures%rowtype;
  v_stay           public.departure_stay_options%rowtype;
  v_n              integer;
  v_shared_disc    bigint;
  v_own_price      bigint;
  v_shared_price   bigint;
  v_n_shared       integer := 0;
  v_n_own          integer := 0;
  v_rooms          jsonb := '[]'::jsonb;
  v_lines          jsonb := '[]'::jsonb;
  v_problems       jsonb := '[]'::jsonb;
  v_base           bigint := 0;
  v_add_ons_total  bigint := 0;
  v_discount       bigint := 0;
  v_discount_kind  text;
  v_coupon         public.coupons%rowtype;
  v_referrer       uuid;
  v_credit         bigint := 0;
  v_subtotal       bigint;
  v_total          bigint;
  v_deposit        bigint;
  v_due_now        bigint;
  v_el             jsonb;
  v_add_on         public.departure_add_ons%rowtype;
  v_qty            integer;
  v_idx            integer[];
  v_avail          record;
  v_taken_tiers    jsonb := '{}'::jsonb;   -- tier_group -> traveler indexes already claimed
  v_pct            numeric;
  r                record;
begin
  -- Travelers and rooms -------------------------------------------------------
  v_n := coalesce(array_length(p_room_indexes, 1), 0);
  if v_n < 1 or v_n > 8 then
    return jsonb_build_object('problems', jsonb_build_array(jsonb_build_object('code', 'traveler_count')));
  end if;
  if p_payment_option not in ('deposit', 'full') then
    return jsonb_build_object('problems', jsonb_build_array(jsonb_build_object('code', 'invalid_payment_option')));
  end if;

  select * into v_dep from public.departures where id = p_departure_id;
  if not found then
    return jsonb_build_object('problems', jsonb_build_array(jsonb_build_object('code', 'departure_not_found')));
  end if;
  -- Trip drops: a departure with a future opens_at is visible and priced, but not bookable.
  if v_dep.opens_at is not null and v_dep.opens_at > now() then
    return jsonb_build_object('problems', jsonb_build_array(
      jsonb_build_object('code', 'departure_not_open', 'opensAt', v_dep.opens_at)));
  end if;

  for r in
    select room_index, count(*) as occupancy
    from unnest(p_room_indexes) as room_index
    group by room_index order by room_index
  loop
    if r.room_index < 1 or r.room_index > 8 then
      v_problems := v_problems || jsonb_build_object('code', 'room_index');
    end if;
    if r.occupancy > 2 then
      v_problems := v_problems || jsonb_build_object('code', 'room_capacity', 'roomIndex', r.room_index);
    elsif r.occupancy = 2 then
      v_n_shared := v_n_shared + 2;
    else
      v_n_own := v_n_own + 1;
    end if;
    v_rooms := v_rooms || jsonb_build_object('index', r.room_index, 'occupancy', r.occupancy);
  end loop;

  -- Stay option ---------------------------------------------------------------
  if p_stay_option_id is not null then
    select * into v_stay from public.departure_stay_options
    where id = p_stay_option_id and departure_id = p_departure_id and is_active;
    if not found then
      v_problems := v_problems || jsonb_build_object('code', 'stay_option_unknown');
    end if;
  else
    select * into v_stay from public.departure_stay_options
    where departure_id = p_departure_id and is_active
    order by is_default desc, position, created_at limit 1;
  end if;
  if v_stay.id is not null and v_stay.capacity is not null then
    select count(*) into v_qty
    from public.booking_travelers bt join public.bookings b on b.id = bt.booking_id
    where b.stay_option_id = v_stay.id
      and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.hold_expires_at > now()));
    if v_qty + v_n > v_stay.capacity then
      v_problems := v_problems || jsonb_build_object('code', 'stay_option_full', 'available', greatest(v_stay.capacity - v_qty, 0));
    end if;
  end if;

  v_shared_disc  := coalesce(v_stay.shared_room_discount_amount, v_dep.shared_room_discount_amount);
  v_own_price    := v_dep.price_amount + coalesce(v_stay.price_delta_amount, 0);
  v_shared_price := greatest(v_own_price - v_shared_disc, 0);

  if v_n_own > 0 then
    v_lines := v_lines || jsonb_build_object('kind', 'base', 'title', 'Trip · own room', 'quantity', v_n_own,
                 'unit_amount', v_own_price, 'total_amount', v_own_price * v_n_own);
    v_base := v_base + v_own_price * v_n_own;
  end if;
  if v_n_shared > 0 then
    v_lines := v_lines || jsonb_build_object('kind', 'base', 'title', 'Trip · shared room', 'quantity', v_n_shared,
                 'unit_amount', v_shared_price, 'total_amount', v_shared_price * v_n_shared);
    v_base := v_base + v_shared_price * v_n_shared;
  end if;

  -- Add-ons --------------------------------------------------------------------
  if p_add_ons is not null and jsonb_typeof(p_add_ons) = 'array' then
    for v_el in select * from jsonb_array_elements(p_add_ons) loop
      select * into v_add_on from public.departure_add_ons
      where id = (v_el ->> 'addOnId')::uuid and departure_id = p_departure_id and is_active;
      if not found then
        v_problems := v_problems || jsonb_build_object('code', 'add_on_unknown', 'addOnId', v_el ->> 'addOnId');
        continue;
      end if;
      if current_date > public.add_on_bookable_until(v_add_on) then
        v_problems := v_problems || jsonb_build_object('code', 'add_on_closed', 'addOnId', v_add_on.id);
        continue;
      end if;

      if v_add_on.pricing_basis = 'per_traveler' then
        select coalesce(array_agg(distinct x), '{}') into v_idx
        from jsonb_array_elements_text(coalesce(v_el -> 'travelerIndexes', '[]'::jsonb)) as t(x0)
        cross join lateral (select x0::integer as x) s
        where x between 1 and v_n;
        v_qty := coalesce(array_length(v_idx, 1), 0);
        if v_qty = 0 then continue; end if;
        if v_add_on.tier_group is not null then
          if exists (select 1 from unnest(v_idx) i
                     where coalesce(v_taken_tiers -> v_add_on.tier_group, '[]'::jsonb) @> to_jsonb(array[i])) then
            v_problems := v_problems || jsonb_build_object('code', 'tier_conflict', 'addOnId', v_add_on.id, 'tierGroup', v_add_on.tier_group);
            continue;
          end if;
          v_taken_tiers := jsonb_set(v_taken_tiers, array[v_add_on.tier_group],
            coalesce(v_taken_tiers -> v_add_on.tier_group, '[]'::jsonb) || to_jsonb(v_idx));
        end if;
      else
        v_qty := greatest(coalesce((v_el ->> 'quantity')::integer, 1), 1);
        v_idx := null;
        if v_add_on.tier_group is not null then
          if v_taken_tiers ? v_add_on.tier_group then
            v_problems := v_problems || jsonb_build_object('code', 'tier_conflict', 'addOnId', v_add_on.id, 'tierGroup', v_add_on.tier_group);
            continue;
          end if;
          v_taken_tiers := jsonb_set(v_taken_tiers, array[v_add_on.tier_group], '[0]'::jsonb);
        end if;
      end if;

      if v_add_on.capacity is not null then
        select * into v_avail from public.add_on_availability where add_on_id = v_add_on.id;
        if v_qty > greatest(v_add_on.capacity - v_avail.confirmed - v_avail.held, 0) then
          v_problems := v_problems || jsonb_build_object('code', 'add_on_sold_out', 'addOnId', v_add_on.id,
                          'available', greatest(v_add_on.capacity - v_avail.confirmed - v_avail.held, 0));
          continue;
        end if;
      end if;

      v_lines := v_lines || jsonb_build_object('kind', 'add_on', 'add_on_id', v_add_on.id, 'title', v_add_on.title,
                   'quantity', v_qty, 'unit_amount', v_add_on.price_amount, 'total_amount', v_add_on.price_amount * v_qty,
                   'pricing_basis', v_add_on.pricing_basis, 'traveler_indexes', coalesce(to_jsonb(v_idx), 'null'::jsonb),
                   'tier_group', v_add_on.tier_group, 'day_number', v_add_on.day_number);
      v_add_ons_total := v_add_ons_total + v_add_on.price_amount * v_qty;
    end loop;
  end if;

  -- Coupon or referral code (base trip only) ----------------------------------
  if nullif(trim(p_code), '') is not null then
    select * into v_coupon from public.coupons
    where code = trim(p_code) and is_active
      and (valid_from is null or valid_from <= now())
      and (valid_until is null or valid_until >= now())
      and (max_redemptions is null or redemptions < max_redemptions);
    if found then
      if v_coupon.amount_off is not null and v_coupon.currency <> v_dep.currency then
        v_problems := v_problems || jsonb_build_object('code', 'code_currency');
      else
        v_discount := least(v_base, coalesce(v_coupon.amount_off, (v_base * v_coupon.percent_off + 50) / 100));
        v_discount_kind := 'coupon';
        v_lines := v_lines || jsonb_build_object('kind', 'discount', 'title', 'Code ' || upper(trim(p_code)), 'quantity', 1,
                     'unit_amount', -v_discount, 'total_amount', -v_discount, 'coupon_id', v_coupon.id);
      end if;
    else
      select user_id into v_referrer from public.referral_codes where code = upper(trim(p_code));
      if v_referrer is null then
        v_problems := v_problems || jsonb_build_object('code', 'code_invalid');
      elsif v_referrer = v_uid then
        v_problems := v_problems || jsonb_build_object('code', 'code_own_referral');
      else
        select coalesce((value #>> '{}')::numeric, 5) into v_pct from public.system_settings where key = 'referral_discount_percent';
        v_discount := least(v_base, ((v_base * coalesce(v_pct, 5)) / 100)::bigint);
        v_discount_kind := 'referral';
        v_lines := v_lines || jsonb_build_object('kind', 'discount', 'title', 'Friend''s referral', 'quantity', 1,
                     'unit_amount', -v_discount, 'total_amount', -v_discount, 'referrer_id', v_referrer, 'referral_code', upper(trim(p_code)));
      end if;
    end if;
  end if;

  -- Account credit --------------------------------------------------------------
  if p_apply_credit and v_uid is not null then
    v_credit := least(public.account_credit_balance(v_uid, v_dep.currency::text), v_base - v_discount);
    if v_credit > 0 then
      v_lines := v_lines || jsonb_build_object('kind', 'discount', 'title', 'Account credit', 'quantity', 1,
                   'unit_amount', -v_credit, 'total_amount', -v_credit, 'credit_applied', v_credit);
    else
      v_credit := 0;
    end if;
  end if;

  -- Totals -----------------------------------------------------------------------
  v_subtotal := v_base + v_add_ons_total;
  v_total    := v_subtotal - v_discount - v_credit;
  -- Deposit per traveler: the tier's own figure when it has one, otherwise the departure's.
  -- A tier whose room is scarce and prepaid non-refundable has to collect enough at booking to
  -- cover what we immediately sink; a tier we can still walk away from does not. See migration
  -- 20260910000400 for why this column exists.
  v_deposit  := coalesce(v_stay.deposit_amount, v_dep.deposit_amount);
  v_deposit  := case when v_deposit > 0 then v_deposit * v_n else 0 end;
  v_due_now  := case when p_payment_option = 'full' or v_deposit = 0 then v_total
                     else least(v_total, v_deposit + v_add_ons_total) end;

  return jsonb_build_object(
    'departure_id', v_dep.id,
    'currency', v_dep.currency,
    'travelers', v_n,
    'rooms', v_rooms,
    'stay_option_id', v_stay.id,
    'stay_option_name', v_stay.name,
    'lines', v_lines,
    'base_amount', v_base,
    'add_ons_amount', v_add_ons_total,
    'subtotal_amount', v_subtotal,
    'discount_amount', v_discount,
    'discount_kind', v_discount_kind,
    'credit_amount', v_credit,
    'total_amount', v_total,
    'deposit_amount', v_deposit,
    'due_now_amount', v_due_now,
    'balance_amount', v_total - v_due_now,
    'payment_option', p_payment_option,
    'problems', v_problems
  );
end;
$$;
