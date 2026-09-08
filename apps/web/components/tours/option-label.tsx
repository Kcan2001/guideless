import type { OptionLabel } from "@guideless/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";

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
