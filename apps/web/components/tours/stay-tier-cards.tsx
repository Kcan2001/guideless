import Link from "next/link";
import type { Route } from "next";
import { BedDouble, Check, Coffee, Info, MapPin, Minus, Star, TrainFront } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { DetailModal } from "@/components/tours/detail-modal";
import { HotelCarousel } from "@/components/tours/hotel-carousel";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { buttonVariants } from "@/components/ui/button";
import { PricedAsOf } from "@/components/tours/priced-as-of";
import { StayHotelPanel } from "@/components/tours/stay-hotel-panel";
import { StayScarcity } from "@/components/tours/stay-scarcity";
import { stayDetails, stayGallery, stayHotelNames, type StayOption } from "@/lib/data/extras";
import { photoAlt } from "@/lib/photos";
import { cn } from "@/lib/utils";

function money(amount: number, currency: Currency) {
  return formatMoney({ amount, currency }, { compact: true });
}

/**
 * Accommodation tiers, as cards you can compare at a glance.
 *
 * The card carries only what a traveler chooses BETWEEN: the property's own photographs, the price,
 * how many places are left, and three facts. Everything else — the full description, what is and is
 * not in the price, why it costs what it does, the address and the amenities — is one click away in
 * a modal. The previous version put all of that inline, three cards across, which made a wall of
 * text nobody reads and buried the price below the fold.
 *
 * Photographs come from the property itself where we have a hotel linked, and fall back to a
 * destination photo otherwise. Star ratings render only when set, and an unconfirmed property says
 * so rather than implying a booking we have not made.
 */
export function StayTierCards({
  options,
  currency,
  sharedRoomDiscountAmount,
  ctaHref,
  ctaLabel = "Build my trip",
}: {
  options: StayOption[];
  currency: Currency;
  /** Departure-level saving per traveler when two share; a tier may override it. */
  sharedRoomDiscountAmount: number;
  ctaHref: Route | null;
  ctaLabel?: string;
}) {
  if (options.length === 0) return null;
  const twoUp = options.length === 2;
  return (
    <ul
      className={cn("grid gap-6", twoUp ? "lg:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3")}
      data-testid="stay-tiers"
    >
      {options.map((o) => {
        const d = stayDetails(o);
        const saving = o.shared_room_discount_amount ?? sharedRoomDiscountAmount;

        // The properties' own photography wins, one city at a time; the seeded destination shot
        // is the fallback.
        const gallery = stayGallery(o.hotels, o.image_urls);
        const hotelNames = stayHotelNames(o.hotels);
        const galleryAlt = hotelNames ?? photoAlt(o.image_urls[0] ?? "", o.name);

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
              "flex flex-col overflow-hidden rounded-xl border bg-surface",
              o.is_default ? "border-ink" : "border-border",
            )}
          >
            {gallery.length > 0 && (
              <div className="relative aspect-[16/10]">
                <HotelCarousel
                  images={gallery}
                  alt={galleryAlt}
                  sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
                  className="h-full w-full"
                />
                <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <TierBadge tier={o.tier} />
                  <OptionLabelBadge label={o.label} />
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {o.area ?? "Where you stay"}
                </p>
                <h3 className="mt-1.5 font-heading text-xl font-bold">
                  {o.name}
                  {o.star_rating ? (
                    <span
                      className="ml-2 inline-flex items-center gap-0.5 align-middle text-teal"
                      aria-label={`${o.star_rating} star`}
                    >
                      {Array.from({ length: o.star_rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />
                      ))}
                    </span>
                  ) : null}
                </h3>
                {hotelNames && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{hotelNames}</p>
                )}
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-y border-border py-3">
                <p className="font-heading text-xl font-bold">
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

              {summaryFacts.length > 0 && (
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  {summaryFacts.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                      <div className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {label}
                        </dt>
                        <dd>{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                {ctaHref && (
                  <Link
                    href={ctaHref}
                    className={buttonVariants({
                      variant: o.is_default ? "primary" : "secondary",
                      size: "sm",
                    })}
                  >
                    {ctaLabel}
                  </Link>
                )}
                <DetailModal
                  trigger="See the detail"
                  title={o.name}
                  subtitle={hotelNames ?? o.area}
                >
                  {o.tagline && <p className="font-heading text-lg">{o.tagline}</p>}
                  {o.description && <p className="text-sm">{o.description}</p>}

                  {allFacts.length > 0 && (
                    <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                      {allFacts.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                          <div className="min-w-0">
                            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                              {label}
                            </dt>
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
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            In the price
                          </p>
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
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Not in the price
                          </p>
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
                    <p className="rounded-lg bg-cloud p-4 text-sm">
                      <span className="font-semibold">Why this price. </span>
                      {o.why_price_note}
                    </p>
                  )}

                  {o.hotels.length > 0 ? (
                    <StayHotelPanel hotels={o.hotels} confirmed={d.hotelConfirmed} />
                  ) : (
                    !d.hotelConfirmed && (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        Property confirmed at booking. We name the hotel in your confirmation, never
                        a star rating we cannot stand behind.
                      </p>
                    )
                  )}
                </DetailModal>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
