import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Stat, StatusBadge, Table, money } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { getDashboard } from "@/lib/admin/queries";

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const sp = await props.searchParams;
  const { upcoming, issues, recentBookings, openSupport } = await getDashboard();
  const next = upcoming[0];
  const confirmedSeats = upcoming.reduce((n, d) => n + d.availability.confirmed, 0);
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return (
    <>
      <PageHeader
        title="Operations"
        description="What needs attention before the next departure."
        actions={
          <>
            <Link href="/admin/departures/new" className={buttonVariants({ size: "sm" })}>
              New departure
            </Link>
            <Link
              href="/admin/tours/new"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              New tour
            </Link>
            <Link
              href="/admin/hosts"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Host applications
            </Link>
            <Link
              href="/admin/meetups"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              City evenings
            </Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Upcoming departures"
          value={upcoming.length}
          hint={next ? `Next: ${next.tour.name} in ${next.daysUntil} days` : "None scheduled"}
        />
        <Stat
          label="Confirmed travelers"
          value={confirmedSeats}
          hint="across upcoming departures"
          tone="good"
        />
        <Stat
          label="Issues"
          value={warnings}
          hint={warnings === 0 ? "All clear" : "need a decision"}
          tone={warnings > 0 ? "warning" : "good"}
        />
        <Stat
          label="Open support"
          value={<Link href="/admin/support">{openSupport}</Link>}
          hint="threads waiting on staff"
          tone={openSupport > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Upcoming departures" description="Capacity and readiness at a glance.">
          <Table
            head={["Departure", "Dates", "Travelers", "Status", ""]}
            rows={upcoming.map((d) => [
              <Link
                key="t"
                href={`/admin/departures/${d.departure.id}`}
                className="font-medium text-foreground no-underline hover:text-link"
              >
                {d.tour.name}
              </Link>,
              <span key="d">
                {formatDateRange(d.departure.start_date, d.departure.end_date)}
                <span className="block text-xs text-muted-foreground">{d.daysUntil} days away</span>
              </span>,
              <span key="c">
                {d.availability.confirmed} / {d.departure.capacity}
                {d.availability.held > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    (+{d.availability.held} held)
                  </span>
                )}
                <span className="block text-xs text-muted-foreground">
                  min {d.departure.minimum_travelers}
                </span>
              </span>,
              <StatusBadge key="s" kind="departure" status={d.departure.status} />,
              <Link key="l" href={`/admin/departures/${d.departure.id}`} className="text-sm">
                Open
              </Link>,
            ])}
            empty="No upcoming departures. Create one to start selling."
          />
        </Section>

        <Section
          title="Issues"
          description="Operational risk, made visible."
          actions={
            <Link href="/admin/inventory" className="text-sm">
              Inventory
            </Link>
          }
        >
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding. Enjoy it.</p>
          ) : (
            <div className="space-y-4">
              {(["warning", "info"] as const).map((severity) => {
                const group = issues.filter((i) => i.severity === severity);
                if (group.length === 0) return null;
                return (
                  <div key={severity}>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {severity === "warning" ? "Needs a decision" : "Worth knowing"}
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {group.map((i, idx) => (
                        <li key={`${severity}-${idx}`} className="flex gap-2">
                          {severity === "warning" ? (
                            <AlertTriangle
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#D9A441]"
                              aria-hidden
                            />
                          ) : (
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden />
                          )}
                          {i.href ? (
                            <Link
                              href={i.href as "/admin"}
                              className="text-foreground no-underline hover:text-link"
                            >
                              {i.text}
                            </Link>
                          ) : (
                            <span>{i.text}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-6">
        <Section
          title="Recent bookings"
          actions={
            <Link href="/admin/bookings" className="text-sm">
              All bookings
            </Link>
          }
        >
          <Table
            head={["Confirmation", "Trip", "Status", "Payment", "Total"]}
            rows={recentBookings.map(({ booking: b, tour }) => [
              <Link
                key="c"
                href={`/admin/bookings/${b.id}`}
                className="font-medium text-foreground no-underline hover:text-link"
              >
                {b.confirmation_number}
              </Link>,
              tour.name,
              <StatusBadge key="s" kind="booking" status={b.status} />,
              <StatusBadge key="p" kind="payment" status={b.payment_status} />,
              <span key="m">
                {money(b.amount_paid, b.currency)}{" "}
                <span className="text-muted-foreground">/ {money(b.total_amount, b.currency)}</span>
              </span>,
            ])}
            empty="No bookings yet."
          />
        </Section>
      </div>
    </>
  );
}
