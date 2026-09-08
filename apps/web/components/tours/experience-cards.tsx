import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Check, Clock, MapPin, Minus, Users } from "lucide-react";
import type { AddOnKind, Currency } from "@guideless/types";
import { formatDate, formatMoney, formatWallTime } from "@guideless/utils";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { AddOnWithCounts } from "@/lib/data/extras";
import { photoAlt, photoPosition } from "@/lib/photos";
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

/** Show head-counts only once they mean something, and scarcity only when it is real and close. */
const GOING_MIN = 3;
const LEFT_MAX = 5;

function money(amount: number, currency: Currency) {
  return formatMoney({ amount, currency }, { compact: true });
}

function when(a: AddOnWithCounts): string | null {
  const parts: string[] = [];
  if (a.date) {
    parts.push(
      formatDate(a.date, "en-US", { weekday: "long", month: "short", day: "numeric" }) +
        (a.day_number ? ` · Day ${a.day_number}` : ""),
    );
  } else if (a.day_number) {
    parts.push(`Day ${a.day_number}`);
  }
  if (a.start_time) {
    parts.push(
      a.end_time
        ? `${formatWallTime(a.start_time)}–${formatWallTime(a.end_time)}`
        : formatWallTime(a.start_time),
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Add-ons as decision-ready cards: what, when, where, price and basis, what is and is not
 * included, why it costs that, who is going (aggregate, real), how many are left (only when
 * few), the cancellation window and any age rule. Selection happens in checkout; the card links
 * there. `size="large"` is for mutually exclusive tiers (race views), `"grid"` for the rest.
 */
export function ExperienceCards({
  addOns,
  currency,
  size = "grid",
  ctaHref,
  ctaLabel = "Add at booking",
  pickOne = false,
  testId,
}: {
  addOns: AddOnWithCounts[];
  currency: Currency;
  size?: "large" | "grid";
  ctaHref: Route | null;
  ctaLabel?: string;
  /** Mutually exclusive set: say so on every card. */
  pickOne?: boolean;
  testId?: string;
}) {
  if (addOns.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul
      className={cn(
        "grid gap-6",
        size === "large" ? "lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3",
      )}
      data-testid={testId}
    >
      {addOns.map((a) => {
        const image = a.image_urls[0];
        const closed = a.bookableUntil < today;
        const soldOut = a.available !== null && a.available <= 0;
        const fewLeft = !soldOut && a.available !== null && a.available <= LEFT_MAX;
        const timing = when(a);
        const place = a.meeting_point ?? a.location_name;
        return (
          <li
            key={a.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
          >
            {image && (
              <div
                className={cn(
                  "relative overflow-hidden bg-sand",
                  size === "large" ? "aspect-[4/3]" : "aspect-[16/10]",
                )}
              >
                <Image
                  src={image}
                  alt={photoAlt(image, a.title)}
                  fill
                  sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: photoPosition(image) }}
                />
                {(a.tier || a.label) && (
                  <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                    <TierBadge tier={a.tier} />
                    <OptionLabelBadge label={a.label} />
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {!image && <TierBadge tier={a.tier} />}
                  {KIND_LABEL[a.kind]}
                  {pickOne && <span className="normal-case tracking-normal">· choose one</span>}
                  {!image && <OptionLabelBadge label={a.label} />}
                </p>
                <h3 className="mt-2 font-heading text-xl font-bold md:text-2xl">{a.title}</h3>
              </div>

              <p className="flex flex-wrap items-baseline justify-between gap-2 border-y border-border py-3">
                <span className="font-heading text-xl font-bold">
                  {money(a.price_amount, currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {a.pricing_basis === "per_traveler" ? "per person" : "per booking"}
                  </span>
                </span>
                {soldOut ? (
                  <Badge variant="danger">Sold out</Badge>
                ) : closed ? (
                  <Badge variant="neutral">Sales closed {formatDate(a.bookableUntil)}</Badge>
                ) : fewLeft ? (
                  <Badge variant="warning">{a.available} left</Badge>
                ) : null}
              </p>

              <dl className="space-y-1.5 text-sm">
                {timing && (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">When</dt>
                    <dd>{timing}</dd>
                  </div>
                )}
                {place && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">Where</dt>
                    <dd>{place}</dd>
                  </div>
                )}
                {a.going >= GOING_MIN && (
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">Going</dt>
                    <dd>{a.going} from your group are going</dd>
                  </div>
                )}
              </dl>

              {a.description && <p className="text-muted-foreground">{a.description}</p>}

              {(a.includes.length > 0 || a.excludes.length > 0) && (
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  {a.includes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Included
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {a.includes.map((line) => (
                          <li key={line} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {a.excludes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Not included
                      </p>
                      <ul className="mt-2 space-y-1.5 text-muted-foreground">
                        {a.excludes.map((line) => (
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

              {a.why_price_note && (
                <p className="rounded-lg bg-cloud p-4 text-sm">
                  <span className="font-semibold">Why this price. </span>
                  {a.why_price_note}
                </p>
              )}

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {a.cancellable_until_days_before > 0
                    ? `Free cancellation until ${a.cancellable_until_days_before} days before`
                    : "Non-refundable once booked"}
                </span>
                {a.min_age != null && a.min_age > 0 && <span>Ages {a.min_age}+</span>}
                {a.capacity != null && <span>Up to {a.capacity} per departure</span>}
              </p>

              {ctaHref && !soldOut && !closed && (
                <div className="mt-auto pt-1">
                  <Link
                    href={ctaHref}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
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
