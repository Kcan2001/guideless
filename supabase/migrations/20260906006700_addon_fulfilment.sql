-- What happens after a traveler pays us for somebody else's experience.
--
-- The model Kyle chose: the traveler checks out normally, on our site, through Stripe, in one cart
-- with everything else. We are the merchant of record. Afterwards we buy the experience from the
-- supplier on their behalf, and we tell them plainly that it is a Viator booking operated under
-- their terms, with a link to those terms.
--
-- That last part is a product decision, not a legal minimum: we are not pretending a bought-in
-- ticket is ours. It also makes the cancellation story honest, because the traveler's rights on
-- that ticket really are the supplier's rights, and they need to be able to read them.
--
-- Three consequences for the schema:
--
--   1. Paying and being booked are now different states. Between them somebody has to act, and a
--      paid-but-unbooked experience is an operational debt with a deadline. It needs a queue, not
--      a hope.
--   2. The traveler must be able to see the reference, the voucher and the terms — so unlike every
--      other supplier table here, this one has a traveler read policy.
--   3. Which is exactly why it holds no money. What we paid stays in `add_on_sourcing`, staff-only.
--      Row-level security is per row, not per column, so the only safe way to let a traveler read
--      this is for there to be nothing here they should not see.

create type public.fulfilment_status as enum (
  'pending',    -- paid by the traveler, not yet bought from the supplier. The queue.
  'booked',     -- we hold a supplier reference for it
  'failed',     -- the supplier could not fulfil; somebody owes the traveler a refund and a sentence
  'cancelled'   -- cancelled with the supplier after being booked
);

comment on type public.fulfilment_status is 'Mirror of FULFILMENT_STATUSES in @guideless/types.';

create table public.add_on_fulfilments (
  id                    uuid primary key default gen_random_uuid(),
  booking_add_on_id     uuid not null unique references public.booking_add_ons (id) on delete cascade,
  booking_id            uuid not null references public.bookings (id) on delete cascade,
  add_on_id             uuid not null references public.departure_add_ons (id) on delete restrict,
  supplier              public.experience_supplier not null,
  supplier_option_id    text not null,
  travel_date           date not null,
  travelers             integer not null default 1 check (travelers >= 1),

  status                public.fulfilment_status not null default 'pending',
  -- What the traveler shows on the day, and what they quote to the supplier if they need to.
  supplier_reference    text,
  supplier_booking_id   text,
  voucher_url           text,
  instructions          text,
  -- The supplier's own cancellation ladder for this booking, copied at the time it was made so it
  -- cannot change under the traveler afterwards. Same reasoning as the frozen review byline.
  cancellation_terms    jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cancellation_terms) = 'object'),

  booked_by             uuid references auth.users (id) on delete set null,
  booked_at             timestamptz,
  -- Why it could not be bought, for staff. Never shown to the traveler as-is.
  failure_reason        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- The queue: the oldest unbooked thing somebody has already paid for is the most urgent.
create index add_on_fulfilments_queue_idx
  on public.add_on_fulfilments (travel_date, created_at)
  where status = 'pending';
create index add_on_fulfilments_booking_idx on public.add_on_fulfilments (booking_id);

create trigger add_on_fulfilments_set_updated_at before update on public.add_on_fulfilments
  for each row execute function public.set_updated_at();

comment on table public.add_on_fulfilments is
  'A paid add-on that we still have to buy from a supplier on the traveler''s behalf. Deliberately holds no cost: the traveler can read this row, so nothing commercial belongs in it.';
comment on column public.add_on_fulfilments.cancellation_terms is
  'The supplier''s cancellation ladder as it stood when the booking was made, copied so it cannot change under the traveler later.';

alter table public.add_on_fulfilments enable row level security;

-- The traveler sees their own: what it is, whether it is booked, the reference, the terms.
create policy "travelers read own fulfilments" on public.add_on_fulfilments
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = add_on_fulfilments.booking_id and b.customer_id = (select auth.uid())
    )
    or (select public.is_staff())
  );

create policy "ops staff manage fulfilments" on public.add_on_fulfilments
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));
create policy "service manages fulfilments" on public.add_on_fulfilments
  for all to service_role using (true) with check (true);

-- ── Telling the traveler whose experience it is ──────────────────────────────
-- Deliberately public, and deliberately a name rather than a flag: the point is to say "operated by
-- Viator" on the card, not to hide behind "our partner". A bought-in ticket should look like one.
alter table public.departure_add_ons
  add column operated_by text check (operated_by is null or char_length(operated_by) <= 80),
  add column supplier_terms_url text,
  -- The operator's own page for this experience, with our partner attribution on it. Offered
  -- alongside "add it to your trip" rather than instead of it: a traveler who would rather book it
  -- themselves should be able to, and we still earn the referral when they do.
  add column supplier_booking_url text;

comment on column public.departure_add_ons.operated_by is
  'Who actually runs this, when it is not us. Shown to travelers on purpose — we are not pretending a bought-in experience is ours.';
comment on column public.departure_add_ons.supplier_terms_url is
  'The operator''s own cancellation and booking terms. Linked wherever operated_by is shown, because those are the terms that actually govern the ticket.';
comment on column public.departure_add_ons.supplier_booking_url is
  'Attributed deep link to the operator''s own page. Shown next to our own "add to your trip", so the traveler picks; the attribution means a referral still counts.';

