-- 007_tour_itinerary
-- Template itinerary for a tour version. Copied into trip_days / trip_itinerary_items when a
-- departure is activated (ADR-009). Contains no confidential data — supplier references and
-- costs live in supplier_services (staff-only).

create table public.tour_days (
  id               uuid primary key default gen_random_uuid(),
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  day_number       integer not null check (day_number >= 1),
  destination_id   uuid references public.destinations (id) on delete set null,
  title            text not null,
  summary          text,
  unique (tour_version_id, day_number)
);

create table public.tour_itinerary_items (
  id               uuid primary key default gen_random_uuid(),
  tour_day_id      uuid not null references public.tour_days (id) on delete cascade,
  position         integer not null default 0,
  type             public.itinerary_item_type not null,
  title            text not null,
  description      text,
  start_time       time,                 -- local wall time in `timezone`
  end_time         time,
  timezone         text not null,        -- IANA; usually the day's destination zone
  location_name    text,
  address          text,
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  instructions     text,
  responsibility   public.responsibility not null default 'guideless',
  is_optional      boolean not null default false,
  visibility       public.content_visibility not null default 'public_preview',
  constraint tour_itinerary_items_time_order check (
    start_time is null or end_time is null or end_time >= start_time
  )
);

create index tour_itinerary_items_day_idx on public.tour_itinerary_items (tour_day_id, position);
create index tour_days_version_idx on public.tour_days (tour_version_id, day_number);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.tour_days enable row level security;
alter table public.tour_itinerary_items enable row level security;

create policy "days follow version" on public.tour_days
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage days" on public.tour_days
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

-- Public sees only public_preview items of public versions; staff see everything.
create policy "preview items follow version" on public.tour_itinerary_items
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or (
      visibility = 'public_preview'
      and exists (
        select 1 from public.tour_days d
        where d.id = tour_itinerary_items.tour_day_id
          and public.tour_version_is_public(d.tour_version_id)
      )
    )
  );
create policy "content staff manage items" on public.tour_itinerary_items
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));
