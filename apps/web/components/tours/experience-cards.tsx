import Image from "next/image";
import { CalendarDays, Check, Clock, Layers, MapPin, Minus, Users } from "lucide-react";
import type { AddOnKind, Currency } from "@guideless/types";
import { formatDate, formatMoney, formatWallTime } from "@guideless/utils";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { Badge } from "@/components/ui/badge";
import { DetailModal } from "@/components/tours/detail-modal";
import type { AddOnWithCounts } from "@/lib/data/extras";
import type { AddOnFamily } from "@/lib/data/extras-shared";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn, gridColumns } from "@/lib/utils";

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
 * Optional things to do, as one card per *thing* rather than one per row you can buy.
 *
 * The catalogue holds "Amber Lounge yacht, qualifying day", "…, race day" and "…, both days". They
 * are three real products and the builder sells all three, but on the tour page they are one
 * answer to one question: yes, you can watch this from a boat. Rendering them separately turned a
 * four-rung ladder into a twelve-card wall and made the cheapest rung impossible to find.
 *
 * So rows sharing a `family` collapse (see `addOnFamilies`), and a collapsed card:
 *
 *   - prices itself **From** the cheapest variant, because a Friday yacht and a Sunday yacht are
 *     not the same price and quoting either one flat is wrong in one direction or the other;
 *   - drops the timing, the meeting point and the cancellation window, which belong to a variant
 *     and are not true of the set;
 *   - says how many ways there are to do it, and that you choose in the builder.
 *
 * A single-variant entry keeps all of that, because there is nothing being generalised away.
 *
 * There is no call to action on the card. Selection happens in the builder — this page's job is to
 * show what exists, and a page-level "Build my trip" already does the asking.
 */
