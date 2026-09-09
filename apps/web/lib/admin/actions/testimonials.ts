"use server";

import { revalidatePath } from "next/cache";
import {
  submissionPhotoSchema,
  testimonialDeleteSchema,
  testimonialFormSchema,
  testimonialStatusSchema,
  useSubmissionSchema,
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

/**
 * Turn a submission into a testimonial draft.
 *
 * `consent_confirmed` is inherited rather than asked for again: the person ticked it themselves,
 * with their name and email against it, which is a better record than staff ticking it later. The
 * source note captures where it came from so the trail survives the person forgetting.
 *
 * It lands as a draft, not published — the message we sent promises to show them the wording first.
 */
export async function useSubmissionAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(useSubmissionSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: sub, error: readError } = await sb
    .from("testimonial_submissions")
    .select("*")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();
  if (readError) flash(BACK, "error", dbErrorMessage(readError));
  if (!sub) flash(BACK, "error", "That submission is gone.");
  if (sub.testimonial_id) flash(BACK, "error", "That one has already been used.");

  let tourName: string | null = null;
  if (sub.tour_id) {
    const { data: tour } = await sb
      .from("tours")
      .select("name")
      .eq("id", sub.tour_id)
      .maybeSingle();
    tourName = tour?.name ?? null;
  }
  const label = [tourName, sub.trip_year].filter(Boolean).join(", ") || "An earlier trip";

  const { data: created, error } = await sb
    .from("testimonials")
    .insert({
      quote: sub.quote,
      author_name: sub.author_name,
      trip_label: label,
      tour_id: sub.tour_id,
      happened_in: sub.trip_year,
      consent_confirmed: true,
      source_note:
        `Submitted through /share on ${sub.created_at.slice(0, 10)} by ${sub.email}. ` +
        `They ticked the consent box themselves. ` +
        (sub.consent_photos ? "Photos allowed." : "Photos NOT allowed — do not publish one."),
      status: "pending" as const,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) flash(BACK, "error", dbErrorMessage(error));

  const { error: linkError } = await sb
    .from("testimonial_submissions")
    .update({ status: "used" as const, testimonial_id: created.id })
    .eq("id", sub.id);
  if (linkError) flash(BACK, "error", dbErrorMessage(linkError));

  revalidatePath(BACK);
  flash(BACK, "ok", "Made a draft from it. Send them the wording, then publish.");
}

export async function declineSubmissionAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(useSubmissionSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  const sb = await createClient();
  const { error } = await sb
    .from("testimonial_submissions")
    .update({ status: "declined" as const })
    .eq("id", parsed.data.submissionId);
  if (error) flash(BACK, "error", dbErrorMessage(error));

  revalidatePath(BACK);
  flash(BACK, "ok", "Set aside.");
}

/**
 * Attach one submitted photo to the draft made from that submission.
 *
 * This is the moment a file stops being private: it is copied out of testimonial-uploads into the
 * public social-media bucket, which is the only bucket next/image is allowed to load from. Copy
 * rather than move, so the original stays with the submission it arrived in.
 */
export async function useSubmissionPhotoAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(submissionPhotoSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const { submissionId, path } = parsed.data;

  const sb = await createClient();
  const { data: sub } = await sb
    .from("testimonial_submissions")
    .select("testimonial_id, consent_photos, photo_paths")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) flash(BACK, "error", "That submission is gone.");
  if (!sub.testimonial_id) flash(BACK, "error", "Make a draft from it first.");
  if (!sub.consent_photos) flash(BACK, "error", "They did not agree to their photos being used.");
  // The path comes from a form, so check it against the submission rather than trusting it.
  if (!(sub.photo_paths ?? []).includes(path)) flash(BACK, "error", "That photo is not theirs.");

  const { data: file, error: downloadError } = await sb.storage
    .from("testimonial-uploads")
    .download(path);
  if (downloadError || !file) flash(BACK, "error", "Could not read that photo.");

  const publicPath = `testimonials/${path.split("/").pop()}`;
  const { error: uploadError } = await sb.storage
    .from("social-media")
    .upload(publicPath, file, { upsert: true, contentType: file.type });
  if (uploadError) flash(BACK, "error", "Could not copy that photo across.");

  const {
    data: { publicUrl },
  } = sb.storage.from("social-media").getPublicUrl(publicPath);

  const { error } = await sb
    .from("testimonials")
    .update({ image_url: publicUrl })
    .eq("id", sub.testimonial_id);
  if (error) flash(BACK, "error", dbErrorMessage(error));

  revalidatePublic();
  flash(BACK, "ok", "Photo attached to the draft.");
}
