import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  DEPARTURE_STATUSES,
  ITINERARY_ITEM_STATUSES,
  ITINERARY_ITEM_TYPES,
  RESPONSIBILITIES,
  SUPPLIER_SERVICE_STATUSES,
  VISIBILITIES,
} from "@guideless/types";
import {
  currencySchema,
  isoDateSchema,
  localTimeSchema,
  slugSchema,
  timeZoneSchema,
  uuidSchema,
} from "./common";
import { cancellationPolicySchema } from "./booking";

/** Admin forms post FormData; these coercions turn "" into undefined/null and strings into numbers. */
const optionalText = (max = 5000) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const nullableText = (max = 5000) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable(),
  );
const intField = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
/** Money typed in major units ("3495" or "3,495.00") → integer minor units. */
const moneyMajorToMinor = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const cleaned = v.replace(/[^\d.]/g, "");
  if (cleaned === "") return 0;
  return Math.round(Number(cleaned) * 100);
}, z.number().int().nonnegative());
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

// ── Tours ─────────────────────────────────────────────────────────────────────
export const tourFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    durationDays: intField(1, 60),
    groupSizeMin: intField(1, 50),
    groupSizeMax: intField(1, 50),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    isPublished: checkbox.default(false),
  })
  .refine((t) => t.groupSizeMax >= t.groupSizeMin, {
    message: "Max group must be ≥ min",
    path: ["groupSizeMax"],
  });
export type TourFormInput = z.infer<typeof tourFormSchema>;

export const tourVersionFormSchema = z.object({
  tagline: optionalText(200),
  summary: optionalText(1000),
  description: optionalText(5000),
  whyThisTrip: optionalText(1000),
  heroImageUrl: optionalText(500),
  startingPrice: moneyMajorToMinor.optional(),
  startingPriceCurrency: currencySchema.optional(),
  seoTitle: optionalText(120),
  seoDescription: optionalText(320),
});
export type TourVersionFormInput = z.infer<typeof tourVersionFormSchema>;

export const routeStopSchema = z.object({
  destinationId: uuidSchema,
  nights: intField(0, 30),
});

export const listItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(1000),
});
export const faqSchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(3).max(3000),
});

export const tourDaySchema = z.object({
  dayNumber: intField(1, 60),
  title: z.string().trim().min(1).max(160),
  summary: optionalText(1000),
  destinationId: z.preprocess((v) => (v === "" ? null : v), uuidSchema.nullable()),
});

/** Shared by template (tour_itinerary_items) and trip (trip_itinerary_items) editors. */
export const itineraryItemSchema = z.object({
  type: z.enum(ITINERARY_ITEM_TYPES),
  title: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  startTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()),
  endTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()),
  timezone: timeZoneSchema,
  locationName: optionalText(200),
  address: optionalText(400),
  instructions: optionalText(2000),
  responsibility: z.enum(RESPONSIBILITIES),
  isOptional: checkbox.default(false),
  visibility: z.enum(VISIBILITIES),
  position: intField(0, 999).default(0),
  status: z.enum(ITINERARY_ITEM_STATUSES).optional(),
});
export type ItineraryItemInput = z.infer<typeof itineraryItemSchema>;

// ── Departures ────────────────────────────────────────────────────────────────
export const departureFormSchema = z
  .object({
    tourId: uuidSchema,
    status: z.enum(DEPARTURE_STATUSES),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    timezone: timeZoneSchema,
    capacity: intField(0, 200),
    minimumTravelers: intField(0, 200),
    price: moneyMajorToMinor,
    deposit: moneyMajorToMinor,
    currency: currencySchema,
    bookingDeadline: z.preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable()),
    balanceDueDate: z.preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable()),
    cancellationPolicy: z.preprocess((v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }, cancellationPolicySchema.optional()),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be after start",
    path: ["endDate"],
  })
  .refine((d) => d.deposit <= d.price, {
    message: "Deposit cannot exceed price",
    path: ["deposit"],
  });
export type DepartureFormInput = z.infer<typeof departureFormSchema>;

export const noteSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const supplierServiceFormSchema = z.object({
  supplierId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  status: z.enum(SUPPLIER_SERVICE_STATUSES),
  confirmationNumber: optionalText(120),
  cost: moneyMajorToMinor.optional(),
  costCurrency: currencySchema.optional(),
  cancellationDeadline: z
    .preprocess(
      (v) => (v === "" ? null : v),
      z.iso.datetime({ local: true, offset: true }).nullable(),
    )
    .optional(),
  internalNotes: optionalText(2000),
});

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.enum(["hotel", "rail", "transfer", "activity", "restaurant", "other"]),
  website: optionalText(300),
  countryCode: optionalText(2),
});

// ── Live Moments (spec §24) ───────────────────────────────────────────────────
export const liveMomentFormSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: optionalText(2000),
  /** Local date in the moment's timezone. */
  date: isoDateSchema,
  startTime: localTimeSchema,
  endTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()).optional(),
  /** Defaults to the trip's timezone when omitted. */
  timezone: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).max(64).optional()),
  locationName: optionalText(200),
  address: optionalText(300),
  capacity: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    intField(1, 500).nullable(),
  ),
  status: z.enum(["draft", "scheduled"]).default("scheduled"),
});
export type LiveMomentForm = z.infer<typeof liveMomentFormSchema>;

// ── Bookings ──────────────────────────────────────────────────────────────────
export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  /** Override the policy percentage (finance/admin). 0–100. */
  refundPercentageOverride: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    intField(0, 100).optional(),
  ),
});

export const grantRoleSchema = z.object({
  userId: uuidSchema,
  role: z.enum(["trip_staff", "support", "content_editor", "finance", "admin", "super_admin"]),
});

export { nullableText };
