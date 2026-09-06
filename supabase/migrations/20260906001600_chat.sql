-- 016_chat
-- Group chat on Supabase Realtime (ADR-010). Rooms per trip; membership is explicit; RLS is the
-- moderation boundary. Removed members lose access immediately. Deletion is soft and audited.

create table public.chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  type        public.chat_room_type not null,
  name        text not null,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (trip_id, type)
);

create table public.chat_members (
  room_id       uuid not null references public.chat_rooms (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  member_role   text not null default 'member' check (member_role in ('member', 'staff')),
  joined_at     timestamptz not null default now(),
  removed_at    timestamptz,
  last_read_at  timestamptz,
  is_muted      boolean not null default false,
  primary key (room_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id) where removed_at is null;

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id    uuid not null references auth.users (id) on delete set null,
  body         text not null check (char_length(body) between 1 and 4000),
  attachments  jsonb not null default '[]'::jsonb,   -- [{bucket,path,mime,width,height}]
  reply_to_id  uuid references public.messages (id) on delete set null,
  edited_at    timestamptz,
  deleted_at   timestamptz,
  deleted_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index messages_room_created_idx on public.messages (room_id, created_at desc);

create table public.message_reactions (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.user_blocks (
  blocker_id  uuid not null references auth.users (id) on delete cascade,
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references auth.users (id) on delete set null,
  target_user_id   uuid references auth.users (id) on delete set null,
  message_id       uuid references public.messages (id) on delete set null,
  reason           text not null check (char_length(reason) <= 1000),
  status           text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_by      uuid references auth.users (id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now(),
  check (target_user_id is not null or message_id is not null)
);
create index reports_status_idx on public.reports (status, created_at);

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.is_chat_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members m
    where m.room_id = p_room_id and m.user_id = auth.uid() and m.removed_at is null
  );
$$;
revoke execute on function public.is_chat_member(uuid) from public;
grant execute on function public.is_chat_member(uuid) to authenticated, service_role;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['trip_staff', 'support', 'admin', 'super_admin']::public.app_role[]);
$$;
revoke execute on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated, service_role;

-- Default rooms + membership when a trip is created / a member joins.
create or replace function public.create_default_chat_rooms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_rooms (trip_id, type, name) values
    (new.id, 'trip_group', 'Trip Group'),
    (new.id, 'announcements', 'Announcements'),
    (new.id, 'optional_activities', 'Optional Activities');
  return new;
end;
$$;
create trigger trips_create_chat_rooms after insert on public.trips
  for each row execute function public.create_default_chat_rooms();

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
    from public.chat_rooms r where r.trip_id = new.trip_id
    on conflict (room_id, user_id) do update set removed_at = null;
  elsif tg_op = 'UPDATE' and new.removed_at is not null and old.removed_at is null then
    update public.chat_members cm set removed_at = new.removed_at
    from public.chat_rooms r
    where cm.room_id = r.id and r.trip_id = new.trip_id and cm.user_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger trip_members_sync_chat after insert or update of removed_at on public.trip_members
  for each row execute function public.sync_chat_membership();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;

create policy "members read their rooms" on public.chat_rooms
  for select to authenticated
  using ((select public.is_chat_member(id)) or (select public.is_staff()));
create policy "ops staff manage rooms" on public.chat_rooms
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "members see room roster" on public.chat_members
  for select to authenticated
  using ((removed_at is null and (select public.is_chat_member(room_id))) or (select public.is_staff()));
create policy "members update their own settings" on public.chat_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and removed_at is null);
create policy "moderators manage membership" on public.chat_members
  for all to authenticated using ((select public.is_moderator())) with check ((select public.is_moderator()));

-- Read: room member, message not deleted (unless moderator), sender not blocked by me.
create policy "members read messages" on public.messages
  for select to authenticated
  using (
    (select public.is_moderator())
    or (
      (select public.is_chat_member(room_id))
      and deleted_at is null
      and not exists (select 1 from public.user_blocks ub
                      where ub.blocker_id = (select auth.uid()) and ub.blocked_id = messages.sender_id)
    )
  );

-- Send: must be a member and the sender; announcements are staff-only.
create policy "members send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select public.is_chat_member(room_id))
    and (
      (select public.is_moderator())
      or not exists (select 1 from public.chat_rooms r where r.id = messages.room_id and r.type = 'announcements')
    )
  );

-- Edit own message body; moderators may soft-delete anything.
create policy "senders edit their messages" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()) and deleted_at is null)
  with check (sender_id = (select auth.uid()));
create policy "moderators moderate messages" on public.messages
  for update to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
-- No delete policy: soft delete only, auditable.

create policy "members read reactions" on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_reactions.message_id
                 and ((select public.is_chat_member(m.room_id)) or (select public.is_moderator()))));
create policy "members manage their reactions" on public.message_reactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.messages m where m.id = message_reactions.message_id
                          and (select public.is_chat_member(m.room_id))));

create policy "users manage their blocks" on public.user_blocks
  for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create policy "moderators read blocks" on public.user_blocks
  for select to authenticated using ((select public.is_moderator()));

create policy "users file reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "users read their reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_moderator()));
create policy "moderators resolve reports" on public.reports
  for update to authenticated using ((select public.is_moderator())) with check ((select public.is_moderator()));
