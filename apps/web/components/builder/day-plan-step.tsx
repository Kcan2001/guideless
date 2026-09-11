"use client";

import { useEffect, useRef } from "react";
import { Ban, CalendarDays, Check, Clock, MapPin, Users } from "lucide-react";
import type { AddOnKind } from "@guideless/types";
import { formatDate, formatMoney, formatWallTime } from "@guideless/utils";
import type { AddOnSelection } from "@guideless/validation";
import { OptionCard } from "@/components/builder/option-card";
import { InfoNote } from "@/components/tours/info-note";
import { StepNav } from "@/components/builder/step-nav";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Badge } from "@/components/ui/badge";
import type { AddOnWithCounts } from "@/lib/data/extras";
import {
  blockedBy,
  buildDayPlan,
  spansDays,
  type PlannedEntry,
  type TripDay,
} from "@/lib/bookings/add-on-days";
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
// Under ten is "only a few", the same threshold the stay tiers use, so the two do not disagree
// on what scarce means on the same page.
const LEFT_MAX = 9;

/**
 * Everything optional, laid out as the days of the trip.
 *
 * This replaces three flat lists — race views, experiences, transfers — which asked a traveler to
 * reassemble a five-day weekend in their head from three menus. A race weekend is a diary, so it
 * reads as one: each day in order, with what is on offer that day underneath it, and the days
 * with nothing to sell still shown so the numbering does not lie.
 *
 * Three rules, all of them from the data rather than from this file:
 *
 *   * **Pick as many things per day as you like.** A coast boat at ten, a grandstand seat at
 *     three and a harbour party at nine are three separate purchases on one day.
 *   * **Unless they conflict**, which means the same exclusive group on an overlapping day. Two
 *     race views on Sunday is a conflict; Saturday's yacht and Sunday's yacht is not, and the
 *     builder used to refuse it.
 *   * **A multi-day option is chosen once.** The three-day grandstand pass is selectable on
 *     Friday and shown on Saturday and Sunday as already covered, so nobody reading Sunday
 *     concludes they have no seat.
 */
