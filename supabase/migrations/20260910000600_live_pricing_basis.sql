-- Make the pricing formula machine-readable, so a price can be re-derived from a live rate.
--
-- Until now the formula lived only in a comment at the top of a seed file:
--
--     price = (room cost for 5 nights + 150) × the tier's multiple
--
-- Prose cannot be executed. Every price on the Monaco departure was therefore a number somebody
-- typed once, and the gap between that number and what the room actually cost was invisible until
-- somebody went looking — which is the whole shape of the $19,626-room-sold-for-$4,450 failure.
-- Putting the multiple and the fixed cost in columns means the price can be recomputed from a fresh
-- supplier rate whenever we want, and the arithmetic is auditable rather than remembered.
--
-- WHAT EACH COLUMN IS
--   cost_multiple       the tier's margin multiple. 1.45 on the entry rung, 1.60 at the top.
--   fixed_cost_amount   the non-room cost per traveler already inside the price: the train pass,
--                       the welcome round, per-traveler ops. $150 on Monaco.
--   auto_price          opt-in. A tier is only re-derived when someone has said it may be.
--   priced_room_amount  the room cost the current price was computed from, so drift is a
--                       subtraction rather than an investigation.
--   priced_at           when that happened. Shown to travelers as "priced from a live rate on …".
--
-- Nothing is defaulted on. Every existing tier keeps its hand-set price until a human opts it in,
-- because an automatic repricer that switches itself on across a whole catalogue is a worse bug
-- than the one it fixes.

alter table public.departure_stay_options
  add column cost_multiple      numeric(4, 2)
    check (cost_multiple is null or cost_multiple between 1.00 and 5.00),
  add column fixed_cost_amount  bigint not null default 0
    check (fixed_cost_amount >= 0),
  add column auto_price         boolean not null default false,
  add column priced_room_amount bigint
    check (priced_room_amount is null or priced_room_amount >= 0),
  add column priced_at          timestamptz;

comment on column public.departure_stay_options.cost_multiple is
  'Margin multiple applied to landed cost: price = (room + fixed_cost_amount) * cost_multiple. '
  'Null means this tier is priced by hand and must not be re-derived.';
comment on column public.departure_stay_options.fixed_cost_amount is
  'Per-traveler non-room cost already inside the price (transport passes, welcome round, ops), '
  'in minor units.';
comment on column public.departure_stay_options.auto_price is
  'Opt-in. When true, the price is re-derived from the freshest supplier rate on builder entry. '
  'Requires cost_multiple and a linked hotel; false leaves the hand-set price alone.';
comment on column public.departure_stay_options.priced_room_amount is
  'The room cost the current price was derived from. Drift is this minus the latest rate.';
comment on column public.departure_stay_options.priced_at is
  'When the price was last derived from a live supplier rate. Shown publicly as the "as of" date.';

-- A tier cannot claim to price itself without the two numbers the formula needs.
alter table public.departure_stay_options
  add constraint departure_stay_options_auto_price_needs_basis
    check (not auto_price or cost_multiple is not null);

-- The public view gains the "as of" date, so the tour page can say when a price was last verified
-- rather than implying it is live. Rebuilt rather than replaced: a new column in the middle of the
-- list is not something `create or replace view` will accept.
drop view if exists public.stay_option_hotels_public;
create view public.stay_option_hotels_public
with (security_invoker = false) as
  select o.id as stay_option_id, o.departure_id, h.id as hotel_id, h.name as hotel_name,
         h.slug as hotel_slug, h.address, h.city, h.country_code,
         h.latitude, h.longitude, h.star_rating, h.description, h.image_urls, h.amenities,
         o.priced_at, o.auto_price,
         r.name as room_name, r.bed_type, r.max_occupancy
    from public.departure_stay_options o
    join public.hotels h on h.id = o.hotel_id and h.is_active
    left join public.hotel_rooms r on r.id = o.hotel_room_id
   where o.is_active;
grant select on public.stay_option_hotels_public to anon, authenticated;

comment on view public.stay_option_hotels_public is
  'Public hotel profile per stay tier: name, address, coordinates, stars, description, images, '
  'amenities, and when the price was last derived from a live rate. Supplier ids and net rates '
  'never appear here.';