-- The operator's own page for a product, as the supplier gives it to us. Attribution is added when
-- the link is rendered rather than stored, so a change of partner id does not need a backfill.
alter table public.experience_products add column product_url text;

comment on column public.experience_products.product_url is
  'The supplier''s own page for this product, unattributed. The partner id is appended at render time.';

-- ── Paid means owed ──────────────────────────────────────────────────────────
/**
 * Turn every newly-confirmed add-on that we buy in into a pending fulfilment.
 *
 * A trigger rather than a call inside `confirm_add_on_purchase`, because the debt is created by the
 * row becoming confirmed however that happens — the Stripe webhook today, a manual correction by
 * staff tomorrow. Tying it to the state change means there is no path to a paid add-on that nobody
 * is going to book.
 */
create or replace function public.queue_add_on_fulfilment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sourcing public.add_on_sourcing%rowtype;
  v_date     date;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then
    return new;
  end if;

  select * into v_sourcing from public.add_on_sourcing s where s.add_on_id = new.add_on_id;
  -- Not something we buy in: a hand-built extra we run ourselves has nothing to fulfil.
  if not found then
    return new;
  end if;

  select coalesce(public.add_on_date(a.*), d.start_date) into v_date
  from public.departure_add_ons a
  join public.departures d on d.id = a.departure_id
  where a.id = new.add_on_id;

  insert into public.add_on_fulfilments
    (booking_add_on_id, booking_id, add_on_id, supplier, supplier_option_id, travel_date, travelers)
  values
    (new.id, new.booking_id, new.add_on_id, v_sourcing.supplier, v_sourcing.supplier_option_id,
     coalesce(v_date, current_date), greatest(new.quantity, 1))
  on conflict (booking_add_on_id) do nothing;

  return new;
end;
$$;

create trigger booking_add_ons_queue_fulfilment
  after insert or update of status on public.booking_add_ons
  for each row execute function public.queue_add_on_fulfilment();

comment on function public.queue_add_on_fulfilment is
  'Creates the operational debt the moment a bought-in add-on is paid for. Attached to the status change rather than to the webhook, so no route to "confirmed" can skip it.';

-- ── What ops actually work from ──────────────────────────────────────────────
create or replace view public.fulfilment_queue
with (security_invoker = true) as
select
  f.id,
  f.booking_id,
  f.status,
  f.travel_date,
  f.travelers,
  f.supplier,
  f.supplier_option_id,
  f.created_at,
  (f.travel_date - current_date) as days_until,
  b.confirmation_number,
  a.title,
  a.operated_by,
  t.name as tour_name
from public.add_on_fulfilments f
join public.bookings b on b.id = f.booking_id
join public.departure_add_ons a on a.id = f.add_on_id
join public.departures d on d.id = a.departure_id
join public.tours t on t.id = d.tour_id
where f.status = 'pending'
order by f.travel_date, f.created_at;

comment on view public.fulfilment_queue is
  'Paid add-ons still to be bought from a supplier, soonest travel date first. security_invoker, so a traveler querying it sees only their own and staff see everything.';

/** Record a supplier booking against a fulfilment. Ops-only; the traveler then sees the reference. */
create or replace function public.record_fulfilment(
  p_fulfilment_id uuid,
  p_reference text,
  p_supplier_booking_id text default null,
  p_voucher_url text default null,
  p_instructions text default null,
  p_cancellation_terms jsonb default '{}'::jsonb
)
returns public.add_on_fulfilments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.add_on_fulfilments;
begin
  if not public.is_ops_staff() then
    raise exception 'Operations staff only' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(p_reference), '') = '' then
    raise exception 'A supplier reference is required' using errcode = 'check_violation', hint = 'reference_required';
  end if;

  update public.add_on_fulfilments
  set status = 'booked',
      supplier_reference = btrim(p_reference),
      supplier_booking_id = nullif(btrim(p_supplier_booking_id), ''),
      voucher_url = nullif(btrim(p_voucher_url), ''),
      instructions = nullif(btrim(p_instructions), ''),
      cancellation_terms = coalesce(p_cancellation_terms, '{}'::jsonb),
      booked_by = (select auth.uid()),
      booked_at = now(),
      failure_reason = null
  where id = p_fulfilment_id
  returning * into v_row;

  if not found then
    raise exception 'No such fulfilment' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.record_fulfilment(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.record_fulfilment(uuid, text, text, text, text, jsonb) to authenticated, service_role;

/** Mark a fulfilment as impossible. The traveler is owed a refund, so this is never silent. */
create or replace function public.fail_fulfilment(p_fulfilment_id uuid, p_reason text)
returns public.add_on_fulfilments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.add_on_fulfilments;
begin
  if not public.is_ops_staff() then
    raise exception 'Operations staff only' using errcode = 'insufficient_privilege';
  end if;

  update public.add_on_fulfilments
  set status = 'failed', failure_reason = nullif(btrim(p_reason), ''), booked_by = (select auth.uid())
  where id = p_fulfilment_id
  returning * into v_row;

  if not found then
    raise exception 'No such fulfilment' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.fail_fulfilment(uuid, text) from public;
grant execute on function public.fail_fulfilment(uuid, text) to authenticated, service_role;

comment on function public.fail_fulfilment(uuid, text) is
  'The supplier could not fulfil something a traveler already paid for. Sets the state that the refund and the apology hang off; the reason is for staff, not for the traveler to read raw.';
