import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { DL, PageHeader, Section, Stat, StatusBadge, Table, money } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cancelBookingAddOnAction } from "@/lib/admin/actions/extras";
import { getAddOnManifest } from "@/lib/admin/queries";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";

/** Who is on an add-on, for the supplier and the day-of sheet. */
export default async function AddOnManifestPage(
  props: PageProps<"/admin/departures/[id]/add-ons/[addOnId]">,
) {
  const [{ id, addOnId }, sp, ctx] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(),
  ]);
  const data = await getAddOnManifest(id, addOnId);
  if (!data) notFound();
  const { addOn, departure, tourName, manifest } = data;
  const canOps = ctx.can(OPS_ROLES);
  const live = manifest.filter((m) => m.status === "confirmed" || m.status === "pending");
  const confirmedUnits = manifest
    .filter((m) => m.status === "confirmed")
    .reduce((n, m) => n + m.quantity, 0);
  const pendingUnits = manifest
    .filter((m) => m.status === "pending")
    .reduce((n, m) => n + m.quantity, 0);
  const revenue = manifest
    .filter((m) => m.status === "confirmed")
    .reduce((n, m) => n + m.total_amount, 0);
  const date = addOn.day_number ? new Date(`${departure.start_date}T00:00:00Z`) : null;
  if (date) date.setUTCDate(date.getUTCDate() + (addOn.day_number! - 1));
  const capacityPct =
    addOn.capacity && addOn.capacity > 0
      ? Math.min(100, Math.round((confirmedUnits / addOn.capacity) * 100))
      : null;

  return (
    <>
      <PageHeader
        title={`${addOn.title} — manifest`}
        crumbs={
          <>
            <Link href="/admin/departures">Departures</Link> /{" "}
            <Link href={`/admin/departures/${departure.id}`}>
              {tourName} · {formatDateRange(departure.start_date, departure.end_date)}
            </Link>{" "}
            / Add-ons
          </>
        }
        actions={
          <a
            href={`/admin/departures/${departure.id}/add-ons/${addOn.id}/csv`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Download CSV
          </a>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Confirmed"
          value={String(confirmedUnits)}
          hint={addOn.capacity ? `of ${addOn.capacity}` : "no cap"}
        />
        <Stat label="Holding" value={String(pendingUnits)} hint="pending payment" />
        <Stat label="Revenue" value={money(revenue, addOn.currency)} hint="confirmed only" />
        <Stat
          label="Bookable until"
          value={formatDate(
            new Date(
              (date ?? new Date(`${departure.end_date}T00:00:00Z`)).getTime() -
                addOn.bookable_until_days_before * 86_400_000,
            )
              .toISOString()
              .slice(0, 10),
          )}
          hint={date ? `happens ${formatDate(date.toISOString().slice(0, 10))}` : "undated"}
        />
      </div>

      {capacityPct !== null && (
        <div className="mt-4" aria-label={`${capacityPct}% of capacity confirmed`}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-aqua" style={{ width: `${capacityPct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section
          title={`On the list (${live.length})`}
          description="Traveler, booking and what the supplier needs to know."
        >
          <Table
            head={[
              "Traveler",
              "Booking",
              "Qty",
              "Needs",
              "Status",
              "Paid",
              canOps ? "" : null,
            ].filter((h) => h !== null)}
            rows={live.map((m) => [
              <span key="t">
                {m.traveler_name ?? <span className="text-muted-foreground">Whole booking</span>}
                {m.customer_email && (
                  <span className="block text-xs text-muted-foreground">{m.customer_email}</span>
                )}
              </span>,
              <Link key="b" href={`/admin/bookings/${m.booking_id}`}>
                {m.confirmation_number}
              </Link>,
              m.quantity,
              <span key="n" className="text-xs">
                {m.dietary_requirements && (
                  <span className="block">Diet: {m.dietary_requirements}</span>
                )}
                {m.accessibility_notes && (
                  <span className="block">Access: {m.accessibility_notes}</span>
                )}
                {!m.dietary_requirements && !m.accessibility_notes && "—"}
              </span>,
              <StatusBadge key="s" kind="generic" status={m.status} />,
              money(m.total_amount, m.currency),
              ...(canOps
                ? [
                    <form key="c" action={cancelBookingAddOnAction}>
                      <input type="hidden" name="departureId" value={departure.id} />
                      <input type="hidden" name="addOnId" value={addOn.id} />
                      <input type="hidden" name="bookingAddOnId" value={m.id} />
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        confirm="Remove this traveler from the add-on? Refund separately on the booking."
                      >
                        Remove
                      </SubmitButton>
                    </form>,
                  ]
                : []),
            ])}
            empty="Nobody has added this yet."
          />
          {manifest.length > live.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              {manifest.length - live.length} cancelled or refunded rows are excluded from the list
              but in the CSV.
            </p>
          )}
        </Section>
        <Section title="Add-on">
          <DL
            rows={[
              ["Kind", addOn.kind.replace("_", " ")],
              [
                "Price",
                `${money(addOn.price_amount, addOn.currency)} ${addOn.pricing_basis === "per_traveler" ? "per traveler" : "per booking"}`,
              ],
              [
                "When",
                date
                  ? `Day ${addOn.day_number} · ${formatDate(date.toISOString().slice(0, 10))}${addOn.start_time ? ` · ${addOn.start_time.slice(0, 5)}` : ""}`
                  : "Undated",
              ],
              ["Where", addOn.location_name ?? "—"],
              ["Tier group", addOn.tier_group ?? "—"],
              ["Cancellable until", `${addOn.cancellable_until_days_before} days before`],
              ["Visible", addOn.is_active ? "Yes" : "Hidden"],
            ]}
          />
        </Section>
      </div>
    </>
  );
}
