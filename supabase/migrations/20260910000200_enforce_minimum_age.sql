-- Enforce tour_versions.minimum_age at the database, not on the form.
--
-- Migration 20260910000100 added the number and both live trips now say "18+" on their tour page,
-- but nothing read it: `date_of_birth` is collected on the traveler step and never compared to
-- anything except "is it in the past". A 12-year-old could complete checkout on either trip today.
-- Rule 3 says never trust the client to enforce authorization, and this is the same shape of rule,
-- so it belongs here rather than in a Zod schema that a direct RPC call would bypass.
--
-- Age is measured on the departure's START DATE, not today. Someone who is 17 when they book and
-- 18 when they fly is old enough to travel, and refusing them would be wrong. Someone who is 18
-- today but whose trip is before their birthday is not, which is the case that actually matters.
--
-- A trigger rather than a check inside create_booking(): create_booking has been redefined by five
-- separate migrations and every one of them had to restate the whole body. A trigger is additive,
-- applies to every write path including admin and later traveler edits, and cannot drift out of
-- sync with a redefinition. It fires on the row that carries the link between a traveler and a
-- booking, which is the only point where a person and a trip actually meet.

create or replace function public.enforce_traveler_minimum_age()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minimum_age integer;
  v_start_date  date;
  v_dob         date;
  v_age         integer;
begin
  select tv.minimum_age, d.start_date
    into v_minimum_age, v_start_date
    from public.bookings b
    join public.departures d on d.id = b.departure_id
    join public.tour_versions tv on tv.id = b.tour_version_id
   where b.id = new.booking_id;

  -- No age limit on this trip, or the booking is gone: nothing to enforce.
  if v_minimum_age is null then
    return new;
  end if;

  select tp.date_of_birth into v_dob
    from public.traveler_profiles tp
   where tp.id = new.traveler_id;

  -- A missing date of birth is not a pass. The traveler step marks it required, so a null here
  -- means someone reached this table another way and we cannot show they are old enough.
  if v_dob is null then
    raise exception 'Traveler date of birth is required on this trip'
      using hint = 'traveler_age_unknown';
  end if;

  v_age := extract(year from age(v_start_date, v_dob));

  if v_age < v_minimum_age then
    raise exception 'Travelers must be % or over on the departure date', v_minimum_age
      using hint = 'traveler_under_minimum_age';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_traveler_minimum_age() from public;

comment on function public.enforce_traveler_minimum_age() is
  'Refuses a booking traveler younger than tour_versions.minimum_age on the departure start date. '
  'Raises with hint traveler_under_minimum_age, or traveler_age_unknown when no date of birth.';

create trigger booking_travelers_minimum_age
  before insert or update of traveler_id, booking_id on public.booking_travelers
  for each row execute function public.enforce_traveler_minimum_age();

comment on trigger booking_travelers_minimum_age on public.booking_travelers is
  'Age gate. See enforce_traveler_minimum_age(); age is measured on the departure date, not today.';
