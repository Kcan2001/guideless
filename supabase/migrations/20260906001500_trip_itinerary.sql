-- 015_trip_itinerary
-- The operational itinerary a traveler actually sees. Snapshotted from the tour version when a trip
-- is created (ADR-009), then edited by trip staff. Also the concrete logistics records
-- (accommodations, transport, activities) that itinerary items point to.

-- ── Logistics (per departure, shared by its groups) ───────────────────────────
create table public.accommodations (
  id                    uuid primary key default gen_random_uuid(),
  departure_id          uuid not null references public.departures (id) on delete cascade,
  destination_id        uuid references public.destinations (id) on delete set null,
  supplier_service_id   uuid references public.supplier_services (id) on delete set null,
  name                  text not null,
  address               text,
  latitude              double precision,
  longitude             double precision,
  phone                 text,
  website               text,
  check_in_date         date not null,
  check_out_date        date not null,
  check_in_time         time,
  check_out_time        time,
  timezone              text not null,
  guest_instructions    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint accommodations_dates check (check_out_date > check_in_date)
);
create index accommodations_departure_idx on public.accommodations (departure_id);
create trigger accommodations_set_updated_at before update on public.accommodations
  for each row execute function public.set_updated_at();

create table public.transport_segments (
  id                    uuid primary key default gen_random_uuid(),
  departure_id          uuid not null references public.departures (id) on delete cascade,
  supplier_service_id   uuid references public.supplier_services (id) on delete set null,
  type                  public.transport_type not null,
  carrier               text,
  service_number        text,                    -- train number / flight number
  origin_name           text not null,
  origin_address        text,
  origin_timezone       text not null,
  destination_name      text not null,
  destination_address   text,
  destination_timezone  text not null,
  departs_at            timestamptz not null,
  arrives_at            timestamptz not null,
  meeting_instructions  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint transport_segments_times check (arrives_at > departs_at)
);
create index transport_segments_departure_idx on public.transport_segments (departure_id, departs_at);
create trigger transport_segments_set_updated_at before update on public.transport_segments
  for each row execute function public.set_updated_at();

