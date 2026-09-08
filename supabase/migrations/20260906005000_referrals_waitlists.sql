-- Growth: referral tiers, waitlists, trip drops and group unlocks (strategy §5).
--
-- Four ideas, one migration because they share the same shape — real counts drive real rewards:
--   * referral tiers   a ladder in system_settings, cumulative at each threshold, never paid twice
--   * waitlists        who wants a full departure, or a tour with no open dates at all
--   * trip drops       departures.opens_at: visible and priced, not bookable until the drop
--   * group unlocks    at N confirmed travelers everyone on the departure gets something
--
-- Money rule: the ladder is separate from the existing per-referral reward. Both are credit in the
-- booking currency; neither ever touches a confirmed booking's price.

-- ── Referral tiers ───────────────────────────────────────────────────────────
-- Tier credit is its own source so the ladder can be recomputed without disturbing base rewards.
alter table public.account_credits drop constraint account_credits_source_check;
alter table public.account_credits add constraint account_credits_source_check
  check (source in ('referral_reward', 'referral_tier', 'redemption', 'manual', 'host_reward'));

insert into public.system_settings (key, value, description) values
  ('referral_tiers',
   '[{"referrals": 1, "credit": 10000, "note": "First friend"},
     {"referrals": 2, "credit": 25000, "note": "Second friend"},
     {"referrals": 3, "credit": 40000, "note": "Third friend"},
     {"referrals": 4, "credit": 50000, "note": "Fourth friend, plus an experience on us"}]'::jsonb,
   'Referral ladder: total tier credit (minor units) once N referrals are earned. Cumulative at each threshold, not per friend. Staff may edit; sync_referral_tier() settles the difference.')
on conflict (key) do nothing;

-- Cumulative-at-threshold, recomputed from scratch so it is idempotent and reverses on its own:
--   entitlement = credit of the highest tier whose `referrals` <= earned referrals (0 if none)
--   paid        = every referral credit already given for this currency — the flat per-referral
--                 reward as well as earlier tier top-ups
--   delta       = entitlement - paid, written as one row (positive tops up, negative claws back)
-- The ladder is the referrer's TOTAL, not an extra payment on top of the flat reward: one friend
-- earns $100 altogether, which is what the account card and docs/referrals.md advertise. The flat
-- reward still lands first when a booking confirms; this settles the rest.
-- A voided referral lowers the count, so the next call writes the negative difference.
create or replace function public.sync_referral_tier(p_user_id uuid, p_currency public.currency_code)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned      integer;
  v_entitlement bigint := 0;
  v_paid        bigint;
  v_delta       bigint;
  v_note        text;
begin
  if p_user_id is null or p_currency is null then return 0; end if;

  select count(*) into v_earned
  from public.referrals
  where referrer_id = p_user_id and status = 'earned' and currency = p_currency;

  select coalesce((t ->> 'credit')::bigint, 0), t ->> 'note'
    into v_entitlement, v_note
  from public.system_settings s,
       lateral jsonb_array_elements(s.value) as t
  where s.key = 'referral_tiers'
    and (t ->> 'referrals')::integer <= v_earned
  order by (t ->> 'referrals')::integer desc
  limit 1;
  v_entitlement := coalesce(v_entitlement, 0);

  select coalesce(sum(amount), 0) into v_paid
  from public.account_credits
  where user_id = p_user_id and currency = p_currency
    and source in ('referral_tier', 'referral_reward');

  v_delta := v_entitlement - v_paid;
  if v_delta = 0 then return 0; end if;

  insert into public.account_credits (user_id, amount, currency, source, note)
  values (p_user_id, v_delta, p_currency, 'referral_tier',
          case when v_delta > 0
               then coalesce(v_note, 'Referral milestone') || ' — ' || v_earned || ' friends booked'
               else 'Referral milestone adjusted — ' || v_earned || ' friends booked' end);
  return v_delta;
end;
$$;
revoke execute on function public.sync_referral_tier(uuid, public.currency_code) from public, anon, authenticated;
grant execute on function public.sync_referral_tier(uuid, public.currency_code) to service_role;

