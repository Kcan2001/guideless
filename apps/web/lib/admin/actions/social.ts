"use server";

import { revalidatePath } from "next/cache";
import {
  socialDuplicateFormSchema,
  socialPostFormSchema,
  socialScheduleFormSchema,
  uuidSchema,
} from "@guideless/validation";
import { zonedToUtc } from "@guideless/utils";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * Social queue actions. Publishing itself happens in the `social-publish` Edge Function on a
 * cron; these actions only move rows between states under RLS (content staff).
 */

function postId(fd: FormData): string {
  const parsed = uuidSchema.safeParse(fd.get("postId"));
  if (!parsed.success) throw new Error("Missing or invalid postId");
  return parsed.data;
}

function revalidate(id: string) {
  revalidatePath("/admin/social");
  revalidatePath(`/admin/social/${id}`);
}

export async function updateSocialPostAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const back = returnTo(fd, `/admin/social/${id}`);
  const parsed = parseForm(socialPostFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const p = parsed.data;
  const sb = await createClient();
  const { data: existing } = await sb
    .from("social_posts")
    .select("alt_texts, media_paths, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) flash("/admin/social", "error", "That post no longer exists.");
  if (existing.status === "published" || existing.status === "publishing")
    flash(back, "error", "Published posts cannot be edited here — edit them on Instagram.");
  // Single alt text applies to the first image; carousels keep per-image alt text from import.
  const altTexts = [...existing.alt_texts];
  if (p.altText !== undefined) altTexts[0] = p.altText;
  const { error } = await sb
    .from("social_posts")
    .update({
      platform: p.platform,
      caption: p.caption,
      hashtags: p.hashtags,
      alt_texts: altTexts,
      title: p.platform === "pinterest" ? (p.title ?? null) : null,
      link_url: p.platform === "pinterest" ? (p.linkUrl ?? null) : null,
      tour_id: p.tourId ?? null,
      destination_id: p.destinationId ?? null,
    })
    .eq("id", id);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidate(id);
  flash(back, "ok", "Post saved.");
}

/** "Also post to …": copies media, caption and tags into a new draft for another platform. */
export async function duplicateSocialPostAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(socialDuplicateFormSchema, fd);
  if (!parsed.ok) flash("/admin/social", "error", parsed.error);
  const { postId: id, platform } = parsed.data;
  const sb = await createClient();
  const { data: src } = await sb.from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!src) flash("/admin/social", "error", "That post no longer exists.");
  const { data: copy, error } = await sb
    .from("social_posts")
    .insert({
      platform,
      kind: src.kind,
      caption: src.caption,
      hashtags: src.hashtags,
      media_paths: src.media_paths,
      alt_texts: src.alt_texts,
      source_files: src.source_files,
      title:
        platform === "pinterest"
          ? (src.title ?? src.caption.split("\n")[0]?.slice(0, 100) ?? null)
          : null,
      link_url: platform === "pinterest" ? src.link_url : null,
      tour_id: src.tour_id,
      destination_id: src.destination_id,
      status: "draft",
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) flash(`/admin/social/${id}`, "error", dbErrorMessage(error));
  revalidatePath("/admin/social");
  flash(
    `/admin/social/${copy.id}`,
    "ok",
    `Draft created for ${platform}. Review the caption and schedule it.`,
  );
}

export async function scheduleSocialPostAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const back = returnTo(fd, `/admin/social/${id}`);
  const parsed = parseForm(socialScheduleFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const { date, time, timeZone } = parsed.data;
  const when = zonedToUtc(date, time, timeZone);
  if (when.getTime() < Date.now() - 60_000)
    flash(back, "error", "That time is in the past. Use “Publish now” instead.");
  const sb = await createClient();
  const { error } = await sb
    .from("social_posts")
    .update({ status: "scheduled", scheduled_at: when.toISOString(), last_error: null })
    .eq("id", id)
    .in("status", ["draft", "failed", "cancelled"]);
  if (error) flash(back, "error", scheduleErrorMessage(error));
  revalidate(id);
  flash(back, "ok", `Scheduled for ${when.toISOString().replace("T", " ").slice(0, 16)} UTC.`);
}

export async function publishSocialPostNowAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const back = returnTo(fd, `/admin/social/${id}`);
  const sb = await createClient();
  const { error } = await sb
    .from("social_posts")
    .update({ status: "scheduled", scheduled_at: new Date().toISOString(), last_error: null })
    .eq("id", id)
    .in("status", ["draft", "failed", "cancelled"]);
  if (error) flash(back, "error", scheduleErrorMessage(error));
  revalidate(id);
  flash(back, "ok", "Queued. The publisher runs every 10 minutes.");
}

export async function unscheduleSocialPostAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const back = returnTo(fd, `/admin/social/${id}`);
  const sb = await createClient();
  const { error } = await sb
    .from("social_posts")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidate(id);
  flash(back, "ok", "Back to draft.");
}

export async function cancelSocialPostAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const back = returnTo(fd, "/admin/social");
  const sb = await createClient();
  const { error } = await sb
    .from("social_posts")
    .update({ status: "cancelled", scheduled_at: null })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "failed"]);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidate(id);
  flash(back, "ok", "Post cancelled. It stays in the archive.");
}

export async function deleteSocialPostAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const id = postId(fd);
  const sb = await createClient();
  const { data: post } = await sb
    .from("social_posts")
    .select("media_paths, status")
    .eq("id", id)
    .maybeSingle();
  if (!post) flash("/admin/social", "error", "That post no longer exists.");
  if (post.status === "published")
    flash(`/admin/social/${id}`, "error", "Published posts are kept as a record.");
  const { error } = await sb.from("social_posts").delete().eq("id", id);
  if (error) flash(`/admin/social/${id}`, "error", dbErrorMessage(error));
  if (post.media_paths.length) await sb.storage.from("social-media").remove(post.media_paths);
  revalidate(id);
  flash("/admin/social", "ok", "Post and its media deleted.");
}

function scheduleErrorMessage(err: { code?: string; message?: string }): string {
  if (err.code === "23514")
    return "A post needs at least one image (two for a carousel) before it can be scheduled.";
  return dbErrorMessage(err);
}
