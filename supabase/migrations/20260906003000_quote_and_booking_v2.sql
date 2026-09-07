-- 031_quote_and_booking_v2
-- One place computes money: quote_booking(). The checkout calls it for the live total (anon ok,
-- read-only), create_booking() calls it again inside the transaction and stores the result, and
-- start_add_on_purchase() reuses it for add-ons bought later. The client never invents a price.
--
-- Rules (see migration 029 header): own room by default, shared-room discount for pairs, stay
-- option delta per traveler, add-ons paid in full now and never part of the deposit, a coupon OR
-- a referral code discounts the base trip, and signed-in customers' account credit is applied.

-- ── Quote ────────────────────────────────────────────────────────────────────
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
  v_deposit  := case when v_dep.deposit_amount > 0 then v_dep.deposit_amount * v_n else 0 end;
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
grant execute on function public.quote_booking(uuid, integer[], uuid, jsonb, text, text, boolean) to anon, authenticated, service_role;

-- ── create_booking v2 ────────────────────────────────────────────────────────
drop function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text);

create or replace function public.create_booking(
  p_departure_id      uuid,
  p_travelers         jsonb,
  p_emergency_contact jsonb,
  p_preferences       jsonb,
  p_payment_option    text default 'deposit',
  p_terms_version     text default 'v1',
  p_stay_option_id    uuid default null,
  p_add_ons           jsonb default '[]'::jsonb,
  p_code              text default null
)
returns table (
  booking_id          uuid,
  confirmation_number text,
  currency            text,
  total_amount        bigint,
  deposit_amount      bigint,
  amount_due_now      bigint,
  hold_expires_at     timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_dep          public.departures%rowtype;
  v_count        integer;
  v_hold_minutes integer;
  v_booking_id   uuid;
  v_conf         text;
  v_hold_until   timestamptz;
  v_traveler     jsonb;
  v_traveler_id  uuid;
  v_traveler_ids uuid[] := '{}';
  v_rooms        integer[] := '{}';
  v_i            integer := 0;
  v_quote        jsonb;
  v_line         jsonb;
  v_idx          integer;
begin
  if v_uid is null then
    raise exception 'Sign in to book' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if p_payment_option not in ('deposit', 'full') then
    raise exception 'Invalid payment option' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_travelers) <> 'array' then
    raise exception 'Travelers must be an array' using errcode = 'check_violation';
  end if;
  v_count := jsonb_array_length(p_travelers);
  if v_count < 1 or v_count > 8 then
    raise exception 'A booking holds 1 to 8 travelers' using errcode = 'check_violation', hint = 'traveler_count';
  end if;

  select * into v_dep from public.departures where id = p_departure_id for update;
  if not found then
    raise exception 'Departure not found' using errcode = 'no_data_found';
  end if;
  if v_dep.status not in ('open', 'guaranteed') then
    raise exception 'This departure is not open for booking' using errcode = 'check_violation', hint = 'departure_closed';
  end if;
  if v_dep.start_date <= current_date or (v_dep.booking_deadline is not null and v_dep.booking_deadline < current_date) then
    raise exception 'The booking deadline for this departure has passed' using errcode = 'check_violation', hint = 'deadline_passed';
  end if;

  -- Room layout: each traveler names a room (default: their own).
  for v_traveler in select * from jsonb_array_elements(p_travelers) loop
    v_i := v_i + 1;
    v_rooms := v_rooms || coalesce((v_traveler ->> 'roomIndex')::integer, v_i);
  end loop;

  v_quote := public.quote_booking(p_departure_id, v_rooms, p_stay_option_id, p_add_ons, p_code, p_payment_option, true);
  if jsonb_array_length(v_quote -> 'problems') > 0 then
    raise exception 'Quote problem: %', v_quote -> 'problems' ->> 0
      using errcode = 'check_violation', hint = (v_quote -> 'problems' -> 0 ->> 'code');
  end if;

  select coalesce((value #>> '{}')::integer, 30) into v_hold_minutes
  from public.system_settings where key = 'booking_hold_minutes';
  v_hold_minutes := coalesce(v_hold_minutes, 30);
  v_hold_until := now() + make_interval(mins => v_hold_minutes);

  insert into public.bookings (
    customer_id, departure_id, tour_version_id, status, payment_status, currency,
    subtotal_amount, discount_amount, total_amount, deposit_amount, hold_expires_at,
    terms_accepted_at, terms_version, stay_option_id)
  values (
    v_uid, v_dep.id, v_dep.tour_version_id, 'pending_payment', 'unpaid', v_dep.currency,
    (v_quote ->> 'subtotal_amount')::bigint,
    (v_quote ->> 'discount_amount')::bigint + (v_quote ->> 'credit_amount')::bigint,
    (v_quote ->> 'total_amount')::bigint,
    (v_quote ->> 'deposit_amount')::bigint,
    v_hold_until, now(), p_terms_version,
    nullif(v_quote ->> 'stay_option_id', '')::uuid)
  returning id, bookings.confirmation_number into v_booking_id, v_conf;

  -- Line items exactly as quoted (add-ons are recorded on booking_add_ons below).
  for v_line in select * from jsonb_array_elements(v_quote -> 'lines') loop
    if v_line ->> 'kind' = 'add_on' then continue; end if;
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    values (v_booking_id, v_line ->> 'kind', v_line ->> 'title', (v_line ->> 'quantity')::integer,
            (v_line ->> 'unit_amount')::bigint, (v_line ->> 'total_amount')::bigint, v_dep.currency,
            v_line - 'kind' - 'title' - 'quantity' - 'unit_amount' - 'total_amount');
  end loop;
  if (v_quote ->> 'stay_option_id') is not null then
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    values (v_booking_id, 'base', 'Stay: ' || (v_quote ->> 'stay_option_name'), 1, 0, 0, v_dep.currency,
            jsonb_build_object('stay_option_id', v_quote ->> 'stay_option_id'));
  end if;

  v_i := 0;
  for v_traveler in select * from jsonb_array_elements(p_travelers) loop
    v_i := v_i + 1;
    insert into public.traveler_profiles (
      owner_user_id, user_id, first_name, last_name, preferred_name, email, phone, date_of_birth, nationality,
      room_preference, dietary_requirements, accessibility_notes)
    values (
      v_uid,
      case when v_i = 1 then v_uid else null end,
      v_traveler ->> 'firstName',
      v_traveler ->> 'lastName',
      nullif(v_traveler ->> 'preferredName', ''),
      nullif(v_traveler ->> 'email', ''),
      nullif(v_traveler ->> 'phone', ''),
      (v_traveler ->> 'dateOfBirth')::date,
      nullif(v_traveler ->> 'nationality', ''),
      (case when (select count(*) from unnest(v_rooms) x where x = v_rooms[v_i]) = 2 then 'shared_double' else 'single' end)::public.room_preference,
      nullif(p_preferences ->> 'dietaryRequirements', ''),
      nullif(p_preferences ->> 'accessibilityNeeds', ''))
    returning id into v_traveler_id;
    v_traveler_ids := v_traveler_ids || v_traveler_id;

    if v_i = 1 and p_emergency_contact is not null and jsonb_typeof(p_emergency_contact) = 'object' then
      insert into public.emergency_contacts (traveler_id, name, relationship, phone, email)
      values (v_traveler_id, p_emergency_contact ->> 'name', p_emergency_contact ->> 'relationship',
              p_emergency_contact ->> 'phone', nullif(p_emergency_contact ->> 'email', ''));
    end if;

    -- Capacity guard trigger fires here and raises 'departure_sold_out' if over capacity.
    insert into public.booking_travelers (booking_id, traveler_id, is_lead, room_index)
    values (v_booking_id, v_traveler_id, v_i = 1, v_rooms[v_i]);
  end loop;

  -- Add-ons: pending until the booking is paid; the hold mirrors the seat hold.
  for v_line in select * from jsonb_array_elements(v_quote -> 'lines') where value ->> 'kind' = 'add_on' loop
    if v_line ->> 'pricing_basis' = 'per_traveler' then
      for v_idx in select (x)::integer from jsonb_array_elements_text(v_line -> 'traveler_indexes') as t(x) loop
        insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, hold_expires_at)
        values (v_booking_id, (v_line ->> 'add_on_id')::uuid, v_traveler_ids[v_idx], 1,
                (v_line ->> 'unit_amount')::bigint, (v_line ->> 'unit_amount')::bigint, v_dep.currency, 'pending', v_hold_until);
      end loop;
    else
      insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, hold_expires_at)
      values (v_booking_id, (v_line ->> 'add_on_id')::uuid, null, (v_line ->> 'quantity')::integer,
              (v_line ->> 'unit_amount')::bigint, (v_line ->> 'total_amount')::bigint, v_dep.currency, 'pending', v_hold_until);
    end if;
  end loop;

  -- Referral: recorded now, rewarded when the booking is confirmed (trigger below).
  if v_quote ->> 'discount_kind' = 'referral' then
    insert into public.referrals (code, referrer_id, referred_user_id, booking_id, status, reward_amount, currency)
    select ln ->> 'referral_code', (ln ->> 'referrer_id')::uuid, v_uid, v_booking_id, 'pending',
           coalesce((select (value #>> '{}')::bigint from public.system_settings where key = 'referral_reward_amount'), 7500),
           v_dep.currency
    from jsonb_array_elements(v_quote -> 'lines') as l(ln) where ln ->> 'kind' = 'discount' and ln ? 'referrer_id'
    limit 1;
  end if;

  insert into public.booking_preferences (
    booking_id, room_preference, dietary_requirements, accessibility_needs, airport_transfer, optional_experience_ids)
  values (
    v_booking_id,
    (case when v_count > 1 and array_length(v_rooms, 1) > (select count(distinct x) from unnest(v_rooms) x) then 'shared_double' else 'single' end)::public.room_preference,
    nullif(p_preferences ->> 'dietaryRequirements', ''),
    nullif(p_preferences ->> 'accessibilityNeeds', ''),
    coalesce((p_preferences ->> 'airportTransfer')::public.transfer_preference, 'group_welcome_transfer'),
    '{}'::uuid[]);

  return query
    select v_booking_id, v_conf, v_dep.currency::text,
           (v_quote ->> 'total_amount')::bigint, (v_quote ->> 'deposit_amount')::bigint,
           (v_quote ->> 'due_now_amount')::bigint, v_hold_until;
end;
$$;
revoke execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text, uuid, jsonb, text) from public;
grant execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text, uuid, jsonb, text) to authenticated, service_role;

-- ── Booking status side effects ──────────────────────────────────────────────
create or replace function public.bookings_sync_add_ons_and_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit  bigint;
  v_coupon  uuid;
  v_ref     public.referrals%rowtype;
begin
  if new.status = old.status then return new; end if;

  if new.status = 'confirmed' and old.status = 'pending_payment' then
    update public.booking_add_ons set status = 'confirmed', hold_expires_at = null
    where booking_id = new.id and status = 'pending' and purchase_id is null;

    -- Redeem the account credit that the quote applied.
    select coalesce(sum((metadata ->> 'credit_applied')::bigint), 0) into v_credit
    from public.booking_items where booking_id = new.id and kind = 'discount' and metadata ? 'credit_applied';
    if v_credit > 0 then
      insert into public.account_credits (user_id, amount, currency, source, booking_id, note)
      values (new.customer_id, -v_credit, new.currency, 'redemption', new.id, 'Applied at checkout');
    end if;

    -- Count the coupon redemption.
    select (metadata ->> 'coupon_id')::uuid into v_coupon
    from public.booking_items where booking_id = new.id and kind = 'discount' and metadata ? 'coupon_id' limit 1;
    if v_coupon is not null then
      update public.coupons set redemptions = redemptions + 1 where id = v_coupon;
    end if;

    -- Reward the referrer.
    select * into v_ref from public.referrals where booking_id = new.id and status = 'pending';
    if found then
      update public.referrals set status = 'earned', earned_at = now() where id = v_ref.id;
      insert into public.account_credits (user_id, amount, currency, source, booking_id, note)
      values (v_ref.referrer_id, v_ref.reward_amount, v_ref.currency, 'referral_reward', new.id, 'A friend booked with your code');
    end if;
  end if;

  if new.status in ('draft', 'cancelled', 'refunded') then
    update public.booking_add_ons set status = 'cancelled', cancelled_at = now()
    where booking_id = new.id and status = 'pending';
    if new.status in ('cancelled', 'refunded') then
      update public.booking_add_ons set status = 'cancelled', cancelled_at = now()
      where booking_id = new.id and status = 'confirmed';
      update public.referrals set status = 'void' where booking_id = new.id and status = 'pending';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_sync_add_ons_and_rewards after update of status on public.bookings
  for each row execute function public.bookings_sync_add_ons_and_rewards();

-- ── Add-ons bought later (account page, or the app mid-trip) ─────────────────
create or replace function public.start_add_on_purchase(p_booking_id uuid, p_add_ons jsonb)
returns table (purchase_id uuid, amount bigint, currency text, summary text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_booking   public.bookings%rowtype;
  v_rooms     integer[];
  v_ids       uuid[];
  v_quote     jsonb;
  v_line      jsonb;
  v_purchase  uuid := gen_random_uuid();
  v_total     bigint := 0;
  v_titles    text[] := '{}';
  v_idx       integer;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found or v_booking.status <> 'confirmed' then
    raise exception 'This booking cannot take add-ons' using errcode = 'check_violation', hint = 'not_payable';
  end if;

  select array_agg(bt.room_index order by bt.is_lead desc, bt.created_at), array_agg(bt.traveler_id order by bt.is_lead desc, bt.created_at)
  into v_rooms, v_ids
  from public.booking_travelers bt where bt.booking_id = p_booking_id;

  -- Price only the add-ons; ignore codes and credit so the base trip is untouched.
  v_quote := public.quote_booking(v_booking.departure_id, v_rooms, v_booking.stay_option_id, p_add_ons, null, 'full', false);
  if jsonb_array_length(v_quote -> 'problems') > 0 then
    raise exception 'Add-on problem: %', v_quote -> 'problems' ->> 0
      using errcode = 'check_violation', hint = (v_quote -> 'problems' -> 0 ->> 'code');
  end if;

  for v_line in select * from jsonb_array_elements(v_quote -> 'lines') where value ->> 'kind' = 'add_on' loop
    v_titles := v_titles || (v_line ->> 'title');
    v_total := v_total + (v_line ->> 'total_amount')::bigint;
    if v_line ->> 'pricing_basis' = 'per_traveler' then
      for v_idx in select (x)::integer from jsonb_array_elements_text(v_line -> 'traveler_indexes') as t(x) loop
        insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, purchase_id, hold_expires_at)
        values (p_booking_id, (v_line ->> 'add_on_id')::uuid, v_ids[v_idx], 1,
                (v_line ->> 'unit_amount')::bigint, (v_line ->> 'unit_amount')::bigint, v_booking.currency, 'pending', v_purchase, now() + interval '30 minutes');
      end loop;
    else
      insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, purchase_id, hold_expires_at)
      values (p_booking_id, (v_line ->> 'add_on_id')::uuid, null, (v_line ->> 'quantity')::integer,
              (v_line ->> 'unit_amount')::bigint, (v_line ->> 'total_amount')::bigint, v_booking.currency, 'pending', v_purchase, now() + interval '30 minutes');
    end if;
  end loop;

  if v_total <= 0 then
    raise exception 'Nothing to add' using errcode = 'check_violation', hint = 'nothing_selected';
  end if;

  return query select v_purchase, v_total, v_booking.currency::text, array_to_string(v_titles, ', ');
