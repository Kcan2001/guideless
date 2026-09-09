import { z } from "zod";
import { RECOMMENDATION_CATEGORIES } from "@guideless/types";
import { isoDateSchema, localTimeSchema, timeZoneSchema, uuidSchema } from "./common";

/**
 * The trip assistant, and the personal plans it can write (migrations 0059–0061).
 *
 * Two audiences use these schemas and both matter. Web and mobile validate what a person typed;
 * the server validates what the *model* produced before any of it reaches the database. The second
 * is the one that earns its keep: a tool call is untrusted input in exactly the way a form is, and
 * a model that invents a time zone or a 4,000-character title must be refused the same way a
 * browser would be.
 */

export const ASSISTANT_MESSAGE_MAX = 2000;

export const assistantMessageSchema = z.object({
  bookingId: uuidSchema,
  message: z
    .string()
    .trim()
    .min(1, "Ask something first")
    .max(ASSISTANT_MESSAGE_MAX, `Keep it under ${ASSISTANT_MESSAGE_MAX} characters`),
});
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;

/**
 * A traveler's own plan. Times are wall-clock in `timezone`, never an instant: a dinner at 20:00
 * in Nice is at 20:00 in Nice no matter where the phone thinks it is.
 */
export const travelerPlanSchema = z
  .object({
    title: z.string().trim().min(1, "Give it a name").max(200),
    notes: z.string().trim().max(2000).optional(),
    planDate: isoDateSchema.optional(),
    startTime: localTimeSchema.optional(),
    endTime: localTimeSchema.optional(),
    timezone: timeZoneSchema,
    locationName: z.string().trim().max(200).optional(),
    address: z.string().trim().max(400).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    mapsUrl: z.url().max(2000).optional(),
    placeRef: z.string().trim().max(200).optional(),
    recommendationId: uuidSchema.optional(),
  })
  .refine((v) => !v.endTime || !v.startTime || v.endTime >= v.startTime, {
    message: "The end time cannot be before the start time",
    path: ["endTime"],
  });
export type TravelerPlanInput = z.infer<typeof travelerPlanSchema>;

/** Adding a plan by hand needs to say which trip it belongs to; the assistant already knows. */
export const travelerPlanFormSchema = z.intersection(
  travelerPlanSchema,
  z.object({ bookingId: uuidSchema }),
);
export type TravelerPlanFormInput = z.infer<typeof travelerPlanFormSchema>;

/**
 * What the assistant is allowed to ask a places provider for. Bounded on purpose: an unbounded
 * radius or a 200-result page is a bill, not a feature.
 */
export const placeSearchSchema = z.object({
  query: z.string().trim().min(2).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(20000).default(2000),
  openNow: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});
export type PlaceSearchInput = z.infer<typeof placeSearchSchema>;

export const travelerSignalSchema = z.object({
  kind: z.enum([
    "recommendation_opened",
    "add_on_viewed",
    "add_on_bought",
    "moment_joined",
    "plan_added",
  ]),
  categories: z.array(z.enum(RECOMMENDATION_CATEGORIES)).max(13).default([]),
  refId: uuidSchema.optional(),
});
export type TravelerSignalInput = z.infer<typeof travelerSignalSchema>;

/**
 * A reservation request. The contract exists before any provider does (item 7), so today every
 * one of these ends as a draft the traveler sends themselves — and the shape will not have to
 * change when a real provider arrives.
 */
export const reservationRequestSchema = z.object({
  placeRef: z.string().trim().min(1).max(200),
  placeName: z.string().trim().min(1).max(200),
  partySize: z.number().int().min(1).max(20),
  date: isoDateSchema,
  time: localTimeSchema,
  timezone: timeZoneSchema,
  notes: z.string().trim().max(500).optional(),
});
export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;
