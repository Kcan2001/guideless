-- Referral economics that do not cost us a trip.
--
-- WHAT WAS WRONG
-- The referee's discount was 5% of the base trip, uncapped, on a catalogue whose prices now run
-- from $1,385 to about $46,000. That is $69 off a Nice trip and $1,580 off a Monte Carlo one —
-- twenty-three times the giveaway for the same act of telling a friend, and the expensive end is
-- exactly where our margin is already committed to a non-refundable room.
--
-- On top of that the referrer earned an escalating ladder that reached $500 plus "an experience on
-- us" at four friends, and `host_free_spot_threshold` gave a host a free place at eight travelers.
-- A free seat on the Monaco departure is a $1,385 to $31,640 gift, and on Premium or Elite it is a
-- room we have already paid for and cannot resell.
--
-- WHAT THE MARKET ACTUALLY DOES
-- Costsaver and the TTC brands (Contiki, Insight, Trafalgar) pay a flat $100 travel credit to the
-- referrer, once the referred booking is paid in full. Intrepid's incentive is a $100 voucher.
-- WeRoad is the outlier at 10% to the friend and 5% stacking to 50%, and WeRoad is not selling a
-- $31,640 room. The norm is a flat, modest, one-sided credit.
--
-- WHAT WE DO NOW
--   Referrer   $100 credit, flat, on any trip, when the referred booking confirms.
--   Referee    $50 off, flat, on any trip.
--
-- $150 total against a gross margin that starts at about $430 on the cheapest tier. That is a
-- referral costing roughly a third of the margin it brings in, which is cheaper than any paid
-- channel and cannot run away from us at the top of the range. The escalating ladder is gone and
-- the host free spot is gone: we have a product, an app and a group to sell, and none of those
-- get cheaper by giving the trip away.

insert into public.system_settings (key, value, description) values
  ('referral_discount_amount', '5000',
   'Fixed amount off the base trip (minor units) for a customer booking with a friend''s referral code. Flat, never a percentage: a percentage of a $31,640 trip is not a thank-you, it is a hole.')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- $75 → $100, matching Costsaver and Intrepid.
update public.system_settings
set value = '10000',
    description = 'Credit (minor units, in the booking currency) the referrer earns when the referred booking is confirmed. Flat, and deliberately close to what the large operators pay.'
where key = 'referral_reward_amount';

-- The escalating ladder is retired. One flat rate, however many friends: the fourth referral is
-- not worth five times the first, and "an experience on us" was an uncosted promise.
update public.system_settings
set value = '[]'::jsonb,
    description = 'Retired 2026-09-10. Referrals pay a flat referral_reward_amount however many a customer brings. Kept as an empty list so existing readers do not break.'
where key = 'referral_tiers';

-- A free place is the single most expensive thing we could give away, and on the tiers where a
-- host is most useful it is a room we have already bought and cannot resell. Hosts get the flat
-- referral credit like everyone else until there is a costed model that survives a Monte Carlo room.
update public.system_settings
set value = '0',
    description = 'Retired 2026-09-10: 0 disables the free host place. A free seat on an event departure is a $1,385-$31,640 gift against a non-refundable room. Hosts earn referral credit instead.'
where key = 'host_free_spot_threshold';

-- The percentage setting stays, unread, so nothing that still selects it errors. quote_booking now
-- reads referral_discount_amount; this row is a tombstone rather than a switch.
update public.system_settings
set description = 'RETIRED 2026-09-10, no longer read by quote_booking(). Referral discounts are a flat amount (referral_discount_amount). Left in place so older readers do not fail.'
where key = 'referral_discount_percent';

-- quote_booking, re-created from migration 20260910000400 with only the referral discount changed
-- from a percentage of the base to a flat amount.
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
        -- A FIXED amount, not a percentage. See migration 20260910000800 for why: 5% of a Nice
        -- trip is $69 and 5% of a Monte Carlo one is $1,580, and nothing about referring a friend
        -- is worth twenty-three times more because they picked a scarcer room.
        select coalesce((value #>> '{}')::numeric, 5000) into v_pct
          from public.system_settings where key = 'referral_discount_amount';
        v_discount := least(v_base, coalesce(v_pct, 5000)::bigint);
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

-- ── sync_referral_tier, flattened ────────────────────────────────────────────
-- The ladder was the referrer's TOTAL entitlement, and this function settled the difference between
-- that total and what had already been paid. Emptying `referral_tiers` therefore did not flatten
-- the model, it set entitlement to zero and clawed the flat $100 straight back — the tests caught
-- it immediately. Entitlement is now simply the flat reward times the number of referrals earned.
--
-- Everything else about the design is worth keeping and is kept: it recomputes from scratch, so it
-- is idempotent and reverses itself when a referral is voided (the count drops, the next call
-- writes the negative difference). That is what makes a cancelled referred booking take its credit
-- back without anybody having to remember to do it.
create or replace function public.sync_referral_tier(p_user_id uuid, p_currency public.currency_code)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned      integer;
  v_reward      bigint;
  v_entitlement bigint := 0;
  v_paid        bigint;
  v_delta       bigint;
begin
  select count(*) into v_earned
  from public.referrals
  where referrer_id = p_user_id and status = 'earned';

  select coalesce((value #>> '{}')::bigint, 10000) into v_reward
  from public.system_settings where key = 'referral_reward_amount';

  -- Flat, per friend, however many. The fourth referral is worth what the first was.
  v_entitlement := v_earned * coalesce(v_reward, 10000);

  select coalesce(sum(amount), 0) into v_paid
  from public.account_credits
  where user_id = p_user_id and currency = p_currency
    and source in ('referral_tier', 'referral_reward');

  v_delta := v_entitlement - v_paid;
  if v_delta = 0 then return 0; end if;

  insert into public.account_credits (user_id, amount, currency, source, note)
  values (p_user_id, v_delta, p_currency, 'referral_tier',
          case when v_delta > 0
               then 'Referral credit — ' || v_earned || ' friend' || case when v_earned = 1 then '' else 's' end || ' booked'
               else 'Referral credit adjusted — ' || v_earned || ' friend' || case when v_earned = 1 then '' else 's' end || ' booked' end);
  return v_delta;
end;
$$;

comment on function public.sync_referral_tier(uuid, public.currency_code) is
  'Settles a referrer''s total referral credit to (earned referrals x referral_reward_amount). '
  'Recomputes from scratch, so it is idempotent and claws back automatically when a referral is '
  'voided. Flat since 2026-09-10: the escalating ladder was retired.';
