import Link from "next/link";
import { notFound } from "next/navigation";
import { daysBetween, formatDate, formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  DL,
  PageHeader,
  Section,
  StatusBadge,
  Table,
  inputClass,
  labelClass,
  money,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  addBookingNoteAction,
  cancelBookingAction,
  recordManualPaymentAction,
  resolveCancellationRequestAction,
} from "@/lib/admin/actions/bookings";
import { getBookingAdmin } from "@/lib/admin/queries";
import { FINANCE_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminBookingPage(props: PageProps<"/admin/bookings/[id]">) {
  const [{ id }, sp, ctx] = await Promise.all([props.params, props.searchParams, requireStaff()]);
  const data = await getBookingAdmin(id);
  if (!data) notFound();
  const {
    booking: b,
    customer,
    departure,
    tour,
    travelers,
    items,
    payments,
    refunds,
    notes,
    preferences,
  } = data;
  const canOps = ctx.can(OPS_ROLES);
  const canFinance = ctx.can(FINANCE_ROLES);
  const balance = Math.max(b.total_amount - b.amount_paid, 0);
  const active = !["cancelled", "refunded", "completed"].includes(b.status);

  const daysBefore = daysBetween(new Date().toISOString().slice(0, 10), departure.start_date);
  const sb = await createClient();
  const { data: policyPct } = await sb.rpc("refund_percentage_for", {
    policy: departure.cancellation_policy,
    days_before: daysBefore,
  });

  return (
    <>
      <PageHeader
        title={b.confirmation_number}
        crumbs={<Link href="/admin/bookings">Bookings</Link>}
        description={
          <>
            <StatusBadge kind="booking" status={b.status} />{" "}
            <StatusBadge kind="payment" status={b.payment_status} /> · {tour.name} ·{" "}
            <Link href={`/admin/departures/${departure.id}`}>
              {formatDateRange(departure.start_date, departure.end_date)}
            </Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Section title={`Travelers (${travelers.length})`}>
            <Table
              head={["Name", "Contact", "DOB", "Nationality", "Room / diet", "Emergency contact"]}
              rows={travelers.map((t) => [
                <span key="n">
                  <span className="font-medium">
                    {t.first_name} {t.last_name}
                  </span>
                  {t.preferred_name && (
                    <span className="text-muted-foreground"> ({t.preferred_name})</span>
                  )}
                  {t.isLead && (
                    <Badge variant="info" className="ml-2">
                      lead
                    </Badge>
                  )}
                </span>,
                <span key="c" className="text-xs">
                  {t.email ?? "—"}
                  <br />
                  {t.phone ?? ""}
                </span>,
                t.date_of_birth ? (
                  formatDate(t.date_of_birth)
                ) : (
                  <Badge variant="warning">missing</Badge>
                ),
                t.nationality ?? <Badge variant="warning">missing</Badge>,
                <span key="r" className="text-xs">
                  {t.room_preference.replace("_", " ")}
                  {t.dietary_requirements && (
                    <span className="block text-muted-foreground">{t.dietary_requirements}</span>
                  )}
                  {t.accessibility_notes && (
                    <span className="block text-muted-foreground">♿ {t.accessibility_notes}</span>
                  )}
                </span>,
                <span key="e" className="text-xs">
                  {t.emergency.map((e) => (
                    <span key={e.id} className="block">
                      {e.name} ({e.relationship}) · {e.phone}
                    </span>
                  ))}
                  {t.emergency.length === 0 && "—"}
                </span>,
              ])}
            />
            {preferences && (
              <p className="mt-3 text-xs text-muted-foreground">
                Arrival: {preferences.airport_transfer.replace(/_/g, " ")} · Room:{" "}
                {preferences.room_preference.replace("_", " ")}
              </p>
            )}
          </Section>

          <Section id="payments" title="Money">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded bg-cloud p-3">
                <p className="eyebrow text-muted-foreground">Total</p>
                <p className="num text-xl">{money(b.total_amount, b.currency)}</p>
              </div>
              <div className="rounded bg-cloud p-3">
                <p className="eyebrow text-muted-foreground">Paid</p>
                <p className="num text-xl">{money(b.amount_paid, b.currency)}</p>
                {b.amount_refunded > 0 && (
                  <p className="text-xs text-muted-foreground">
                    refunded {money(b.amount_refunded, b.currency)}
                  </p>
                )}
              </div>
              <div className="rounded bg-cloud p-3">
                <p className="eyebrow text-muted-foreground">Balance</p>
                <p className="num text-xl">{money(balance, b.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  due{" "}
                  {departure.balance_due_date
                    ? formatDate(departure.balance_due_date)
                    : "before departure"}
                </p>
              </div>
            </div>

            <h3 className="eyebrow mt-6 mb-2 text-muted-foreground">Line items</h3>
            <Table
              head={["Item", "Qty", "Unit", "Total"]}
              rows={items.map((i) => [
                i.title,
                i.quantity,
                money(i.unit_amount, i.currency),
                money(i.total_amount, i.currency),
              ])}
            />

            <h3 className="eyebrow mt-6 mb-2 text-muted-foreground">Payments</h3>
            <Table
              head={["When", "Kind", "Amount", "Stripe status", "Reference"]}
              rows={payments.map((p) => [
                formatDate(p.created_at.slice(0, 10)),
                p.kind,
                money(p.amount, p.currency),
                p.stripe_status,
                <span key="r" className="font-mono text-xs">
                  {p.stripe_payment_intent_id ?? "manual"}
                  {p.failure_message && (
                    <span className="block text-danger">{p.failure_message}</span>
                  )}
                </span>,
              ])}
              empty="No payments yet."
            />
            {refunds.length > 0 && (
              <>
                <h3 className="eyebrow mt-6 mb-2 text-muted-foreground">Refunds</h3>
                <Table
                  head={["When", "Amount", "Status", "Reason"]}
                  rows={refunds.map((r) => [
                    formatDate(r.created_at.slice(0, 10)),
                    money(r.amount, r.currency),
                    r.stripe_status,
                    r.reason ?? "—",
                  ])}
                />
              </>
            )}

            {canFinance && active && balance > 0 && (
              <form
                action={recordManualPaymentAction}
                className="mt-6 flex flex-wrap items-end gap-2 rounded border border-dashed border-border p-3"
              >
                <input type="hidden" name="bookingId" value={b.id} />
                <label className={labelClass}>
                  Record off-platform payment (major units)
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder={(balance / 100).toFixed(2)}
                    className={cn(inputClass, "w-40")}
                    required
                  />
                </label>
                <SubmitButton
                  size="sm"
                  variant="secondary"
                  confirm="Record this payment as received outside Stripe?"
                >
                  Record payment
                </SubmitButton>
              </form>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Customer">
            <DL
              rows={[
                ["Account", customer?.display_name ?? "—"],
                ["Booked", formatDate(b.created_at.slice(0, 10))],
                ["Terms", b.terms_version ?? "—"],
                [
                  "Hold",
                  b.hold_expires_at
                    ? `until ${new Date(b.hold_expires_at).toLocaleTimeString()}`
                    : "—",
                ],
                [
                  "Stripe session",
                  <span key="s" className="font-mono text-xs">
                    {b.stripe_checkout_session_id ?? "—"}
                  </span>,
                ],
              ]}
            />
          </Section>

          {data.cancellationRequests.length > 0 && (
            <Section
              id="cancellation"
              title="Cancellation request"
              description="What the customer asked for from their account. Cancel the booking below first (that issues the refund), then record the decision here."
            >
              <ul className="space-y-3 text-sm">
                {data.cancellationRequests.map((r) => (
                  <li key={r.id} className="rounded bg-cloud p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        <StatusBadge kind="generic" status={r.status} />{" "}
                        <span className="text-muted-foreground">
                          {formatDate(r.requested_at.slice(0, 10))} · quoted{" "}
                          {r.refund_percentage_quoted}% refund
                        </span>
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{r.reason}</p>
                    {r.staff_notes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Staff notes: {r.staff_notes}
                      </p>
                    )}
                    {r.status === "pending" && canOps && (
                      <form action={resolveCancellationRequestAction} className="mt-3 grid gap-2">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <input type="hidden" name="requestId" value={r.id} />
                        <label className={labelClass}>
                          Note to keep on file (optional)
                          <input name="staffNotes" className={inputClass} maxLength={2000} />
                        </label>
                        <div className="flex gap-2">
                          <SubmitButton
                            size="sm"
                            variant="secondary"
                            name="status"
                            value="approved"
                            confirm="Mark approved? Make sure the booking is cancelled and refunded first."
                          >
                            Mark approved
                          </SubmitButton>
                          <SubmitButton size="sm" variant="ghost" name="status" value="declined">
                            Decline
                          </SubmitButton>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {active && canOps && (
            <Section
              title="Cancel booking"
              description={`Policy today: ${policyPct ?? 0}% refund (${daysBefore} days before departure).`}
            >
              <form action={cancelBookingAction} className="grid gap-3">
                <input type="hidden" name="bookingId" value={b.id} />
                <label className={labelClass}>
                  Reason (shared with finance, not the customer)
                  <textarea name="reason" className={cn(inputClass, "h-16 py-1.5")} required />
                </label>
                {canFinance && (
                  <label className={labelClass}>
                    Override refund % (finance only)
                    <input
                      name="refundPercentageOverride"
                      type="number"
                      min={0}
                      max={100}
                      placeholder={String(policyPct ?? 0)}
                      className={cn(inputClass, "w-28")}
                    />
                  </label>
                )}
                <div>
                  <SubmitButton
                    size="sm"
                    variant="secondary"
                    className="border-danger text-danger hover:bg-danger-surface"
                    confirm="Cancel this booking? Seats are released immediately."
                  >
                    Cancel booking
                  </SubmitButton>
                </div>
              </form>
            </Section>
          )}
          {b.cancelled_at && (
            <Section title="Cancelled">
              <DL
                rows={[
                  ["When", formatDate(b.cancelled_at.slice(0, 10))],
                  ["Refund", `${b.refund_percentage ?? 0}%`],
                  ["Reason", b.cancellation_reason ?? "—"],
                ]}
              />
            </Section>
          )}

          <Section id="notes" title="Staff notes" description="Never shown to the customer.">
            <form action={addBookingNoteAction} className="mb-4 flex gap-2">
              <input type="hidden" name="bookingId" value={b.id} />
              <input name="body" placeholder="Add a note…" className={inputClass} required />
              <SubmitButton size="sm" variant="secondary">
                Add
              </SubmitButton>
            </form>
            <ul className="space-y-3 text-sm">
              {notes.map((n) => (
                <li key={n.id} className="rounded bg-cloud p-3">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(n.created_at.slice(0, 10))}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-muted-foreground">No notes.</li>}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
