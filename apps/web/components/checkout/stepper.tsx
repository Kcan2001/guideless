import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const CHECKOUT_STEPS = [
  "Departure",
  "Travelers",
  "Preferences",
  "Account",
  "Terms",
  "Payment",
  "Confirmation",
] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
      aria-label="Checkout progress"
    >
      {CHECKOUT_STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={label}
            className="flex items-center gap-2"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-heading text-[11px] font-bold",
                state === "done" && "bg-aqua text-ink",
                state === "current" && "bg-ink text-cloud",
                state === "todo" && "border border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                state === "todo" ? "text-muted-foreground" : "font-medium text-foreground",
                "hidden sm:inline",
              )}
            >
              {label}
            </span>
            {i < CHECKOUT_STEPS.length - 1 && (
              <span aria-hidden className="hidden h-px w-4 bg-border lg:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
