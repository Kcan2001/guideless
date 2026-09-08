import { z } from "zod";
import { uuidSchema } from "./common";

/**
 * Reviews and traveler photos. The database is the real gate — `submit_review()` refuses anyone
 * whose trip has not ended — so these schemas exist to give a person a sentence instead of a
 * Postgres error, and to keep the same limits in front of the form as behind it.
 */

export const REVIEW_STATUSES = ["pending", "published", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);

/** Blank optional text arrives from a form as "", which is not the same as "not answered". */
const optionalText = (max: number, message?: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, message).optional(),
  );

const ratingSchema = z.coerce
  .number()
  .int("Pick a whole number of stars")
  .min(1, "Pick at least one star")
  .max(5, "Five stars is the most there is");

/** A checkbox posts "on" when ticked and nothing at all when not. */
const checkbox = z.preprocess(
  (v) =>
    v === undefined || v === null || v === ""
      ? undefined
      : v === "on" || v === "true" || v === true,
  z.boolean().optional(),
);

export const reviewFormSchema = z.object({
  bookingId: uuidSchema,
  rating: ratingSchema,
  title: optionalText(120, "Keep the headline under 120 characters"),
  body: z
    .string()
    .trim()
    .min(20, "Tell the next traveler a little more — twenty characters at least")
    .max(4000, "That is longer than 4,000 characters"),
  wouldRepeat: checkbox,
});
export type ReviewFormInput = z.infer<typeof reviewFormSchema>;

export const reviewModerationSchema = z.object({
  reviewId: uuidSchema,
  status: reviewStatusSchema,
  note: optionalText(500, "Keep the note under 500 characters"),
});
export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;

export const photoModerationSchema = z.object({
  photoId: uuidSchema,
  status: reviewStatusSchema,
  note: optionalText(500, "Keep the note under 500 characters"),
});
export type PhotoModerationInput = z.infer<typeof photoModerationSchema>;

/** Matches the `trip-media` bucket's allowed types and the 25 MB limit from migration 020. */
export const TRIP_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
export const TRIP_PHOTO_MAX_BYTES = 25 * 1024 * 1024;

export const tripPhotoUploadSchema = z.object({
  bookingId: uuidSchema,
  mimeType: z.enum(TRIP_PHOTO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(TRIP_PHOTO_MAX_BYTES),
  caption: optionalText(280, "Keep the caption under 280 characters"),
});
export type TripPhotoUploadInput = z.infer<typeof tripPhotoUploadSchema>;
