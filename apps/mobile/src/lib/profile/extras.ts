/**
 * Onboarding profile fields. The columns are in the generated types, but a deployed environment
 * can still be a migration behind, so every write degrades: if Postgres says the column is not
 * there, we drop those fields and save the rest rather than losing the traveler's edit.
 */

export const PARTY_TYPES = ["solo", "couple", "friends", "family"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_LABEL: Record<PartyType, string> = {
  solo: "On my own",
  couple: "As a couple",
  friends: "With friends",
  family: "With family",
};

/** Columns this build writes that older databases may not have. */
export const EXTRA_COLUMNS = [
  "traveling_from",
  "excited_about",
  "party_type",
  "onboarded_at",
  "show_traveling_from",
] as const;

/** Postgres/PostgREST codes for "that column isn't there". */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}

/** Split a patch into columns every database has and the ones that may be missing. */
export function splitExtras<T extends Record<string, unknown>>(
  patch: T,
): { base: Record<string, unknown>; extras: Record<string, unknown> } {
  const base: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  const extraKeys = new Set<string>(EXTRA_COLUMNS);
  for (const [k, v] of Object.entries(patch)) {
    if (extraKeys.has(k)) extras[k] = v;
    else base[k] = v;
  }
  return { base, extras };
}

/** Onboarding is due when the traveler has never completed or skipped it. */
export function needsOnboarding(
  profile: { onboarded_at?: string | null } | null | undefined,
): boolean {
  if (!profile) return false; // No profile row yet — nothing to prompt against.
  if (!("onboarded_at" in profile)) return false; // Database predates the column.
  return profile.onboarded_at == null;
}
