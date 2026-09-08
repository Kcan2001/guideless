-- 049_reviews_photos
-- Reviews and traveler photos. The whole point of this feature is that it cannot be faked:
-- a review exists only when a real traveler took a real trip that has already ended, nothing is
-- ever seeded, and the site shows no rating, count or average until published rows exist.
-- The homepage already promises exactly this ("No invented reviews"), so the schema enforces it
-- rather than trusting the UI: insert goes through submit_review()/submit_trip_photo(), which
-- check eligibility in one place, and everything lands as `pending` for a human to publish.

create type public.review_status as enum ('pending', 'published', 'rejected');

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  tour_id       uuid not null references public.tours (id) on delete cascade,
  -- The author's first name, frozen when they write. A published review must not silently
  -- change its byline because someone later edited their profile, and `profiles` is not readable
  -- by anonymous visitors, so the public page could not join to it anyway.
  author_name   text not null default '',
  -- When they travelled, copied at submit time. `trips` is not readable by anonymous visitors
  -- either, so this is the only way the public page can say how recent a review is.
  trip_end_date date,
  rating        smallint not null check (rating between 1 and 5),
  title         text check (char_length(title) <= 120),
  body          text not null check (char_length(body) between 1 and 4000),
  would_repeat  boolean,
  status        public.review_status not null default 'pending',
  published_at  timestamptz,
  staff_note    text check (char_length(staff_note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One review per booking: a party of four does not get four voices, the person who booked writes.
  constraint reviews_one_per_booking unique (booking_id),
  constraint reviews_published_at check ((status = 'published') = (published_at is not null))
);
create index reviews_tour_published_idx on public.reviews (tour_id, published_at desc)
  where status = 'published';
create index reviews_status_idx on public.reviews (status, created_at desc);
create index reviews_user_idx on public.reviews (user_id);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

comment on table public.reviews is
  'Traveler reviews. Only insertable through submit_review() by someone whose trip has ended; '
  'published by staff. Nothing here is ever seeded — an empty table means an empty reviews page.';

-- Photos travelers took on the trip. Files live in the existing private `trip-media` bucket
-- (migration 020) under trip-media/{trip_id}/{user_id}/, whose policies already restrict writes
-- to trip members writing into their own folder. This table adds the moderation state on top.
create table public.trip_photos (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  tour_id       uuid not null references public.tours (id) on delete cascade,
  author_name   text not null default '',
  storage_path  text not null unique,
  caption       text check (char_length(caption) <= 280),
  status        public.review_status not null default 'pending',
  published_at  timestamptz,
  staff_note    text check (char_length(staff_note) <= 500),
  created_at    timestamptz not null default now(),
  constraint trip_photos_published_at check ((status = 'published') = (published_at is not null))
);
create index trip_photos_tour_published_idx on public.trip_photos (tour_id, published_at desc)
  where status = 'published';
create index trip_photos_status_idx on public.trip_photos (status, created_at desc);
create index trip_photos_user_idx on public.trip_photos (user_id);

-- First name only. A review is somebody's word, not their identity document.
create or replace function public.review_author_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(split_part(btrim(coalesce((select display_name from public.profiles where id = p_user_id), '')), ' ', 1), ''),
    'A Guideless traveler'
  );
$$;
revoke execute on function public.review_author_name(uuid) from public, anon;
grant execute on function public.review_author_name(uuid) to authenticated, service_role;

-- ── Eligibility, stated once ─────────────────────────────────────────────────
-- A booking may be reviewed when the caller owns it, it was actually paid for (confirmed or
-- completed), and the trip it belongs to has finished. `end_date < current_date` means the last
-- day is over: asking someone for a review while they are still at the airport is rude and the
-- answer is not worth much either.
create or replace function public.can_review_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.trip_members tm on tm.booking_id = b.id
    join public.trips t on t.id = tm.trip_id
    where b.id = p_booking_id
      and b.customer_id = (select auth.uid())
      and b.status in ('confirmed', 'completed')
      and t.end_date < current_date
      and t.status <> 'cancelled'
  );
$$;
revoke execute on function public.can_review_booking(uuid) from public;
grant execute on function public.can_review_booking(uuid) to authenticated, service_role;

