"use server";

import { revalidatePath } from "next/cache";
import { photoModerationSchema, reviewModerationSchema } from "@guideless/validation";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { SUPPORT_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Publishing and rejecting traveler content. The database functions check the moderator role
 * again, so this is UX: it turns a refusal into a sentence and sends the page back with a flash.
 */

const BACK = "/admin/moderation";

export async function setReviewStatusAction(fd: FormData): Promise<void> {
  await requireStaff(SUPPORT_ROLES);
  const parsed = parseForm(reviewModerationSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const { reviewId, status, note } = parsed.data;

  const sb = await createClient();
  const { error } = await sb.rpc("set_review_status", {
    p_review_id: reviewId,
    p_status: status,
    p_note: note ?? undefined,
  });
  if (error) flash(BACK, "error", dbErrorMessage(error));

  revalidatePath(BACK);
  revalidatePath("/reviews");
  flash(
    BACK,
    "ok",
    status === "published" ? "Published. It is live on the site." : "Rejected. It stays private.",
  );
}

export async function setPhotoStatusAction(fd: FormData): Promise<void> {
  await requireStaff(SUPPORT_ROLES);
  const parsed = parseForm(photoModerationSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const { photoId, status, note } = parsed.data;

  const sb = await createClient();
  const { error } = await sb.rpc("set_trip_photo_status", {
    p_photo_id: photoId,
    p_status: status,
    p_note: note ?? undefined,
  });
  if (error) flash(BACK, "error", dbErrorMessage(error));

  revalidatePath(BACK);
  flash(BACK, "ok", status === "published" ? "Photo published." : "Photo rejected.");
}