end;
$$;
revoke execute on function public.start_add_on_purchase(uuid, jsonb) from public;
grant execute on function public.start_add_on_purchase(uuid, jsonb) to authenticated, service_role;

-- Called by the Stripe webhook once the purchase session is paid. Idempotent on the payment intent.
create or replace function public.confirm_add_on_purchase(
  p_purchase_id        uuid,
  p_amount             bigint,
  p_payment_intent_id  text,
  p_session_id         text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id  uuid;
  v_currency    public.currency_code;
  v_payment_id  uuid;
  v_expected    bigint;
begin
  if exists (select 1 from public.payments where stripe_payment_intent_id = p_payment_intent_id) then
    return false;
  end if;
  select booking_id, currency, sum(total_amount) into v_booking_id, v_currency, v_expected
  from public.booking_add_ons where purchase_id = p_purchase_id and status = 'pending'
  group by booking_id, currency;
  if v_booking_id is null then
    raise exception 'Purchase % has no pending add-ons', p_purchase_id;
  end if;

  insert into public.payments (booking_id, kind, amount, currency, stripe_payment_intent_id, stripe_checkout_session_id, stripe_status, paid_at)
  values (v_booking_id, 'add_on', p_amount, v_currency, p_payment_intent_id, p_session_id, 'succeeded', now())
  returning id into v_payment_id;

  update public.booking_add_ons
  set status = 'confirmed', hold_expires_at = null, payment_id = v_payment_id, stripe_checkout_session_id = p_session_id
  where purchase_id = p_purchase_id and status = 'pending';

  insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
  select ba.booking_id, 'add_on', a.title, ba.quantity, ba.unit_amount, ba.total_amount, ba.currency,
         jsonb_build_object('add_on_id', ba.add_on_id, 'purchase_id', p_purchase_id)
  from public.booking_add_ons ba join public.departure_add_ons a on a.id = ba.add_on_id
  where ba.purchase_id = p_purchase_id;

  update public.bookings
  set subtotal_amount = subtotal_amount + p_amount,
      total_amount    = total_amount + p_amount,
      amount_paid     = amount_paid + p_amount
  where id = v_booking_id;
  return true;
end;
$$;
revoke execute on function public.confirm_add_on_purchase(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.confirm_add_on_purchase(uuid, bigint, text, text) to service_role;

create or replace function public.release_expired_add_on_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with released as (
    update public.booking_add_ons set status = 'cancelled', cancelled_at = now()
    where status = 'pending' and purchase_id is not null and hold_expires_at <= now()
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;
revoke execute on function public.release_expired_add_on_holds() from public, anon, authenticated;
select cron.schedule('release-expired-add-on-holds', '*/5 * * * *', $$ select public.release_expired_add_on_holds(); $$);

-- Line items for the initial add-ons appear once the booking is confirmed.
create or replace function public.booking_add_ons_write_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status = 'pending' and new.purchase_id is null then
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    select new.booking_id, 'add_on', a.title, new.quantity, new.unit_amount, new.total_amount, new.currency,
           jsonb_build_object('add_on_id', new.add_on_id, 'traveler_id', new.traveler_id)
    from public.departure_add_ons a where a.id = new.add_on_id;
  end if;
  return new;
end;
$$;
create trigger booking_add_ons_write_items after update of status on public.booking_add_ons
  for each row execute function public.booking_add_ons_write_items();

-- ── "6 of your group are on the boat": who, for trip members only ────────────
create or replace function public.trip_add_on_participants(p_trip_id uuid)
returns table (add_on_id uuid, user_id uuid, display_name text, first_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select ba.add_on_id, coalesce(tp.user_id, b.customer_id) as user_id,
         nullif(p.display_name, '') as display_name, tp.first_name
  from public.trips t
  join public.bookings b on b.departure_id = t.departure_id and b.status = 'confirmed'
  join public.booking_add_ons ba on ba.booking_id = b.id and ba.status = 'confirmed'
  left join public.traveler_profiles tp on tp.id = ba.traveler_id
  left join public.profiles p on p.id = coalesce(tp.user_id, b.customer_id)
  where t.id = p_trip_id
    and ((select public.is_trip_member(p_trip_id)) or (select public.is_staff()));
$$;
grant execute on function public.trip_add_on_participants(uuid) to authenticated, service_role;
