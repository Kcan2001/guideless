import { CalendarDays, Users } from "lucide-react";
import { dropCountdown, dropState } from "@/lib/growth/drops";
import { WaitlistForm } from "@/components/growth/waitlist-form";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import type { DepartureWithAvailability } from "@/lib/data/tours";
import { cn } from "@/lib/utils";

export function availabilityBadge(d: DepartureWithAvailability) {
  const { available } = d.availability;
  const drop = dropState(d.opensAt);
  if (!drop.open) {
    return { variant: "info" as const, label: dropCountdown(drop.secondsUntil) };
  }
  if (d.status === "guaranteed" && available > 0) {
    return { variant: "included" as const, label: `Guaranteed · ${available} left` };
  }
  if (available <= 0) return { variant: "danger" as const, label: "Sold out" };
  if (available <= 3) return { variant: "warning" as const, label: `${available} spots left` };
  return { variant: "info" as const, label: `${available} spots left` };
}

export function DepartureList({
  tourSlug,
  tourId,
  departures,
}: {
  tourSlug: string;
  /** Needed so a sold-out or not-yet-dropped departure can offer the waitlist. */
  tourId?: string;
  departures: DepartureWithAvailability[];
}) {
  if (departures.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-8 text-center">
        <p className="font-heading text-lg font-semibold">New dates are being finalized.</p>
        <p className="mt-1 text-muted-foreground">Check back soon, or explore other trips.</p>
        <PendingLink
          href="/tours"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
        >
          All trips
        </PendingLink>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded border border-border bg-surface">
      {departures.map((d) => {
        const badge = availabilityBadge(d);
        const drop = dropState(d.opensAt);
        const soldOut = d.availability.available <= 0;
        return (
          <li key={d.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                {formatDateRange(d.startDate, d.endDate)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden /> up to {d.capacity} travelers
                </span>
                {d.depositAmount > 0 && (
                  <span>
                    {formatMoney(
                      { amount: d.depositAmount, currency: d.currency },
                      { compact: true },
                    )}{" "}
                    deposit
                  </span>
                )}
              </p>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <div className="text-right">
              <p className="num text-xl">
                {formatMoney({ amount: d.priceAmount, currency: d.currency }, { compact: true })}
              </p>
              <p className="text-xs text-muted-foreground">per traveler</p>
            </div>
            <div className="flex gap-2">
              <PendingLink
                href={`/tours/${tourSlug}/departures/${d.id}`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Details
              </PendingLink>
              {!drop.open || soldOut ? (
                <span
                  className={cn(buttonVariants({ size: "sm" }), "pointer-events-none opacity-50")}
                >
                  {drop.open ? "Sold out" : "Not open yet"}
                </span>
              ) : (
                <PendingLink
                  href={{ pathname: `/tours/${tourSlug}/build`, query: { departure: d.id } }}
                  className={buttonVariants({ size: "sm" })}
                  pendingLabel="Opening…"
                >
                  Build my trip
                </PendingLink>
              )}
            </div>
            {tourId && (!drop.open || soldOut) && (
              <div className="w-full border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  {drop.open
                    ? "These dates are full. We will write if a place opens."
                    : "These dates open soon. We will write the moment they do."}
                </p>
                <WaitlistForm
                  tourId={tourId}
                  departureId={d.id}
                  source="departure_list"
                  className="mt-3 max-w-md"
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
