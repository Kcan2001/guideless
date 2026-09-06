-- 010_groups
-- A departure can be split into explicit groups (Group A: 8 travelers, Group B: 6). Every departure
-- gets at least one group; a trip (014) is created per group.

create table public.departure_groups (
  id            uuid primary key default gen_random_uuid(),
  departure_id  uuid not null references public.departures (id) on delete cascade,
  name          text not null default 'Group A',
  position      integer not null default 1 check (position >= 1),
  capacity      integer check (capacity is null or capacity >= 0),
  created_at    timestamptz not null default now(),
  unique (departure_id, position)
);

create index departure_groups_departure_idx on public.departure_groups (departure_id);

-- Auto-create the first group when a departure is created.
create or replace function public.create_default_departure_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.departure_groups (departure_id, name, position)
  values (new.id, 'Group A', 1);
  return new;
end;
$$;

create trigger departures_create_default_group
  after insert on public.departures
  for each row execute function public.create_default_departure_group();

-- ── RLS ── groups are operational detail; travelers learn their group via trip_members.
alter table public.departure_groups enable row level security;

create policy "staff read groups" on public.departure_groups
  for select to authenticated using ((select public.is_staff()));
create policy "ops staff manage groups" on public.departure_groups
  for all to authenticated
  using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));