export function DayPlanStep({
  title,
  departure,
  addOns,
  tripDays,
  travelerNames,
  selection,
  onChange,
  onBack,
  onNext,
}: {
  title: string;
  departure: CheckoutDeparture;
  addOns: AddOnWithCounts[];
  tripDays: TripDay[];
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

  const plan = buildDayPlan({
    addOns,
    tripDays,
    startDate: departure.startDate ?? null,
  });

  const heldIds = selection
    .filter((s) => (s.travelerIndexes?.length ?? 0) > 0 || (s.quantity ?? 0) > 0)
    .map((s) => s.addOnId);
  const blocked = blockedBy(addOns, heldIds);

  const chosen = selection.reduce(
    (sum, s) => sum + (s.travelerIndexes?.length ?? 0) + (s.quantity ?? 0),
    0,
  );

  function emit(a: AddOnWithCounts, selected: boolean) {
    if (a.tier_group && selected) {
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

  function renderCard(entry: PlannedEntry<AddOnWithCounts>) {
    const a = entry.addOn;
    const closed = a.bookableUntil < today;
    const soldOut = a.available !== null && a.available <= 0;
    const blockedByTitle = blocked.get(a.id);
    const disabled = closed || soldOut || Boolean(blockedByTitle);
    const perTraveler = a.pricing_basis === "per_traveler";
    const count = perTraveler
      ? (selection.find((s) => s.addOnId === a.id)?.travelerIndexes?.length ?? 0)
      : quantityOf(selection, a.id);

    const spanText = spansDays(a)
      ? `Covers days ${entry.days[0]} to ${entry.days[entry.days.length - 1]} — one purchase`
      : null;

    const facts = [
      {
        icon: CalendarDays,
        text: [
          spanText,
          a.start_time
            ? a.end_time
              ? `${formatWallTime(a.start_time)}–${formatWallTime(a.end_time)}`
              : `From ${formatWallTime(a.start_time)}`
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
    ].filter((f) => f && f.text) as Array<{ icon: typeof Clock; text: string }>;

    const control = blockedByTitle ? (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          You have <span className="font-medium text-foreground">{blockedByTitle}</span> for this
          day. Remove it to choose this instead.
        </span>
      </p>
    ) : disabled ? (
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
          Who&rsquo;s in
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
            <Badge variant="warning">Only a few left · {a.available}</Badge>
          ) : spansDays(a) ? (
            <Badge variant="info">{entry.days.length} days</Badge>
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
        footnote={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {a.min_age != null && a.min_age > 0 ? <span>Ages {a.min_age}+</span> : null}
            {!a.supplier_confirmed && (
              <span className="inline-flex items-center gap-1">
                Price not yet confirmed with the venue
                <InfoNote label="Why is this price not confirmed?" align="left">
                  We do not hold a contract or an allocation with this supplier yet, so the price
                  comes from their published rates plus our booking rather than from an agreed rate.
                  It can move before the trip.
                  <br />
                  <br />
                  Monaco&rsquo;s clubs and hospitality operators sell no tickets through any API and
                  most take names only from January, so nothing on this weekend can be locked in
                  this far out. If a confirmed price ends up higher than this, we tell you and you
                  can drop it &mdash; we will not quietly bill the difference.
                </InfoNote>
              </span>
            )}
          </span>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Day by day. Add as much or as little as you like — the only things you cannot combine are
          two views of the same session. Everything here can also be added later in the app.
        </p>
      </header>

      <ol className="space-y-10" data-testid="day-plan">
        {plan.days.map((day) => {
          const selectable = day.entries.filter((e) => e.isFirstDay);
          const carried = day.entries.filter((e) => e.carriedOver);
          return (
            <li key={day.dayNumber} data-testid={`day-${day.dayNumber}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
                <h2 className="font-heading text-xl font-semibold">Day {day.dayNumber}</h2>
                {day.date && (
                  <span className="text-sm text-muted-foreground">
                    {formatDate(day.date, "en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
                {day.title && <span className="text-sm text-muted-foreground">· {day.title}</span>}
                {day.destination && (
                  <span className="text-sm text-muted-foreground">· {day.destination}</span>
                )}
              </div>

              {carried.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {carried.map((e) => {
                    const held = heldIds.includes(e.addOn.id);
                    return (
                      <li
                        key={e.addOn.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded border px-4 py-3 text-sm",
                          held
                            ? "border-teal/40 bg-teal/5"
                            : "border-dashed border-border text-muted-foreground",
                        )}
                      >
                        {held ? (
                          <Check className="h-4 w-4 shrink-0 text-teal" aria-hidden />
                        ) : (
                          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        <span>
                          <span className="font-medium text-foreground">{e.addOn.title}</span>{" "}
                          {held
                            ? "covers today — nothing more to do."
                            : `also covers today. Choose it on day ${e.days[0]}.`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectable.length > 0 ? (
                // A lone option on a quiet day gets the full width rather than sitting stranded
                // in half a grid; its own container query then lays the card out to suit.
                <ul className={cn("mt-4 grid gap-5", selectable.length > 1 && "md:grid-cols-2")}>
                  {selectable.map((e) => (
                    <li key={e.addOn.id}>{renderCard(e)}</li>
                  ))}
                </ul>
              ) : carried.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing to book today. The day is yours.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {plan.anytime.length > 0 && (
        <section>
          <div className="border-b border-border pb-2">
            <h2 className="font-heading text-xl font-semibold">Any time on the trip</h2>
          </div>
          <ul className={cn("mt-4 grid gap-5", plan.anytime.length > 1 && "md:grid-cols-2")}>
            {plan.anytime.map((a) => (
              <li key={a.id}>
                {renderCard({ addOn: a, isFirstDay: true, carriedOver: false, days: [] })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={chosen === 0 ? "Continue without extras" : "Continue"}
      />
    </div>
  );
}
