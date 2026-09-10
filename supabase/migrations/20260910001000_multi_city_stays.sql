-- A tier on a multi-city trip is several hotels, not one.
--
-- `departure_stay_options.hotel_id` holds a single property, and `resolveStayContext()` prices it
-- across the whole departure: check in on the start date, check out on the end date. That is
-- exactly right for Monaco, which is five nights in one place. It is wrong for Southern France,
-- which is three nights in Nice, two in Avignon and three in Paris — pricing that tier off one
-- property for eight nights is not an approximation, it is a different trip. It is also why
-- Southern France has no hotels linked at all: there was nowhere to put the other two.
--
-- So a tier gets legs: one row per city, each with its own hotel and its own dates, which is also
-- the shape a supplier availability query takes. Single-city tiers are untouched — no legs means
-- the anchor `hotel_id` covers the whole stay, and the public view keeps saying so.

create table public.departure_stay_legs (
  id              uuid primary key default gen_random_uuid(),
  stay_option_id  uuid not null references public.departure_stay_options (id) on delete cascade,
  -- Which city this leg is, for the label on the card. Nullable so a leg can exist before the
  -- destination does, restrict so a published destination cannot vanish under a sold tier.
  destination_id  uuid references public.destinations (id) on delete restrict,
  hotel_id        uuid not null references public.hotels (id) on delete restrict,
  hotel_room_id   uuid references public.hotel_rooms (id) on delete set null,
  position        smallint not null check (position between 1 and 20),
  -- Real dates, not an offset from the departure. A leg is queried against a supplier verbatim,
  -- and an offset would have to be recomputed — and eventually mis-recomputed — at every use.
  check_in        date not null,
  check_out       date not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint departure_stay_legs_dates check (check_out > check_in)
);
create unique index departure_stay_legs_position_idx
  on public.departure_stay_legs (stay_option_id, position);
create index departure_stay_legs_hotel_idx on public.departure_stay_legs (hotel_id);
create trigger departure_stay_legs_set_updated_at before update on public.departure_stay_legs
  for each row execute function public.set_updated_at();

comment on table public.departure_stay_legs is
  'One city of a stay tier: the hotel, the room type and the exact nights. Absent for single-city '
  'tiers, which use departure_stay_options.hotel_id for the whole departure.';

alter table public.departure_stay_legs enable row level security;
-- Same shape as hotels: the public reads through the projection below, never the base table, so a
-- future supplier or cost column here cannot leak by being added.
create policy "staff read stay legs" on public.departure_stay_legs
  for select to authenticated using ((select public.is_staff()));
create policy "content or ops staff manage stay legs" on public.departure_stay_legs
  for all to authenticated
  using ((select public.is_content_staff()) or (select public.is_ops_staff()))
  with check ((select public.is_content_staff()) or (select public.is_ops_staff()));

-- The public projection now returns one row per leg rather than one row per tier. Callers group by
-- `stay_option_id` and render the legs in `position` order; a single-city tier is simply a tier
-- with one leg, so there is one code path rather than two.
drop view if exists public.stay_option_hotels_public;
create view public.stay_option_hotels_public
with (security_invoker = false) as
  select o.id                       as stay_option_id,
         o.departure_id,
         l.position,
         l.check_in,
         l.check_out,
         (l.check_out - l.check_in) as nights,
         dest.name                  as leg_name,
         h.id                       as hotel_id,
         h.name                     as hotel_name,
         h.slug                     as hotel_slug,
         h.address, h.city, h.country_code, h.latitude, h.longitude,
         h.star_rating, h.description, h.image_urls, h.amenities,
         o.priced_at, o.auto_price,
         r.name                     as room_name,
         r.bed_type, r.max_occupancy
    from public.departure_stay_legs l
    join public.departure_stay_options o on o.id = l.stay_option_id and o.is_active
    join public.hotels h on h.id = l.hotel_id and h.is_active
    left join public.destinations dest on dest.id = l.destination_id
    left join public.hotel_rooms r on r.id = l.hotel_room_id
   union all
  select o.id,
         o.departure_id,
         1::smallint,
         d.start_date,
         d.end_date,
         (d.end_date - d.start_date),
         dest.name,
         h.id, h.name, h.slug,
         h.address, h.city, h.country_code, h.latitude, h.longitude,
         h.star_rating, h.description, h.image_urls, h.amenities,
         o.priced_at, o.auto_price,
         r.name, r.bed_type, r.max_occupancy
    from public.departure_stay_options o
    join public.departures d on d.id = o.departure_id
    join public.hotels h on h.id = o.hotel_id and h.is_active
    left join public.destinations dest on dest.id = h.destination_id
    left join public.hotel_rooms r on r.id = o.hotel_room_id
   where o.is_active
     and not exists (
       select 1 from public.departure_stay_legs l where l.stay_option_id = o.id
     );
grant select on public.stay_option_hotels_public to anon, authenticated;

comment on view public.stay_option_hotels_public is
  'Public hotel profile per stay tier, one row per city: name, address, coordinates, stars, '
  'description, images, amenities, the nights in that city, and when the price was last derived '
  'from a live rate. A single-city tier yields one row covering the whole departure. Supplier ids '
  'and net rates never appear here.';
