-- 018_support
-- In-app support threads. Staff see the customer's trip, booking and history alongside the thread.
-- Internal notes on a thread are staff-only.

create table public.support_threads (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references auth.users (id) on delete cascade,
  trip_id           uuid references public.trips (id) on delete set null,
  booking_id        uuid references public.bookings (id) on delete set null,
  category          public.support_category not null default 'other',
  status            public.support_thread_status not null default 'open',
  priority          text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  subject           text not null check (char_length(subject) between 1 and 200),
  -- Context captured at creation so staff see where the traveler was.
  context           jsonb not null default '{}'::jsonb,   -- {itineraryItemId, latitude, longitude, appVersion}
  last_message_at   timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index support_threads_customer_idx on public.support_threads (customer_id, created_at desc);
create index support_threads_open_idx on public.support_threads (status, priority, last_message_at)
  where status in ('open', 'waiting_on_staff');
create trigger support_threads_set_updated_at before update on public.support_threads
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references public.support_threads (id) on delete cascade,
  sender_id         uuid references auth.users (id) on delete set null,
  is_from_staff     boolean not null default false,
  is_internal_note  boolean not null default false,   -- staff-only, never shown to the customer
  body              text not null check (char_length(body) between 1 and 8000),
  created_at        timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (thread_id, created_at);

create table public.support_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.support_messages (id) on delete cascade,
  bucket        text not null default 'support-attachments',
  storage_path  text not null,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes between 1 and 26214400),   -- 25 MB
  created_at    timestamptz not null default now()
);
create index support_attachments_message_idx on public.support_attachments (message_id);

create table public.support_assignments (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.support_threads (id) on delete cascade,
  staff_id       uuid not null references auth.users (id) on delete cascade,
  assigned_by    uuid references auth.users (id) on delete set null,
  assigned_at    timestamptz not null default now(),
  unassigned_at  timestamptz
);
create index support_assignments_thread_idx on public.support_assignments (thread_id) where unassigned_at is null;
create index support_assignments_staff_idx on public.support_assignments (staff_id) where unassigned_at is null;

-- Keep last_message_at fresh and set first_response_at.
create or replace function public.support_message_touch_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_internal_note then return new; end if;
  update public.support_threads t
  set last_message_at = new.created_at,
      first_response_at = case when new.is_from_staff and t.first_response_at is null then new.created_at else t.first_response_at end,
      status = case
        when new.is_from_staff and t.status in ('open', 'waiting_on_staff') then 'waiting_on_customer'::public.support_thread_status
        when not new.is_from_staff and t.status in ('waiting_on_customer', 'resolved') then 'waiting_on_staff'::public.support_thread_status
        else t.status end
  where t.id = new.thread_id;
  return new;
end;
$$;
create trigger support_messages_touch_thread after insert on public.support_messages
  for each row execute function public.support_message_touch_thread();

-- ── RLS ──────────────────────────────────────────────────────────────────────
create or replace function public.is_support_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['support', 'trip_staff', 'admin', 'super_admin']::public.app_role[]);
$$;
revoke execute on function public.is_support_staff() from public;
grant execute on function public.is_support_staff() to authenticated, service_role;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_assignments enable row level security;

create policy "customers read their threads" on public.support_threads
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_support_staff()));
create policy "customers open threads" on public.support_threads
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'open');
create policy "support staff manage threads" on public.support_threads
  for update to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));

create policy "thread participants read messages" on public.support_messages
  for select to authenticated
  using (
    (select public.is_support_staff())
    or (
      not is_internal_note
      and exists (select 1 from public.support_threads t
                  where t.id = support_messages.thread_id and t.customer_id = (select auth.uid()))
    )
  );
create policy "customers reply on their threads" on public.support_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and not is_from_staff and not is_internal_note
    and exists (select 1 from public.support_threads t
                where t.id = support_messages.thread_id and t.customer_id = (select auth.uid())
                  and t.status <> 'closed')
  );
create policy "support staff reply" on public.support_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and is_from_staff and (select public.is_support_staff()));

create policy "attachments follow message" on public.support_attachments
  for select to authenticated
  using (exists (select 1 from public.support_messages m
                 join public.support_threads t on t.id = m.thread_id
                 where m.id = support_attachments.message_id
                   and ((t.customer_id = (select auth.uid()) and not m.is_internal_note) or (select public.is_support_staff()))));
create policy "senders attach to their messages" on public.support_attachments
  for insert to authenticated
  with check (exists (select 1 from public.support_messages m
                      where m.id = support_attachments.message_id and m.sender_id = (select auth.uid())));

create policy "support staff manage assignments" on public.support_assignments
  for all to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));
