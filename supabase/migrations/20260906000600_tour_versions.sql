-- 006_tour_versions
-- Versioned tour content. A departure pins a version forever (ADR-008).

create table public.tour_versions (
  id                   uuid primary key default gen_random_uuid(),
  tour_id              uuid not null references public.tours (id) on delete cascade,
  version_number       integer not null check (version_number >= 1),
  status               public.tour_version_status not null default 'draft',
  tagline              text,
  summary              text,
  description          text,
  why_this_trip        text,
  hero_image_url       text,
  gallery_image_urls   text[] not null default '{}',
  -- Marketing "from" price for listings. Real prices live on departures.
  starting_price_amount bigint check (starting_price_amount >= 0),
  starting_price_currency public.currency_code,
  seo_title            text,
  seo_description      text,
  published_at         timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tour_id, version_number),
  constraint tour_versions_price_pair check (
    (starting_price_amount is null) = (starting_price_currency is null)
  )
);

create index tour_versions_tour_status_idx on public.tour_versions (tour_id, status);

create trigger tour_versions_set_updated_at
  before update on public.tour_versions
  for each row execute function public.set_updated_at();

alter table public.tours
  add constraint tours_current_version_fk
  foreign key (current_version_id) references public.tour_versions (id) on delete set null;

-- Ordered destinations a version visits (Nice → Avignon → Paris).
create table public.tour_version_destinations (
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  destination_id   uuid not null references public.destinations (id) on delete restrict,
  position         integer not null check (position >= 1),
  nights           integer not null default 0 check (nights >= 0),
  primary key (tour_version_id, destination_id),
  unique (tour_version_id, position)
);

create table public.tour_included_items (
  id               uuid primary key default gen_random_uuid(),
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  position         integer not null default 0,
  title            text not null,
  description      text
);
create index tour_included_items_version_idx on public.tour_included_items (tour_version_id, position);

-- "What you book yourself" — the traveler-handles half of the promise.
create table public.tour_excluded_items (
  id               uuid primary key default gen_random_uuid(),
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  position         integer not null default 0,
  title            text not null,
  description      text
);
create index tour_excluded_items_version_idx on public.tour_excluded_items (tour_version_id, position);

create table public.tour_faqs (
  id               uuid primary key default gen_random_uuid(),
  tour_version_id  uuid not null references public.tour_versions (id) on delete cascade,
  position         integer not null default 0,
  question         text not null,
  answer           text not null
);
create index tour_faqs_version_idx on public.tour_faqs (tour_version_id, position);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public may read PUBLISHED versions of PUBLISHED tours; staff read everything;
-- content staff write. Child tables inherit through their version.

create or replace function public.tour_version_is_public(version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tour_versions v
    join public.tours t on t.id = v.tour_id
    where v.id = version_id and v.status = 'published' and t.is_published
  );
$$;
grant execute on function public.tour_version_is_public(uuid) to anon, authenticated, service_role;

create or replace function public.is_content_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['content_editor', 'admin', 'super_admin']::public.app_role[]);
$$;
revoke execute on function public.is_content_staff() from public;
grant execute on function public.is_content_staff() to authenticated, service_role;

alter table public.tour_versions enable row level security;
alter table public.tour_version_destinations enable row level security;
alter table public.tour_included_items enable row level security;
alter table public.tour_excluded_items enable row level security;
alter table public.tour_faqs enable row level security;

create policy "published versions are public" on public.tour_versions
  for select to anon, authenticated
  using (public.tour_version_is_public(id) or (select public.is_staff()));
create policy "content staff manage versions" on public.tour_versions
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "version destinations follow version" on public.tour_version_destinations
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage version destinations" on public.tour_version_destinations
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "included items follow version" on public.tour_included_items
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage included items" on public.tour_included_items
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "excluded items follow version" on public.tour_excluded_items
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage excluded items" on public.tour_excluded_items
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "faqs follow version" on public.tour_faqs
  for select to anon, authenticated
  using (public.tour_version_is_public(tour_version_id) or (select public.is_staff()));
create policy "content staff manage faqs" on public.tour_faqs
  for all to authenticated
  using ((select public.is_content_staff())) with check ((select public.is_content_staff()));
