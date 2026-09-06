import { z } from "zod";
import { CURRENCIES, ITINERARY_ITEM_TYPES, VISIBILITIES } from "@guideless/types";

export const uuidSchema = z.uuid();

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());

/** E.164-ish. Stripe/Twilio-compatible. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, "Enter a phone number with country code, e.g. +14155550123");

export const isoDateSchema = z.iso.date();
export const isoTimestampSchema = z.iso.datetime({ offset: true });
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm");

/** IANA zone, validated against the runtime's Intl database. */
export const timeZoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Unknown IANA time zone" },
);

export const currencySchema = z.enum(CURRENCIES);

/** Integer minor units only. */
export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: currencySchema,
});

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const locationSchema = geoPointSchema.partial().extend({
  name: z.string().max(200).optional(),
  address: z.string().max(400).optional(),
  city: z.string().max(120).optional(),
  country: z.string().length(2).optional(),
  timezone: timeZoneSchema,
});

export const itineraryItemTypeSchema = z.enum(ITINERARY_ITEM_TYPES);
export const visibilitySchema = z.enum(VISIBILITIES);

/** ISO 3166-1 alpha-2. */
export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Use a two-letter country code");
