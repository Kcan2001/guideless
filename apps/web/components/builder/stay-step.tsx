"use client";

import { BedDouble, Building2, Coffee, Info, MapPin, TrainFront } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import { OptionCard } from "@/components/builder/option-card";
import { StepNav } from "@/components/builder/step-nav";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { TierLegend } from "@/components/tours/tier-legend";
import { StayScarcity } from "@/components/tours/stay-scarcity";
import { StayHotelPanel } from "@/components/tours/stay-hotel-panel";
import { stayDetails } from "@/lib/data/extras-shared";

/** "Where do you want to stay?" — one tier per booking; a radio group of cards. */
export function StayStep({
  title,
  departure,
  stayOptionId,
  onStay,
  onBack,
  onNext,
}: {
  title: string;
  departure: CheckoutDeparture;
  stayOptionId: string | null;
  onStay: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const saving = departure.sharedRoomDiscountAmount;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          The first option is in the price. Upgrade if you want to.
          {saving > 0 ? ` Two sharing a room each save ${money(saving)}.` : ""}
        </p>
      </header>

      <TierLegend />

      <fieldset>
        <legend className="sr-only">Where you stay</legend>
        <div className="grid gap-5 md:grid-cols-2" role="radiogroup" data-testid="stay-tiers">
          {departure.stayOptions.map((o) => {
            const d = stayDetails(o);
            const selected = stayOptionId === o.id;
            const facts = [
              d.neighborhood && { icon: MapPin, text: d.neighborhood },
              d.stationDistance && { icon: TrainFront, text: d.stationDistance },
              d.trainTime && { icon: TrainFront, text: d.trainTime },
              d.breakfast && { icon: Coffee, text: `Breakfast: ${d.breakfast}` },
              d.roomType && { icon: BedDouble, text: d.roomType },
              o.hotel && { icon: Building2, text: o.hotel.name },
            ].filter(Boolean) as Array<{ icon: typeof MapPin; text: string }>;
            const inputId = `stay-${o.id}`;
            return (
              <OptionCard
                key={o.id}
                id={o.id}
                title={o.name}
                eyebrow={o.area ?? (o.is_default ? "Included in the base trip" : null)}
                tier={o.tier}
                label={o.label}
                image={o.image_urls[0]}
                imageAlt={`${o.name}${o.area ? `, ${o.area}` : ""}`}
                price={
                  o.price_delta_amount === 0
                    ? "Included"
                    : `${o.price_delta_amount > 0 ? "+" : "−"}${money(Math.abs(o.price_delta_amount))}`
                }
                priceNote={o.price_delta_amount === 0 ? null : "per person"}
                facts={facts}
                description={o.tagline ?? o.description}
                includes={o.includes}
                excludes={o.excludes}
                whyPriceNote={o.why_price_note}
                status={
                  <StayScarcity
                    spotsLeft={o.spotsLeft}
                    isLimited={o.isLimited}
                    soldOut={o.soldOut}
                    allocationHeld={d.hotelConfirmed}
                  />
                }
                selected={selected}
                footnote={
                  !d.hotelConfirmed ? (
                    <span className="inline-flex items-start gap-1.5">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Property confirmed at booking; named in your confirmation.
                    </span>
                  ) : null
                }
                control={
                  <label htmlFor={inputId} className="flex cursor-pointer items-center gap-3">
                    <input
                      id={inputId}
                      type="radio"
                      name="stayOption"
                      className="h-4 w-4 accent-ink"
                      checked={selected}
                      onChange={() => onStay(o.id)}
                    />
                    <span className="font-medium">{selected ? "Selected" : "Choose this"}</span>
                  </label>
                }
              >
                {o.hotel && <StayHotelPanel hotel={o.hotel} confirmed={d.hotelConfirmed} />}
              </OptionCard>
            );
          })}
        </div>
      </fieldset>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!stayOptionId} />
    </div>
  );
}