export function ExperienceCards({
  families,
  currency,
  size = "grid",
  pickOne = false,
  testId,
}: {
  families: AddOnFamily<AddOnWithCounts>[];
  currency: Currency;
  size?: "large" | "grid";
  /** Mutually exclusive set: say so on every card. */
  pickOne?: boolean;
  testId?: string;
}) {
  if (families.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  // Distinct days the exclusive set touches, spans included, across every variant.
  const groupDays = new Set(
    families.flatMap((f) =>
      f.variants.flatMap((a) =>
        a.day_number == null
          ? []
          : Array.from(
              {
                length: Math.max(a.end_day_number ?? a.day_number, a.day_number) - a.day_number + 1,
              },
              (_, i) => a.day_number! + i,
            ),
      ),
    ),
  );
  const exclusiveCopy = groupDays.size > 1 ? "one per day" : "choose one";
  return (
    <ul className={cn("grid gap-6", gridColumns(families.length))} data-testid={testId}>
      {families.map((f) => {
        const a = f.cheapest;
        const image = a.image_urls[0];
        // A family is closed or sold out only when every way of doing it is.
        const closed = f.variants.every((v) => v.bookableUntil < today);
        const soldOut = f.variants.every((v) => v.available !== null && v.available <= 0);
        // Scarcity is a claim about one thing. Across variants it is not a number anyone can act on.
        const fewLeft = !f.isFrom && !soldOut && a.available !== null && a.available <= LEFT_MAX;
        // Timing, place and the cancellation window belong to a variant, not to the set.
        const timing = f.isFrom ? null : when(a);
        const place = f.isFrom ? null : (a.meeting_point ?? a.location_name);
        const going = f.variants.reduce((sum, v) => sum + v.going, 0);
        return (
          <li
            key={f.key}
            className="flex flex-col overflow-hidden rounded border border-border bg-surface"
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
                  alt={photoAlt(image, f.title)}
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
                <p className="eyebrow flex flex-wrap items-center gap-2 text-muted-foreground">
                  {!image && <TierBadge tier={a.tier} />}
                  {KIND_LABEL[a.kind]}
                  {pickOne && (
                    <span className="normal-case tracking-normal">· {exclusiveCopy}</span>
                  )}
                  {!image && <OptionLabelBadge label={a.label} />}
                </p>
                <h3 className="mt-2 font-heading text-xl md:text-2xl">{f.title}</h3>
              </div>

              <p className="flex flex-wrap items-baseline justify-between gap-2 border-y border-border py-3">
                <span className="num text-xl">
                  {/* The space is a real text node, not a margin: margin does not separate the
                      words for a screen reader, which would otherwise read "From$6,380". */}
                  {f.isFrom && (
                    <>
                      <span className="text-sm font-normal">From</span>{" "}
                    </>
                  )}
                  {money(f.fromAmount, currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {a.pricing_basis === "per_traveler" ? "per person" : "per booking"}
                  </span>
                </span>
                {soldOut ? (
                  <Badge variant="danger">Sold out</Badge>
                ) : closed ? (
                  <Badge variant="neutral">Sales closed</Badge>
                ) : fewLeft ? (
                  <Badge variant="warning">{a.available} left</Badge>
                ) : null}
              </p>

              <dl className="space-y-1.5 text-sm">
                {f.isFrom && (
                  <div className="flex items-start gap-2">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">Ways to do it</dt>
                    <dd>{f.variantCount} ways to do it — you pick when you build the trip</dd>
                  </div>
                )}
                {timing && (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">When</dt>
                    <dd>{timing}</dd>
                  </div>
                )}
                {going >= GOING_MIN && (
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <dt className="sr-only">Going</dt>
                    <dd>{going} from your group are going</dd>
                  </div>
                )}
              </dl>

              {f.summary && <p className="line-clamp-4 text-muted-foreground">{f.summary}</p>}

              {/* Everything below the fold of the card lives in the sheet, exactly as it does for
                  the stay tiers. Four cards in a row that each decide for themselves how much to
                  say is how one section ends up 2,500px tall with three of its four columns empty,
                  and it is the inconsistency the design system exists to stop. */}
              <div className="mt-auto pt-1">
                <DetailModal trigger="See the detail" title={f.title} subtitle={place}>
                  {f.isFrom ? (
                    <>
                      <p className="text-sm">{f.summary}</p>
                      <div>
                        <p className="eyebrow text-muted-foreground">
                          The {f.variantCount} ways to do it
                        </p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {f.variants.map((v) => (
                            <li
                              key={v.id}
                              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2 last:border-0"
                            >
                              <span>{v.title}</span>
                              <span className="font-heading font-bold">
                                {money(v.price_amount, currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-sm text-muted-foreground">
                          You choose between these when you build the trip.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {a.description && <p className="text-sm">{a.description}</p>}
                      {place && (
                        <p className="flex items-start gap-2 text-sm">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                          {place}
                        </p>
                      )}
                      {(a.includes.length > 0 || a.excludes.length > 0) && (
                        <div className="grid gap-4 text-sm sm:grid-cols-2">
                          {a.includes.length > 0 && (
                            <div>
                              <p className="eyebrow text-muted-foreground">Included</p>
                              <ul className="mt-2 space-y-1.5">
                                {a.includes.map((line) => (
                                  <li key={line} className="flex gap-2">
                                    <Check
                                      className="mt-0.5 h-4 w-4 shrink-0 text-teal"
                                      aria-hidden
                                    />
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {a.excludes.length > 0 && (
                            <div>
                              <p className="eyebrow text-muted-foreground">Not included</p>
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
                        <p className="rounded bg-cloud p-4 text-sm">
                          <span className="font-semibold">Why this price. </span>
                          {a.why_price_note}
                        </p>
                      )}
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" aria-hidden />
                          {a.cancellable_until_days_before != null &&
                          a.cancellable_until_days_before > 0
                            ? `Free cancellation until ${a.cancellable_until_days_before} days before`
                            : "Non-refundable once booked"}
                        </span>
                        {a.min_age != null && a.min_age > 0 && <span>Ages {a.min_age}+</span>}
                      </p>
                    </>
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
