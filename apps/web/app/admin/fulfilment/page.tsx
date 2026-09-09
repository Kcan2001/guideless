import Link from "next/link";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, Stat, inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { failFulfilmentAction, recordFulfilmentAction } from "@/lib/admin/actions/fulfilment";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "To book" };
export const dynamic = "force-dynamic";

/**
 * Experiences a traveler has already paid us for and that somebody still has to buy from the
 * supplier.
 *
 * This screen exists because the model has a gap in it by design: we take the money first and
 * fulfil afterwards. That gap is fine as long as it is visible and has a deadline attached, and
 * unbearable if it is neither — so the queue is sorted by the date the traveler actually needs the
 * thing, and rows that are close say so loudly.
 */
export default async function AdminFulfilmentPage(props: PageProps<"/admin/fulfilment">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(OPS_ROLES)]);
  const sb = await createClient();

  const [{ data: queue }, { data: recent }] = await Promise.all([
    sb.from("fulfilment_queue").select("*").limit(100),
    sb
      .from("add_on_fulfilments")
      .select(
        "id, status, supplier_reference, travel_date, booked_at, failure_reason, departure_add_ons(title)",
      )
      .neq("status", "pending")
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);

  const rows = queue ?? [];
  const urgent = rows.filter((r) => (r.days_until ?? 99) <= 7).length;
  const overdue = rows.filter((r) => (r.days_until ?? 99) < 0).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="To book"
        description="Paid by the traveler, not yet bought from the supplier. Soonest first — these are promises with dates on them."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting" value={rows.length} hint="paid, not yet booked" />
        <Stat
          label="Within a week"
          value={urgent}
          tone={urgent > 0 ? "warning" : "neutral"}
          hint={urgent > 0 ? "book these today" : "nothing pressing"}
        />
        <Stat
          label="Date has passed"
          value={overdue}
          tone={overdue > 0 ? "warning" : "neutral"}
          hint={overdue > 0 ? "somebody has been let down — refund them" : "none"}
        />
      </div>

      <Section
        title="Queue"
        description="Buy it from the operator, then paste the reference here. The traveler sees it immediately."
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Every bought-in extra somebody has paid for has been booked.
          </p>
        ) : (
          <div className="grid gap-6">
            {rows.map((r) => {
              const days = r.days_until ?? 0;
              return (
                <article
                  key={r.id ?? r.booking_id}
                  className="border-b border-border pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium">{r.title}</p>
                    {r.operated_by && <Badge variant="neutral">via {r.operated_by}</Badge>}
                    {days < 0 ? (
                      <Badge variant="danger">the date has passed</Badge>
                    ) : days <= 7 ? (
                      <Badge variant="warning">
                        in {days} day{days === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.tour_name} ·{" "}
                    <Link href={`/admin/bookings/${r.booking_id ?? ""}`} className="text-link">
                      {r.confirmation_number}
                    </Link>{" "}
                    · {r.travelers} {r.travelers === 1 ? "traveler" : "travelers"} ·{" "}
                    {r.travel_date ? formatDate(r.travel_date) : "no date"} · option{" "}
                    <code>{r.supplier_option_id}</code>
                  </p>

                  <form
                    action={recordFulfilmentAction}
                    className="mt-4 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="fulfilmentId" value={r.id ?? ""} />
                    <div>
                      <label className={labelClass}>Their booking reference</label>
                      <input name="reference" required className={`${inputClass} w-48`} />
                    </div>
                    <div>
                      <label className={labelClass}>Voucher link (optional)</label>
                      <input name="voucherUrl" type="url" className={`${inputClass} w-64`} />
                    </div>
                    <div className="min-w-48 flex-1">
                      <label className={labelClass}>Anything the traveler needs to know</label>
                      <input
                        name="instructions"
                        className={inputClass}
                        placeholder="Meet at the fountain ten minutes before"
                      />
                    </div>
                    <SubmitButton size="sm" pendingText="Saving…">
                      Booked
                    </SubmitButton>
                  </form>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Couldn&rsquo;t book it
                    </summary>
                    <form
                      action={failFulfilmentAction}
                      className="mt-2 flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="fulfilmentId" value={r.id ?? ""} />
                      <div className="min-w-64 flex-1">
                        <label className={labelClass}>What happened (staff only)</label>
                        <input
                          name="reason"
                          required
                          className={inputClass}
                          placeholder="Sold out on the date; operator confirmed no availability"
                        />
                      </div>
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        pendingText="Saving…"
                        confirm="This traveler has paid for something they will not get. You will need to refund them. Continue?"
                      >
                        Can&rsquo;t be booked
                      </SubmitButton>
                    </form>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Recently handled" description="The last twenty-five, booked or written off.">
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(recent ?? []).map((r) => {
              const addOn = (r as unknown as { departure_add_ons: { title: string } | null })
                .departure_add_ons;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Badge variant={r.status === "booked" ? "included" : "danger"}>{r.status}</Badge>
                  <span className="font-medium">{addOn?.title ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {formatDate(r.travel_date)}
                    {r.supplier_reference ? ` · ${r.supplier_reference}` : ""}
                    {r.failure_reason ? ` · ${r.failure_reason}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
