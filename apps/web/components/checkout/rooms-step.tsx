"use client";

import { ArrowLeft, ArrowRight, BedDouble, Users } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { TierBadge } from "@/components/tours/option-label";
import { Button } from "@/components/ui/button";
import { ownRoom, roomOccupancy, shareRoom } from "@/lib/bookings/add-on-selection";
import { cn } from "@/lib/utils";

/**
 * Rooms & stay. Everyone gets their own room unless they choose to share (two per room).
 * Stay tiers are radio cards; the delta is per traveler and the quote in the sidebar does the math.
 */
export function RoomsStep({
  departure,
  travelerNames,
  rooms,
  stayOptionId,
  onRooms,
  onStay,
  onBack,
  onNext,
}: {
  departure: CheckoutDeparture;
  travelerNames: string[];
  rooms: number[];
  stayOptionId: string | null;
  onRooms: (rooms: number[]) => void;
  onStay: (id: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const occupancy = roomOccupancy(rooms);
  const saving = departure.sharedRoomDiscountAmount;
  const hasStays = departure.stayOptions.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Rooms and stay.</h1>
        <p className="mt-2 text-muted-foreground">
          Your own room is the default. Two travelers can share if they&rsquo;d like
          {saving > 0 ? ` and each save ${money(saving)}` : ""}.
        </p>
      </header>

      <section
        aria-labelledby="rooms-heading"
        className="rounded-xl border border-border bg-surface p-6"
      >
        <h2
          id="rooms-heading"
          className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Rooms
        </h2>
        <ul className="mt-4 space-y-3">
          {[...occupancy.entries()].map(([room, travelers]) => (
            <li
              key={room}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sand">
                  {travelers.length === 2 ? (
                    <Users className="h-4 w-4" aria-hidden />
                  ) : (
                    <BedDouble className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="font-medium">
                    Room {room} · {travelers.length === 2 ? "shared" : "own room"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {travelers.map((i) => travelerNames[i] || `Traveler ${i + 1}`).join(" and ")}
                  </p>
                </div>
              </div>
              {travelers.length === 2 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onRooms(ownRoom(rooms, travelers[1]!))}
                >
                  Separate rooms
                </Button>
              )}
            </li>
          ))}
        </ul>

        {rooms.length > 1 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-medium">Share a room</p>
            <p className="text-sm text-muted-foreground">
              Pick who shares. Two per room, one bed or two — tell us in preferences.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rooms.map((room, i) =>
                rooms.map((other, j) => {
                  if (j <= i || room === other) return null;
                  if (occupancy.get(room)!.length > 1 || occupancy.get(other)!.length > 1)
                    return null;
                  return (
                    <li key={`${i}-${j}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="border border-border"
                        onClick={() => onRooms(shareRoom(rooms, j, i))}
                      >
                        {travelerNames[i] || `Traveler ${i + 1}`} +{" "}
                        {travelerNames[j] || `Traveler ${j + 1}`}
                        {saving > 0 ? ` · save ${money(saving * 2)}` : ""}
                      </Button>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        )}
      </section>

      {hasStays && (
        <fieldset className="rounded-xl border border-border bg-surface p-6">
          <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Where you&rsquo;ll stay
          </legend>
          <p className="text-sm text-muted-foreground">
            One group, your choice of hotel. Prices are per traveler on top of the trip price.
          </p>
          <div className="mt-4 grid gap-3">
            {departure.stayOptions.map((s) => {
              const selected = stayOptionId === s.id;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
                    selected ? "border-ink bg-surface" : "border-border bg-surface/60",
                  )}
                >
                  <input
                    type="radio"
                    name="stayOption"
                    className="mt-1 accent-ink"
                    checked={selected}
                    onChange={() => onStay(s.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        <TierBadge tier={s.tier} />
                        {s.name}
                        {s.star_rating ? (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {"★".repeat(s.star_rating)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm font-medium">
                        {s.price_delta_amount === 0
                          ? "Included"
                          : `${s.price_delta_amount > 0 ? "+" : "−"}${money(Math.abs(s.price_delta_amount))} per traveler`}
                      </span>
                    </span>
                    {s.area && (
                      <span className="block text-sm text-muted-foreground">{s.area}</span>
                    )}
                    {s.description && <span className="mt-1 block text-sm">{s.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="button" size="lg" onClick={onNext}>
          Continue <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
