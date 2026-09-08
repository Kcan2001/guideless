-- Friend / group codes (plan v2 §20) and create_booking v3.
--
-- A traveler who has booked can hand friends a code like KYLE-MONACO-27. A friend who enters it
-- while booking the same departure gets their own, financially independent booking linked to the
-- code (bookings.group_code_id); the departure's single operational group already puts everyone in
-- one chat, so the code exists for the roster ("Kyle's crew"), for room coordination later and for
-- the builder's social hints. Codes never change a price: quote_booking is untouched.
--
-- create_booking is re-created with a 10th parameter (p_group_code) and, from
-- 20260906004100_booking_snapshots.sql, writes the accommodation tier as its own booking_items line
-- and snapshots add-on titles at insert.

-- ── Table ────────────────────────────────────────────────────────────────────
create table public.group_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$'),
  departure_id      uuid not null references public.departures (id) on delete cascade,
  owner_user_id     uuid not null references auth.users (id) on delete cascade,
  owner_booking_id  uuid references public.bookings (id) on delete set null,
  label             text check (label is null or char_length(label) between 1 and 80),
  max_uses          integer not null default 20 check (max_uses between 1 and 200),
  uses              integer not null default 0 check (uses >= 0),
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index group_codes_departure_idx on public.group_codes (departure_id);
create index group_codes_owner_idx on public.group_codes (owner_user_id);
create unique index group_codes_owner_booking_idx on public.group_codes (owner_booking_id) where owner_booking_id is not null;

alter table public.bookings add column group_code_id uuid references public.group_codes (id) on delete set null;
create index bookings_group_code_idx on public.bookings (group_code_id) where group_code_id is not null;

alter table public.group_codes enable row level security;

-- Owners see their own codes; staff see all. Customers never insert, update or delete directly:
-- creation goes through create_group_code(), use counting through create_booking().
create policy "group codes: owner or staff read" on public.group_codes
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_staff()));

-- ── create_group_code(booking) ───────────────────────────────────────────────
-- Idempotent: one code per booking. Code = lead traveler's first name (letters only, ≤ 12) +
-- first word of the tour slug + two-digit departure year, e.g. KYLE-MONACO-27; on collision a
-- two-digit counter segment is appended (KYLE-MONACO-27-02).
create or replace function public.create_group_code(p_booking_id uuid)
returns public.group_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_row      public.group_codes%rowtype;
  v_first    text;
  v_token    text;
  v_year     text;
  v_base     text;
  v_code     text;
  v_i        integer := 1;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid;
  if not found or v_booking.status not in ('pending_payment', 'confirmed', 'completed') then
    raise exception 'This booking cannot share a group code' using errcode = 'check_violation', hint = 'not_eligible';
  end if;

  select * into v_row from public.group_codes where owner_booking_id = p_booking_id;
  if found then
    return v_row;
  end if;

  select tp.first_name into v_first
  from public.booking_travelers bt
  join public.traveler_profiles tp on tp.id = bt.traveler_id
  where bt.booking_id = p_booking_id
  order by bt.is_lead desc, bt.created_at
  limit 1;
  v_first := left(upper(regexp_replace(coalesce(v_first, ''), '[^A-Za-z]', '', 'g')), 12);
  if char_length(v_first) < 2 then
    v_first := 'TRIP';
  end if;

  select left(upper(regexp_replace(split_part(t.slug, '-', 1), '[^a-z0-9]', '', 'g')), 12), to_char(d.start_date, 'YY')
  into v_token, v_year
  from public.departures d
  join public.tours t on t.id = d.tour_id
  where d.id = v_booking.departure_id;
  if v_token is null or char_length(v_token) < 2 then
    v_token := 'GUIDELESS';
  end if;

  v_base := v_first || '-' || v_token || '-' || v_year;
  v_code := v_base;
  while exists (select 1 from public.group_codes where code = v_code) loop
    v_i := v_i + 1;
    v_code := v_base || '-' || lpad(v_i::text, 2, '0');
    if v_i > 99 then
      raise exception 'Could not allocate a group code' using errcode = 'unique_violation';
    end if;
  end loop;

  insert into public.group_codes (code, departure_id, owner_user_id, owner_booking_id)
  values (v_code, v_booking.departure_id, v_uid, p_booking_id)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.create_group_code(uuid) from public, anon;
