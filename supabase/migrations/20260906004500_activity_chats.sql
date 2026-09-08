-- 045_activity_chats
-- A chat room per paid add-on, so the eight people on Friday's boat can talk to each other
-- without filling the whole-trip room (plan v2 §38: departure chat / activity chat / support
-- chat are separate). Membership follows the purchase: confirmed buyers are in, cancellations
-- are removed, and someone who did not buy the add-on can neither list the room nor read it.
--
-- The three default rooms (trip_group, announcements, optional_activities) stay singular per
-- trip; activity rooms are keyed by add-on instead, so `unique (trip_id, type)` becomes a pair
-- of partial unique indexes.

alter table public.chat_rooms
  add column add_on_id uuid references public.departure_add_ons (id) on delete cascade;

alter table public.chat_rooms drop constraint chat_rooms_trip_id_type_key;
create unique index chat_rooms_trip_type_idx on public.chat_rooms (trip_id, type)
  where add_on_id is null;
create unique index chat_rooms_trip_add_on_idx on public.chat_rooms (trip_id, add_on_id)
  where add_on_id is not null;
-- An activity room is always of type optional_activities; the three defaults never carry an add-on.
alter table public.chat_rooms add constraint chat_rooms_add_on_type_check
  check (add_on_id is null or type = 'optional_activities');

-- ── Who is in an activity room ───────────────────────────────────────────────
-- Confirmed buyers of the add-on who are still members of the trip. `security definer` because
-- it reads bookings and booking_add_ons, which travelers cannot read for other people.
create or replace function public.add_on_room_participants(p_trip_id uuid, p_add_on_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct tm.user_id
  from public.trip_members tm
  join public.bookings b on b.customer_id = tm.user_id
  join public.booking_add_ons ba on ba.booking_id = b.id
  where tm.trip_id = p_trip_id
    and tm.removed_at is null
    and ba.add_on_id = p_add_on_id
    and ba.status = 'confirmed';
$$;
revoke execute on function public.add_on_room_participants(uuid, uuid) from public;
grant execute on function public.add_on_room_participants(uuid, uuid) to authenticated, service_role;

/**
 * Bring an activity room's roster in line with who has actually paid: confirmed buyers are
 * added (or reinstated), everyone else is marked removed. Returns the number of rooms touched.
 * Safe to call repeatedly; the app calls it after a purchase and the trigger below calls it
 * whenever a booking_add_ons row changes state.
 */
create or replace function public.sync_add_on_chat_members(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room  record;
  v_rooms integer := 0;
begin
  for v_room in
    select id, add_on_id from public.chat_rooms
    where trip_id = p_trip_id and add_on_id is not null
  loop
    insert into public.chat_members (room_id, user_id, member_role)
    select v_room.id, p.user_id, 'member'
    from public.add_on_room_participants(p_trip_id, v_room.add_on_id) p
    on conflict (room_id, user_id) do update set removed_at = null;

    -- Anyone in the room who no longer holds a confirmed purchase loses access. Staff stay.
    update public.chat_members cm
    set removed_at = now()
    where cm.room_id = v_room.id
      and cm.removed_at is null
      and cm.member_role <> 'staff'
      and not exists (
        select 1 from public.add_on_room_participants(p_trip_id, v_room.add_on_id) p
        where p.user_id = cm.user_id
      );
    v_rooms := v_rooms + 1;
  end loop;
  return v_rooms;
end;
$$;
revoke execute on function public.sync_add_on_chat_members(uuid) from public;
grant execute on function public.sync_add_on_chat_members(uuid) to authenticated, service_role;

/**
 * Open (or find) the chat room for an add-on and put the caller in it. Staff may open any room;
 * a traveler may only open one for an add-on they have confirmed. Idempotent.
 */
create or replace function public.ensure_add_on_chat_room(p_trip_id uuid, p_add_on_id uuid)
returns public.chat_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.chat_rooms;
  v_title text;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege', hint = 'auth_required';
  end if;
  if not (select public.is_staff()) and not exists (
    select 1 from public.add_on_room_participants(p_trip_id, p_add_on_id) p where p.user_id = v_uid
  ) then
    raise exception 'This chat is for travelers who booked this experience'
      using errcode = 'insufficient_privilege', hint = 'not_a_participant';
  end if;

  select * into v_room from public.chat_rooms
  where trip_id = p_trip_id and add_on_id = p_add_on_id;

  if v_room.id is null then
    select a.title into v_title from public.departure_add_ons a where a.id = p_add_on_id;
    if v_title is null then
      raise exception 'Unknown add-on %', p_add_on_id using hint = 'add_on_not_found';
    end if;
    insert into public.chat_rooms (trip_id, type, name, add_on_id)
    values (p_trip_id, 'optional_activities', v_title, p_add_on_id)
    returning * into v_room;
  end if;

  perform public.sync_add_on_chat_members(p_trip_id);
  return v_room;
end;
$$;
revoke execute on function public.ensure_add_on_chat_room(uuid, uuid) from public;
grant execute on function public.ensure_add_on_chat_room(uuid, uuid) to authenticated, service_role;

-- Purchases and cancellations move the roster without the app having to remember to ask.
create or replace function public.booking_add_ons_sync_chats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select t.id into v_trip_id
  from public.bookings b
  join public.trips t on t.departure_id = b.departure_id
  where b.id = new.booking_id
  limit 1;
  if v_trip_id is not null then
    perform public.sync_add_on_chat_members(v_trip_id);
  end if;
  return new;
end;
$$;
create trigger booking_add_ons_sync_chats
  after insert or update of status on public.booking_add_ons
  for each row execute function public.booking_add_ons_sync_chats();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- `chat_rooms`, `chat_members` and `messages` already gate on is_chat_member(room_id), and the
-- sync above is the only thing that grants membership on an activity room, so a traveler who
-- did not buy the add-on has no row in chat_members and therefore cannot list or read it.
-- The trip-wide membership trigger must not sweep travelers into activity rooms, so it now
-- skips rooms that belong to an add-on.
create or replace function public.sync_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.chat_members (room_id, user_id, member_role)
    select r.id, new.user_id, case when new.member_role = 'staff' then 'staff' else 'member' end
    from public.chat_rooms r where r.trip_id = new.trip_id and r.add_on_id is null
    on conflict (room_id, user_id) do update set removed_at = null;
  elsif tg_op = 'UPDATE' and new.removed_at is not null and old.removed_at is null then
    -- Leaving the trip removes every room, activity rooms included.
    update public.chat_members cm set removed_at = new.removed_at
    from public.chat_rooms r
    where cm.room_id = r.id and r.trip_id = new.trip_id and cm.user_id = new.user_id;
  end if;
  return new;
end;
$$;
