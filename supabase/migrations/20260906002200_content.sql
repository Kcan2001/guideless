-- 022_content
-- Curated recommendations (manual in v1 — no AI) and lightweight database-backed CMS.
-- recommendation_category is an enum (002); a categories table is unnecessary for now.

create table public.recommendations (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  title           text not null,
  description     text,
  categories      public.recommendation_category[] not null default '{}',
  neighborhood    text,
  -- morning | afternoon | evening | night; empty = any time
  time_of_day     text[] not null default '{}',
  price_level     smallint check (price_level between 1 and 4),
  address         text,
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  website         text,
  maps_url        text,
  image_url       text,
  -- Staff can pin a recommendation to a specific tour version day ("Recommended lunch — Day 3")
  tour_version_id uuid references public.tour_versions (id) on delete set null,
  day_number      integer check (day_number is null or day_number >= 1),
  position        integer not null default 0,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index recommendations_destination_idx on public.recommendations (destination_id, is_published, position);
create index recommendations_categories_idx on public.recommendations using gin (categories);
create trigger recommendations_set_updated_at before update on public.recommendations
  for each row execute function public.set_updated_at();

create table public.destination_guides (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  slug            text not null,
  title           text not null,
  body_markdown   text not null default '',
  position        integer not null default 0,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (destination_id, slug)
);
create trigger destination_guides_set_updated_at before update on public.destination_guides
  for each row execute function public.set_updated_at();

create table public.cms_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(?:[-/][a-z0-9]+)*$'),
  title            text not null,
  seo_title        text,
  seo_description  text,
  og_image_url     text,
  is_published     boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger cms_pages_set_updated_at before update on public.cms_pages
  for each row execute function public.set_updated_at();

create table public.cms_blocks (
  id        uuid primary key default gen_random_uuid(),
  page_id   uuid not null references public.cms_pages (id) on delete cascade,
  position  integer not null default 0,
  type      text not null,                   -- hero | rich_text | faq | image | cta | featured_tours | …
  content   jsonb not null default '{}'::jsonb,
  unique (page_id, position)
);

-- ── RLS ── published content is public; content staff write.
alter table public.recommendations enable row level security;
alter table public.destination_guides enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_blocks enable row level security;

create policy "published recommendations are readable" on public.recommendations
  for select to anon, authenticated using (is_published or (select public.is_staff()));
create policy "content staff manage recommendations" on public.recommendations
  for all to authenticated using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "published guides are readable" on public.destination_guides
  for select to anon, authenticated using (is_published or (select public.is_staff()));
create policy "content staff manage guides" on public.destination_guides
  for all to authenticated using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "published pages are readable" on public.cms_pages
  for select to anon, authenticated using (is_published or (select public.is_staff()));
create policy "content staff manage pages" on public.cms_pages
  for all to authenticated using ((select public.is_content_staff())) with check ((select public.is_content_staff()));

create policy "blocks follow page" on public.cms_blocks
  for select to anon, authenticated
  using (exists (select 1 from public.cms_pages p where p.id = cms_blocks.page_id
                 and (p.is_published or (select public.is_staff()))));
create policy "content staff manage blocks" on public.cms_blocks
  for all to authenticated using ((select public.is_content_staff())) with check ((select public.is_content_staff()));
