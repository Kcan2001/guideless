"use client";

import { Check } from "lucide-react";
import type { BuilderStep, BuilderStepKey } from "@/lib/bookings/builder-steps";
import { cn } from "@/lib/utils";

/** Progress through the derived steps. Completed steps are buttons so a traveler can go back. */
export function BuilderProgress({
  steps,
  current,
  onSelect,
}: {
  steps: BuilderStep[];
  current: BuilderStepKey;
  onSelect: (key: BuilderStepKey) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
      aria-label="Trip builder progress"
    >
      {steps.map((s, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
        const inner = (
          <>
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
                "hidden sm:inline",
                state === "todo" ? "text-muted-foreground" : "font-medium text-foreground",
              )}
            >
              {s.short}
            </span>
          </>
        );
        return (
          <li
            key={s.key}
            className="flex items-center gap-2"
            aria-current={state === "current" ? "step" : undefined}
          >
            {state === "done" ? (
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                className="flex items-center gap-2 rounded-md hover:underline"
              >
                {inner}
              </button>
            ) : (
              <span className="flex items-center gap-2">{inner}</span>
            )}
            {i < steps.length - 1 && (
              <span aria-hidden className="hidden h-px w-4 bg-border lg:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
