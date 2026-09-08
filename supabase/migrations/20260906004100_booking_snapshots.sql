-- Purchased-item snapshots (plan v2 §27) and the in-app notification on payment.
--
--   * booking_add_ons.title_snapshot: the add-on title as sold, copied at insert so a later catalog
--     edit never rewrites a customer's line items. confirm_add_on_purchase and the write-items
--     trigger read the snapshot; existing rows are backfilled from the catalog.
--   * booking_items.kind gains 'stay': the accommodation tier becomes its own line
--     (unit = price_delta, quantity = travelers) and the base lines shrink by the same total, so
--     sum(base + stay + add_on) − discounts still equals bookings.subtotal / total exactly. The
--     create_booking body that writes it lives in 20260906004200_group_codes.sql, which re-creates
--     the function with its new 10th parameter.
--   * notify_booking_paid(): one operational notification per payment intent for the booking owner
--     ("Your trip is confirmed" / "Payment received"); confirm_add_on_purchase writes "Added to your
--     trip" the same way. Idempotent through notifications.dedupe_key.

-- ── Snapshot column ──────────────────────────────────────────────────────────
alter table public.booking_add_ons
  add column title_snapshot text check (title_snapshot is null or char_length(title_snapshot) between 1 and 160);

update public.booking_add_ons ba
set title_snapshot = a.title
from public.departure_add_ons a
where a.id = ba.add_on_id and ba.title_snapshot is null;

-- ── booking_items.kind: base | stay | add_on | discount ─────────────────────
alter table public.booking_items drop constraint if exists booking_items_kind_check;
alter table public.booking_items
  add constraint booking_items_kind_check check (kind in ('base', 'stay', 'add_on', 'discount'));

-- Existing zero-amount "Stay: …" rows were written as kind 'base'; reclassify them.
update public.booking_items
set kind = 'stay'
where kind = 'base' and title like 'Stay: %' and unit_amount = 0 and metadata ? 'stay_option_id';

-- ── Trigger: initial add-ons confirmed with the booking ──────────────────────
create or replace function public.booking_add_ons_write_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status = 'pending' and new.purchase_id is null then
    insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency, metadata)
    select new.booking_id, 'add_on', coalesce(new.title_snapshot, a.title), new.quantity, new.unit_amount, new.total_amount, new.currency,
           jsonb_build_object('add_on_id', new.add_on_id, 'traveler_id', new.traveler_id)
    from public.departure_add_ons a where a.id = new.add_on_id;
  end if;
  return new;
end;
$$;

-- ── Payment notifications ────────────────────────────────────────────────────
-- Called by the Stripe webhook after it records the payment and updates the booking. p_kind is the
-- payment kind the webhook derived ('deposit' | 'full' | 'balance'); anything else is treated as
-- a confirming payment. Returns true when a notification was written, false when the intent had
-- already been notified.
create or replace function public.notify_booking_paid(
  p_booking_id         uuid,
  p_payment_intent_id  text,
  p_kind               text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_title   text;
  v_body    text;
  v_count   integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'no_data_found';
  end if;
  if p_kind = 'balance' then
    v_title := 'Payment received';
    v_body  := 'Thanks — your balance for booking ' || v_booking.confirmation_number || ' is settled.';
  else
    v_title := 'Your trip is confirmed';
    v_body  := 'Booking ' || v_booking.confirmation_number || ' is confirmed. Your itinerary, group and documents will appear here as the trip approaches.';
  end if;

  insert into public.notifications (user_id, category, type, title, body, deep_link, dedupe_key)
  values (v_booking.customer_id, 'operational', 'booking_confirmed', v_title, v_body,
          jsonb_build_object('kind', 'payment', 'bookingId', v_booking.id),
          'payment:' || p_payment_intent_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke execute on function public.notify_booking_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.notify_booking_paid(uuid, text, text) to service_role;

-- ── start_add_on_purchase: snapshot the title ────────────────────────────────
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
        insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, purchase_id, hold_expires_at, title_snapshot)
        values (p_booking_id, (v_line ->> 'add_on_id')::uuid, v_ids[v_idx], 1,
                (v_line ->> 'unit_amount')::bigint, (v_line ->> 'unit_amount')::bigint, v_booking.currency, 'pending', v_purchase, now() + interval '30 minutes',
                left(v_line ->> 'title', 160));
      end loop;
    else
      insert into public.booking_add_ons (booking_id, add_on_id, traveler_id, quantity, unit_amount, total_amount, currency, status, purchase_id, hold_expires_at, title_snapshot)
      values (p_booking_id, (v_line ->> 'add_on_id')::uuid, null, (v_line ->> 'quantity')::integer,
              (v_line ->> 'unit_amount')::bigint, (v_line ->> 'total_amount')::bigint, v_booking.currency, 'pending', v_purchase, now() + interval '30 minutes',
              left(v_line ->> 'title', 160));
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

-- ── confirm_add_on_purchase: snapshot titles + "Added to your trip" ──────────
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
  v_customer_id uuid;
  v_currency    public.currency_code;
  v_payment_id  uuid;
  v_summary     text;
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
  select ba.booking_id, 'add_on', coalesce(ba.title_snapshot, a.title), ba.quantity, ba.unit_amount, ba.total_amount, ba.currency,
         jsonb_build_object('add_on_id', ba.add_on_id, 'purchase_id', p_purchase_id)
  from public.booking_add_ons ba join public.departure_add_ons a on a.id = ba.add_on_id
  where ba.purchase_id = p_purchase_id;

  update public.bookings
  set subtotal_amount = subtotal_amount + p_amount,
      total_amount    = total_amount + p_amount,
      amount_paid     = amount_paid + p_amount
  where id = v_booking_id
  returning customer_id into v_customer_id;

  select string_agg(distinct coalesce(ba.title_snapshot, a.title), ', ' order by coalesce(ba.title_snapshot, a.title))
  into v_summary
  from public.booking_add_ons ba join public.departure_add_ons a on a.id = ba.add_on_id
  where ba.purchase_id = p_purchase_id;

  insert into public.notifications (user_id, category, type, title, body, deep_link, dedupe_key)
  values (v_customer_id, 'operational', 'add_on_confirmed', 'Added to your trip',
          coalesce(v_summary, 'Your add-ons') || ' — paid and confirmed.',
          jsonb_build_object('kind', 'payment', 'bookingId', v_booking_id),
          'payment:' || p_payment_intent_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  return true;
end;
$$;
revoke execute on function public.confirm_add_on_purchase(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.confirm_add_on_purchase(uuid, bigint, text, text) to service_role;
