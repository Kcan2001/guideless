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

export const createBookingSchema = z.object({
  departureId: uuidSchema,
  travelers: z.array(travelerInputSchema).min(1).max(8),
  emergencyContact: emergencyContactSchema,
  preferences: bookingPreferencesSchema,
  terms: termsAcceptanceSchema,
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/)
    .optional(),
  paymentOption: z.enum(["deposit", "full"]).default("deposit"),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

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
