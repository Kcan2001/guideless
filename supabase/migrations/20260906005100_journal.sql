-- 051_journal
-- The journal (strategy §5: "pages that map to bookable trips"). No new table: `cms_pages` from
-- migration 022 already carries slug, title, SEO fields, publish state and published_at — which is
-- most of a post — and has never had a reader or an editor. A parallel `journal_posts` table would
-- have duplicated eight of its columns. What it lacks is added here:
--
--   * `kind`            — one slug namespace, two shapes: standing pages and journal posts.
--   * `body_markdown`   — the same convention `destination_guides` already uses for long-form staff
--                         writing, rather than the `cms_blocks` model, which would need a block
--                         editor to author and gives a founder writing occasional posts nothing.
--   * `hero_image_url`  — the image on the post itself (`og_image_url` is the social card).
--   * `excerpt`         — the line on the index; without it a list has to truncate the body.
--   * `tour_id`         — every post can end in a real trip, which is the point of the journal.
--   * `author_name`     — a byline, stored rather than joined: staff come and go, bylines do not.
--
-- RLS is unchanged: the existing policies already publish `is_published` rows to anon and give
-- content staff write. Nothing here is customer data.

alter table public.cms_pages
  add column kind            text   not null default 'page'
    check (kind in ('page', 'journal')),
  add column body_markdown   text   not null default '',
  add column hero_image_url  text,
  add column excerpt         text   check (char_length(excerpt) <= 300),
  add column author_name     text   check (char_length(author_name) <= 80),
  add column tour_id         uuid   references public.tours (id) on delete set null;

comment on column public.cms_pages.body_markdown is
  'Small Markdown subset rendered by apps/web/lib/content/markdown.ts: ## / ### headings, '
  'paragraphs, - bullets, 1. numbers, > quotes, **bold**, [text](url). Rendered to React '
  'elements, never to raw HTML, so a post cannot inject markup.';

comment on column public.cms_pages.tour_id is
  'Optional trip the post sends the reader to. Set null when the tour is deleted so a post is '
  'never orphaned mid-sentence; the page then falls back to the generic call to action.';

-- The index the journal index page actually runs: published posts, newest first.
create index cms_pages_journal_idx
  on public.cms_pages (kind, is_published, published_at desc)
  where kind = 'journal';

-- A published post needs a date to sort by and a title to link to; enforce rather than trust the UI.
alter table public.cms_pages
  add constraint cms_pages_published_journal_has_date
    check (kind <> 'journal' or not is_published or published_at is not null);