-- What the account page shows: where the traveler is on the ladder and what the next friend is worth.
create or replace function public.referral_progress(p_currency text default 'USD')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_cur      public.currency_code;
  v_earned   integer := 0;
  v_pending  integer := 0;
  v_tiers    jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  v_cur := upper(coalesce(nullif(btrim(p_currency), ''), 'USD'))::public.currency_code;

  select count(*) filter (where status = 'earned'),
         count(*) filter (where status = 'pending')
    into v_earned, v_pending
  from public.referrals where referrer_id = v_uid and currency = v_cur;

  select coalesce(jsonb_agg(jsonb_build_object(
           'referrals', (t ->> 'referrals')::integer,
           'credit',    (t ->> 'credit')::bigint,
           'note',      t ->> 'note',
           'reached',   (t ->> 'referrals')::integer <= v_earned
         ) order by (t ->> 'referrals')::integer), '[]'::jsonb)
    into v_tiers
  from public.system_settings s, lateral jsonb_array_elements(s.value) as t
  where s.key = 'referral_tiers';

  return jsonb_build_object(
    'currency', v_cur,
    'earned', v_earned,
    'pending', v_pending,
    'baseReward', (select (value #>> '{}')::bigint from public.system_settings where key = 'referral_reward_amount'),
    'discountPercent', (select (value #>> '{}')::numeric from public.system_settings where key = 'referral_discount_percent'),
    'tiers', v_tiers
  );
end;
$$;
revoke execute on function public.referral_progress(text) from public, anon;
grant execute on function public.referral_progress(text) to authenticated, service_role;

-- ── Reward path: settle the ladder on confirm, take it back on cancel ────────
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
      -- Settle the ladder: crossing a threshold tops the referrer up to that tier's total.
      perform public.sync_referral_tier(v_ref.referrer_id, v_ref.currency);
    end if;
  end if;

  if new.status in ('draft', 'cancelled', 'refunded') then
    update public.booking_add_ons set status = 'cancelled', cancelled_at = now()
    where booking_id = new.id and status = 'pending';
    if new.status in ('cancelled', 'refunded') then
      update public.booking_add_ons set status = 'cancelled', cancelled_at = now()
      where booking_id = new.id and status = 'confirmed';
      -- An already-earned referral gives its credit back too: the trip did not happen, so the
      -- reward should not stand, and the ladder recomputes downward from the lower count.
      select * into v_ref from public.referrals where booking_id = new.id and status = 'earned';
      if found then
        update public.referrals set status = 'void' where id = v_ref.id;
        insert into public.account_credits (user_id, amount, currency, source, booking_id, note)
        values (v_ref.referrer_id, -v_ref.reward_amount, v_ref.currency, 'referral_reward', new.id,
                'Reversed: the booking was cancelled');
        perform public.sync_referral_tier(v_ref.referrer_id, v_ref.currency);
      end if;
      update public.referrals set status = 'void' where booking_id = new.id and status = 'pending';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_sync_add_ons_and_rewards on public.bookings;
create trigger bookings_sync_add_ons_and_rewards after update of status on public.bookings
  for each row execute function public.bookings_sync_add_ons_and_rewards();

-- ── quote_booking: refuse a departure whose drop has not happened yet ───────
-- Re-created verbatim from migration 003000 with only the opens_at guard added, so the
-- pricing rules stay in exactly one place.
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

-- ── Waitlists ────────────────────────────────────────────────────────────────
-- Two shapes in one table: a specific departure (sold out, closed, or not yet dropped), or a whole
-- tour when no dates are open at all. tour_id is always set, so staff can group either way.
create table public.departure_waitlist (
  id                    uuid primary key default gen_random_uuid(),
  tour_id               uuid not null references public.tours (id) on delete cascade,
  departure_id          uuid references public.departures (id) on delete cascade,
  user_id               uuid references auth.users (id) on delete set null,
  email                 extensions.citext not null,
  name                  text check (char_length(name) between 1 and 120),
  party_size            smallint not null default 1 check (party_size between 1 and 8),
  note                  text check (char_length(note) <= 500),
  source                text not null default 'tour_page' check (source ~ '^[a-z0-9_-]{1,40}$'),
  created_at            timestamptz not null default now(),
  notified_at           timestamptz,
  converted_booking_id  uuid references public.bookings (id) on delete set null
);
-- Postgres treats nulls as distinct, so each shape needs its own partial unique index.
create unique index departure_waitlist_departure_email_idx
  on public.departure_waitlist (departure_id, email) where departure_id is not null;
create unique index departure_waitlist_tour_email_idx
  on public.departure_waitlist (tour_id, email) where departure_id is null;
create index departure_waitlist_tour_idx on public.departure_waitlist (tour_id, created_at desc);
comment on table public.departure_waitlist is
  'Who wants a departure that cannot be booked yet. Public access only through join_waitlist().';

alter table public.departure_waitlist enable row level security;

create policy "staff read the waitlist" on public.departure_waitlist
  for select to authenticated using ((select public.is_staff()));
create policy "ops manage the waitlist" on public.departure_waitlist
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));
create policy "travelers read their own waitlist rows" on public.departure_waitlist
  for select to authenticated using (user_id = (select auth.uid()));

-- Idempotent: joining twice updates the row instead of failing, and never reveals another row.
-- Returns 'joined' | 'already_waiting' | 'rate_limited' | 'invalid_email' | 'not_found'.
create or replace function public.join_waitlist(
  p_tour_id       uuid,
  p_departure_id  uuid default null,
  p_email         text default null,
  p_name          text default null,
  p_party_size    integer default 1,
  p_source        text default 'tour_page'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_tour   uuid := p_tour_id;
  v_size   smallint := least(greatest(coalesce(p_party_size, 1), 1), 8);
  v_source text := coalesce(nullif(btrim(p_source), ''), 'tour_page');
  v_exists boolean;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    return 'invalid_email';
  end if;
  if not public.check_rate_limit('waitlist:' || v_email, 5, 3600) then
    return 'rate_limited';
  end if;

  if p_departure_id is not null then
    select tour_id into v_tour from public.departures where id = p_departure_id;
    if v_tour is null then return 'not_found'; end if;
  elsif not exists (select 1 from public.tours where id = v_tour and is_published) then
    return 'not_found';
  end if;

  if p_departure_id is not null then
    select true into v_exists from public.departure_waitlist
    where departure_id = p_departure_id and email = v_email;
  else
    select true into v_exists from public.departure_waitlist
    where tour_id = v_tour and departure_id is null and email = v_email;
  end if;

  if coalesce(v_exists, false) then
    update public.departure_waitlist
       set name = coalesce(nullif(btrim(p_name), ''), name),
           party_size = v_size,
           user_id = coalesce(user_id, auth.uid())
     where email = v_email
       and (departure_id = p_departure_id
            or (p_departure_id is null and tour_id = v_tour and departure_id is null));
    return 'already_waiting';
  end if;

  insert into public.departure_waitlist (tour_id, departure_id, user_id, email, name, party_size, source)
  values (v_tour, p_departure_id, auth.uid(), v_email, nullif(btrim(p_name), ''), v_size, v_source);
  return 'joined';
end;
$$;
revoke execute on function public.join_waitlist(uuid, uuid, text, text, integer, text) from public;
grant execute on function public.join_waitlist(uuid, uuid, text, text, integer, text) to anon, authenticated, service_role;

-- Staff "notify" marks the rows and writes an in-app notification for anyone with an account.
-- Email is not wired yet; these rows are the record that they were told.
create or replace function public.notify_waitlist(p_departure_id uuid, p_body text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_tour  text;
  r       record;
begin
  if not public.is_ops_staff() then
    raise exception 'Ops staff only' using errcode = 'insufficient_privilege', hint = 'staff_required';
  end if;

  select t.name into v_tour
  from public.departures d join public.tours t on t.id = d.tour_id
  where d.id = p_departure_id;
  if v_tour is null then return 0; end if;

  for r in
    select id, user_id from public.departure_waitlist
    where departure_id = p_departure_id and notified_at is null
  loop
    if r.user_id is not null then
      insert into public.notifications (user_id, category, type, title, body, deep_link)
      values (r.user_id, 'marketing', 'waitlist_open', v_tour || ' is open',
              coalesce(p_body, 'A place opened on the dates you asked about.'),
              jsonb_build_object('kind', 'departure', 'departureId', p_departure_id));
    end if;
    update public.departure_waitlist set notified_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.notify_waitlist(uuid, text) from public, anon;
grant execute on function public.notify_waitlist(uuid, text) to authenticated, service_role;

-- ── Trip drops ───────────────────────────────────────────────────────────────
-- Visible, priced and countdown-able; bookable only once opens_at has passed.
alter table public.departures add column opens_at timestamptz;
comment on column public.departures.opens_at is
  'Trip drop: before this moment the departure shows a countdown and a waitlist, not a booking button.';

create or replace view public.departures_public
with (security_invoker = true) as
select id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity,
       minimum_travelers, price_amount, deposit_amount, currency, booking_deadline,
       balance_due_date, cancellation_policy, created_at, updated_at,
       shared_room_discount_amount, group_opens_days_before, opens_at
from public.departures;

-- ── Group unlocks ────────────────────────────────────────────────────────────
-- At N confirmed travelers everyone on the departure gets something. Granting is a staff action;
-- this table is the promise and the progress bar, never an automatic payout.
create table public.departure_unlocks (
  id            uuid primary key default gen_random_uuid(),
  departure_id  uuid not null references public.departures (id) on delete cascade,
  threshold     smallint not null check (threshold between 2 and 200),
  reward        text not null check (char_length(reward) between 3 and 200),
  is_active     boolean not null default true,
  granted_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (departure_id, threshold)
);
create index departure_unlocks_departure_idx on public.departure_unlocks (departure_id, threshold);

alter table public.departure_unlocks enable row level security;

create policy "anyone reads active unlocks" on public.departure_unlocks
  for select to anon, authenticated using (is_active);
create policy "ops manage unlocks" on public.departure_unlocks
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- Progress from real confirmed travelers only: {confirmed, unlocks:[{threshold, reward, reached, granted}]}.
create or replace function public.departure_unlock_progress(p_departure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed integer;
  v_unlocks   jsonb;
begin
  select count(*) into v_confirmed
  from public.booking_travelers bt
  join public.bookings b on b.id = bt.booking_id
  where b.departure_id = p_departure_id and b.status in ('confirmed', 'completed');

  select coalesce(jsonb_agg(jsonb_build_object(
           'threshold', u.threshold,
           'reward', u.reward,
           'reached', v_confirmed >= u.threshold,
           'granted', u.granted_at is not null
         ) order by u.threshold), '[]'::jsonb)
    into v_unlocks
  from public.departure_unlocks u
  where u.departure_id = p_departure_id and u.is_active;

  return jsonb_build_object('confirmed', v_confirmed, 'unlocks', v_unlocks);
end;
$$;
grant execute on function public.departure_unlock_progress(uuid) to anon, authenticated, service_role;
