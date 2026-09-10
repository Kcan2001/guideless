"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small (i) that opens a short explanation.
 *
 * Built on <details>/<summary> rather than a popover library: it is keyboard operable and screen-
 * reader announced for free, it works before hydration, and it needs no dependency. The panel is
 * positioned absolutely so opening it does not shove the card's layout around, and it is capped in
 * width so a long caveat stays readable.
 *
 * Used for the things a traveler would reasonably assume we had nailed down and we have not:
 * how many places we can really deliver, and whether a supplier is contracted.
 */
export function InfoNote({
  label,
  children,
  className,
  align = "right",
}: {
  /** Accessible name for the trigger, e.g. "Why only four places?". */
  label: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <details className={cn("group relative inline-block align-middle", className)}>
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center rounded-full text-muted-foreground transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </summary>
      <div
        role="note"
        className={cn(
          "absolute z-20 mt-2 w-64 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted-foreground shadow-lg",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}