grant execute on function public.create_group_code(uuid) to authenticated, service_role;

-- ── check_group_code(code, departure) ────────────────────────────────────────
-- Public lookup for the builder. Never exposes emails or full names; the owner's first name is
-- what the owner already shares with their group.
create or replace function public.check_group_code(p_code text, p_departure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row     public.group_codes%rowtype;
  v_joined  integer := 0;
  v_first   text;
begin
  select * into v_row from public.group_codes where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found', 'owner_first_name', null, 'joined', 0);
  end if;

  select count(*)::integer into v_joined
  from public.bookings b
  where b.group_code_id = v_row.id and b.status in ('pending_payment', 'confirmed', 'completed');

  select tp.first_name into v_first
  from public.booking_travelers bt
  join public.traveler_profiles tp on tp.id = bt.traveler_id
  where bt.booking_id = v_row.owner_booking_id
  order by bt.is_lead desc, bt.created_at
  limit 1;

  if v_row.departure_id <> p_departure_id then
    return jsonb_build_object('valid', false, 'reason', 'wrong_departure', 'owner_first_name', v_first, 'joined', v_joined);
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'owner_first_name', v_first, 'joined', v_joined);
  end if;
  if v_row.uses >= v_row.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'full', 'owner_first_name', v_first, 'joined', v_joined);
  end if;
  return jsonb_build_object('valid', true, 'reason', null, 'owner_first_name', v_first, 'joined', v_joined);
end;
$$;
grant execute on function public.check_group_code(text, uuid) to anon, authenticated, service_role;

-- ── create_booking v3 ────────────────────────────────────────────────────────
drop function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text, uuid, jsonb, text);

