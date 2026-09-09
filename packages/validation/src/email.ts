import { z } from "zod";
import { uuidSchema } from "./common";

/**
 * Writing an email in admin.
 *
 * `segment` is a plain string rather than an enum because the segments come from the mailing_list
 * view, and a value that is not in it simply matches nobody. The consent check that actually
 * matters — whether that segment agreed to marketing at all — lives in the database and in
 * sendCampaign(), not here, because it is the one nobody may bypass.
 */

const optional = (max: number, message?: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, message).optional(),
  );

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const MARKETABLE_SEGMENTS = ["newsletter", "destination_alert", "waitlist"] as const;

export const campaignFormSchema = z
  .object({
    campaignId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      uuidSchema.optional(),
    ),
    subject: z
      .string()
      .trim()
      .min(3, "Give it a subject line")
      .max(200, "That subject is too long to read in an inbox"),
    preheader: optional(200, "Keep the preheader under 200 characters"),
    body: z
      .string()
      .trim()
      .min(10, "There is no email here yet")
      .max(20000, "That is longer than 20,000 characters"),
    segment: z.enum(MARKETABLE_SEGMENTS, {
      message: "Pick a list that agreed to hear from us",
    }),
    context: optional(120),
    ctaLabel: optional(60, "Keep the button label short"),
    ctaUrl: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url("That is not a URL").optional(),
    ),
  })
  .refine((v) => !v.ctaLabel || v.ctaUrl, {
    path: ["ctaUrl"],
    message: "A button needs somewhere to go",
  })
  .refine((v) => !v.ctaUrl || v.ctaLabel, {
    path: ["ctaLabel"],
    message: "A link needs a label",
  });
export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export const campaignSendSchema = z.object({
  campaignId: uuidSchema,
  confirm: checkbox,
});
