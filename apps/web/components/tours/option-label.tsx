import type { OptionLabel, OptionTier } from "@guideless/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { tierName } from "@/content/tiers";
import { cn } from "@/lib/utils";

/** Staff-chosen labels on stay tiers and add-ons (migration 039). Never derived from data. */
const LABELS: Record<OptionLabel, { text: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  best_value: { text: "Best value", variant: "included" },
  most_popular: { text: "Most popular", variant: "info" },
  social: { text: "Social", variant: "traveler" },
  luxury: { text: "Luxury", variant: "guideless" },
};

export function optionLabelText(label: OptionLabel): string {
  return LABELS[label].text;
}

export function OptionLabelBadge({
  label,
  className,
}: {
  label: OptionLabel | null | undefined;
  className?: string;
}) {
  if (!label) return null;
  const { text, variant } = LABELS[label];
  return (
    <Badge variant={variant} className={className}>
      {text}
    </Badge>
  );
}

/**
 * Public tier (Explorer / Classic / Premium / Elite, migration 040). Same treatment everywhere:
 * an ink-outlined, uppercase, tracked eyebrow, always top-left of the card it belongs to.
 * Untiered options (a transfer, a dinner) render nothing.
 */
export function TierBadge({
  tier,
  className,
}: {
  tier: OptionTier | null | undefined;
  className?: string;
}) {
  if (!tier) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-ink bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink",
        className,
      )}
      data-tier={tier}
    >
      {tierName(tier)}
    </span>
  );
}
