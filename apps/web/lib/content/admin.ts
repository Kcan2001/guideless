import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CmsPage } from "@/lib/content/journal";

/**
 * Staff read models for the content editor. These run as the signed-in staff user, so RLS decides
 * what comes back — drafts included, which is exactly why they cannot reuse the public reader.
 */

export interface CmsPageAdminRow extends CmsPage {
  tour_name: string | null;
}

export async function listCmsPagesAdmin(): Promise<CmsPageAdminRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("cms_pages")
    .select("*, tours(name)")
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map(({ tours, ...page }) => ({
    ...(page as CmsPage),
    tour_name: (tours as { name: string } | null)?.name ?? null,
  }));
}

export async function getCmsPageAdmin(id: string): Promise<CmsPage | null> {
  const sb = await createClient();
  const { data, error } = await sb.from("cms_pages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Published trips a post can point at. Name only — the editor needs nothing else. */
export async function listTourOptions(): Promise<Array<{ id: string; name: string }>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("tours")
    .select("id, name")
    .eq("is_published", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
