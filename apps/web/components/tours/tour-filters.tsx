import Link from "next/link";
import type { Tables } from "@guideless/types";
import { formatMoney } from "@guideless/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DURATION_BUCKETS,
  PRICE_CEILINGS,
  hasActiveFilters,
  type TourFilters as Filters,
} from "@/lib/data/tour-filters";
import { cn } from "@/lib/utils";

const LEVELS = [
  ["relaxed", "Relaxed"],
  ["moderate", "Moderate"],
  ["active", "Active"],
] as const;

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

const selectClass =
  "h-10 w-full rounded border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Server-rendered GET form: works without JavaScript and keeps URLs shareable. */
export function TourFilters({
  filters,
  destinations,
  months,
}: {
  filters: Filters;
  destinations: Tables<"destinations">[];
  months: string[];
}) {
  return (
    <form
      method="get"
      action="/tours"
      className="grid gap-3 rounded border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[repeat(5,1fr)_auto]"
      aria-label="Filter trips"
    >
      <label className="text-sm">
        <span className="eyebrow mb-1 block text-muted-foreground">Destination</span>
        <select name="destination" defaultValue={filters.destination ?? ""} className={selectClass}>
          <option value="">Anywhere</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="eyebrow mb-1 block text-muted-foreground">Month</span>
        <select name="month" defaultValue={filters.month ?? ""} className={selectClass}>
          <option value="">Any month</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="eyebrow mb-1 block text-muted-foreground">Duration</span>
        <select name="duration" defaultValue={filters.duration ?? ""} className={selectClass}>
          <option value="">Any length</option>
          {Object.entries(DURATION_BUCKETS).map(([key, b]) => (
            <option key={key} value={key}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="eyebrow mb-1 block text-muted-foreground">Pace</span>
        <select name="activity" defaultValue={filters.activityLevel ?? ""} className={selectClass}>
          <option value="">Any pace</option>
          {LEVELS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="eyebrow mb-1 block text-muted-foreground">Max price</span>
        <select
          name="maxPrice"
          defaultValue={filters.maxPrice?.toString() ?? ""}
          className={selectClass}
        >
          <option value="">Any price</option>
          {PRICE_CEILINGS.map((p) => (
            <option key={p} value={p}>
              Up to {formatMoney({ amount: p, currency: "USD" }, { compact: true })}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" className="h-10 flex-1">
          Filter
        </Button>
        {hasActiveFilters(filters) && (
          <Link
            href="/tours"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-10")}
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
