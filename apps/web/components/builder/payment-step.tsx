"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { PaymentOption } from "@guideless/utils";
import { formatMoney } from "@guideless/utils";
import type { BuilderDraft } from "@/components/builder/draft";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { startCheckout } from "@/lib/bookings/actions";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** "Review and pay." — deposit or full, a last look, then Stripe's page. */
export function PaymentStep({
  title,
  departure,
  draft,
  userSignedIn,
  onBack,
  onPaymentOption,
}: {
  title: string;
  departure: CheckoutDeparture;
  draft: BuilderDraft;
  userSignedIn: boolean;
  onBack: () => void;
  onPaymentOption: (o: PaymentOption) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const canDeposit = departure.depositAmount > 0;
  const travelers = draft.travelers.slice(0, draft.travelerCount);
  const chosenAddOns = departure.addOns
    .map((a) => {
      const sel = draft.addOns.find((s) => s.addOnId === a.id);
      const qty = sel ? (sel.travelerIndexes?.length ?? sel.quantity ?? 0) : 0;
      return qty > 0 ? { title: a.title, qty, total: a.price_amount * qty } : null;
    })
    .filter((x): x is { title: string; qty: number; total: number } => x !== null);
  const stay = departure.stayOptions.find((s) => s.id === draft.stayOptionId);

  const options = useMemo(
    () =>
      [
        canDeposit && {
          value: "deposit" as const,
          title: `Deposit today (${money(departure.depositAmount)} per traveler)`,
          body:
            chosenAddOns.length > 0
              ? "Extras are paid today too. Balance before departure."
              : "Balance before departure.",
        },
        { value: "full" as const, title: "Pay in full today", body: "Nothing more to pay." },
      ].filter(Boolean) as Array<{ value: PaymentOption; title: string; body: string }>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDeposit, departure.depositAmount, chosenAddOns.length],
  );

  function submit() {
    setError(null);
    if (!draft.emergencyContact || !draft.preferences) {
      setError("Please complete the traveler step first.");
      return;
    }
    track("begin_payment", {
      departure_id: departure.id,
      currency: departure.currency,
      travelers: travelers.length,
    });
    start(async () => {
      const result = await startCheckout({
        departureId: departure.id,
        tourSlug: departure.tourSlug,
        travelers,
        roomIndexes: draft.roomIndexes.slice(0, travelers.length),
        stayOptionId: draft.stayOptionId,
        addOns: draft.addOns,
        code: draft.code ?? undefined,
        groupCode: draft.groupCode ?? undefined,
        emergencyContact: draft.emergencyContact!,
        preferences: draft.preferences!,
        terms: {
          terms: true,
          cancellationPolicy: true,
          travelResponsibility: true,
          privacyPolicy: true,
        },
        paymentOption: draft.paymentOption,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          Card details go to Stripe&rsquo;s secure page. We never see your card.
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">How would you like to pay?</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
              draft.paymentOption === o.value
                ? "border-ink bg-surface"
                : "border-border bg-surface/60",
            )}
          >
            <input
              type="radio"
              name="paymentOption"
              className="mt-1 accent-ink"
              checked={draft.paymentOption === o.value}
              onChange={() => onPaymentOption(o.value)}
            />
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Travelers
        </h2>
        <ul className="mt-3 space-y-1">
          {travelers.map((t, i) => (
            <li key={i}>
              {t.firstName} {t.lastName}
              {t.preferredName ? ` (${t.preferredName})` : ""} · {t.email} · room{" "}
              {draft.roomIndexes[i] ?? i + 1}
            </li>
          ))}
        </ul>
        {stay && (
          <>
            <h2 className="mt-5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Stay
            </h2>
            <p className="mt-2">{stay.name}</p>
          </>
        )}
        <h2 className="mt-5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Extras
        </h2>
        {chosenAddOns.length === 0 ? (
          <p className="mt-2 text-muted-foreground">None yet. Add some later from your account.</p>
        ) : (
          <ul className="mt-2 space-y-1" data-testid="review-add-ons">
            {chosenAddOns.map((a) => (
              <li key={a.title} className="flex justify-between gap-4">
                <span>
                  {a.title}
                  {a.qty > 1 ? ` × ${a.qty}` : ""}
                </span>
                <span>{money(a.total)}</span>
              </li>
            ))}
          </ul>
        )}
        {draft.groupCode && (
          <>
            <h2 className="mt-5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Group
            </h2>
            <p className="mt-2">Joining a friend&rsquo;s group with code {draft.groupCode}.</p>
          </>
        )}
      </div>

      {!userSignedIn && <FormError message="You need to be signed in to pay. Go back one step." />}
      <FormError message={error ?? undefined} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={pending || !userSignedIn}
          data-testid="step-continue"
        >
          {pending ? "Opening secure payment…" : "Continue to secure payment"}{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
