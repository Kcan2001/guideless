import { z } from "zod";
import { SOCIAL_MEDIA_KINDS, SOCIAL_PLATFORMS, SOCIAL_POST_STATUSES } from "@guideless/types";
import { emailSchema, isoDateSchema, localTimeSchema, timeZoneSchema, uuidSchema } from "./common";

/** Pinterest caps: 100-char title, 800-char description. */
export const PINTEREST_TITLE_MAX = 100;
export const PINTEREST_DESCRIPTION_MAX = 800;

/** Instagram caps: 2,200 characters, 30 hashtags, 10 carousel items. */
export const INSTAGRAM_CAPTION_MAX = 2200;
export const INSTAGRAM_HASHTAG_MAX = 30;
export const INSTAGRAM_CAROUSEL_MAX = 10;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** "#Nice, #frenchriviera slow travel" → ["nice", "frenchriviera", "slow", "travel"]. */
export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (tag) seen.add(tag.toLowerCase());
  }
  return [...seen];
}

export const hashtagsFieldSchema = z.preprocess(
  (v) => (typeof v === "string" ? parseHashtags(v) : v),
  z
    .array(z.string().min(1).max(100))
    .max(INSTAGRAM_HASHTAG_MAX, `At most ${INSTAGRAM_HASHTAG_MAX} hashtags`),
);

export const socialMediaKindSchema = z.enum(SOCIAL_MEDIA_KINDS);
export const socialPostStatusSchema = z.enum(SOCIAL_POST_STATUSES);
export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS);

/** Admin "edit post" form. Scheduling is a separate action so a caption edit never re-queues. */
export const socialPostFormSchema = z.object({
  postId: uuidSchema,
  platform: socialPlatformSchema.default("instagram"),
  caption: z.string().max(INSTAGRAM_CAPTION_MAX).default(""),
  hashtags: hashtagsFieldSchema.default([]),
  altText: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
  /** Pinterest only. */
  title: z.preprocess(blankToUndefined, z.string().trim().max(PINTEREST_TITLE_MAX).optional()),
  /** Pinterest only. Destination link; defaults to the site when empty. */
  linkUrl: z.preprocess(blankToUndefined, z.url().max(2000).optional()),
  tourId: z.preprocess(blankToUndefined, uuidSchema.optional()),
  destinationId: z.preprocess(blankToUndefined, uuidSchema.optional()),
});
export type SocialPostForm = z.infer<typeof socialPostFormSchema>;

/** "Also post to …" — copies a post's media and caption into a draft for another platform. */
export const socialDuplicateFormSchema = z.object({
  postId: uuidSchema,
  platform: socialPlatformSchema,
});

// ── Newsletter ───────────────────────────────────────────────────────────────
export const NEWSLETTER_SOURCES = ["footer", "checkout", "account", "admin", "import"] as const;

/**
 * Public signup form. `website` is a honeypot: real browsers leave it empty, bots fill it.
 * Consent is implied by submitting the form next to the stated purpose (single opt-in, CAN-SPAM
 * compliant with the one-click unsubscribe link in every send).
 */
export const newsletterSignupSchema = z.object({
  email: emailSchema,
  source: z.enum(NEWSLETTER_SOURCES).default("footer"),
  website: z.preprocess(blankToUndefined, z.string().max(0, "Bot check failed").optional()),
});
export type NewsletterSignup = z.infer<typeof newsletterSignupSchema>;

export const newsletterUnsubscribeSchema = z.object({ token: uuidSchema });

/** Admin "schedule" form: a wall-clock time in an explicit zone; the action converts to UTC. */
export const socialScheduleFormSchema = z.object({
  postId: uuidSchema,
  date: isoDateSchema,
  time: localTimeSchema,
  timeZone: timeZoneSchema,
});
export type SocialScheduleForm = z.infer<typeof socialScheduleFormSchema>;

/** Rows created by scripts/social-import.mjs (validated server-side by the same rules). */
export const socialPostImportSchema = z.object({
  kind: socialMediaKindSchema,
  caption: z.string().max(INSTAGRAM_CAPTION_MAX).default(""),
  hashtags: z.array(z.string()).max(INSTAGRAM_HASHTAG_MAX).default([]),
  mediaPaths: z.array(z.string().min(1)).min(1).max(INSTAGRAM_CAROUSEL_MAX),
  altTexts: z.array(z.string().max(1000)).default([]),
  sourceFiles: z.array(z.string()).default([]),
});
