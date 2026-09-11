import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand buttons (docs/design-system.md, "The direction, decided 2026-09-10").
 *
 * Archivo in caps, one 4px radius, and **aqua is the primary button**. Aqua used to be decoration
 * that failed AA the moment anyone set it as text; on ink it is 10.4:1 and on a button it carries
 * ink text at 12:1, so this is the first place the brand colour does real work. One primary per
 * screen — a page with four aqua buttons has no primary button.
 *
 * `link` stays in sentence case: it is prose that happens to be interactive, and shouting a
 * sentence is worse than not shouting at all.
 *
 * Use `buttonVariants()` directly on <Link> for navigation.
 */
export const buttonVariants = cva(
  // No `whitespace-nowrap`, and heights are minimums rather than fixed. A button with a long label
  // used to run off the side of the page instead of wrapping — the home page scrolled sideways at
  // 390px because one link's label is a whole sentence. A short label never wraps anyway, so this
  // costs nothing and removes a whole class of overflow.
  "inline-flex max-w-full items-center justify-center gap-2 text-balance rounded font-heading font-extrabold uppercase tracking-[0.06em] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/85",
        secondary: "border border-ink text-foreground hover:bg-sand/60",
        accent: "bg-accent text-accent-foreground hover:bg-accent/85",
        ghost: "text-foreground hover:bg-sand/60",
        link: "text-link normal-case tracking-normal font-sans font-medium underline-offset-4 hover:underline hover:text-link-hover",
        inverse: "bg-cloud text-ink hover:bg-white",
        /** On an ink band, where sand borders vanish and aqua would be a second primary. */
        outline: "border border-border-dark text-cloud hover:bg-cloud/10",
      },
      size: {
        sm: "min-h-9 px-3.5 py-1.5 text-xs",
        md: "min-h-11 px-5 py-2 text-sm",
        lg: "min-h-13 px-7 py-2.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
