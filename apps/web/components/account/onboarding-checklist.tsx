import Link from "next/link";
import type { Route } from "next";
import { Check, Circle } from "lucide-react";
import type { OnboardingStep } from "@/lib/bookings/onboarding";
import { cn } from "@/lib/utils";

/**
 * Pre-trip checklist for one booking (spec §85). Calm by design: done items are quiet, the next
 * open item is the only thing that asks for attention. Links to in-page anchors or the trip.
 */
export function OnboardingChecklist({
  steps,
  tourName,
}: {
  steps: OnboardingStep[];
  tourName: string;
}) {
  const nextOpen = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section
      aria-labelledby="onboarding-heading"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="onboarding-heading" className="font-heading text-lg font-semibold">
          Before {tourName}
        </h3>
        <p className="text-sm text-muted-foreground">
          {doneCount} of {steps.length} done
          {nextOpen ? "" : " · you're all set"}
        </p>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => {
          const isNext = step === nextOpen;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.done
                    ? "border-aqua bg-aqua text-ink"
                    : isNext
                      ? "border-ink text-ink"
                      : "border-border text-muted-foreground",
                )}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done && "text-muted-foreground line-through decoration-border",
                  )}
                >
                  {step.label}
                  <span className="sr-only">{step.done ? " (done)" : isNext ? " (next)" : ""}</span>
                </p>
                <p className="text-sm text-muted-foreground">{step.hint}</p>
              </div>
              {!step.done && step.href && (
                <Link
                  href={step.href as Route}
                  className={cn(
                    "shrink-0 text-sm font-medium no-underline hover:underline",
                    isNext ? "text-link" : "text-muted-foreground",
                  )}
                >
                  {step.href.startsWith("/trips/") ? "Open" : "Go"}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
