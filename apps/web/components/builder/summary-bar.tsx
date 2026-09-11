"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronUp, X } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { QuotePanel } from "@/components/builder/quote-panel";
import { STEP_FORM_ID } from "@/components/builder/step-nav";
import { Button } from "@/components/ui/button";
import type { QuoteState } from "@/lib/quote-client";

/**
 * Mobile only: a sticky bar with the total, what is due today and Continue; tapping the total
 * opens the full summary as a sheet. Continue submits the current step's form when there is one,
 * otherwise calls `onNext`.
 */
export function SummaryBar({
  departure,
  travelerCount,
  roomIndexes,
  state,
  code,
  onCode,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  departure: CheckoutDeparture;
  travelerCount: number;
  roomIndexes: number[];
  state: QuoteState;
  code: string | null;
  onCode: (code: string | null) => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const quote = state.quote;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function proceed() {
    const form = document.getElementById(STEP_FORM_ID) as HTMLFormElement | null;
    if (form) form.requestSubmit();
    else onNext?.();
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-col items-start text-left"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Total <ChevronUp className="h-3 w-3" aria-hidden />
            </span>
            <span className="font-heading text-lg font-bold leading-tight">
              {quote ? money(quote.total_amount) : "…"}
            </span>
            {quote && (
              <span className="text-xs text-muted-foreground">
                {quote.payment_option === "deposit" ? "Deposit today" : "Due today"}{" "}
                {money(quote.due_now_amount)}
              </span>
            )}
          </button>
          <Button type="button" onClick={proceed} disabled={nextDisabled} size="lg">
            {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your trip summary"
          className="fixed inset-0 z-50 flex items-end bg-ink/50 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t bg-cloud p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-border p-2"
                aria-label="Close summary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <QuotePanel
              departure={departure}
              travelerCount={travelerCount}
              roomIndexes={roomIndexes}
              state={state}
              code={code}
              onCode={onCode}
              compact
            />
          </div>
        </div>
      )}
    </>
  );
}
