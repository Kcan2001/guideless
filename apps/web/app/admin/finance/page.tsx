import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Stat, Table, money } from "@/components/admin/ui";
import {
  RECONCILE_WINDOWS,
  reconcile,
  stripeUrl,
  type Discrepancy,
  type DiscrepancyKind,
  type ReconcileWindow,
} from "@/lib/admin/finance";
import { FINANCE_ROLES, requireStaff } from "@/lib/auth/staff";

export const metadata = { title: "Reconciliation" };
/** Reads Stripe on every view; never cached, and never written back. */
export const dynamic = "force-dynamic";

const GROUPS: Array<{ kind: DiscrepancyKind; title: string; description: string }> = [
  {
    kind: "stripe_only",
    title: "Paid in Stripe, missing here",
    description:
      "A card was charged and we have no payment for it. Usually a webhook that never landed; the traveler may be waiting on a confirmation.",
  },
  {
    kind: "ledger_only",
    title: "Paid here, missing in Stripe",
    description:
      "Our ledger says paid but Stripe has no such payment in this window. Check whether it was recorded by hand or belongs to an older window.",
  },
  {
    kind: "amount_mismatch",
    title: "Amounts disagree",
    description: "Both sides know the payment but not for the same amount or currency.",
  },
  {
    kind: "refund_mismatch",
    title: "Refunds disagree",
    description: "Money was returned in Stripe and our record of it is missing or different.",
  },
  {
    kind: "booking_total",
    title: "Booking totals",
    description:
      "A booking's paid total does not match its payments. Summed over every payment on the booking, not just this window.",
  },
];

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

function rowsFor(list: Discrepancy[], livemode: boolean): React.ReactNode[][] {
  return list.map((d) => [
    <span key="what" className="text-sm">
      {d.detail}
      {d.occurredAt && (
        <span className="block text-xs text-muted-foreground">{when(d.occurredAt)}</span>
      )}
    </span>,
    <span key="amt" className="tabular-nums text-sm">
      {d.ourAmount !== undefined && d.currency ? money(d.ourAmount, d.currency) : "—"}
      <span className="block text-xs text-muted-foreground">ours</span>
    </span>,
    <span key="samt" className="tabular-nums text-sm">
      {d.stripeAmount !== undefined && d.currency ? money(d.stripeAmount, d.currency) : "—"}
      <span className="block text-xs text-muted-foreground">
        {d.kind === "booking_total" ? "payments" : "Stripe"}
      </span>
    </span>,
    <span key="links" className="flex flex-wrap gap-3 text-sm">
      {d.bookingId && (
        <Link href={`/admin/bookings/${d.bookingId}`}>{d.confirmationNumber ?? "Booking"}</Link>
      )}
      {d.stripeId && d.stripeObject && (
        <a href={stripeUrl(d.stripeObject, d.stripeId, livemode)} target="_blank" rel="noreferrer">
          Stripe ↗
        </a>
      )}
    </span>,
  ]);
}

export default async function AdminFinancePage(props: PageProps<"/admin/finance">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(FINANCE_ROLES)]);
  const requested = Number(typeof sp.window === "string" ? sp.window : 30);
  const windowDays = (RECONCILE_WINDOWS as readonly number[]).includes(requested)
    ? (requested as ReconcileWindow)
    : 30;
  const report = await reconcile(windowDays);
  const total = report.discrepancies.length;

  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Stripe against our ledger. Read-only: nothing here changes a payment, a refund or a booking."
        actions={
          <div className="flex gap-2">
            {RECONCILE_WINDOWS.map((w) => (
              <Link
                key={w}
                href={`/admin/finance?window=${w}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  w === windowDays ? "border-foreground font-medium" : "border-border"
                }`}
              >
                {w} days
              </Link>
            ))}
          </div>
        }
      />
      <Flash searchParams={sp} />

      {!report.configured ? (
        <Section title="Stripe is not configured here">
          <p className="text-sm text-muted-foreground">
            This environment has no Stripe key, so there is nothing to compare against. The page
            works in any environment that has one.
          </p>
        </Section>
      ) : report.error ? (
        <Section title="Could not read from Stripe">
          <p className="text-sm text-muted-foreground">
            {report.error} Nothing was changed. Try again, and check the key if it persists.
          </p>
        </Section>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Needs a look"
              value={total}
              tone={total === 0 ? "good" : "warning"}
              hint={total === 0 ? "Everything matches" : "Across all checks below"}
            />
            <Stat
              label="Stripe payments"
              value={report.checked.stripeIntents}
              hint="In this window"
            />
            <Stat label="Our payments" value={report.checked.payments} hint="In this window" />
            <Stat label="Our refunds" value={report.checked.refunds} hint="In this window" />
          </div>

          {total === 0 ? (
            <Section title="Everything matches">
              <p className="text-sm text-muted-foreground">
                Compared {report.checked.stripeIntents} Stripe payment
                {report.checked.stripeIntents === 1 ? "" : "s"} and {report.checked.payments} of
                ours since {when(report.since)}, plus {report.checked.refunds} refund
                {report.checked.refunds === 1 ? "" : "s"} and {report.checked.bookings} booking
                {report.checked.bookings === 1 ? "" : "s"}. No differences found.
                {!report.livemode && " This is test-mode data."}
              </p>
            </Section>
          ) : (
            GROUPS.map((g) => {
              const list = report.discrepancies.filter((d) => d.kind === g.kind);
              if (list.length === 0) return null;
              return (
                <Section
                  key={g.kind}
                  title={`${g.title} · ${list.length}`}
                  description={g.description}
                >
                  <Table
                    head={["What disagrees", "Ours", "Theirs", ""]}
                    rows={rowsFor(list, report.livemode)}
                  />
                </Section>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
