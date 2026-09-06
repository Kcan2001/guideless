-- 004_destinations
-- Cities/regions a tour visits. Public, SEO-oriented. Carries the IANA zone and emergency numbers.

create table public.destinations (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name               text not null,
  country_code       char(2) not null,
  country_name       text not null,
  region             text,
  timezone           text not null,                       -- IANA, e.g. Europe/Paris
  latitude           double precision check (latitude between -90 and 90),
  longitude          double precision check (longitude between -180 and 180),
  summary            text,
  description        text,
  hero_image_url     text,
  -- e.g. {"police":"17","ambulance":"15","fire":"18","general":"112"}
  emergency_numbers  jsonb not null default '{}'::jsonb,
  seo_title          text,
  seo_description    text,
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index destinations_country_idx on public.destinations (country_code);
create index destinations_name_trgm_idx on public.destinations using gin (name extensions.gin_trgm_ops);

create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.destinations enable row level security;

create policy "published destinations are public" on public.destinations
  for select to anon, authenticated
  using (is_published or (select public.is_staff()));

create policy "content staff manage destinations" on public.destinations
  for all to authenticated
  using ((select public.has_any_role(array['content_editor', 'admin', 'super_admin']::public.app_role[])))
  with check ((select public.has_any_role(array['content_editor', 'admin', 'super_admin']::public.app_role[])));
