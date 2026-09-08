import "server-only";

import type { Tables } from "@guideless/types";
import { createPublicClient } from "@/lib/supabase/public";
import { markdownToPlainText, readingMinutes } from "@/lib/content/markdown";

/**
 * The journal. Posts live in `cms_pages` with `kind = 'journal'` (migration 051). RLS publishes
 * only `is_published` rows to anon, so these reads carry no draft filter of their own beyond the
 * kind — a draft is invisible because the database says so, not because the query remembered to ask.
 */

export type CmsPage = Tables<"cms_pages">;

export interface JournalPost extends CmsPage {
  /** Reading time and summary are derived, not stored, so they cannot drift from the body. */
  readingMinutes: number;
  summary: string;
}

export interface JournalPostDetail extends JournalPost {
  tour: { slug: string; name: string } | null;
}

function decorate(row: CmsPage): JournalPost {
  return {
    ...row,
    readingMinutes: readingMinutes(row.body_markdown),
    summary: row.excerpt ?? markdownToPlainText(row.body_markdown, 180),
  };
}

export async function listJournalPosts(limit = 50): Promise<JournalPost[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("cms_pages")
    .select("*")
    .eq("kind", "journal")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(decorate);
}

export async function getJournalPost(slug: string): Promise<JournalPostDetail | null> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("cms_pages")
    .select("*")
    .eq("kind", "journal")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let tour: JournalPostDetail["tour"] = null;
  if (data.tour_id) {
    // A post may outlive a tour being unpublished; then it simply loses its call to action.
    const { data: t } = await sb
      .from("tours")
      .select("slug, name")
      .eq("id", data.tour_id)
      .eq("is_published", true)
      .maybeSingle();
    tour = t ?? null;
  }
  return { ...decorate(data), tour };
}

export async function listJournalSlugs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("cms_pages")
    .select("slug, updated_at")
    .eq("kind", "journal")
    .eq("is_published", true);
  if (error) throw error;
  return data.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}

/** Published guides for a destination, in staff order. Empty is the normal state, not an error. */
export async function listDestinationGuides(
  destinationId: string,
): Promise<Array<Tables<"destination_guides">>> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("destination_guides")
    .select("*")
    .eq("destination_id", destinationId)
    .eq("is_published", true)
    .order("position");
  if (error) throw error;
  return data;
}
