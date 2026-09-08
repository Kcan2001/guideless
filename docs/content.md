# Content: the journal, destination guides, and the funnel

How staff-written words reach the site, and how we count what they produce. Schema: migration
`20260906005100_journal.sql`. Editor: `/admin/content`. Funnel: `/admin/funnel`.

## Where a post lives

Journal posts and standing pages are both rows in `cms_pages`, told apart by `kind`
(`'journal' | 'page'`). There is no `journal_posts` table, and that was a deliberate choice:
`cms_pages` already carried slug, title, SEO title and description, social image, publish state and
`published_at` — eight columns of a post — and had never had a reader or an editor since migration
022 created it. A parallel table would have duplicated those columns and split the slug namespace in
two, so two rows could claim the same URL.

Migration 051 adds what a post needs on top:

| Column           | Why                                                                |
| ---------------- | ------------------------------------------------------------------ |
| `kind`           | One slug namespace, two shapes                                     |
| `body_markdown`  | The body — the convention `destination_guides` already uses        |
| `excerpt`        | The line on the index; without it a list has to truncate the body  |
| `hero_image_url` | The image on the post (`og_image_url` stays the social card)       |
| `author_name`    | A byline, stored not joined: staff come and go, bylines do not     |
| `tour_id`        | The trip the post sends readers to, nulled if that trip is deleted |

Two constraints hold the shape: a published post must carry `published_at`, and the excerpt is
capped. Drafts are free to be half-written — the rules only bind at publish.

`cms_blocks` is untouched. A block model needs a block editor to author, which buys a founder
writing occasional posts nothing; markdown in a textarea buys them a post.

## The markdown subset

`apps/web/lib/content/markdown.ts` parses a deliberately small subset and returns a described tree
that React renders as elements. There is no `dangerouslySetInnerHTML` in the path, so a body cannot
inject markup no matter what is typed into it.

```
## Heading        ### Subheading
- bullet          1. numbered
> quote
blank line between paragraphs
**bold**   *italic*   [text](/path or https://…)
```

Anything else stays literal: a stray `#` renders as a `#` rather than vanishing. Links are limited
to site-relative paths and `http(s)`; anything else degrades to its text, so a `javascript:` URL
never reaches an `href`. Emphasis must hug its text, so `2 * 3 * 4` stays arithmetic.

Why a subset and not a library: the body is staff-written, the shapes above are what travel writing
needs, and a parser would add a dependency plus a sanitising step for output nobody asked for. If
posts ever need tables or embeds, that is the moment to reconsider — not before.

The same renderer draws `destination_guides.body_markdown`, which had been stored since migration
022 and never displayed.

## Editing

`/admin/content` (content staff; RLS enforces it independently of the route guard) lists journal
posts and standing pages, with a live preview rendered by the same component as the public page.

- Publishing needs a summary and at least 200 characters of body. The message says why.
- The first publish stamps `published_at`; later edits keep it, so an edited post does not jump the
  index.
- Renaming a slug revalidates the old URL as well as the new one.
- A published post cannot be deleted in one click — unpublish first. A live URL should not vanish
  mid-read.

The hand-built pages (About, FAQ, Why Guideless and the rest) are React, not database rows, and are
not listed in the editor.

## What the reader gets

- `/journal` — newest post lead, the rest in a grid. With no posts it says the first piece is being
  written and points at the trips, rather than showing an empty grid.
- `/journal/[slug]` — the post, then a call to action: the linked trip if it has one, the generic
  one if not. `Article` and `BreadcrumbList` structured data; canonical URL; social card from the
  hero unless one is set explicitly.
- `/destinations/[slug]` — published guides under the description, then the trips that stop there,
  and a closing **Build this trip** that goes straight to the builder for the next open departure.

Every new route is in `app/sitemap.ts`.

### The per-tour itinerary page was not built

The strategy doc asks for a "14 day itinerary" search surface. The tour page already is that page:
day by day, what is included, every optional experience priced, ending in the builder. A second
route over the same rows would compete with it in search and split the signal between two URLs for
one trip. If itinerary-shaped search traffic proves real, the honest fix is to make the tour page
rank for it, not to clone it.

## The funnel

`/admin/funnel` counts stages from our own tables, so the numbers reconcile against bookings and
payments, need no extra service, and survive an ad blocker.

| Stage            | Source                                    |
| ---------------- | ----------------------------------------- |
| Started building | `builder_drafts`                          |
| Booking created  | `bookings`                                |
| Confirmed        | `bookings.status` in confirmed, completed |
| Paid in full     | `bookings.payment_status = 'paid'`        |

Two limits, stated on the page rather than buried here. Everything before the builder — visits, trip
page views, everyone who left before signing in — is invisible; that lives in GA4 and PostHog.
Anonymous builder drafts stay in the browser and never reach the database, so "started building"
counts signed-in travelers only.

A cancelled or refunded booking still counts as a booking created. It was a loss, not an absence,
and a funnel that hides its losses is worth nothing.

With no data the page says so instead of drawing a chart of zeros.
