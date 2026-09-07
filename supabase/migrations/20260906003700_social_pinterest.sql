-- 037_social_pinterest
-- Pinterest as the second social platform (docs/marketing.md §7, ADR-011). Reuses the same queue,
-- import and admin; the Edge Function dispatches on `platform`.
--
-- Enum values must be added outside the transaction that first uses them, so this migration only
-- adds the value plus the platform-specific columns. Mirror: SOCIAL_PLATFORMS in @guideless/types.

alter type public.social_platform add value if not exists 'pinterest';

-- Pinterest pins carry a title and a destination link; Instagram ignores both.
alter table public.social_posts
  add column if not exists title    text check (title is null or char_length(title) <= 100),
  add column if not exists link_url text check (link_url is null or link_url ~ '^https?://');

-- Per-account platform settings (Pinterest: default board_id, refresh_token, scopes).
alter table public.social_accounts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.social_posts.title is 'Pinterest pin title (≤100 chars). Unused by Instagram.';
comment on column public.social_posts.link_url is 'Pinterest destination link. Defaults to the site URL in the publisher when null.';
comment on column public.social_accounts.metadata is 'Platform-specific settings, e.g. {"board_id": "…", "refresh_token": "…"} for Pinterest. Service role only.';
