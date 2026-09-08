import { z } from "zod";
import { INTERESTS } from "@guideless/validation";
import { PARTY_TYPES } from "@/lib/profile/extras";

/**
 * First-run profile questions. Only the name is required — a traveler who skips everything else
 * still gets a working app, and the group screen simply shows less about them.
 *
 * TODO(validation): swap for `onboardingSchema` from `@guideless/validation` once the shared
 * schema lands; the field names below are the contract it will use.
 */
const blankToUndefined = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Tell your group what to call you").max(80),
  travelingFrom: blankToUndefined(120),
  excitedAbout: blankToUndefined(280),
  partyType: z.enum(PARTY_TYPES).nullable().default(null),
  interests: z.array(z.enum(INTERESTS)).max(12).default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
