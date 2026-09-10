-- Scarcity, in public: how many places are left on each stay tier, and where you would sleep.
--
-- TWO THINGS, DELIBERATELY SEPARATE
--
-- 1. How many places are left. This is OUR allocation, not the supplier's. It is computed from
--    bookings on every read, so it is never stale and needs no refresh job — the number a traveler
--    sees is the number that exists at that instant. Migration 048 already built this counting rule
--    for staff (`stay_option_availability`); that view bypasses RLS and is deliberately ungranted,
--    so this adds a narrow public function beside it rather than opening the view up. The public
--    function returns only what is left. It never returns how many are confirmed versus held, which
--    would let anyone watch our conversion rate.
--
-- 2. What the hotel is. `stay_option_hotels_public` has existed since migration 044 and already
--    exposes name, city, stars, images and amenities for any tier with a hotel_id. It has no
--    address and no coordinates, so a map was impossible. Added below.
--
-- A NOTE ON UNITS, BECAUSE IT IS EASY TO GET WRONG
-- `departure_stay_options.capacity` counts TRAVELERS, not rooms — `stay_option_availability`
-- counts rows in booking_travelers. Two people sharing one room consume two of it. So the public
-- number is "places left", and the UI must not call it rooms: four places is four solo travelers
-- or two sharing couples, and telling someone "4 rooms left" would be false in the second case.

-- ── 1. Places left, public ───────────────────────────────────────────────────
create or replace function public.stay_option_availability_public(p_departure_id uuid)
returns table (
  stay_option_id uuid,
  capacity       integer,
  spots_left     integer,
  is_limited     boolean,
  sold_out       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.capacity,
         -- Null capacity means we have not capped this tier; there is no number to show.
         case when s.capacity is null then null
              else greatest(s.capacity - (
                     select count(*)
                       from public.booking_travelers bt
                       join public.bookings b on b.id = bt.booking_id
                      where b.stay_option_id = s.id
                        and (b.status = 'confirmed'
                             or (b.status = 'pending_payment' and b.hold_expires_at > now()))
                   )::integer, 0)
         end as spots_left,
         -- "Only a few left" threshold. Ten is Kyle's number, 2026-09-10. A capped tier that is
         -- already gone is sold out rather than limited, so the two flags never both fire.
         case when s.capacity is null then false
              else (s.capacity - (
                     select count(*)
                       from public.booking_travelers bt
                       join public.bookings b on b.id = bt.booking_id
                      where b.stay_option_id = s.id
                        and (b.status = 'confirmed'
                             or (b.status = 'pending_payment' and b.hold_expires_at > now()))
                   )::integer) between 1 and 9
         end as is_limited,
         case when s.capacity is null then false
              else s.capacity <= (
                     select count(*)
                       from public.booking_travelers bt
                       join public.bookings b on b.id = bt.booking_id
                      where b.stay_option_id = s.id
                        and (b.status = 'confirmed'
                             or (b.status = 'pending_payment' and b.hold_expires_at > now()))
                   )::integer
         end as sold_out
    from public.departure_stay_options s
   where s.departure_id = p_departure_id
     and s.is_active
   order by s.position;
$$;

revoke execute on function public.stay_option_availability_public(uuid) from public;
grant execute on function public.stay_option_availability_public(uuid) to anon, authenticated, service_role;

comment on function public.stay_option_availability_public(uuid) is
  'Places left per stay tier for a departure, for anonymous display. Counts TRAVELERS (not rooms), '
  'using the same confirmed-plus-live-hold rule as quote_booking(). is_limited is 1-9 left. '
  'Never exposes confirmed vs held separately. Computed on read, so it is never stale.';

-- ── 2. Where you would sleep ─────────────────────────────────────────────────
-- Adds address, coordinates and description so the tier card can show a map and a real profile.
-- Still only active hotels on active tiers, and still nothing a supplier contract would keep
-- private: no net rate, no supplier id, no internal note.
-- `create or replace view` cannot insert a column into the middle of an existing column list, so
-- the view is dropped and rebuilt. Nothing depends on it in SQL; the web reads it by name.
drop view if exists public.stay_option_hotels_public;
create view public.stay_option_hotels_public
with (security_invoker = false) as
  select o.id as stay_option_id, o.departure_id, h.id as hotel_id, h.name as hotel_name,
         h.slug as hotel_slug, h.address, h.city, h.country_code,
         h.latitude, h.longitude, h.star_rating, h.description, h.image_urls, h.amenities,
         r.name as room_name, r.bed_type, r.max_occupancy
    from public.departure_stay_options o
    join public.hotels h on h.id = o.hotel_id and h.is_active
    left join public.hotel_rooms r on r.id = o.hotel_room_id
   where o.is_active;
grant select on public.stay_option_hotels_public to anon, authenticated;

comment on view public.stay_option_hotels_public is
  'Public hotel profile per stay tier: name, address, coordinates, stars, description, images, '
  'amenities. Read by the tour page and configurator. Supplier ids and net rates never appear here.';
