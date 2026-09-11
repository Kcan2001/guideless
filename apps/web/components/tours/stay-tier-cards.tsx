import Image from "next/image";
import { BedDouble, Check, Coffee, MapPin, Minus, TrainFront } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { DetailModal } from "@/components/tours/detail-modal";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { PricedAsOf } from "@/components/tours/priced-as-of";
import { StayScarcity } from "@/components/tours/stay-scarcity";
import { stayDetails, type StayOption } from "@/lib/data/extras";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn, gridColumns } from "@/lib/utils";

function money(amount: number, currency: Currency) {
  return formatMoney({ amount, currency }, { compact: true });
}

/**
 * Accommodation tiers on the tour page: what each price band *means*, not which hotel you get.
 *
 * The tour page and the builder answer different questions. Somebody reading the tour page is
 * deciding whether this trip is for them and which budget they are in; somebody in the builder has
 * decided and is choosing a room. Naming the property here answered the second question to a person
 * still asking the first, and it cost us twice: four carousels of hotel photography above the fold
 * pushed the price below it, and a named hotel on a marketing page is a promise about inventory we
 * only actually hold once a tier is linked and in date.
 *
 * So the card shows the band — the area, the character of the tier, what it includes, the price and
 * how many places are left — over the tier's own photograph of the *place*. The properties, their
 * photographs, their addresses and their amenities are one step further in, in the builder, where
 * they are a choice rather than a claim.
 *
 * There is no per-card call to action. Choosing happens in the builder, and four buttons that all
 * go to the same page is four chances to answer "which one?" before anyone has seen the rooms.
 */
export function StayTierCards({
  options,
  currency,
  sharedRoomDiscountAmount,
}: {
  options: StayOption[];
  currency: Currency;
  /** Departure-level saving per traveler when two share; a tier may override it. */
  sharedRoomDiscountAmount: number;
}) {
  if (options.length === 0) return null;
  return (
    <ul className={cn("grid gap-6", gridColumns(options.length))} data-testid="stay-tiers">
      {options.map((o) => {
        const d = stayDetails(o);
        const saving = o.shared_room_discount_amount ?? sharedRoomDiscountAmount;

        // The tier's own photograph of the area. Deliberately NOT the hotel gallery — see above.
        const image = o.image_urls[0] ?? null;

        const allFacts: Array<{ icon: typeof MapPin; label: string; value: string }> = [];
        if (d.neighborhood) allFacts.push({ icon: MapPin, label: "Where", value: d.neighborhood });
        if (d.stationDistance)
          allFacts.push({ icon: TrainFront, label: "Station", value: d.stationDistance });
        if (d.trainTime)
          allFacts.push({ icon: TrainFront, label: "To the action", value: d.trainTime });
        if (d.breakfast) allFacts.push({ icon: Coffee, label: "Breakfast", value: d.breakfast });
        if (d.roomType) allFacts.push({ icon: BedDouble, label: "Room", value: d.roomType });

        // Three on the card. The rest are in the sheet.
        const summaryFacts = allFacts.slice(0, 3);

        return (
          <li
            key={o.id}
            className={cn(
              "flex flex-col overflow-hidden rounded border bg-surface",
              o.is_default ? "border-ink" : "border-border",
            )}
          >
            {image && (
              <div className="relative aspect-[16/10]">
                <Image
                  src={image}
                  alt={photoAlt(image, o.area ?? o.name)}
                  fill
                  sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: photoPosition(image) }}
                />
                <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <TierBadge tier={o.tier} />
                  <OptionLabelBadge label={o.label} />
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col gap-3 p-5">
              <div>
                <p className="eyebrow text-muted-foreground">{o.area ?? "Where you stay"}</p>
                <h3 className="mt-1.5 font-heading text-xl ">{o.name}</h3>
                {o.tagline && <p className="mt-1 text-sm text-muted-foreground">{o.tagline}</p>}
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-y border-border py-3">
                <p className="num text-xl">
                  {o.price_delta_amount === 0
                    ? "Included"
                    : `${o.price_delta_amount > 0 ? "+" : "−"}${money(Math.abs(o.price_delta_amount), currency)}`}
                  {o.price_delta_amount !== 0 && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      per person
                    </span>
                  )}
                </p>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PricedAsOf pricedAt={o.pricedAt} />
                  <StayScarcity
                    spotsLeft={o.spotsLeft}
                    isLimited={o.isLimited}
                    soldOut={o.soldOut}
                    allocationHeld={d.hotelConfirmed}
                  />
                </span>
              </div>

              {/* One column. Four cards across leaves each about 250px wide, and a two-column fact
                  list there wraps "10-15 min to Nice-Ville" onto three lines. */}
              {summaryFacts.length > 0 && (
                <dl className="grid gap-y-2 text-sm">
                  {summaryFacts.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                      <div className="min-w-0">
                        <dt className="sr-only">{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                <DetailModal trigger="See the detail" title={o.name} subtitle={o.area}>
                  {o.description && <p className="text-sm">{o.description}</p>}

                  {allFacts.length > 0 && (
                    <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                      {allFacts.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                          <div className="min-w-0">
                            <dt className="eyebrow text-muted-foreground">{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        </div>
                      ))}
                    </dl>
                  )}

                  {saving > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Two sharing a room each save {money(saving, currency)}.
                    </p>
                  )}

                  {(o.includes.length > 0 || o.excludes.length > 0) && (
                    <div className="grid gap-4 text-sm sm:grid-cols-2">
                      {o.includes.length > 0 && (
                        <div>
                          <p className="eyebrow text-muted-foreground">In the price</p>
                          <ul className="mt-2 space-y-1.5">
                            {o.includes.map((line) => (
                              <li key={line} className="flex gap-2">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {o.excludes.length > 0 && (
                        <div>
                          <p className="eyebrow text-muted-foreground">Not in the price</p>
                          <ul className="mt-2 space-y-1.5 text-muted-foreground">
                            {o.excludes.map((line) => (
                              <li key={line} className="flex gap-2">
                                <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {o.why_price_note && (
                    <p className="rounded bg-cloud p-4 text-sm">
                      <span className="font-semibold">Why this price. </span>
                      {o.why_price_note}
                    </p>
                  )}

                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <BedDouble className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    You see the actual properties, their photographs and their addresses when you
                    build the trip. We name a hotel once we hold the rooms, never before.
                  </p>
                </DetailModal>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
