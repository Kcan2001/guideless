-- Stay-tier availability, so operations can see what is left per tier without re-deriving the rule.
--
-- `quote_booking()` already decides whether a tier is full: it counts travelers on bookings that
-- are confirmed, or pending_payment with a live hold. That arithmetic lived only inside the
-- pricing function, so the inventory screen had nothing to read. This view is the sibling of
-- `add_on_availability` and states the same rule once, split into confirmed and held.
--
-- Counted in travelers, not bookings, exactly as quote_booking does.
--
-- Staff-only: a tier's remaining count is an operational number, not a social signal like
-- `add_on_headcounts`, and it is only ever read by /admin/inventory.

create or replace view public.stay_option_availability
with (security_invoker = false) as
select s.id           as stay_option_id,
       s.departure_id,
       s.capacity,
       (select count(*)
          from public.booking_travelers bt
          join public.bookings b on b.id = bt.booking_id
         where b.stay_option_id = s.id
           and b.status = 'confirmed')::integer as confirmed,
       (select count(*)
          from public.booking_travelers bt
          join public.bookings b on b.id = bt.booking_id
         where b.stay_option_id = s.id
           and b.status = 'pending_payment'
           and b.hold_expires_at > now())::integer as held
from public.departure_stay_options s;

comment on view public.stay_option_availability is
  'Travelers holding each stay tier (confirmed, plus live pending holds), mirroring quote_booking(). Staff only.';

-- security_invoker = false means the view bypasses the underlying RLS, so it is never granted
-- directly; the function below is the only way in and it checks for staff first.
revoke all on public.stay_option_availability from anon, authenticated;

create or replace function public.stay_option_availability_for(p_departure_id uuid)
returns table (stay_option_id uuid, capacity integer, confirmed integer, held integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    raise exception 'Staff only' using errcode = 'insufficient_privilege', hint = 'staff_required';
  end if;
  return query
    select v.stay_option_id, v.capacity, v.confirmed, v.held
    from public.stay_option_availability v
    where v.departure_id = p_departure_id;
end;
$$;

revoke execute on function public.stay_option_availability_for(uuid) from public, anon;
grant execute on function public.stay_option_availability_for(uuid) to authenticated;
