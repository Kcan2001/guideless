"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { AddOnSelection } from "@guideless/validation";
import { AddOnPicker } from "@/components/checkout/add-on-picker";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Button } from "@/components/ui/button";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Step: Add-ons. Optional by design; the sidebar quote updates as things are toggled. */
export function AddOnsStep({
  departure,
  travelerNames,
  selection,
  onChange,
  onBack,
  onNext,
}: {
  departure: CheckoutDeparture;
  travelerNames: string[];
  selection: AddOnSelection[];
  onChange: (next: AddOnSelection[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const count = selection.reduce(
    (n, s) => n + (s.travelerIndexes?.length ?? 0) + (s.quantity ?? 0),
    0,
  );
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Make it yours.</h1>
        <p className="mt-2 text-muted-foreground">
          Everything here is optional and paid today. See who else from the group is in, and add
          more later from your account or the app, even during the trip.
        </p>
      </header>

      <AddOnPicker
        addOns={departure.addOns}
        currency={departure.currency}
        startDate={departure.startDate}
        travelerNames={travelerNames}
        selection={selection}
        onChange={onChange}
        onToggleEvent={(addOnId, selected) =>
          // Event names live in lib/analytics.ts (owned elsewhere); cast until they are added there.
          track((selected ? "add_add_on" : "remove_add_on") as AnalyticsEvent, {
            departure_id: departure.id,
            add_on_id: addOnId,
          })
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="button" size="lg" onClick={onNext}>
          {count === 0 ? "Continue without add-ons" : "Continue"}{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