create table public.activities (
  id                    uuid primary key default gen_random_uuid(),
  departure_id          uuid not null references public.departures (id) on delete cascade,
  destination_id        uuid references public.destinations (id) on delete set null,
  supplier_service_id   uuid references public.supplier_services (id) on delete set null,
  name                  text not null,
  description           text,
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  timezone              text not null,
  location_name         text,
  address               text,
  latitude              double precision,
  longitude             double precision,
  is_optional           boolean not null default true,
  capacity              integer check (capacity is null or capacity >= 0),
  price_amount          bigint check (price_amount is null or price_amount >= 0),  -- add-on price to traveler
  currency              public.currency_code,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index activities_departure_idx on public.activities (departure_id, starts_at);
create trigger activities_set_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

-- ── Trip itinerary (per trip) ─────────────────────────────────────────────────
create table public.trip_days (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips (id) on delete cascade,
  day_number      integer not null check (day_number >= 1),
  date            date not null,
  destination_id  uuid references public.destinations (id) on delete set null,
  timezone        text not null,
  title           text not null,
  summary         text,
  unique (trip_id, day_number),
  unique (trip_id, date)
);

create table public.trip_itinerary_items (
  id                     uuid primary key default gen_random_uuid(),
  trip_id                uuid not null references public.trips (id) on delete cascade,  -- denormalized for RLS
  trip_day_id            uuid not null references public.trip_days (id) on delete cascade,
  source_item_id         uuid references public.tour_itinerary_items (id) on delete set null,
  position               integer not null default 0,
  type                   public.itinerary_item_type not null,
  status                 public.itinerary_item_status not null default 'planned',
  title                  text not null,
  description            text,
  start_time             time,
  end_time               time,
  timezone               text not null,
  location_name          text,
  address                text,
  latitude               double precision,
  longitude              double precision,
  instructions           text,
  responsibility         public.responsibility not null default 'guideless',
  is_optional            boolean not null default false,
  visibility             public.content_visibility not null default 'trip_member',
  accommodation_id       uuid references public.accommodations (id) on delete set null,
  transport_segment_id   uuid references public.transport_segments (id) on delete set null,
  activity_id            uuid references public.activities (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index trip_itinerary_items_trip_idx on public.trip_itinerary_items (trip_id);
create index trip_itinerary_items_day_idx on public.trip_itinerary_items (trip_day_id, position);
create trigger trip_itinerary_items_set_updated_at before update on public.trip_itinerary_items
  for each row execute function public.set_updated_at();

-- Staff-only private notes ("arriving a day early — do not show traveler").
create table public.trip_notes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  about_user_id uuid references auth.users (id) on delete set null,
  body        text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index trip_notes_trip_idx on public.trip_notes (trip_id);

-- ── Snapshot: create a trip for a departure group from its tour version ──────
create or replace function public.create_trip_for_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_departure public.departures%rowtype;
  v_group     public.departure_groups%rowtype;
  v_tour_name text;
  v_trip_id   uuid;
begin
  select * into v_group from public.departure_groups where id = p_group_id;
  if not found then raise exception 'Departure group % not found', p_group_id; end if;
  select * into v_departure from public.departures where id = v_group.departure_id;
  select name into v_tour_name from public.tours where id = v_departure.tour_id;

  insert into public.trips (departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, snapshot_taken_at)
  values (v_departure.id, v_group.id, v_departure.tour_version_id, v_tour_name,
          v_departure.start_date, v_departure.end_date, v_departure.timezone, now())
  returning id into v_trip_id;

  -- Days
  insert into public.trip_days (trip_id, day_number, date, destination_id, timezone, title, summary)
  select v_trip_id, d.day_number, v_departure.start_date + (d.day_number - 1),
         d.destination_id, coalesce(dest.timezone, v_departure.timezone), d.title, d.summary
  from public.tour_days d
  left join public.destinations dest on dest.id = d.destination_id
  where d.tour_version_id = v_departure.tour_version_id;

  -- Items
  insert into public.trip_itinerary_items (
    trip_id, trip_day_id, source_item_id, position, type, title, description, start_time, end_time,
    timezone, location_name, address, latitude, longitude, instructions, responsibility, is_optional, visibility)
  select v_trip_id, td.id, i.id, i.position, i.type, i.title, i.description, i.start_time, i.end_time,
         i.timezone, i.location_name, i.address, i.latitude, i.longitude, i.instructions, i.responsibility,
         i.is_optional,
         case when i.visibility = 'public_preview' then 'trip_member'::public.content_visibility else i.visibility end
  from public.tour_itinerary_items i
  join public.tour_days d on d.id = i.tour_day_id
  join public.trip_days td on td.trip_id = v_trip_id and td.day_number = d.day_number
  where d.tour_version_id = v_departure.tour_version_id;

  -- Members: every traveler on a confirmed booking assigned to this group (or unassigned, if the
  -- departure has a single group). Only travelers with a linked account get chat/app access.
  insert into public.trip_members (trip_id, user_id, traveler_id, booking_id)
  select v_trip_id, coalesce(tp.user_id, b.customer_id), tp.id, b.id
  from public.booking_travelers bt
  join public.bookings b on b.id = bt.booking_id
  join public.traveler_profiles tp on tp.id = bt.traveler_id
  where b.departure_id = v_departure.id and b.status = 'confirmed'
    and (bt.departure_group_id = v_group.id
         or (bt.departure_group_id is null
             and (select count(*) from public.departure_groups g where g.departure_id = v_departure.id) = 1))
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;
revoke execute on function public.create_trip_for_group(uuid) from public;
grant execute on function public.create_trip_for_group(uuid) to service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.accommodations enable row level security;
alter table public.transport_segments enable row level security;
alter table public.activities enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_itinerary_items enable row level security;
alter table public.trip_notes enable row level security;

create policy "departure members read accommodations" on public.accommodations
  for select to authenticated
  using ((select public.is_departure_member(departure_id)) or (select public.is_staff()));
create policy "ops staff manage accommodations" on public.accommodations
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "departure members read transport" on public.transport_segments
  for select to authenticated
  using ((select public.is_departure_member(departure_id)) or (select public.is_staff()));
create policy "ops staff manage transport" on public.transport_segments
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "departure members read activities" on public.activities
  for select to authenticated
  using ((select public.is_departure_member(departure_id)) or (select public.is_staff()));
create policy "ops staff manage activities" on public.activities
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "trip members read days" on public.trip_days
  for select to authenticated
  using ((select public.is_trip_member(trip_id)) or (select public.is_staff()));
create policy "ops staff manage days" on public.trip_days
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "trip members read visible items" on public.trip_itinerary_items
  for select to authenticated
  using (
    (select public.is_staff())
    or (visibility <> 'staff_only' and (select public.is_trip_member(trip_id)))
  );
create policy "ops staff manage items" on public.trip_itinerary_items
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "staff only trip notes" on public.trip_notes
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
