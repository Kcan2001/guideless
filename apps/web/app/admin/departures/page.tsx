import Link from "next/link";
import { DEPARTURE_STATUSES } from "@guideless/types";
import { formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table, inputClass, money } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { listDepartures } from "@/lib/admin/queries";

export default async function AdminDeparturesPage(props: PageProps<"/admin/departures">) {
  const sp = await props.searchParams;
  const status =
    typeof sp.status === "string" && (DEPARTURE_STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : undefined;
  const includePast = sp.past === "1";
  const rows = await listDepartures({ status, includePast });

  return (
    <>
      <PageHeader
        title="Departures"
        description="Dated executions of a tour version. Capacity, price and status live here."
        actions={
          <Link href="/admin/departures/new" className={buttonVariants({ size: "sm" })}>
            New departure
          </Link>
        }
      />
      <Flash searchParams={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs font-medium text-muted-foreground">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass + " w-40"}>
            <option value="">Any</option>
            {DEPARTURE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            name="past"
            value="1"
            defaultChecked={includePast}
            className="accent-ink"
          />{" "}
          Include past
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Filter
        </button>
      </form>
      <Section title={`${rows.length} departure${rows.length === 1 ? "" : "s"}`}>
        <Table
          head={["Tour", "Dates", "Status", "Booked / Held / Cap", "Price", "Groups", ""]}
          rows={rows.map((r) => [
            <Link
              key="t"
              href={`/admin/departures/${r.departure.id}`}
              className="font-medium text-foreground no-underline hover:text-link"
            >
              {r.tour.name}
            </Link>,
            formatDateRange(r.departure.start_date, r.departure.end_date),
            <StatusBadge key="s" kind="departure" status={r.departure.status} />,
            <span key="c">
              {r.availability.confirmed} / {r.availability.held} / {r.departure.capacity}
              {r.availability.confirmed < r.departure.minimum_travelers && (
                <span className="block text-xs text-warning">
                  below min {r.departure.minimum_travelers}
                </span>
              )}
            </span>,
            <span key="p">
              {money(r.departure.price_amount, r.departure.currency)}
              <span className="block text-xs text-muted-foreground">
                deposit {money(r.departure.deposit_amount, r.departure.currency)}
              </span>
            </span>,
            r.groupCount,
            <Link key="l" href={`/admin/departures/${r.departure.id}`} className="text-sm">
              Open
            </Link>,
          ])}
          empty="No departures match."
        />
      </Section>
    </>
  );
}
