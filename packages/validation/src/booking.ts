import { z } from "zod";
import { countryCodeSchema, emailSchema, isoDateSchema, phoneSchema, uuidSchema } from "./common";

/**
 * Checkout step 2 — Traveler. Collect only what operations actually needs.
 * Passport numbers are NOT collected here; they are requested later, per-destination,
 * and stored separately with stricter access.
 */
export const travelerInputSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional(),
  email: emailSchema,
  phone: phoneSchema.optional(),
  dateOfBirth: isoDateSchema.refine(
    (d) => new Date(d) < new Date(),
    "Date of birth must be in the past",
  ),
  nationality: countryCodeSchema,
});
export type TravelerInput = z.infer<typeof travelerInputSchema>;

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60),
  phone: phoneSchema,
  email: emailSchema.optional(),
});
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;

/** Checkout step 3 — Preferences. */
export const bookingPreferencesSchema = z.object({
  roomPreference: z
    .enum(["single", "shared_twin", "shared_double", "no_preference"])
    .default("no_preference"),
  dietaryRequirements: z.string().trim().max(500).optional(),
  accessibilityNeeds: z.string().trim().max(500).optional(),
  airportTransfer: z
    .enum(["group_welcome_transfer", "own_arrangement"])
    .default("group_welcome_transfer"),
  optionalExperienceIds: z.array(uuidSchema).max(20).default([]),
});
export type BookingPreferencesInput = z.infer<typeof bookingPreferencesSchema>;

/** Checkout step 5 — Terms. Every field must be literally `true`. */
export const termsAcceptanceSchema = z.object({
  terms: z.literal(true),
  cancellationPolicy: z.literal(true),
  travelResponsibility: z.literal(true),
  privacyPolicy: z.literal(true),
  supplierTerms: z.literal(true).optional(),
  waiver: z.literal(true).optional(),
});
export type TermsAcceptanceInput = z.infer<typeof termsAcceptanceSchema>;

/** One chosen add-on: per-traveler add-ons name 1-based traveler indexes, per-booking ones a quantity. */
export const addOnSelectionSchema = z.object({
  addOnId: uuidSchema,
  travelerIndexes: z.array(z.number().int().min(1).max(8)).max(8).optional(),
  quantity: z.number().int().min(1).max(8).optional(),
});
export type AddOnSelection = z.infer<typeof addOnSelectionSchema>;

/** Room layout: one 1-based room number per traveler; at most two travelers share a room. */
export const roomIndexesSchema = z
  .array(z.number().int().min(1).max(8))
  .min(1)
  .max(8)
  .refine((rooms) => rooms.every((r) => rooms.filter((x) => x === r).length <= 2), {
    message: "A room holds at most two travelers",
  });

export const promoCodeInputSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/)
    .optional(),
);

/** Friend / group code such as KYLE-MONACO-27 (public.group_codes). Blank → undefined. */
export const groupCodeSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$/, "That does not look like a group code")
    .optional(),
);

export const createBookingSchema = z
  .object({
    departureId: uuidSchema,
    travelers: z.array(travelerInputSchema).min(1).max(8),
    /** Defaults to one room per traveler when omitted. */
    roomIndexes: roomIndexesSchema.optional(),
    stayOptionId: uuidSchema.nullable().optional(),
    addOns: z.array(addOnSelectionSchema).max(20).default([]),
    emergencyContact: emergencyContactSchema,
    preferences: bookingPreferencesSchema,
    terms: termsAcceptanceSchema,
    /** Coupon or a friend's referral code (GL-XXXXXX). */
    code: promoCodeInputSchema,
    /** Joins a friend's group on the same departure; never changes the price. */
    groupCode: groupCodeSchema,
    paymentOption: z.enum(["deposit", "full"]).default("deposit"),
  })
  .refine((b) => !b.roomIndexes || b.roomIndexes.length === b.travelers.length, {
    message: "Every traveler needs a room",
    path: ["roomIndexes"],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Input for the live quote (checkout sidebar) and for add-ons bought after booking. */
export const quoteRequestSchema = z.object({
  departureId: uuidSchema,
  roomIndexes: roomIndexesSchema,
  stayOptionId: uuidSchema.nullable().optional(),
  addOns: z.array(addOnSelectionSchema).max(20).default([]),
  code: promoCodeInputSchema,
  paymentOption: z.enum(["deposit", "full"]).default("deposit"),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const addOnPurchaseSchema = z.object({
  bookingId: uuidSchema,
  addOns: z.array(addOnSelectionSchema).min(1).max(20),
});
export type AddOnPurchaseInput = z.infer<typeof addOnPurchaseSchema>;

/** Cancellation policy tiers, validated when staff edit them in admin. */
export const cancellationTierSchema = z.object({
  daysBeforeDeparture: z.number().int().nonnegative(),
  refundPercentage: z.number().int().min(0).max(100),
});

export const cancellationPolicySchema = z
  .array(cancellationTierSchema)
  .min(1)
  .refine(
    (tiers) => {
      const sorted = [...tiers].sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture);
      return sorted.every(
        (t, i) => i === 0 || t.daysBeforeDeparture < sorted[i - 1]!.daysBeforeDeparture,
      );
    },
    { message: "Each tier must have a distinct daysBeforeDeparture" },
  );
export type CancellationPolicyInput = z.infer<typeof cancellationPolicySchema>;

// ── Account self-service ──────────────────────────────────────────────────────
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Editable traveler fields on /account; names as on the passport are changed via support. */
export const travelerUpdateSchema = z.object({
  preferredName: z.preprocess(blankToUndefined, z.string().trim().max(80).optional()),
  email: z.preprocess(blankToUndefined, emailSchema.optional()),
  phone: z.preprocess(blankToUndefined, phoneSchema.optional()),
  dateOfBirth: isoDateSchema.refine(
    (d) => new Date(d) < new Date(),
    "Date of birth must be in the past",
  ),
  nationality: countryCodeSchema,
  dietaryRequirements: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
  accessibilityNotes: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
});
export type TravelerUpdateInput = z.infer<typeof travelerUpdateSchema>;

export const emergencyContactUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  email: z.preprocess(blankToUndefined, emailSchema.optional()),
});

export const cancellationRequestSchema = z.object({
  bookingId: uuidSchema,
  reason: z.string().trim().min(3, "Tell us briefly why").max(2000),
});
export type CancellationRequestInput = z.infer<typeof cancellationRequestSchema>;

/** Trip Builder saved configuration (public.builder_drafts). The draft shape belongs to the web app. */
export const builderDraftSchema = z.object({
  departureId: uuidSchema,
  step: z.number().int().min(0).max(7),
  draft: z.object({}).passthrough(),
});
export type BuilderDraftInput = z.infer<typeof builderDraftSchema>;
