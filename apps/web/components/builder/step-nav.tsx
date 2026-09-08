"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Back / Continue for a builder step. `form` links the Continue button to a form elsewhere on the
 * page (the sticky mobile bar uses `requestSubmit()` on the same form id).
 */
export function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  submit = false,
}: {
  onBack: (() => void) | null;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Render Continue as the form's submit button instead of calling `onNext`. */
  submit?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
      ) : (
        <span />
      )}
      <Button
        type={submit ? "submit" : "button"}
        size="lg"
        onClick={submit ? undefined : onNext}
        disabled={nextDisabled}
        data-testid="step-continue"
      >
        {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Every step form carries this id so the mobile summary bar can submit it. */
export const STEP_FORM_ID = "builder-step";
