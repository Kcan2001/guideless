"use client";

import { CalendarDays, Users } from "lucide-react";
import type { Currency } from "@guideless/types";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { StepNav } from "@/components/builder/step-nav";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface BuilderDepartureSummary {
  id: string;
  startDate: string;
  endDate: string;
  priceAmount: number;
  depositAmount: number;
  currency: Currency;
  available: number;
  guaranteed: boolean;
}

/**
 * "When do you want to go?" — the departure and how many are coming. The count is asked here so
 * per-traveler choices on the next steps can be made before names are typed.
 */
export function DepartureStep({
  title,
  departures,
  selectedId,
  travelerCount,
  onSelect,
  onTravelerCount,
  onNext,
}: {
  title: string;
  departures: BuilderDepartureSummary[];
  selectedId: string;
  travelerCount: number;
  onSelect: (id: string) => void;
  onTravelerCount: (n: number) => void;
  onNext: () => void;
}) {
  const selected = departures.find((d) => d.id === selectedId);
  const soldOut = !selected || selected.available <= 0;
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 text-muted-foreground">Prices are per traveler in their own room.</p>
      </header>

      <fieldset>
        <legend className="sr-only">Departure</legend>
        <ul className="grid gap-3" data-testid="departure-options">
          {departures.map((d) => {
            const isSelected = d.id === selectedId;
            const gone = d.available <= 0;
            return (
              <li key={d.id}>
                <label
                  className={cn(
                    "flex cursor-pointer flex-wrap items-center gap-4 rounded border bg-surface p-5",
                    isSelected ? "border-ink ring-1 ring-ink" : "border-border",
                    gone && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="departure"
                    className="accent-ink"
                    checked={isSelected}
                    disabled={gone}
                    onChange={() => onSelect(d.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {formatDateRange(d.startDate, d.endDate)}
                    </span>
                    {d.depositAmount > 0 && (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatMoney(
                          { amount: d.depositAmount, currency: d.currency },
                          { compact: true },
                        )}{" "}
                        deposit today
                      </span>
                    )}
                  </span>
                  {gone ? (
                    <Badge variant="danger">Sold out</Badge>
                  ) : d.guaranteed ? (
                    <Badge variant="included">Guaranteed · {d.available} left</Badge>
                  ) : d.available <= 5 ? (
                    <Badge variant="warning">{d.available} left</Badge>
                  ) : null}
                  <span className="text-right">
                    <span className="block font-heading text-xl font-bold">
                      {formatMoney(
                        { amount: d.priceAmount, currency: d.currency },
                        { compact: true },
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">per traveler</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="rounded border border-border bg-surface p-6">
        <label htmlFor="traveler-count" className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> How many travelers?
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone on one booking pays together. Friends who pay separately book on their own and
          join your group with a trip code.
        </p>
        <Select
          id="traveler-count"
          className="mt-3 w-40"
          value={travelerCount}
          onChange={(e) => onTravelerCount(Number(e.target.value))}
        >
          {Array.from(
            { length: Math.min(8, Math.max(1, selected?.available ?? 8)) },
            (_, i) => i + 1,
          ).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "traveler" : "travelers"}
            </option>
          ))}
        </Select>
      </div>

      <StepNav onBack={null} onNext={onNext} nextDisabled={soldOut} />
    </div>
  );
}
