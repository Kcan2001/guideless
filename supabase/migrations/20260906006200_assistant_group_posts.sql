-- The assistant's one job in the group chat: post the free activity, each morning, once.
--
-- The decision was scheduled posts only — no conversation in the shared room. That is a product
-- choice, and it is also what keeps the room a place where people talk to each other rather than
-- to a machine. What it posts is the thing the whole proposition rests on: the free activity that
-- everyone can join, whatever they paid, which is the difference between one group and two.
--
-- Two schema changes make it possible, and one table makes it safe to run twice.

-- ── A message with no person behind it ───────────────────────────────────────
-- `sender_id` was not null because every message so far came from somebody. A scheduled post comes
-- from us. The alternative — a fake "Guideless" auth user in every environment — is worse: it can
-- be messaged, blocked and reported like a person, and it would have to exist in production before
-- anything worked.
alter table public.messages alter column sender_id drop not null;
alter table public.messages add column is_system boolean not null default false;

comment on column public.messages.is_system is
  'Posted by us, not by a traveler. sender_id is null on these; clients render them as Guideless and must not offer to block or report them.';

-- A system message has no sender; a traveler's message must still have one. Without this, dropping
-- the not-null above would let a client insert an anonymous message and have it render as ours.
alter table public.messages add constraint messages_sender_or_system
  check ((is_system and sender_id is null) or (not is_system and sender_id is not null));

-- ── Posted once, whatever the scheduler does ─────────────────────────────────
-- Vercel cron has at-least-once delivery, and a retry that posts "free hike at 8am" a second time
-- is the kind of thing that makes people mute a chat room.
create table public.assistant_group_posts (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  post_date  date not null,
  message_id uuid references public.messages (id) on delete set null,
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (trip_id, post_date)
);

comment on table public.assistant_group_posts is
  'One row per trip per day the assistant posted the free activities. The primary key is the idempotency guard: a retried cron run inserts nothing and posts nothing.';

alter table public.assistant_group_posts enable row level security;

-- Travelers never read this directly — they read the message it produced. Staff can, to answer
-- "why did nobody get told about the swim".
create policy "staff read assistant posts" on public.assistant_group_posts
  for select to authenticated using ((select public.is_staff()));
create policy "service writes assistant posts" on public.assistant_group_posts
  for all to service_role using (true) with check (true);

-- ── What to post ─────────────────────────────────────────────────────────────
-- The free, optional, Guideless-run things happening on one day of a trip. Free means free: an
-- add-on somebody paid for is not this, and neither is a train.
create or replace function public.free_activities_on(p_trip_id uuid, p_date date)
returns table (
  item_id    uuid,
  title      text,
  start_time time,
  location_name text,
  instructions  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.title, i.start_time, i.location_name, i.instructions
  from public.trip_itinerary_items i
  join public.trip_days d on d.id = i.trip_day_id
  where i.trip_id = p_trip_id
    and d.date = p_date
    and i.is_optional
    and i.responsibility = 'guideless'
    and i.type <> 'free_time'
    and i.status <> 'cancelled'
  order by i.start_time nulls last, i.position;
$$;

revoke execute on function public.free_activities_on(uuid, date) from public;
grant execute on function public.free_activities_on(uuid, date) to authenticated, service_role;

comment on function public.free_activities_on(uuid, date) is
  'The free group activities on one day of a trip — optional, run by us, not a paid add-on. What the morning chat post is made of.';

-- Trips that are running today, with their group room and their zone, so one query drives the
-- scheduled run rather than a fan-out from the application.
create or replace function public.trips_running_on(p_date date)
returns table (trip_id uuid, room_id uuid, timezone text, trip_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, r.id, t.timezone, t.name
  from public.trips t
  join public.chat_rooms r on r.trip_id = t.id and r.type = 'trip_group' and not r.is_archived
  where t.status <> 'cancelled'
    and p_date between t.start_date and t.end_date;
$$;

revoke execute on function public.trips_running_on(date) from public;
grant execute on function public.trips_running_on(date) to service_role;
