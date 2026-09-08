"use server";

import { revalidatePath } from "next/cache";
import { cmsPageFormSchema, uuidSchema } from "@guideless/validation";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * Journal posts and standing pages (both `cms_pages`; see migration 051). Content staff only —
 * the RLS policy enforces it too, so a bad role fails at the database as well as here.
 */

const LIST = "/admin/content";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

function row(page: ReturnType<typeof cmsPageFormSchema.parse>, publishedAt: string | null) {
  return {
    kind: page.kind,
    slug: page.slug,
    title: page.title,
    excerpt: page.excerpt ?? null,
    body_markdown: page.bodyMarkdown,
    hero_image_url: page.heroImageUrl ?? null,
    og_image_url: page.ogImageUrl ?? null,
    author_name: page.authorName ?? null,
    tour_id: page.tourId ?? null,
    seo_title: page.seoTitle ?? null,
    seo_description: page.seoDescription ?? null,
    is_published: page.isPublished,
    published_at: publishedAt,
  };
}

/** First publish stamps the date; later edits keep it, so a post does not jump the index. */
function publishDate(
  isPublished: boolean,
  existing: string | null,
  supplied?: string,
): string | null {
  if (!isPublished) return existing;
  if (supplied) return new Date(supplied).toISOString();
  return existing ?? new Date().toISOString();
}

export async function createCmsPageAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const back = returnTo(fd, `${LIST}/new`);
  const parsed = parseForm(cmsPageFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);

  const sb = await createClient();
  const { data, error } = await sb
    .from("cms_pages")
    .insert(row(parsed.data, publishDate(parsed.data.isPublished, null, parsed.data.publishedAt)))
    .select("id, kind, slug")
    .single();
  if (error) flash(back, "error", dbErrorMessage(error));

  revalidatePath(LIST);
  if (data.kind === "journal") {
    revalidatePath("/journal");
    revalidatePath(`/journal/${data.slug}`);
  }
  flash(`${LIST}/${data.id}`, "ok", "Saved.");
}

export async function updateCmsPageAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const pageId = id(fd, "pageId");
  const back = returnTo(fd, `${LIST}/${pageId}`);
  const parsed = parseForm(cmsPageFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);

  const sb = await createClient();
  const { data: existing } = await sb
    .from("cms_pages")
    .select("published_at, slug")
    .eq("id", pageId)
    .maybeSingle();

  const { error } = await sb
    .from("cms_pages")
    .update(
      row(
        parsed.data,
        publishDate(
          parsed.data.isPublished,
          existing?.published_at ?? null,
          parsed.data.publishedAt,
        ),
      ),
    )
    .eq("id", pageId);
  if (error) flash(back, "error", dbErrorMessage(error));

  revalidatePath(LIST);
  revalidatePath("/journal");
  revalidatePath(`/journal/${parsed.data.slug}`);
  // A renamed post leaves its old URL cached otherwise.
  if (existing?.slug && existing.slug !== parsed.data.slug) {
    revalidatePath(`/journal/${existing.slug}`);
  }
  flash(back, "ok", parsed.data.isPublished ? "Published." : "Saved as a draft.");
}

export async function deleteCmsPageAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const pageId = id(fd, "pageId");
  const sb = await createClient();
  const { data: existing } = await sb
    .from("cms_pages")
    .select("slug, is_published")
    .eq("id", pageId)
    .maybeSingle();

  // Published work is unpublished first, never deleted in one click.
  if (existing?.is_published) {
    flash(
      `${LIST}/${pageId}`,
      "error",
      "Unpublish it first — a live URL should not vanish mid-read.",
    );
  }

  const { error } = await sb.from("cms_pages").delete().eq("id", pageId);
  if (error) flash(`${LIST}/${pageId}`, "error", dbErrorMessage(error));

  revalidatePath(LIST);
  if (existing?.slug) revalidatePath(`/journal/${existing.slug}`);
  flash(LIST, "ok", "Deleted.");
}
