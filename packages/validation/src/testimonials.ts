import { z } from "zod";
import { uuidSchema } from "./common";
import { reviewStatusSchema } from "./reviews";

/**
 * Testimonials from trips run before Guideless existed. These are not reviews and the schema keeps
 * it that way: there is no rating field here because there is no rating column, so nothing can
 * later average them into a tour's star count.
 *
 * The only rule worth enforcing twice is consent. The database refuses to publish a row whose
 * `consentConfirmed` is false; this turns that refusal into a sentence before the form is sent.
 */

const optionalText = (max: number, message?: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, message).optional(),
  );

const checkbox = z.preprocess(
  (v) =>
    v === undefined || v === null || v === "" ? false : v === "on" || v === "true" || v === true,
  z.boolean(),
);

const optionalUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  uuidSchema.optional(),
);

export const testimonialFormSchema = z
  .object({
    testimonialId: optionalUuid,
    quote: z
      .string()
      .trim()
      .min(20, "A quote needs at least twenty characters to be worth showing")
      .max(1200, "That is longer than 1,200 characters"),
    authorName: z.string().trim().min(1, "Give it a first name").max(60, "First name only, please"),
    tripLabel: z
      .string()
      .trim()
      .min(2, "Say which trip and when, e.g. “Monaco, 2025”")
      .max(80, "Keep the label under 80 characters"),
    tourId: optionalUuid,
    happenedIn: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.coerce.number().int().min(2000).max(2100).optional(),
    ),
    // Must be a Supabase Storage object URL. next.config.ts only allows next/image to load from
    // those hosts, so anything else would render as a broken image rather than fail here.
    imageUrl: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .url("That is not a URL")
        .startsWith("https://", "Use an https URL")
        .includes("/storage/v1/object/", {
          message: "Upload it to the social-media bucket and paste that URL",
        })
        .optional(),
    ),
    position: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? 0 : v),
      z.coerce.number().int().min(0).max(9999).default(0),
    ),
    consentConfirmed: checkbox,
    sourceNote: optionalText(1000, "Keep the note under 1,000 characters"),
    publish: checkbox,
  })
  .refine((v) => !v.publish || v.consentConfirmed, {
    path: ["consentConfirmed"],
    message: "Confirm they agreed to be quoted before publishing this",
  });
export type TestimonialFormInput = z.infer<typeof testimonialFormSchema>;

export const testimonialStatusSchema = z.object({
  testimonialId: uuidSchema,
  status: reviewStatusSchema,
});
export type TestimonialStatusInput = z.infer<typeof testimonialStatusSchema>;

export const testimonialDeleteSchema = z.object({ testimonialId: uuidSchema });
