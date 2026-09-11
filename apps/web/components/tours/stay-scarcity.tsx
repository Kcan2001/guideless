import { InfoNote } from "@/components/tours/info-note";
import { cn } from "@/lib/utils";

/**
 * How many places are left on a stay tier.
 *
 * The number is TRAVELERS, not rooms — two people sharing one room take two places — so the copy
 * says "places", never "rooms". Getting that wrong would understate what is gone by half for every
 * couple on the trip.
 *
 * Below ten we say so out loud. That threshold is deliberate rather than dramatic: the Monaco
 * tiers nearest the circuit have four and six places because that is genuinely all the supplier
 * had, and a traveler deciding between tiers should know which one disappears first.
 */
export function StayScarcity({
  spotsLeft,
  isLimited,
  soldOut,
  allocationHeld = false,
  className,
}: {
  spotsLeft: number | null;
  isLimited: boolean;
  soldOut: boolean;
  /** True once we hold a contracted allocation. False means the cap is our estimate. */
  allocationHeld?: boolean;
  className?: string;
}) {
  // An uncapped tier has nothing honest to report.
  if (spotsLeft === null) return null;

  if (soldOut) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded bg-surface-muted px-2 py-0.5 font-heading text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground",
          className,
        )}
      >
        Sold out
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      {isLimited && (
        <span className="inline-flex items-center rounded bg-warning-surface px-2 py-0.5 font-heading text-[11px] font-extrabold uppercase tracking-[0.1em] text-warning">
          Only a few left
        </span>
      )}
      <span className={cn("font-medium", isLimited ? "text-warning" : "text-muted-foreground")}>
        {spotsLeft} {spotsLeft === 1 ? "place" : "places"} left
      </span>
      {!allocationHeld && (
        <InfoNote label="What does places left mean here?">
          This is how many places we have set aside on this tier, and how many are still unsold. It
          counts travelers, not rooms &mdash; two people sharing take two places.
          <br />
          <br />
          We do not yet hold a contracted block at this property, so the cap is our own judgement of
          what we can secure rather than rooms we have already bought. On the tiers nearest the
          circuit it is deliberately small: a live supplier search found only three properties
          within 1.5&nbsp;km of the track with any race-week availability at all.
        </InfoNote>
      )}
    </span>
  );
}
