import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { BedDouble, Check, Coffee, Info, MapPin, Minus, Star, TrainFront } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { buttonVariants } from "@/components/ui/button";
import { stayDetails, type StayOption } from "@/lib/data/extras";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn } from "@/lib/utils";

function money(amount: number, currency: Currency) {
  return formatMoney({ amount, currency }, { compact: true });
}

/**
 * Accommodation tiers as editorial cards: photo, label, tagline, price, the practical facts a
 * traveler compares on (neighbourhood, station, train time, breakfast, room), what is and is not
 * in the price, and why the tier costs what it costs. Every fact comes from the row; nothing is
 * inferred. Star ratings render only when set, and an unconfirmed property says so.
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
        const image = o.image_urls[0];
        const saving = o.shared_room_discount_amount ?? sharedRoomDiscountAmount;
        const facts: Array<{ icon: typeof MapPin; label: string; value: string }> = [];
        if (d.neighborhood) facts.push({ icon: MapPin, label: "Where", value: d.neighborhood });
        if (d.stationDistance)
          facts.push({ icon: TrainFront, label: "Station", value: d.stationDistance });
        if (d.trainTime)
          facts.push({ icon: TrainFront, label: "To the action", value: d.trainTime });
        if (d.breakfast) facts.push({ icon: Coffee, label: "Breakfast", value: d.breakfast });
        if (d.roomType) facts.push({ icon: BedDouble, label: "Room", value: d.roomType });
        return (
          <li
            key={o.id}
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border bg-surface",
              o.is_default ? "border-ink" : "border-border",
            )}
          >
            {image && (
              <div className="relative aspect-[16/10] overflow-hidden bg-sand">
                <Image
                  src={image}
                  alt={photoAlt(image, `${o.name}${o.area ? `, ${o.area}` : ""}`)}
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover"
                  style={{ objectPosition: photoPosition(image) }}
                />
                {(o.tier || o.label) && (
                  <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                    <TierBadge tier={o.tier} />
                    <OptionLabelBadge label={o.label} />
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-5 p-6 md:p-7">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {!image && <TierBadge tier={o.tier} />}
                  {o.area ?? "Where you stay"}
                  {!image && <OptionLabelBadge label={o.label} />}
                  {o.is_default && !o.label && (
                    <span className="normal-case tracking-normal">· included in the base trip</span>
                  )}
                </p>
                <h3 className="mt-2 font-heading text-2xl font-bold">
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
                {o.tagline && (
                  <p className="mt-1 font-heading text-lg text-muted-foreground">{o.tagline}</p>
                )}
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-border py-3">
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
                {saving > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Two sharing each save {money(saving, currency)}
                  </p>
                )}
              </div>

              {o.description && <p className="text-muted-foreground">{o.description}</p>}

              {facts.length > 0 && (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {facts.map((f) => (
                    <div key={f.label} className="flex items-start gap-2">
                      <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd>{f.value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
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

              {!d.hotelConfirmed && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Property confirmed at booking. We name the hotel in your confirmation, never a
                  star rating we cannot stand behind.
                </p>
              )}

              {ctaHref && (
                <div className="mt-auto pt-2">
                  <Link
                    href={ctaHref}
                    className={buttonVariants({
                      variant: o.is_default ? "primary" : "secondary",
                      size: "sm",
                    })}
                  >
                    {ctaLabel}
                  </Link>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
