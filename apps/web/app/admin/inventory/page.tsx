import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Stat, StatusBadge, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { getInventory, type DepartureInventory } from "@/lib/admin/ops";
import { minutesUntil } from "@/lib/admin/alerts";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

function CapacityBar({
  capacity,
  confirmed,
  held,
}: {
  capacity: number | null;
  confirmed: number;
  held: number;
}) {
  if (capacity === null || capacity === 0)
    return <span className="text-xs text-muted-foreground">No cap</span>;
  const pct = (n: number) => `${Math.min((n / capacity) * 100, 100)}%`;
  return (
    <span className="flex items-center gap-2">
      <span
        className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-border"
        aria-hidden
      >
        <span className="absolute inset-y-0 left-0 bg-teal" style={{ width: pct(confirmed) }} />
        <span
          className="absolute inset-y-0 bg-[#D9A441]"
          style={{ left: pct(confirmed), width: pct(held) }}
        />
      </span>
      <span className="tabular-nums">
        {confirmed}
        {held > 0 && <span className="text-warning"> +{held}</span>}
        <span className="text-muted-foreground"> / {capacity}</span>
      </span>
    </span>
  );
}

/** Minutes remaining, so staff can see money about to be released. */
function HoldClock({ expiresAt }: { expiresAt: string }) {
  const mins = minutesUntil(expiresAt, new Date());
  const urgent = mins <= 60;
  return (
    <span className={urgent ? "font-medium text-warning" : "text-muted-foreground"}>
      {mins <= 0 ? "expiring now" : mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`}
    </span>
  );
}

function DepartureCard({ row }: { row: DepartureInventory }) {
  const { departure: d, tour, availability: a } = row;
  return (
    <Section
      title={tour.name}
      description={
        <>
          {formatDateRange(d.start_date, d.end_date)} · {row.daysUntil} days out ·{" "}
          <StatusBadge kind="departure" status={d.status} />
          {row.needsDecision ? (
            <Badge variant="danger" className="ml-2">
              Below minimum
            </Badge>
          ) : (
            row.belowMinimum && (
              <Badge variant="neutral" className="ml-2">
                Still filling
              </Badge>
            )
          )}
        </>
      }
      actions={
        <Link href={`/admin/departures/${d.id}`} className="text-sm">
          Open departure
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Seats"
          value={<CapacityBar capacity={a.capacity} confirmed={a.confirmed} held={a.held} />}
          hint={`${a.available} available · minimum ${d.minimum_travelers}`}
          tone={row.needsDecision ? "warning" : "neutral"}
        />
        <Stat label="Stay tiers" value={row.tiers.length} hint="active" />
        <Stat
          label="Add-ons"
          value={row.addOns.length}
          hint={`${row.addOns.filter((x) => x.soldOut).length} sold out`}
          tone={row.addOns.some((x) => x.soldOut) ? "warning" : "neutral"}
        />
      </div>

      {row.tiers.length > 0 && (
        <div className="mt-6">
          <h3 className="eyebrow mb-2 text-muted-foreground">Where they stay</h3>
          <Table
            head={["Tier", "Taken", "Remaining", "Hotel rates"]}
            rows={row.tiers.map((t) => [
              <span key="n">
                {t.name}
                {t.tier && (
                  <Badge variant="neutral" className="ml-2 capitalize">
                    {t.tier}
                  </Badge>
                )}
              </span>,
              <CapacityBar key="c" capacity={t.capacity} confirmed={t.confirmed} held={t.held} />,
              <span key="r" className="tabular-nums">
                {t.remaining === null ? "—" : t.remaining}
              </span>,
              <span key="h" className="text-xs">
                {!t.hotelId ? (
                  <span className="text-muted-foreground">No hotel linked</span>
                ) : t.lastRateAt ? (
                  `Refreshed ${t.lastRateAt.slice(0, 10)}`
                ) : (
                  <span className="text-warning">No rates yet</span>
                )}
              </span>,
            ])}
            empty="No stay tiers."
          />
        </div>
      )}

      {row.addOns.length > 0 && (
        <div className="mt-6">
          <h3 className="eyebrow mb-2 text-muted-foreground">What they add</h3>
          <Table
            head={["Add-on", "Taken", "Remaining", "Sales close"]}
            rows={row.addOns.map((x) => [
              <Link
                key="t"
                href={`/admin/departures/${d.id}/add-ons/${x.id}`}
                className="text-foreground no-underline hover:text-link"
              >
                {x.title}
                {x.soldOut && (
                  <Badge variant="danger" className="ml-2">
                    Sold out
                  </Badge>
                )}
              </Link>,
              <CapacityBar key="c" capacity={x.capacity} confirmed={x.confirmed} held={x.held} />,
              <span key="r" className="tabular-nums">
                {x.remaining === null ? "—" : x.remaining}
              </span>,
              <span key="s" className={x.salesClosed ? "text-muted-foreground" : undefined}>
                {x.bookableUntil}
                {x.salesClosed && " (closed)"}
              </span>,
            ])}
            empty="No add-ons."
          />
        </div>
      )}

      {row.holds.length > 0 && (
        <div className="mt-6">
          <h3 className="eyebrow mb-2 flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden /> Live holds
          </h3>
          <Table
            head={["What", "Booking", "Units", "Releases in"]}
            rows={row.holds.map((h) => [
              h.label,
              <Link
                key="b"
                href={`/admin/bookings/${h.bookingId}`}
                className="text-foreground no-underline hover:text-link"
              >
                {h.confirmationNumber}
              </Link>,
              <span key="u" className="tabular-nums">
                {h.units}
              </span>,
              <HoldClock key="e" expiresAt={h.expiresAt} />,
            ])}
          />
        </div>
      )}
    </Section>
  );
}

export default async function InventoryPage(props: PageProps<"/admin/inventory">) {
  const sp = await props.searchParams;
  const rows = await getInventory();
  const atRisk = rows.filter((r) => r.needsDecision).length;
  const holds = rows.reduce((n, r) => n + r.holds.length, 0);
  const soldOut = rows.reduce((n, r) => n + r.addOns.filter((a) => a.soldOut).length, 0);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What is left, and what is at risk. At-risk departures first."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Departures selling" value={rows.length} hint="upcoming and open" />
        <Stat
          label="Need a decision"
          value={atRisk}
          hint={atRisk === 0 ? "none urgent" : "need a decision"}
          tone={atRisk > 0 ? "warning" : "good"}
        />
        <Stat
          label="Live holds"
          value={holds}
          hint="seats and add-ons"
          tone={holds > 0 ? "warning" : "neutral"}
        />
        <Stat label="Sold out add-ons" value={soldOut} hint="across all departures" />
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No departures are selling. Create one to start.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {rows.map((row) => (
            <DepartureCard key={row.departure.id} row={row} />
          ))}
        </div>
      )}

      {atRisk > 0 && (
        <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D9A441]" aria-hidden />A
          departure below its minimum this close to the date needs a decision: sell, discount or
          cancel.
        </p>
      )}
    </>
  );
}
