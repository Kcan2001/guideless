"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { AddOnKind } from "@guideless/types";
import { formatDate, formatMoney, formatWallTime } from "@guideless/utils";
import type { AddOnSelection } from "@guideless/validation";
import { OptionCard } from "@/components/builder/option-card";
import { StepNav } from "@/components/builder/step-nav";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Badge } from "@/components/ui/badge";
import type { AddOnWithCounts } from "@/lib/data/extras";
import {
  isSelectedFor,
  quantityOf,
  setQuantity,
  toggleTraveler,
} from "@/lib/bookings/add-on-selection";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<AddOnKind, string> = {
  activity: "Experience",
  ticket: "Ticket",
  transfer: "Transfer",
  dinner: "Dinner",
  extra_night: "Extra night",
  room_upgrade: "Room",
  group_moment: "Group moment",
  insurance: "Insurance",
  extension: "Extension",
  other: "Optional",
};

const GOING_MIN = 3;
const LEFT_MAX = 5;

const INTRO: Record<"race" | "experiences" | "transfers", string> = {
  race: "One per traveler. Pick now, or add later while seats last.",
  experiences: "All optional, paid today, visible to your group.",
  transfers: "Skip this if you’d rather make your own way.",
};

/**
 * Race views, experiences or transfers as selectable cards. Per-traveler add-ons toggle per
 * traveler (a single traveler gets one control); per-booking ones take a quantity. Tier groups are
 * mutually exclusive per traveler; the selection reducers enforce it.
 */
export function AddOnStep({
  title,
  mode,
  departure,
  addOns,
  travelerNames,
  selection,
  onChange,
  onBack,
  onNext,
}: {
  title: string;
  mode: "race" | "experiences" | "transfers";
  departure: CheckoutDeparture;
  addOns: AddOnWithCounts[];
  travelerNames: string[];
  selection: AddOnSelection[];
  onChange: (next: AddOnSelection[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const today = new Date().toISOString().slice(0, 10);
  const n = travelerNames.length;
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    for (const a of addOns) track("addon_viewed", { departure_id: departure.id, add_on_id: a.id });
  }, [addOns, departure.id]);

  const chosen = selection.reduce(
    (sum, s) => sum + (s.travelerIndexes?.length ?? 0) + (s.quantity ?? 0),
    0,
  );

  function emit(a: AddOnWithCounts, selected: boolean) {
    if (mode === "race" && selected) {
      track("race_option_selected", {
        departure_id: departure.id,
        add_on_id: a.id,
        tier: a.tier ?? undefined,
      });
    }
    track(selected ? "add_add_on" : "remove_add_on", {
      departure_id: departure.id,
      add_on_id: a.id,
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 text-muted-foreground">{INTRO[mode]}</p>
      </header>

      <ul
        className={cn("grid gap-5", mode === "race" ? "lg:grid-cols-3" : "md:grid-cols-2")}
        data-testid={`${mode}-options`}
      >
        {addOns.map((a) => {
          const closed = a.bookableUntil < today;
          const soldOut = a.available !== null && a.available <= 0;
          const disabled = closed || soldOut;
          const perTraveler = a.pricing_basis === "per_traveler";
          const count = perTraveler
            ? (selection.find((s) => s.addOnId === a.id)?.travelerIndexes?.length ?? 0)
            : quantityOf(selection, a.id);
          const facts = [
            (a.date || a.day_number) && {
              icon: CalendarDays,
              text: [
                a.date
                  ? formatDate(a.date, "en-US", { weekday: "long", month: "short", day: "numeric" })
                  : null,
                a.day_number ? `Day ${a.day_number}` : null,
                a.start_time
                  ? a.end_time
                    ? `${formatWallTime(a.start_time)}–${formatWallTime(a.end_time)}`
                    : formatWallTime(a.start_time)
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            (a.meeting_point ?? a.location_name) && {
              icon: MapPin,
              text: (a.meeting_point ?? a.location_name)!,
            },
            a.going >= GOING_MIN && { icon: Users, text: `${a.going} from your group are going` },
            {
              icon: Clock,
              text:
                a.cancellable_until_days_before != null && a.cancellable_until_days_before > 0
                  ? `Free cancellation until ${a.cancellable_until_days_before} days before`
                  : "Non-refundable once booked",
            },
          ].filter(Boolean) as Array<{ icon: typeof Clock; text: string }>;

          const control = disabled ? (
            <p className="text-sm text-muted-foreground">
              {soldOut ? "Fully booked." : `Booking closed on ${formatDate(a.bookableUntil)}.`}
            </p>
          ) : perTraveler && n === 1 ? (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ink"
                checked={count > 0}
                onChange={() => {
                  onChange(toggleTraveler(selection, addOns, a.id, 1));
                  emit(a, count === 0);
                }}
              />
              <span className="font-medium">{count > 0 ? "Added" : "Add to my trip"}</span>
            </label>
          ) : perTraveler ? (
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Who’s in{mode === "race" ? " · one view per traveler" : ""}
              </legend>
              <ul className="flex flex-wrap gap-2">
                {travelerNames.map((name, i) => {
                  const idx = i + 1;
                  const on = isSelectedFor(selection, a.id, idx);
                  const room = a.available === null || on || count < a.available;
                  return (
                    <li key={idx}>
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm",
                          on ? "border-ink bg-ink text-cloud" : "border-border bg-surface",
                          !room && !on && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          disabled={!room && !on}
                          onChange={() => {
                            onChange(toggleTraveler(selection, addOns, a.id, idx));
                            emit(a, !on);
                          }}
                        />
                        {name || `Traveler ${idx}`}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <div className="flex items-center gap-3">
              <label htmlFor={`qty-${a.id}`} className="text-sm font-medium">
                Quantity
              </label>
              <select
                id={`qty-${a.id}`}
                className="rounded border border-border bg-surface px-3 py-1.5 text-sm"
                value={count}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  onChange(setQuantity(selection, addOns, a.id, q));
                  emit(a, q > 0);
                }}
              >
                {Array.from({ length: Math.min(a.available ?? 8, 8) + 1 }, (_, q) => q).map((q) => (
                  <option key={q} value={q}>
                    {q === 0 ? "None" : q}
                  </option>
                ))}
              </select>
            </div>
          );

          return (
            <li key={a.id}>
              <OptionCard
                id={a.id}
                title={a.title}
                eyebrow={KIND_LABEL[a.kind]}
                tier={a.tier}
                label={a.label}
                image={a.image_urls[0]}
                price={money(a.price_amount)}
                priceNote={perTraveler ? "per person" : "per booking"}
                status={
                  soldOut ? (
                    <Badge variant="danger">Sold out</Badge>
                  ) : closed ? (
                    <Badge variant="neutral">Sales closed</Badge>
                  ) : a.available !== null && a.available <= LEFT_MAX ? (
                    <Badge variant="warning">{a.available} left</Badge>
                  ) : null
                }
                facts={facts}
                description={a.description}
                includes={a.includes}
                excludes={a.excludes}
                whyPriceNote={a.why_price_note}
                selected={count > 0}
                disabled={disabled}
                control={control}
                footnote={a.min_age != null && a.min_age > 0 ? `Ages ${a.min_age}+` : null}
              />
            </li>
          );
        })}
      </ul>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={
          chosen === 0 ? (mode === "race" ? "Decide later" : "Continue without") : "Continue"
        }
      />
    </div>
  );
}
