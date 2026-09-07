-- plpgsql_check (supabase db lint --level warning) flagged three functions from
-- 20260906003000_quote_and_booking_v2.sql:
--   * array locals initialised from a text literal ('{}') instead of a typed empty array;
--   * confirm_add_on_purchase declared v_expected but never read it.
-- Behaviour is unchanged; the bodies below are the v2 definitions with only those edits.

-- ── create_booking ───────────────────────────────────────────────────────────
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
  v_traveler_ids uuid[] := array[]::uuid[];
  v_rooms        integer[] := array[]::integer[];
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

-- ── start_add_on_purchase ────────────────────────────────────────────────────
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
  v_titles    text[] := array[]::text[];
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

-- ── confirm_add_on_purchase ──────────────────────────────────────────────────
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
begin
  if exists (select 1 from public.payments where stripe_payment_intent_id = p_payment_intent_id) then
    return false;
  end if;
  select booking_id, currency into v_booking_id, v_currency
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
