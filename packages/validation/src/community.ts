import { z } from "zod";
import { emailSchema, uuidSchema } from "./common";

const optionalText = (max: number) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(max).optional());

// ── Profiles: what a traveler chooses to show the group ──────────────────────
export const INTERESTS = [
  "food",
  "wine",
  "coffee",
  "hiking",
  "swimming",
  "running",
  "cycling",
  "art",
  "architecture",
  "history",
  "music",
  "nightlife",
  "photography",
  "shopping",
  "markets",
  "beaches",
  "trains",
  "motorsport",
  "books",
  "quiet_mornings",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const TRAVEL_STYLES = ["relaxed", "balanced", "active"] as const;

export const groupProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: optionalText(500),
  homeCountry: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().length(2).toUpperCase().optional(),
  ),
  interests: z.array(z.enum(INTERESTS)).max(12).default([]),
  travelStyle: z.enum(TRAVEL_STYLES).nullable().default(null),
  languages: z.array(z.string().trim().min(2).max(24)).max(8).default([]),
  showHomeCountry: z.boolean().default(true),
  showBio: z.boolean().default(true),
  showInterests: z.boolean().default(true),
});
export type GroupProfileInput = z.infer<typeof groupProfileSchema>;

// ── RSVPs ─────────────────────────────────────────────────────────────────────
export const itemRsvpSchema = z.object({
  itemId: uuidSchema,
  status: z.enum(["going", "maybe", "not_going"]),
});

export const meetupRsvpSchema = z.object({
  meetupId: uuidSchema,
  status: z.enum(["going", "cancelled"]),
});

// ── Host program intake (public form) ─────────────────────────────────────────
export const hostApplicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  communityDescription: z.string().trim().min(10).max(2000),
  communitySize: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(10_000_000).optional(),
  ),
  links: optionalText(500),
  city: optionalText(120),
  preferredTourId: z.preprocess((v) => (v === "" ? undefined : v), uuidSchema.optional()),
  preferredMonth: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  ),
});
export type HostApplicationInput = z.infer<typeof hostApplicationSchema>;

// ── Referral / coupon code as typed in checkout ───────────────────────────────
export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/, "Codes are 3–32 letters, numbers or dashes");
