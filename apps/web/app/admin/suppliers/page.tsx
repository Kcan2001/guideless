import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Stat, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { listSuppliers } from "@/lib/admin/ops";

export const metadata: Metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

/**
 * Every supplier and what we owe them a confirmation on. Costs and internal notes stay on the
 * departure screen, where they are edited; this is the roll-up.
 */
export default async function SuppliersPage(props: PageProps<"/admin/suppliers">) {
  const sp = await props.searchParams;
  const rows = await listSuppliers();
  const unconfirmed = rows.reduce((n, r) => n + r.servicesUnconfirmed, 0);
  const active = rows.filter((r) => r.supplier.is_active).length;

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who we book through, and what is still unconfirmed."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Suppliers" value={rows.length} hint={`${active} active`} />
        <Stat
          label="Unconfirmed services"
          value={unconfirmed}
          hint={unconfirmed === 0 ? "all confirmed" : "chase these"}
          tone={unconfirmed > 0 ? "warning" : "good"}
        />
        <Stat
          label="On upcoming departures"
          value={rows.filter((r) => r.departures.length > 0).length}
          hint="suppliers with work booked"
        />
      </div>

      <div className="mt-8">
        <Table
          head={["Supplier", "Contact", "Services", "Upcoming departures"]}
          rows={rows.map((r) => [
            <span key="n">
              <span className="font-medium">{r.supplier.name}</span>
              <span className="ml-2 text-xs capitalize text-muted-foreground">
                {r.supplier.kind}
              </span>
              {!r.supplier.is_active && (
                <Badge variant="neutral" className="ml-2">
                  Inactive
                </Badge>
              )}
              {r.supplier.website && (
                <a
                  href={r.supplier.website}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs"
                >
                  {r.supplier.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </span>,
            <span key="c" className="text-xs">
              {r.primaryContact ? (
                <>
                  {r.primaryContact.name}
                  {r.primaryContact.email && (
                    <span className="block">{r.primaryContact.email}</span>
                  )}
                  {r.primaryContact.phone && (
                    <span className="block">{r.primaryContact.phone}</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">No contact on file</span>
              )}
            </span>,
            <span key="s">
              <span className="tabular-nums">{r.servicesTotal}</span>
              {r.servicesUnconfirmed > 0 && (
                <Badge variant="danger" className="ml-2">
                  {r.servicesUnconfirmed} unconfirmed
                </Badge>
              )}
            </span>,
            <span key="d" className="text-xs">
              {r.departures.length === 0 ? (
                <span className="text-muted-foreground">None upcoming</span>
              ) : (
                r.departures.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/departures/${d.id}#suppliers`}
                    className="block no-underline hover:text-link"
                  >
                    {d.tourName} · {formatDate(d.startDate)}
                  </Link>
                ))
              )}
              {r.departures.length > 3 && (
                <span className="text-muted-foreground">+{r.departures.length - 3} more</span>
              )}
            </span>,
          ])}
          empty="No suppliers yet. Add one from a departure's supplier section."
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Costs, confirmation numbers and cancellation deadlines live on each departure, where they
        are edited.
      </p>
    </>
  );
}
