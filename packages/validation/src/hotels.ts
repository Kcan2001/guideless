import { z } from "zod";
import { HOTEL_PAYMENT_TYPES, HOTEL_SUPPLIERS } from "@guideless/types";
import { currencySchema, isoDateSchema, slugSchema, uuidSchema } from "./common";

/**
 * Hotel inventory (migration 044, docs/strategy-v3-direction.md §3). Admin forms and the rate
 * search input. Net rates and supplier ids are staff-only; nothing here is customer input except
 * hotelRateSearchSchema, which only carries dates and occupancy.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Textarea → string[]: one entry per line, blanks dropped. */
const lineList = (maxItems: number, maxLen: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) =>
      (Array.isArray(v) ? v : v.split(/\r?\n/))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, maxItems),
    )
    .pipe(z.array(z.string().max(maxLen)).max(maxItems))
    .default([]);

const flag = (fallback: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return fallback;
    if (v === "on" || v === "true" || v === true || v === "1") return true;
    if (v === "false" || v === false || v === "0" || v === "off") return false;
    return fallback;
  }, z.boolean());

const nullableInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );

const nullableUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  uuidSchema.nullable(),
);

export const hotelSupplierSchema = z.enum(HOTEL_SUPPLIERS);
export const hotelPaymentTypeSchema = z.enum(HOTEL_PAYMENT_TYPES);

export const hotelFormSchema = z.object({
  destinationId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  address: optionalText(400),
  city: z.string().trim().min(1).max(120),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Two-letter country code"),
  latitude: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().min(-90).max(90).nullable(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().min(-180).max(180).nullable(),
  ),
  /** Only when the property is confirmed and the rating is real (plan v2 §10). */
  starRating: nullableInt(1, 5),
  description: optionalText(4000),
  imageUrls: lineList(24, 500),
  amenities: lineList(40, 80),
  isActive: flag(true),
});
export type HotelForm = z.infer<typeof hotelFormSchema>;

export const hotelRoomFormSchema = z.object({
  hotelId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  bedType: optionalText(60),
  maxOccupancy: z.coerce.number().int().min(1).max(8).default(2),
  description: optionalText(2000),
  imageUrls: lineList(12, 500),
  position: z.coerce.number().int().min(1).max(50).default(1),
});
export type HotelRoomForm = z.infer<typeof hotelRoomFormSchema>;

export const hotelSupplierMappingSchema = z.object({
  hotelId: uuidSchema,
  supplier: hotelSupplierSchema,
  supplierHotelId: z.string().trim().min(1).max(120),
  hotelRoomId: nullableUuid,
  supplierRoomId: optionalText(120),
});
export type HotelSupplierMappingInput = z.infer<typeof hotelSupplierMappingSchema>;

/** Markups in MAJOR units in the form; the action converts to minor units. */
export const pricingRuleFormSchema = z
  .object({
    destinationId: nullableUuid,
    hotelId: nullableUuid,
    minMarkup: z.coerce.number().min(0).max(100000).default(0),
    percentageMarkup: z.coerce.number().min(0).max(500).default(0),
    fixedMarkup: z.coerce.number().min(0).max(100000).default(0),
    priority: z.coerce.number().int().min(-1000).max(1000).default(0),
    effectiveFrom: z
      .preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable())
      .default(null),
    effectiveTo: z.preprocess((v) => (v === "" ? null : v), isoDateSchema.nullable()).default(null),
    isActive: flag(true),
  })
  .refine((r) => !(r.effectiveFrom && r.effectiveTo) || r.effectiveTo >= r.effectiveFrom, {
    message: "The end date must not be before the start date",
    path: ["effectiveTo"],
  });
export type PricingRuleForm = z.infer<typeof pricingRuleFormSchema>;

/** Rate search: dates and occupancy only — never a price. */
export const hotelRateSearchSchema = z
  .object({
    hotelIds: z.array(uuidSchema).min(1).max(20),
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    adults: z.coerce.number().int().min(1).max(4),
    children: z.coerce.number().int().min(0).max(3).default(0),
    currency: currencySchema.default("USD"),
  })
  .refine((s) => s.checkOut > s.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });
export type HotelRateSearch = z.infer<typeof hotelRateSearchSchema>;
