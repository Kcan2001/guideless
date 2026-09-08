import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  ADD_ON_KINDS,
  DEPARTURE_STATUSES,
  ITINERARY_ITEM_STATUSES,
  ITINERARY_ITEM_TYPES,
  OPTION_LABELS,
  OPTION_TIERS,
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

/**
 * Marking a live item changed (migration 047). The note is what the traveler is told, so it is
 * required here even though the column is nullable: a change with no explanation is the thing
 * this feature exists to stop.
 */
export const itineraryChangeSchema = z.object({
  changeNote: z.string().trim().min(3).max(280),
  replacedByItemId: z.preprocess((v) => (v === "" ? undefined : v), uuidSchema.optional()),
  cancel: z.coerce.boolean().default(false),
});
export type ItineraryChangeInput = z.infer<typeof itineraryChangeSchema>;

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

// ── Stay options and add-ons (spec §103, roadmap M9–M10) ──────────────────────
const flag = (fallback: boolean) =>
  z.preprocess(
    (v) => (v === undefined ? fallback : v === "on" || v === true || v === "true"),
    z.boolean(),
  );
const nullableInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), intField(min, max).nullable());
const nullableNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().min(min).max(max).nullable(),
  );

/** One entry per line from a textarea → trimmed, de-blanked string[] (max `count` items). */
const lineList = (count: number, maxLen: number) =>
  z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : Array.isArray(v)
          ? v
          : [],
    z.array(z.string().max(maxLen)).max(count),
  );
const optionalLabel = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.enum(OPTION_LABELS).nullable(),
);
const optionalTier = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.enum(OPTION_TIERS).nullable(),
);

export const stayOptionFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  hotelName: optionalText(200),
  area: optionalText(200),
  starRating: nullableInt(1, 5),
  destinationId: z.preprocess((v) => (v === "" ? null : v), uuidSchema.nullable()),
  /** Per traveler, major units; may be negative for a cheaper tier. */
  priceDelta: z.coerce.number().min(-100000).max(100000).default(0),
  /** Per traveler, major units; blank inherits the departure's discount. */
  sharedRoomDiscount: nullableNumber(0, 100000),
  capacity: nullableInt(0, 500),
  position: intField(1, 50).default(1),
  isDefault: flag(false),
  isActive: flag(true),
  // Presentation (migration 039). Pricing never reads these.
  tagline: optionalText(160),
  imageUrls: lineList(12, 500),
  includes: lineList(12, 160),
  excludes: lineList(12, 160),
  label: optionalLabel,
  tier: optionalTier,
  whyPriceNote: optionalText(500),
  neighborhood: optionalText(120),
  stationDistance: optionalText(120),
  trainTime: optionalText(120),
  breakfast: optionalText(120),
  roomType: optionalText(120),
  hotelConfirmed: flag(false),
});
export type StayOptionForm = z.infer<typeof stayOptionFormSchema>;

// Source of truth moved to @guideless/types (migration 039 made it a Postgres enum); re-exported
// so existing imports keep working.
export { ADD_ON_KINDS, OPTION_LABELS, OPTION_TIERS };

export const addOnFormSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  kind: z.enum(ADD_ON_KINDS).default("activity"),
  /** Major units in the departure currency. */
  price: z.coerce.number().min(0).max(1000000),
  pricingBasis: z.enum(["per_traveler", "per_booking"]).default("per_traveler"),
  capacity: nullableInt(0, 10000),
  dayNumber: nullableInt(1, 60),
  startTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()).optional(),
  endTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()).optional(),
  locationName: optionalText(200),
  address: optionalText(300),
  latitude: nullableNumber(-90, 90),
  longitude: nullableNumber(-180, 180),
  bookableUntilDaysBefore: intField(0, 365).default(1),
  cancellableUntilDaysBefore: intField(0, 365).default(7),
  tierGroup: optionalText(40),
  supplierServiceId: z.preprocess((v) => (v === "" ? null : v), uuidSchema.nullable()),
  position: intField(1, 100).default(1),
  isFeatured: flag(false),
  isActive: flag(true),
  // Presentation (migration 039).
  imageUrls: lineList(12, 500),
  includes: lineList(12, 160),
  excludes: lineList(12, 160),
  label: optionalLabel,
  tier: optionalTier,
  whyPriceNote: optionalText(500),
  meetingPoint: optionalText(200),
  minAge: nullableInt(0, 99),
});
export type AddOnForm = z.infer<typeof addOnFormSchema>;

