"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Currency } from "@guideless/types";
import { formatDate, formatMoney, formatWallTime } from "@guideless/utils";
import type { AddOnSelection } from "@guideless/validation";
import { TierBadge } from "@/components/tours/option-label";
import { Badge } from "@/components/ui/badge";
import type { AddOnWithCounts } from "@/lib/data/extras";
import {
  isSelectedFor,
  quantityOf,
  setQuantity,
  toggleTraveler,
} from "@/lib/bookings/add-on-selection";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  activity: "Experience",
  ticket: "Ticket",
  transfer: "Transfer",
  dinner: "Dinner",
  extra_night: "Extra night",
  room_upgrade: "Room",
  other: "Add-on",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The "make it yours" picker, shared by the checkout step and the account "Add to your trip" page.
 * Per-traveler add-ons toggle per traveler; per-booking ones take a quantity. Options in the same
 * tier group are a choose-one set. Everything is optional, and it says so.
 */
export function AddOnPicker({
  addOns,
  currency,
  startDate,
  travelerNames,
  selection,
  onChange,
  todayISO = new Date().toISOString().slice(0, 10),
  onToggleEvent,
}: {
  addOns: AddOnWithCounts[];
  currency: Currency;
  startDate: string;
  travelerNames: string[];
  selection: AddOnSelection[];
  onChange: (next: AddOnSelection[]) => void;
  todayISO?: string;
  onToggleEvent?: (addOnId: string, selected: boolean) => void;
}) {
  const money = (amount: number) => formatMoney({ amount, currency }, { compact: true });
  const groups = groupByTier(addOns);

  if (addOns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Nothing extra to add for this departure. The included experiences are already yours.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group.key} className="space-y-3">
          {group.tier && (
            <legend className="mb-1 text-sm font-medium">
              {group.label}{" "}
              <span className="font-normal text-muted-foreground">· choose one per traveler</span>
            </legend>
          )}
          {group.items.map((a) => {
            const closed = todayISO > a.bookableUntil;
            const soldOut = a.available !== null && a.available <= 0;
            const disabled = closed || soldOut;
            const date = a.day_number ? addDays(startDate, a.day_number - 1) : null;
            const perTraveler = a.pricing_basis === "per_traveler";
            const chosenCount = perTraveler
              ? (selection.find((s) => s.addOnId === a.id)?.travelerIndexes?.length ?? 0)
              : quantityOf(selection, a.id);
            return (
              <article
                key={a.id}
                aria-labelledby={`addon-${a.id}-title`}
                className={cn(
                  "rounded-xl border p-5",
                  chosenCount > 0 ? "border-ink bg-surface" : "border-border bg-surface/60",
                  disabled && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={a.tier} />
                      <Badge variant="optional">{KIND_LABEL[a.kind] ?? "Add-on"}</Badge>
                      {a.is_featured && <Badge variant="included">Popular</Badge>}
                      {a.going > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" aria-hidden /> {a.going} going
                        </span>
                      )}
                    </div>
                    <h3
                      id={`addon-${a.id}-title`}
                      className="mt-2 font-heading text-lg font-semibold"
                    >
                      {a.title}
                    </h3>
                    {a.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          Day {a.day_number} · {formatDate(date)}
                          {a.start_time ? ` · ${formatWallTime(a.start_time)}` : ""}
                        </span>
                      )}
                      {a.location_name && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden /> {a.location_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-lg font-bold">{money(a.price_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {perTraveler ? "per traveler" : "per booking"}
                    </p>
                    {a.available !== null && !soldOut && a.available <= 5 && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {a.available} left
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  {closed ? (
                    <p className="text-sm text-muted-foreground">
                      Booking closed on {formatDate(a.bookableUntil)}.
                    </p>
                  ) : soldOut ? (
                    <p className="text-sm text-muted-foreground">Fully booked.</p>
                  ) : perTraveler ? (
                    <ul className="flex flex-wrap gap-2">
                      {travelerNames.map((name, i) => {
                        const idx = i + 1;
                        const on = isSelectedFor(selection, a.id, idx);
                        const capacityLeft =
                          a.available === null || on || chosenCount < a.available;
                        return (
                          <li key={idx}>
                            <label
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                                on ? "border-ink bg-ink text-cloud" : "border-border bg-surface",
                                !capacityLeft && !on && "cursor-not-allowed opacity-50",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={on}
                                disabled={!capacityLeft && !on}
                                onChange={() => {
                                  onChange(toggleTraveler(selection, addOns, a.id, idx));
                                  onToggleEvent?.(a.id, !on);
                                }}
                              />
                              {name || `Traveler ${idx}`}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label htmlFor={`qty-${a.id}`} className="text-sm">
                        Quantity
                      </label>
                      <select
                        id={`qty-${a.id}`}
                        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                        value={chosenCount}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          onChange(setQuantity(selection, addOns, a.id, q));
                          onToggleEvent?.(a.id, q > 0);
                        }}
                      >
                        {Array.from({ length: Math.min(a.available ?? 8, 8) + 1 }, (_, q) => q).map(
                          (q) => (
                            <option key={q} value={q}>
                              {q === 0 ? "None" : q}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

function groupByTier(addOns: AddOnWithCounts[]) {
  const out: { key: string; tier: string | null; label: string; items: AddOnWithCounts[] }[] = [];
  for (const a of addOns) {
    const key = a.tier_group ? `tier:${a.tier_group}` : `single:${a.id}`;
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        tier: a.tier_group,
        label: a.tier_group
          ? a.tier_group.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
          : "",
        items: [],
      };
      out.push(g);
    }
    g.items.push(a);
  }
  return out;
}
