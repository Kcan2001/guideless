import { z } from "zod";
import { slugSchema, uuidSchema } from "./common";

/**
 * Journal posts and standing pages. Both live in `cms_pages`, told apart by `kind`; see
 * migration 20260906005100_journal.sql for why there is no separate table.
 */

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const optionalUrl = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z
    .string()
    .trim()
    .max(500)
    // Site-relative (our own photo manifest) or absolute http(s). No other scheme reaches an <img>.
    .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Use a /path or an http(s) URL")
    .optional(),
);

export const CMS_PAGE_KINDS = ["page", "journal"] as const;
export type CmsPageKind = (typeof CMS_PAGE_KINDS)[number];

export const cmsPageFormSchema = z
  .object({
    kind: z.enum(CMS_PAGE_KINDS),
    slug: slugSchema,
    title: z.string().trim().min(3).max(160),
    excerpt: optionalText(300),
    bodyMarkdown: z.preprocess((v) => (v === undefined ? "" : v), z.string().max(60_000)),
    heroImageUrl: optionalUrl,
    ogImageUrl: optionalUrl,
    authorName: optionalText(80),
    tourId: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      uuidSchema.optional(),
    ),
    seoTitle: optionalText(70),
    seoDescription: optionalText(200),
    isPublished: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()),
    /** Empty means "now" on first publish; the action fills it in. */
    publishedAt: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.string().optional(),
    ),
  })
  .refine((v) => v.kind !== "journal" || !v.isPublished || Boolean(v.excerpt), {
    path: ["excerpt"],
    message: "A published post needs a summary — it is the line readers see on the index.",
  })
  .refine((v) => v.kind !== "journal" || !v.isPublished || v.bodyMarkdown.trim().length >= 200, {
    path: ["bodyMarkdown"],
    message: "A published post needs a body of at least 200 characters.",
  });

export type CmsPageForm = z.infer<typeof cmsPageFormSchema>;