// ── Meetups (roadmap M13) ─────────────────────────────────────────────────────
export const meetupFormSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  city: z.string().trim().min(1).max(120),
  countryCode: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().length(2).toUpperCase().nullable(),
  ),
  venueName: optionalText(200),
  address: optionalText(300),
  date: isoDateSchema,
  startTime: localTimeSchema,
  endTime: z.preprocess((v) => (v === "" ? null : v), localTimeSchema.nullable()).optional(),
  timezone: z.string().min(1).max(64),
  capacity: nullableInt(0, 1000),
  isPublished: flag(false),
});
export type MeetupForm = z.infer<typeof meetupFormSchema>;

export const hostApplicationDecisionSchema = z.object({
  status: z.enum(["pending", "approved", "declined"]),
  staffNotes: optionalText(2000),
});

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

// ── Coupons ───────────────────────────────────────────────────────────────────
/**
 * Mirrors the database rules on `coupons`: exactly one of percent/amount, a currency exactly when
 * it is an amount, and a sane validity window. Amounts are typed in major units and converted here.
 * Editing a coupon never changes an existing booking — bookings snapshot their discount.
 */
export const couponFormSchema = z
  .object({
    /** Codes are citext in the database; upper-cased here so the admin list reads consistently. */
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Letters, numbers, hyphen and underscore only")
      .transform((c) => c.toUpperCase()),
    /** Blank or absent both mean "no description" — a caller may omit the field entirely. */
    description: z.preprocess(
      (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
      z.string().trim().max(500).nullable(),
    ),
    /** "percent" or "amount" — decides which of the two value fields is used. */
    kind: z.enum(["percent", "amount"]),
    percentOff: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      intField(1, 100).optional(),
    ),
    amountOff: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      moneyMajorToMinor.optional(),
    ),
    currency: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      currencySchema.optional(),
    ),
    validFrom: z.preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable()).default(null),
    validUntil: z.preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable()).default(null),
    maxRedemptions: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      intField(1, 100000).nullable(),
    ),
    isActive: checkbox.default(false),
  })
  .refine((c) => c.kind !== "percent" || typeof c.percentOff === "number", {
    message: "Enter a percentage between 1 and 100",
    path: ["percentOff"],
  })
  .refine((c) => c.kind !== "amount" || (typeof c.amountOff === "number" && c.amountOff > 0), {
    message: "Enter an amount greater than zero",
    path: ["amountOff"],
  })
  .refine((c) => c.kind !== "amount" || Boolean(c.currency), {
    message: "An amount off needs a currency",
    path: ["currency"],
  })
  .refine((c) => !(c.validFrom && c.validUntil) || c.validUntil >= c.validFrom, {
    message: "The end date must not be before the start date",
    path: ["validUntil"],
  });
export type CouponForm = z.infer<typeof couponFormSchema>;

// ── Support inbox (roadmap launch gap) ──────────────────────────────────────
export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const SUPPORT_THREAD_STATUSES = [
  "open",
  "waiting_on_customer",
  "waiting_on_staff",
  "resolved",
  "closed",
] as const;

export const supportReplySchema = z.object({ body: z.string().trim().min(1).max(8000) });
export const supportPrioritySchema = z.object({ priority: z.enum(SUPPORT_PRIORITIES) });
export const supportStatusSchema = z.object({ status: z.enum(SUPPORT_THREAD_STATUSES) });

// ── Trip documents uploaded by staff ────────────────────────────────────────
export const TRIP_DOCUMENT_KINDS = [
  "ticket",
  "voucher",
  "hotel_confirmation",
  "insurance",
  "guide",
  "map",
  "other",
] as const;
export const TRIP_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const TRIP_DOCUMENT_MAX_BYTES = 52_428_800; // 50 MB, mirrors the bucket limit

/** Metadata recorded after the browser has uploaded the file straight to Storage. */
export const tripDocumentRecordSchema = z.object({
  kind: z.enum(TRIP_DOCUMENT_KINDS),
  title: z.string().trim().min(1).max(200),
  forUserId: z.preprocess((v) => (v === "" || v === undefined ? null : v), uuidSchema.nullable()),
  visibility: z.enum(["trip_member", "staff_only"]).default("trip_member"),
  storagePath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^trips\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/, "Unexpected storage path"),
  mimeType: z.enum(TRIP_DOCUMENT_MIME_TYPES),
  sizeBytes: z.coerce.number().int().min(1).max(TRIP_DOCUMENT_MAX_BYTES),
});
export type TripDocumentRecord = z.infer<typeof tripDocumentRecordSchema>;

export { nullableText };
