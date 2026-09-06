-- 005_tours
-- A tour is a thin identity row. All content hangs off tour_versions (006) — see ADR-008.

create table public.tours (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name                text not null,
  -- Set once the first version is published. FK added in 006 (circular dependency).
  current_version_id  uuid,
  duration_days       integer not null check (duration_days between 1 and 60),
  group_size_min      integer not null default 6 check (group_size_min >= 1),
  group_size_max      integer not null default 14 check (group_size_max >= group_size_min),
  activity_level      public.activity_level not null default 'moderate',
  style               text not null default 'minimal_intervention',
  is_published        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tours_name_trgm_idx on public.tours using gin (name extensions.gin_trgm_ops);

create trigger tours_set_updated_at
  before update on public.tours
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.tours enable row level security;

create policy "published tours are public" on public.tours
  for select to anon, authenticated
  using (is_published or (select public.is_staff()));

create policy "content staff manage tours" on public.tours
  for all to authenticated
  using ((select public.has_any_role(array['content_editor', 'admin', 'super_admin']::public.app_role[])))
  with check ((select public.has_any_role(array['content_editor', 'admin', 'super_admin']::public.app_role[])));
