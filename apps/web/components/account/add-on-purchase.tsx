"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import type { Currency } from "@guideless/types";
import { formatMoney } from "@guideless/utils";
import type { AddOnSelection } from "@guideless/validation";
import { AddOnPicker } from "@/components/checkout/add-on-picker";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { startAddOnPurchase } from "@/lib/bookings/actions";
import { problemMessage, toggleTraveler, setQuantity } from "@/lib/bookings/add-on-selection";
import type { AddOnWithCounts } from "@/lib/data/extras";
import { useBookingQuote } from "@/lib/quote-client";

/**
 * "Add to your trip" after booking. Prices come from `quote_booking()` on the booking's own room
 * layout with codes and credit switched off (the base trip is untouched); add-ons are paid in full.
 */
export function AddOnPurchase({
  bookingId,
  departureId,
  currency,
  startDate,
  roomIndexes,
  travelerNames,
  addOns,
  preselect,
  paymentsReady,
}: {
  bookingId: string;
  departureId: string;
  currency: Currency;
  startDate: string;
  roomIndexes: number[];
  travelerNames: string[];
  addOns: AddOnWithCounts[];
  preselect: string | null;
  paymentsReady: boolean;
}) {
  const [selection, setSelection] = useState<AddOnSelection[]>(() => {
    const target = preselect ? addOns.find((a) => a.id === preselect) : null;
    if (!target) return [];
    if (target.pricing_basis === "per_booking") return setQuantity([], addOns, target.id, 1);
    return travelerNames.reduce<AddOnSelection[]>(
      (sel, _n, i) => toggleTraveler(sel, addOns, target.id, i + 1),
      [],
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { quote, pending: quoting } = useBookingQuote(
    selection.length
      ? {
          departureId,
          roomIndexes,
          stayOptionId: null,
          addOns: selection,
          code: null,
          paymentOption: "full",
          applyCredit: false,
        }
      : null,
  );
  const money = (amount: number) => formatMoney({ amount, currency }, { compact: true });
  const total = selection.length ? (quote?.add_ons_amount ?? null) : 0;
  const problems = selection.length ? (quote?.problems ?? []) : [];

  function submit() {
    setError(null);
    start(async () => {
      const result = await startAddOnPurchase({ bookingId, addOns: selection });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <AddOnPicker
        addOns={addOns}
        currency={currency}
        startDate={startDate}
        travelerNames={travelerNames}
        selection={selection}
        onChange={setSelection}
      />
      <aside
        className="rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-6 lg:self-start"
        aria-live="polite"
      >
        <h2 className="font-heading text-lg font-semibold">Your additions</h2>
        {selection.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing selected yet.</p>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            {(quote?.lines ?? [])
              .filter((l) => l.kind === "add_on")
              .map((l, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {l.title}
                    {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  </dt>
                  <dd>{money(l.total_amount)}</dd>
                </div>
              ))}
            <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
              <dt>Due today</dt>
              <dd className="font-heading text-lg" data-testid="purchase-total">
                {total === null ? "…" : money(total)}
              </dd>
            </div>
          </dl>
        )}
        {problems.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-danger" role="alert">
            {problems.map((p, i) => (
              <li key={i}>{problemMessage(p)}</li>
            ))}
          </ul>
        )}
        <FormError message={error ?? undefined} />
        <Button
          type="button"
          size="lg"
          className="mt-5 w-full"
          onClick={submit}
          disabled={
            !paymentsReady || pending || quoting || selection.length === 0 || problems.length > 0
          }
        >
          {pending
            ? "Opening secure payment…"
            : paymentsReady
              ? "Pay and add to my trip"
              : "Payment opens soon"}{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Paid in full today on Stripe&rsquo;s secure page. Each add-on lists its own cancellation
          deadline; your trip balance is unchanged.
        </p>
      </aside>
    </div>
  );
}
