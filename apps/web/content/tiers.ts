import type { OptionTier } from "@guideless/types";

/**
 * The four public tiers (migration 040). Every trip starts at the bare minimum; travelers pick a
 * tier for where they stay and for each tiered add-on. Definitions are Kyle's, verbatim.
 */
export interface TierCopy {
  tier: OptionTier;
  name: string;
  definition: string;
}

export const TIERS: readonly TierCopy[] = [
  {
    tier: "explorer",
    name: "Explorer",
    definition: "Best price. More basic accommodation. Maximum value.",
  },
  { tier: "classic", name: "Classic", definition: "The standard Guideless experience." },
  { tier: "premium", name: "Premium", definition: "Better hotels and upgraded experiences." },
  { tier: "elite", name: "Elite", definition: "Luxury. The best available." },
] as const;

export function tierName(tier: OptionTier): string {
  return TIERS.find((t) => t.tier === tier)?.name ?? tier;
}
