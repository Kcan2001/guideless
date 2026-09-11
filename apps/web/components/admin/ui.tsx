import type { ReactNode } from "react";
import type { BookingStatus, DepartureStatus, PaymentStatus, TripStatus } from "@guideless/types";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {crumbs && <div className="mb-2 text-xs text-muted-foreground">{crumbs}</div>}
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-6 rounded-xl border border-border bg-surface", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "warning" | "good";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-bold",
          tone === "warning" && "text-warning",
          tone === "good" && "text-[#2FA88A]",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Table({
  head,
  rows,
  empty = "Nothing here yet.",
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, r) => (
            <tr key={r} className="align-top">
              {cells.map((c, i) => (
                <td key={i} className="px-3 py-3 first:pl-0 last:pr-0">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DEPARTURE: Record<DepartureStatus, BadgeProps["variant"]> = {
  draft: "neutral",
  open: "info",
  guaranteed: "included",
  full: "warning",
  closed: "neutral",
  in_progress: "included",
  completed: "neutral",
  cancelled: "danger",
};
const BOOKING: Record<BookingStatus, BadgeProps["variant"]> = {
  draft: "neutral",
  pending_payment: "warning",
  confirmed: "included",
  completed: "neutral",
  cancelled: "danger",
  refunded: "danger",
};
const PAYMENT: Record<PaymentStatus, BadgeProps["variant"]> = {
  unpaid: "neutral",
  deposit_paid: "info",
  partially_paid: "info",
  paid: "included",
  refunded: "danger",
  partially_refunded: "warning",
  failed: "danger",
};
const TRIP: Record<TripStatus, BadgeProps["variant"]> = {
  upcoming: "info",
  active: "included",
  completed: "neutral",
  cancelled: "danger",
};

export function StatusBadge({
  kind,
  status,
}: {
  kind: "departure" | "booking" | "payment" | "trip" | "generic";
  status: string;
}) {
  const variant =
    kind === "departure"
      ? DEPARTURE[status as DepartureStatus]
      : kind === "booking"
        ? BOOKING[status as BookingStatus]
        : kind === "payment"
          ? PAYMENT[status as PaymentStatus]
          : kind === "trip"
            ? TRIP[status as TripStatus]
            : "neutral";
  return <Badge variant={variant ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

export function money(amount: number, currency: string): string {
  return formatMoney({ amount, currency: currency as Currency }, { compact: true });
}

export function DL({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lightweight input class for admin forms (denser than customer forms). */
export const inputClass =
  "h-9 w-full rounded-md border border-border bg-cloud px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";
