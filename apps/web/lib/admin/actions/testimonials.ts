"use server";

import { revalidatePath } from "next/cache";
import {
  testimonialDeleteSchema,
  testimonialFormSchema,
  testimonialStatusSchema,
} from "@guideless/validation";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Managing testimonials. Content staff, because this is marketing copy rather than traveler
 * content somebody is moderating.
 *
 * Consent is checked in three places and that is deliberate: the form has a checkbox, the schema
 * refuses to publish without it, and the table has a constraint. The first two are courtesy. The
 * third is the one that counts, because quoting somebody publicly who did not agree to it is the
 * only mistake in this feature that cannot be fixed by editing a row.
 */

const BACK = "/admin/testimonials";

/** Public pages that show testimonials, so a publish is visible without waiting for ISR. */
function revalidatePublic(): void {
  revalidatePath(BACK);
  revalidatePath("/reviews");
  revalidatePath("/tours/[slug]", "page");
}

export async function saveTestimonialAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(testimonialFormSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const v = parsed.data;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const row = {
    quote: v.quote,
    author_name: v.authorName,
    trip_label: v.tripLabel,
    tour_id: v.tourId ?? null,
    happened_in: v.happenedIn ?? null,
    image_url: v.imageUrl ?? null,
    position: v.position,
    consent_confirmed: v.consentConfirmed,
    source_note: v.sourceNote ?? null,
    status: v.publish ? ("published" as const) : ("pending" as const),
    published_at: v.publish ? new Date().toISOString() : null,
  };

  if (v.testimonialId) {
    const { error } = await sb.from("testimonials").update(row).eq("id", v.testimonialId);
    if (error) flash(BACK, "error", dbErrorMessage(error));
    revalidatePublic();
    flash(BACK, "ok", v.publish ? "Saved and live." : "Saved. It is not published.");
  }

  const { error } = await sb.from("testimonials").insert({ ...row, created_by: user?.id ?? null });
  if (error) flash(BACK, "error", dbErrorMessage(error));
  revalidatePublic();
  flash(BACK, "ok", v.publish ? "Added and live." : "Added. Publish it when you are ready.");
}

export async function setTestimonialStatusAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(testimonialStatusSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const { testimonialId, status } = parsed.data;

  const sb = await createClient();
  const { error } = await sb
    .from("testimonials")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", testimonialId);
  // The consent constraint is the likely refusal here, and "a database rule rejected that" is not
  // a useful sentence when the reason is knowable.
  if (error) {
    flash(
      BACK,
      "error",
      error.code === "23514"
        ? "That cannot be published until you confirm they agreed to be quoted."
        : dbErrorMessage(error),
    );
  }

  revalidatePublic();
  flash(
    BACK,
    "ok",
    status === "published" ? "Published. It is live on the site." : "Taken down. It stays private.",
  );
}

export async function deleteTestimonialAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(testimonialDeleteSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  const sb = await createClient();
  const { error } = await sb.from("testimonials").delete().eq("id", parsed.data.testimonialId);
  if (error) flash(BACK, "error", dbErrorMessage(error));

  revalidatePublic();
  flash(BACK, "ok", "Deleted.");
}
