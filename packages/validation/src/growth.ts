import { z } from "zod";
import { emailSchema, uuidSchema } from "./common";

/**
 * Growth: waitlists, trip drops and group unlocks (strategy §5).
 * Referral tiers are data in `system_settings`, not a form, so they have no schema here.
 */

/** Joining a waitlist: a departure when there is one, otherwise the tour. */
export const waitlistJoinSchema = z.object({
  tourId: uuidSchema,
  departureId: z.preprocess((v) => (v === "" ? undefined : v), uuidSchema.optional()),
  email: emailSchema,
  name: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(120).optional()),
  partySize: z.coerce.number().int().min(1).max(8).default(1),
  source: z
    .string()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .default("tour_page"),
  /** Honeypot: bots fill it, people never see it. Must arrive empty. */
  company: z.string().max(0).optional(),
});
export type WaitlistJoinInput = z.infer<typeof waitlistJoinSchema>;

/** What join_waitlist() answers, so the caller can branch without string typos. */
export const WAITLIST_RESULTS = [
  "joined",
  "already_waiting",
  "rate_limited",
  "invalid_email",
  "not_found",
] as const;
export type WaitlistResult = (typeof WAITLIST_RESULTS)[number];

/** Staff: promise the group something once N of them have booked. */
export const departureUnlockFormSchema = z.object({
  departureId: uuidSchema,
  threshold: z.coerce.number().int().min(2).max(200),
  reward: z.string().trim().min(3).max(200),
  isActive: z
    .preprocess((v) => v === "on" || v === true || v === "true", z.boolean())
    .default(true),
});
export type DepartureUnlockForm = z.infer<typeof departureUnlockFormSchema>;

/** Staff: when a departure becomes bookable. Empty clears the drop and opens it immediately. */
export const departureDropSchema = z.object({
  departureId: uuidSchema,
  opensAt: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().datetime({ offset: true }).optional(),
  ),
});
export type DepartureDropInput = z.infer<typeof departureDropSchema>;
