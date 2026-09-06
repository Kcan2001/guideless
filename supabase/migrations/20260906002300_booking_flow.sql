-- 024_booking_flow
-- 1. Move internal notes off customer-readable rows into staff-only tables (RLS is row-level; a
--    column on a row the customer can read is a leak). The *_public views become unnecessary but
--    stay for compatibility.
-- 2. create_booking(): the atomic checkout transaction (spec §107).
-- 3. pg_cron job releasing expired holds every 5 minutes (spec §105).

-- ── 1. Notes ─────────────────────────────────────────────────────────────────
create table public.booking_notes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  body        text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index booking_notes_booking_idx on public.booking_notes (booking_id);

create table public.departure_notes (
  id            uuid primary key default gen_random_uuid(),
  departure_id  uuid not null references public.departures (id) on delete cascade,
  body          text not null,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index departure_notes_departure_idx on public.departure_notes (departure_id);

alter table public.booking_notes enable row level security;
alter table public.departure_notes enable row level security;
create policy "staff only booking notes" on public.booking_notes
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff only departure notes" on public.departure_notes
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

insert into public.booking_notes (booking_id, body)
  select id, internal_notes from public.bookings where internal_notes is not null and internal_notes <> '';
insert into public.departure_notes (departure_id, body)
  select id, internal_notes from public.departures where internal_notes is not null and internal_notes <> '';

-- The *_public views never selected internal_notes, so they survive the column drop unchanged.
alter table public.bookings drop column internal_notes;
alter table public.departures drop column internal_notes;

-- ── 2. create_booking ────────────────────────────────────────────────────────
-- Called by the signed-in customer from the checkout Server Action. Runs as security definer so it
-- can create a pending_payment booking with a hold (customers may only insert drafts directly).
-- Capacity is enforced by the booking_travelers trigger inside this same transaction.

create or replace function public.create_booking(
  p_departure_id     uuid,
  p_travelers        jsonb,
  p_emergency_contact jsonb,
  p_preferences      jsonb,
  p_payment_option   text default 'deposit',
  p_terms_version    text default 'v1'
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
  v_subtotal     bigint;
  v_deposit      bigint;
  v_due_now      bigint;
  v_booking_id   uuid;
  v_conf         text;
  v_hold_until   timestamptz;
  v_traveler     jsonb;
  v_traveler_id  uuid;
  v_i            integer := 0;
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

  select coalesce((value #>> '{}')::integer, 30) into v_hold_minutes
  from public.system_settings where key = 'booking_hold_minutes';
  v_hold_minutes := coalesce(v_hold_minutes, 30);
  v_hold_until := now() + make_interval(mins => v_hold_minutes);

  v_subtotal := v_dep.price_amount * v_count;
  v_deposit  := v_dep.deposit_amount * v_count;
  v_due_now  := case when p_payment_option = 'full' or v_deposit = 0 then v_subtotal else v_deposit end;

  insert into public.bookings (
    customer_id, departure_id, tour_version_id, status, payment_status, currency,
    subtotal_amount, discount_amount, total_amount, deposit_amount, hold_expires_at,
    terms_accepted_at, terms_version)
  values (
    v_uid, v_dep.id, v_dep.tour_version_id, 'pending_payment', 'unpaid', v_dep.currency,
    v_subtotal, 0, v_subtotal, v_deposit, v_hold_until, now(), p_terms_version)
  returning id, bookings.confirmation_number into v_booking_id, v_conf;

  insert into public.booking_items (booking_id, kind, title, quantity, unit_amount, total_amount, currency)
  values (v_booking_id, 'base', 'Trip package per traveler', v_count, v_dep.price_amount, v_subtotal, v_dep.currency);

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
      coalesce((p_preferences ->> 'roomPreference')::public.room_preference, 'no_preference'),
      nullif(p_preferences ->> 'dietaryRequirements', ''),
      nullif(p_preferences ->> 'accessibilityNeeds', ''))
    returning id into v_traveler_id;

    if v_i = 1 and p_emergency_contact is not null and jsonb_typeof(p_emergency_contact) = 'object' then
      insert into public.emergency_contacts (traveler_id, name, relationship, phone, email)
      values (v_traveler_id, p_emergency_contact ->> 'name', p_emergency_contact ->> 'relationship',
              p_emergency_contact ->> 'phone', nullif(p_emergency_contact ->> 'email', ''));
    end if;

    -- Capacity guard trigger fires here and raises 'departure_sold_out' if over capacity.
    insert into public.booking_travelers (booking_id, traveler_id, is_lead)
    values (v_booking_id, v_traveler_id, v_i = 1);
  end loop;

  insert into public.booking_preferences (
    booking_id, room_preference, dietary_requirements, accessibility_needs, airport_transfer, optional_experience_ids)
  values (
    v_booking_id,
    coalesce((p_preferences ->> 'roomPreference')::public.room_preference, 'no_preference'),
    nullif(p_preferences ->> 'dietaryRequirements', ''),
    nullif(p_preferences ->> 'accessibilityNeeds', ''),
    coalesce((p_preferences ->> 'airportTransfer')::public.transfer_preference, 'group_welcome_transfer'),
    coalesce(
      (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_preferences -> 'optionalExperienceIds', '[]'::jsonb)) as x),
      '{}'::uuid[]));

  return query
    select v_booking_id, v_conf, v_dep.currency::text, v_subtotal, v_deposit, v_due_now, v_hold_until;
end;
$$;

revoke execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text) from public;
grant execute on function public.create_booking(uuid, jsonb, jsonb, jsonb, text, text) to authenticated, service_role;

-- ── 3. Release expired holds every 5 minutes ─────────────────────────────────
create extension if not exists pg_cron;
grant usage on schema cron to postgres;

select cron.schedule(
  'release-expired-booking-holds',
  '*/5 * * * *',
  $$ select public.release_expired_holds(); $$
);
