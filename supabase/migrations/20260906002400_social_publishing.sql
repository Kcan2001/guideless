-- 025_social_publishing
-- Marketing: a queue of social posts (Instagram first) published by the `social-publish` Edge
-- Function on a pg_cron schedule. See docs/marketing.md and ADR-011.
--
-- Photos land in the public `social-media` bucket (Instagram fetches media by public URL and only
-- accepts JPEG). Post rows are staff-only marketing data; account tokens are service-role-only.

create type public.social_platform as enum ('instagram');
create type public.social_media_kind as enum ('image', 'carousel');
create type public.social_post_status as enum (
  'draft',        -- imported / being written; not eligible for publishing
  'scheduled',    -- has scheduled_at + media; the cron job will pick it up when due
  'publishing',   -- claimed by a publish run (prevents double posting)
  'published',    -- external_media_id + permalink set
  'failed',       -- last_error set; staff can fix and re-schedule
  'cancelled'
);

-- ── Connected accounts (tokens) ──────────────────────────────────────────────
create table public.social_accounts (
  id                 uuid primary key default gen_random_uuid(),
  platform           public.social_platform not null,
  external_id        text not null,                  -- Instagram professional account id
  username           text not null,
  access_token       text not null,                  -- long-lived (60 d) token; refreshed by the function
  token_expires_at   timestamptz,
  token_refreshed_at timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (platform, external_id)
);
create trigger social_accounts_set_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();
comment on table public.social_accounts is
  'Social platform credentials. RLS enabled with NO policies: only the service role (Edge Function) can read or write.';

-- ── Post queue ───────────────────────────────────────────────────────────────
create table public.social_posts (
  id                    uuid primary key default gen_random_uuid(),
  platform              public.social_platform not null default 'instagram',
  account_id            uuid references public.social_accounts (id) on delete set null,
  kind                  public.social_media_kind not null default 'image',
  caption               text not null default '' check (char_length(caption) <= 2200),
  hashtags              text[] not null default '{}' check (cardinality(hashtags) <= 30),
  -- Storage object paths inside the `social-media` bucket, in carousel order (max 10).
  media_paths           text[] not null default '{}' check (cardinality(media_paths) <= 10),
  alt_texts             text[] not null default '{}',
  -- Original file names from guideless_photos/ so re-imports are idempotent.
  source_files          text[] not null default '{}',
  tour_id               uuid references public.tours (id) on delete set null,
  destination_id        uuid references public.destinations (id) on delete set null,
  status                public.social_post_status not null default 'draft',
  scheduled_at          timestamptz,
  published_at          timestamptz,
  external_container_id text,
  external_media_id     text,
  permalink             text,
  attempts              integer not null default 0,
  last_error            text,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint social_posts_scheduled_needs_time
    check (status not in ('scheduled', 'publishing') or scheduled_at is not null),
  constraint social_posts_publishable_needs_media
    check (status not in ('scheduled', 'publishing', 'published') or cardinality(media_paths) >= 1),
  constraint social_posts_carousel_needs_two
    check (kind <> 'carousel' or status = 'draft' or cardinality(media_paths) >= 2)
);
create index social_posts_due_idx on public.social_posts (status, scheduled_at);
create index social_posts_created_idx on public.social_posts (created_at desc);
create trigger social_posts_set_updated_at before update on public.social_posts
  for each row execute function public.set_updated_at();

-- ── RLS ── marketing content is internal; content staff manage it.
alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;

create policy "content staff manage social posts" on public.social_posts
  for all to authenticated
  using ((select public.is_content_staff()))
  with check ((select public.is_content_staff()));

-- ── Storage ── public bucket; Instagram downloads media from the public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('social-media', 'social-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

alter policy "public buckets are readable" on storage.objects
  using (bucket_id in ('public-assets', 'tour-images', 'user-avatars', 'social-media'));

create policy "content staff manage social media" on storage.objects
  for all to authenticated
  using (bucket_id = 'social-media' and (select public.is_content_staff()))
  with check (bucket_id = 'social-media' and (select public.is_content_staff()));

-- ── Claiming due posts (called by the Edge Function with the service role) ───
-- Atomic scheduled → publishing flip so two overlapping runs never publish the same post.
create or replace function public.claim_due_social_posts(p_limit integer default 5)
returns setof public.social_posts
language sql
security definer
set search_path = ''
as $$
  with due as (
    select id
    from public.social_posts
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit greatest(1, least(p_limit, 25))
    for update skip locked
  )
  update public.social_posts p
  set status = 'publishing', attempts = p.attempts + 1, last_error = null
  from due
  where p.id = due.id
  returning p.*;
$$;
revoke execute on function public.claim_due_social_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;

-- ── Schedule ── every 10 minutes ask the Edge Function to publish whatever is due.
-- The function URL and shared secret live in Supabase Vault so nothing sensitive is in this file:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/social-publish', 'social_publish_url');
--   select vault.create_secret('<random>', 'social_publish_secret');
-- Until both exist the job is a no-op (local development, fresh environments).
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_social_publish()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'social_publish_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'social_publish_secret' limit 1;
  if v_url is null or v_secret is null then
    raise notice 'social-publish: vault secrets not configured; skipping';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function public.invoke_social_publish() from public, anon, authenticated;

select cron.schedule(
  'publish-due-social-posts',
  '*/10 * * * *',
  $$ select public.invoke_social_publish(); $$
);
