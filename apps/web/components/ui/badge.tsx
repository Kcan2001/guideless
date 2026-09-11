import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
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
