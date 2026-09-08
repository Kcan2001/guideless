import Link from "next/link";
import { PageHeader, Section, Stat, Table } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { getFunnel, stageRate, type FunnelWeek } from "@/lib/admin/funnel";

const WINDOWS = [30, 90, 180] as const;

/** Bars share one scale so two weeks are comparable by eye, not only by label. */
function WeeklyChart({ weeks }: { weeks: FunnelWeek[] }) {
  const max = Math.max(...weeks.map((w) => w.booked), 1);
  const barWidth = 26;
  const gap = 10;
  const height = 140;
  const width = Math.max(320, weeks.length * (barWidth + gap));

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height + 34}
        viewBox={`0 0 ${width} ${height + 34}`}
        role="img"
        aria-label={`Bookings created per week, peak ${max}`}
      >
        <line x1="0" y1={height} x2={width} y2={height} stroke="currentColor" opacity="0.2" />
        <text x="0" y="12" fontSize="10" fill="currentColor" opacity="0.6">
          {max} peak
        </text>
        {weeks.map((w, i) => {
          const x = i * (barWidth + gap);
          const booked = (w.booked / max) * (height - 20);
          const confirmed = (w.confirmed / max) * (height - 20);
          return (
            <g key={w.weekStart}>
              <rect
                x={x}
                y={height - booked}
                width={barWidth}
                height={booked}
                fill="currentColor"
                opacity="0.25"
              />
              <rect
                x={x}
                y={height - confirmed}
                width={barWidth}
                height={confirmed}
                fill="currentColor"
                opacity="0.75"
              />
              <text
                x={x + barWidth / 2}
                y={height + 14}
                fontSize="9"
                textAnchor="middle"
                fill="currentColor"
                opacity="0.6"
              >
                {w.weekStart.slice(5)}
              </text>
              <text
                x={x + barWidth / 2}
                y={height + 27}
                fontSize="9"
                textAnchor="middle"
                fill="currentColor"
                opacity="0.9"
              >
                {w.booked}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Solid: confirmed. Faded: bookings created. Labels are the week beginning, then the count.
      </p>
    </div>
  );
}

export default async function AdminFunnelPage(props: PageProps<"/admin/funnel">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(OPS_ROLES)]);
  const days = WINDOWS.includes(Number(sp.days) as (typeof WINDOWS)[number]) ? Number(sp.days) : 90;
  const report = await getFunnel(days);

  return (
    <>
      <PageHeader
        title="Funnel"
        description="Counted from our own tables, so it reconciles with bookings and payments."
        actions={
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <Link
                key={w}
                href={{ pathname: "/admin/funnel", query: { days: w } }}
                className={buttonVariants({
                  size: "sm",
                  variant: w === days ? "primary" : "secondary",
                })}
              >
                {w} days
              </Link>
            ))}
          </div>
        }
      />

      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        This starts at the builder. Visits, trip-page views and everyone who left before signing in
        are not here — those live in GA4 and PostHog. Anonymous builder drafts stay in the browser
        and never reach the database, so &ldquo;started building&rdquo; counts signed-in travelers
        only.
      </p>

      {report.empty ? (
        <Section title="Nothing yet">
          <p className="text-muted-foreground">
            No builder drafts and no bookings in the last {days} days. The first real numbers appear
            here once travelers start configuring trips.
          </p>
        </Section>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.stages.map((stage, i) => {
              const previous = i === 0 ? null : report.stages[i - 1];
              const rate = previous ? stageRate(stage.count, previous.count) : null;
              return (
                <Stat
                  key={stage.key}
                  label={stage.label}
                  value={stage.count}
                  hint={
                    rate === null
                      ? stage.hint
                      : `${rate}% of ${previous?.label.toLowerCase()} · ${stage.hint}`
                  }
                />
              );
            })}
          </div>

          {report.weeks.length > 0 && (
            <Section
              title="By week"
              description="Bookings created, with the confirmed share solid."
            >
              <WeeklyChart weeks={report.weeks} />
            </Section>
          )}

          <Section
            title="By departure"
            description="Where the interest is, and where it stops converting."
          >
            <Table
              head={["Trip", "Departs", "Started", "Booked", "Confirmed", "Paid"]}
              rows={report.departures.map((d) => [
                <Link key="t" href={`/admin/departures/${d.departureId}`} className="font-medium">
                  {d.tourName}
                </Link>,
                d.startDate || "—",
                d.started,
                d.booked,
                d.confirmed,
                d.paid,
              ])}
              empty="No activity against any departure in this window."
            />
          </Section>
        </div>
      )}
    </>
  );
}