-- Every trip the caller could review right now, minus the ones they already have. The account
-- page and the app both ask this rather than reimplementing the rule.
create or replace function public.reviewable_bookings()
returns table (
  booking_id uuid,
  trip_id    uuid,
  tour_id    uuid,
  tour_name  text,
  trip_name  text,
  end_date   date
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, t.id, tv.tour_id, tr.name, t.name, t.end_date
  from public.bookings b
  join public.trip_members tm on tm.booking_id = b.id
  join public.trips t on t.id = tm.trip_id
  join public.tour_versions tv on tv.id = t.tour_version_id
  join public.tours tr on tr.id = tv.tour_id
  where b.customer_id = (select auth.uid())
    and b.status in ('confirmed', 'completed')
    and t.end_date < current_date
    and t.status <> 'cancelled'
    and not exists (select 1 from public.reviews r where r.booking_id = b.id)
  order by t.end_date desc;
$$;
revoke execute on function public.reviewable_bookings() from public;
grant execute on function public.reviewable_bookings() to authenticated, service_role;

-- ── Writing a review ─────────────────────────────────────────────────────────
create or replace function public.submit_review(
  p_booking_id   uuid,
  p_rating       smallint,
  p_body         text,
  p_title        text default null,
  p_would_repeat boolean default null
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_trip record;
  v_row  public.reviews;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if not public.can_review_booking(p_booking_id) then
    raise exception 'You can only review a trip you took, after it has ended'
      using errcode = 'insufficient_privilege', hint = 'not_eligible';
  end if;

  select t.id as trip_id, tv.tour_id, t.end_date
  into v_trip
  from public.bookings b
  join public.trip_members tm on tm.booking_id = b.id
  join public.trips t on t.id = tm.trip_id
  join public.tour_versions tv on tv.id = t.tour_version_id
  where b.id = p_booking_id
  limit 1;

  insert into public.reviews (trip_id, booking_id, user_id, tour_id, author_name, trip_end_date,
                              rating, title, body, would_repeat)
  values (v_trip.trip_id, p_booking_id, v_uid, v_trip.tour_id, public.review_author_name(v_uid),
          v_trip.end_date, p_rating,
          nullif(btrim(coalesce(p_title, '')), ''), btrim(p_body), p_would_repeat)
  returning * into v_row;
  return v_row;
exception
  when unique_violation then
    raise exception 'You have already reviewed this trip'
      using errcode = 'unique_violation', hint = 'already_reviewed';
end;
$$;
revoke execute on function public.submit_review(uuid, smallint, text, text, boolean) from public, anon;
grant execute on function public.submit_review(uuid, smallint, text, text, boolean) to authenticated, service_role;

-- The file is uploaded to storage by the client (bucket policy allows only their own folder on a
-- trip they belong to); this records it and puts it in the moderation queue.
create or replace function public.submit_trip_photo(
  p_booking_id   uuid,
  p_storage_path text,
  p_caption      text default null
)
returns public.trip_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_trip record;
  v_row  public.trip_photos;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if not public.can_review_booking(p_booking_id) then
    raise exception 'You can only add photos from a trip you took, after it has ended'
      using errcode = 'insufficient_privilege', hint = 'not_eligible';
  end if;

  select t.id as trip_id, tv.tour_id
  into v_trip
  from public.bookings b
  join public.trip_members tm on tm.booking_id = b.id
  join public.trips t on t.id = tm.trip_id
  join public.tour_versions tv on tv.id = t.tour_version_id
  where b.id = p_booking_id
  limit 1;

  -- The path must be inside this trip's folder and the caller's own subfolder, matching the
  -- storage policy exactly, so a row can never point at someone else's file.
  if (storage.foldername(p_storage_path))[1] is distinct from v_trip.trip_id::text
     or (storage.foldername(p_storage_path))[2] is distinct from v_uid::text then
    raise exception 'That file path does not belong to you'
      using errcode = 'insufficient_privilege', hint = 'bad_path';
  end if;

  insert into public.trip_photos (trip_id, booking_id, user_id, tour_id, author_name, storage_path, caption)
  values (v_trip.trip_id, p_booking_id, v_uid, v_trip.tour_id, public.review_author_name(v_uid),
          p_storage_path, nullif(btrim(coalesce(p_caption, '')), ''))
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.submit_trip_photo(uuid, text, text) from public, anon;
grant execute on function public.submit_trip_photo(uuid, text, text) to authenticated, service_role;

-- ── Moderation ───────────────────────────────────────────────────────────────
-- Publishing stamps published_at; rejecting clears it. Both keep the staff note.
create or replace function public.set_review_status(
  p_review_id uuid,
  p_status    public.review_status,
  p_note      text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.reviews;
begin
  if not (select public.is_moderator()) then
    raise exception 'Staff only' using errcode = 'insufficient_privilege', hint = 'staff_required';
  end if;
  update public.reviews
  set status = p_status,
      published_at = case when p_status = 'published' then coalesce(published_at, now()) else null end,
      staff_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), staff_note)
  where id = p_review_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'No such review' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.set_review_status(uuid, public.review_status, text) from public, anon;
grant execute on function public.set_review_status(uuid, public.review_status, text) to authenticated, service_role;

create or replace function public.set_trip_photo_status(
  p_photo_id uuid,
  p_status   public.review_status,
  p_note     text default null
)
returns public.trip_photos
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.trip_photos;
begin
  if not (select public.is_moderator()) then
    raise exception 'Staff only' using errcode = 'insufficient_privilege', hint = 'staff_required';
  end if;
  update public.trip_photos
  set status = p_status,
      published_at = case when p_status = 'published' then coalesce(published_at, now()) else null end,
      staff_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), staff_note)
  where id = p_photo_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'No such photo' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.set_trip_photo_status(uuid, public.review_status, text) from public, anon;
grant execute on function public.set_trip_photo_status(uuid, public.review_status, text) to authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;
alter table public.trip_photos enable row level security;

-- Anyone may read a published review; the author sees their own whatever its state; staff see all.
create policy "published reviews are public" on public.reviews
  for select to anon, authenticated
  using (status = 'published');
create policy "authors and staff read every review" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
-- No insert policy: submit_review() is the only door, so the eligibility rule cannot be bypassed.
create policy "authors edit their pending review" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "moderators manage reviews" on public.reviews
  for all to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

create policy "published photos are public" on public.trip_photos
  for select to anon, authenticated
  using (status = 'published');
create policy "authors and staff read every photo" on public.trip_photos
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "authors delete their pending photo" on public.trip_photos
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
create policy "moderators manage photos" on public.trip_photos
  for all to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

-- ── Aggregate ────────────────────────────────────────────────────────────────
-- Count and average per tour, published rows only. A tour with nothing published simply has no
-- row here, so a caller cannot render "0 reviews" or a zero-star average by accident.
create view public.tour_review_stats
with (security_invoker = false) as
  select tour_id,
         count(*)::integer                          as review_count,
         round(avg(rating)::numeric, 2)             as average_rating,
         max(published_at)                          as latest_published_at
  from public.reviews
  where status = 'published'
  group by tour_id;

revoke all on public.tour_review_stats from public;
grant select on public.tour_review_stats to anon, authenticated;

comment on view public.tour_review_stats is
  'Published-only rating summary per tour. No row means no reviews yet — render nothing, not a zero.';
