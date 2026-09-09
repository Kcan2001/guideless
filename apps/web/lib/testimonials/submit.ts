"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { testimonialSubmissionSchema } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { emails } from "@guideless/config";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { staffAlertEmail } from "@/lib/email/templates/campaign";

/**
 * Somebody from an earlier trip sending us their words.
 *
 * Anonymous by design: these people do not have Guideless accounts and asking them to make one to
 * say something nice would lose most of them. The anon key plus `submit_testimonial()` is the whole
 * authorization story — the function refuses without consent and refuses photo paths outside the
 * submission's own folder, so nothing here is trusted to the client.
 */

function back(slug: string, kind: "notice" | "error_msg", message: string): never {
  redirect(`/share/${slug}?${kind}=${encodeURIComponent(message)}` as Route);
}

export async function submitTestimonialAction(fd: FormData): Promise<void> {
  const raw = formToObject(fd);
  const slug = typeof raw.tourSlug === "string" ? raw.tourSlug : "";

  const parsed = testimonialSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    back(slug, "error_msg", parsed.error.issues[0]?.message ?? "Have another look at the form.");
  }
  const v = parsed.data;

  // Silently accept the honeypot rather than telling a bot it was caught.
  if (v.website) back(v.tourSlug, "notice", "Thank you — that's really helpful.");

  if (!(await withinRateLimit("testimonial", 5, 3600))) {
    back(v.tourSlug, "error_msg", RATE_LIMITED_MESSAGE);
  }

  const sb = await createClient();
  const { error } = await sb.rpc("submit_testimonial", {
    p_id: v.submissionId,
    p_tour_slug: v.tourSlug,
    p_author_name: v.authorName,
    p_email: v.email,
    p_quote: v.quote,
    p_trip_year: v.tripYear ?? undefined,
    p_consent_public: v.consentPublic,
    p_consent_photos: v.consentPhotos,
    p_photo_paths: v.photoPaths,
  });
  if (error) {
    // 23505 means this submission id already went through — a double submit, not a failure.
    if (error.code === "23505") back(v.tourSlug, "notice", "Got it — thank you.");
    back(v.tourSlug, "error_msg", "That didn't send. Try again, or just reply to Kyle's message.");
  }

  // Tell Kyle it arrived. Deliberately after the insert and deliberately not awaited into the
  // happy path's success: the submission is saved either way, and a Resend outage must not turn
  // somebody's contribution into an error message.
  try {
    const notice = staffAlertEmail({
      what: "A testimonial came in",
      who: `${v.authorName} <${v.email}>`,
      detail: v.quote,
      url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/testimonials`,
    });
    await sendEmail(createServiceRoleClient(), {
      to: emails.support,
      userId: null,
      template: "staff-testimonial-submission",
      subject: notice.subject,
      html: notice.html,
      text: notice.text,
      payload: { submission_id: v.submissionId },
    });
  } catch (err) {
    console.error("could not send the testimonial notification", err);
  }

  back(
    v.tourSlug,
    "notice",
    "Thank you — that's really helpful. Kyle will send you the exact wording before anything goes up.",
  );
}