create or replace function public.create_booking(
  p_departure_id      uuid,
  p_travelers         jsonb,
  p_emergency_contact jsonb,
  p_preferences       jsonb,
  p_payment_option    text default 'deposit',
  p_terms_version     text default 'v1',
  p_stay_option_id    uuid default null,
  p_add_ons           jsonb default '[]'::jsonb,
  p_code              text default null,
  p_group_code        text default null
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
  v_uid           uuid := auth.uid();
  v_dep           public.departures%rowtype;
  v_count         integer;
  v_hold_minutes  integer;
  v_booking_id    uuid;
  v_conf          text;
  v_hold_until    timestamptz;
  v_traveler      jsonb;
  v_traveler_id   uuid;
  v_traveler_ids  uuid[] := array[]::uuid[];
  v_rooms         integer[] := array[]::integer[];
  v_i             integer := 0;
  v_quote         jsonb;
  v_line          jsonb;
  v_idx           integer;
  v_group_code    text := nullif(upper(trim(coalesce(p_group_code, ''))), '');
  v_group_check   jsonb;
  v_group_code_id uuid;
  v_stay_id       uuid;
  v_stay_delta    bigint := 0;
  v_stay_name     text;
  v_stay_tier     text;
  v_stay_label    text;
  v_stay_line     boolean := false;
  v_unit          bigint;
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

  -- Friend / group code: validated here, never priced.
  if v_group_code is not null then
    v_group_check := public.check_group_code(v_group_code, p_departure_id);
    if not coalesce((v_group_check ->> 'valid')::boolean, false) then
      raise exception 'Group code % is not valid for this departure (%)', v_group_code, v_group_check ->> 'reason'
        using errcode = 'check_violation', hint = 'group_code_invalid';
    end if;
    select id into v_group_code_id from public.group_codes where code = v_group_code for update;
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
    terms_accepted_at, terms_version, stay_option_id, group_code_id)
  values (
    v_uid, v_dep.id, v_dep.tour_version_id, 'pending_payment', 'unpaid', v_dep.currency,
    (v_quote ->> 'subtotal_amount')::bigint,
    (v_quote ->> 'discount_amount')::bigint + (v_quote ->> 'credit_amount')::bigint,
    (v_quote ->> 'total_amount')::bigint,
    (v_quote ->> 'deposit_amount')::bigint,
    v_hold_until, now(), p_terms_version,
    nullif(v_quote ->> 'stay_option_id', '')::uuid,
    v_group_code_id)
  returning id, bookings.confirmation_number into v_booking_id, v_conf;

  if v_group_code_id is not null then
    update public.group_codes set uses = uses + 1 where id = v_group_code_id;
  end if;

  -- The accommodation tier is its own line when it changes the price: the base lines shrink by the
  -- per-traveler delta and a 'stay' line carries it, so the line items still sum to the quote.
  v_stay_id := nullif(v_quote ->> 'stay_option_id', '')::uuid;
  if v_stay_id is not null then
    select s.price_delta_amount, s.name, s.tier::text, s.label::text
    into v_stay_delta, v_stay_name, v_stay_tier, v_stay_label
    from public.departure_stay_options s where s.id = v_stay_id;
    v_stay_delta := coalesce(v_stay_delta, 0);
    v_stay_line := v_stay_delta <> 0
      and not exists (
        select 1 from jsonb_array_elements(v_quote -> 'lines') l
        where l ->> 'kind' = 'base' and (l ->> 'unit_amount')::bigint - v_stay_delta < 0);
  end if;

  -- Line items exactly as quoted (add-ons are recorded on booking_add_ons below).
  for v_line in select * from jsonb_array_elements(v_quote -> 'lines') loop
    if v_line ->> 'kind' = 'add_on' then continue; end if;
    v_unit := (v_line ->> 'unit_amount')::bigint;
    if v_line ->> 'kind' = 'base' and v_stay_line then
      v_unit := v_unit - v_stay_delta;
    end if;
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    values (v_booking_id, v_line ->> 'kind', v_line ->> 'title', (v_line ->> 'quantity')::integer,
            v_unit, v_unit * (v_line ->> 'quantity')::integer, v_dep.currency,
            v_line - 'kind' - 'title' - 'quantity' - 'unit_amount' - 'total_amount');
  end loop;
  if v_stay_id is not null then
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    values (v_booking_id, 'stay', 'Stay: ' || coalesce(v_stay_name, v_quote ->> 'stay_option_name'),
            case when v_stay_line then v_count else 1 end,
            case when v_stay_line then v_stay_delta else 0 end,
            case when v_stay_line then v_stay_delta * v_count else 0 end,
            v_dep.currency,
            jsonb_strip_nulls(jsonb_build_object('stay_option_id', v_stay_id, 'tier', v_stay_tier, 'label', v_stay_label)));
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

  -- Add-ons: pending until the booking is paid; the hold mirrors the seat hold. Titles snapshot.
  for v_line in select * from jsonb_array_elements(v_quote -> 'lines') where value ->> 'kind' = 'add_on' loop
    if v_line ->> 'pricing_basis' = 'per_traveler' then
      for v_idx in select (x)::integer from jsonb_array_elements_text(v_line -> 'traveler_indexes') as t(x) loop
        insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, hold_expires_at, title_snapshot)
        values (v_booking_id, (v_line ->> 'add_on_id')::uuid, v_traveler_ids[v_idx], 1,
                (v_line ->> 'unit_amount')::bigint, (v_line ->> 'unit_amount')::bigint, v_dep.currency, 'pending', v_hold_until,
                left(v_line ->> 'title', 160));
      end loop;
    else
      insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, hold_expires_at, title_snapshot)
      values (v_booking_id, (v_line ->> 'add_on_id')::uuid, null, (v_line ->> 'quantity')::integer,
              (v_line ->> 'unit_amount')::bigint, (v_line ->> 'total_amount')::bigint, v_dep.currency, 'pending', v_hold_until,
              left(v_line ->> 'title', 160));
    end if;
  end loop;

  -- Referral: recorded now, rewarded when the booking is confirmed (trigger).
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
revoke execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text, uuid, jsonb, text, text) from public;
grant execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text, uuid, jsonb, text, text) to authenticated, service_role;
