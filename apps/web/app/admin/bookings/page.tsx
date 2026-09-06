import Link from "next/link";
import { BOOKING_STATUSES } from "@guideless/types";
import { formatDate, formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table, inputClass, money } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { listBookings } from "@/lib/admin/queries";

export default async function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  const sp = await props.searchParams;
  const status =
    typeof sp.status === "string" && (BOOKING_STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : undefined;
  const rows = await listBookings({ status, q });

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every purchase. Payment state comes from Stripe webhooks; booking state from operations."
      />
      <Flash searchParams={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs font-medium text-muted-foreground">
          Confirmation #
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="GL-…"
            className={inputClass + " w-40"}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass + " w-44"}>
            <option value="">Any</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Filter
        </button>
      </form>
      <Section title={`${rows.length} booking${rows.length === 1 ? "" : "s"}`}>
        <Table
          head={[
            "Confirmation",
            "Trip",
            "Customer",
            "Travelers",
            "Status",
            "Payment",
            "Paid / Total",
            "Created",
          ]}
          rows={rows.map(({ booking: b, tour, departure, customer, travelerCount }) => [
            <Link
              key="c"
              href={`/admin/bookings/${b.id}`}
              className="font-medium text-foreground no-underline hover:text-link"
            >
              {b.confirmation_number}
            </Link>,
            <span key="t">
              {tour.name}
              <span className="block text-xs text-muted-foreground">
                {formatDateRange(departure.start_date, departure.end_date)}
              </span>
            </span>,
            customer?.display_name ?? "—",
            travelerCount,
            <StatusBadge key="s" kind="booking" status={b.status} />,
            <StatusBadge key="p" kind="payment" status={b.payment_status} />,
            `${money(b.amount_paid, b.currency)} / ${money(b.total_amount, b.currency)}`,
            formatDate(b.created_at.slice(0, 10)),
          ])}
          empty="No bookings match."
        />
      </Section>
    </>
  );
}
