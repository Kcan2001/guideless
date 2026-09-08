import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DepartureWithAvailability } from "@/lib/data/tours";
import { cn } from "@/lib/utils";

export function availabilityBadge(d: DepartureWithAvailability) {
  const { available } = d.availability;
  if (d.status === "guaranteed" && available > 0) {
    return { variant: "included" as const, label: `Guaranteed · ${available} left` };
  }
  if (available <= 0) return { variant: "danger" as const, label: "Sold out" };
  if (available <= 3) return { variant: "warning" as const, label: `${available} spots left` };
  return { variant: "info" as const, label: `${available} spots left` };
}

export function DepartureList({
  tourSlug,
  departures,
}: {
  tourSlug: string;
  departures: DepartureWithAvailability[];
}) {
  if (departures.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="font-heading text-lg font-semibold">New dates are being finalized.</p>
        <p className="mt-1 text-muted-foreground">Check back soon, or explore other trips.</p>
        <Link
          href="/tours"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
        >
          All trips
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {departures.map((d) => {
        const badge = availabilityBadge(d);
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
              <p className="font-heading text-xl font-bold">
                {formatMoney({ amount: d.priceAmount, currency: d.currency }, { compact: true })}
              </p>
              <p className="text-xs text-muted-foreground">per traveler</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/tours/${tourSlug}/departures/${d.id}`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Details
              </Link>
              {soldOut ? (
                <span
                  className={cn(buttonVariants({ size: "sm" }), "pointer-events-none opacity-50")}
                >
                  Sold out
                </span>
              ) : (
                <Link
                  href={`/tours/${tourSlug}/build?departure=${d.id}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Build my trip
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
