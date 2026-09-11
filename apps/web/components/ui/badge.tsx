import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Badges follow the buttons: Archivo in caps, 4px, no pills. A 999px badge beside a 4px card was
 * the loudest inconsistency on any page that had both.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-2 py-0.5 font-heading text-[11px] font-extrabold uppercase tracking-[0.1em] whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-sand text-foreground",
        included: "bg-aqua/25 text-ink",
        optional: "border border-border text-muted-foreground",
        guideless: "bg-ink text-cloud",
        traveler: "border border-teal text-ink",
        info: "bg-info-surface text-info",
        warning: "bg-warning-surface text-warning",
        danger: "bg-danger-surface text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
