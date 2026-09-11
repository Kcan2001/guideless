import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { SUPPLIER_SERVICE_STATUSES } from "@guideless/types";
import { formatDate, formatDateRange } from "@guideless/utils";
import { DepartureForm } from "@/components/admin/departure-form";
import { AddOnForm, StayOptionForm } from "@/components/admin/extras-forms";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  DL,
  PageHeader,
  Section,
  Stat,
  StatusBadge,
  Table,
  inputClass,
  labelClass,
  money,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  activateTripAction,
  addDepartureNoteAction,
  addGroupAction,
  addSupplierServiceAction,
  assignTravelerGroupAction,
  createSupplierAction,
  updateDepartureAction,
  updateSupplierServiceStatusAction,
} from "@/lib/admin/actions/departures";
import { toggleAddOnAction, toggleStayOptionAction } from "@/lib/admin/actions/extras";
import { getDepartureAdmin, listDepartureExtrasAdmin } from "@/lib/admin/queries";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

export default async function AdminDeparturePage(props: PageProps<"/admin/departures/[id]">) {
  const [{ id }, sp, ctx] = await Promise.all([props.params, props.searchParams, requireStaff()]);
  const [data, extras] = await Promise.all([getDepartureAdmin(id), listDepartureExtrasAdmin(id)]);
  if (!data) notFound();
  const {
    departure: d,
    tour,
    version,
    availability: a,
    groups,
    bookings,
    trips,
    services,
    suppliers,
    notes,
    issues,
  } = data;
  const canOps = ctx.can(OPS_ROLES);
  const travelers = bookings.flatMap((b) => b.travelers.map((t) => ({ ...t, booking: b.booking })));
  const tripByGroup = new Map(trips.map((t) => [t.departure_group_id, t]));
  const groupName = (gid: string | null) => groups.find((g) => g.id === gid)?.name ?? "—";

  return (
    <>
      <PageHeader
        title={`${tour.name} · ${formatDateRange(d.start_date, d.end_date)}`}
        crumbs={<Link href="/admin/departures">Departures</Link>}
        description={
          <>
            <StatusBadge kind="departure" status={d.status} /> · version {version.version_number} ·{" "}
            {d.timezone}
          </>
        }
        actions={
          <>
            <Link
              href={`/admin/departures/${d.id}/manifest`}
              className={buttonVariants({ size: "sm" })}
            >
              Manifest
            </Link>
            <Link
              href={`/tours/${tour.slug}/departures/${d.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Public page
            </Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Confirmed"
          value={`${a.confirmed} / ${d.capacity}`}
          hint={`minimum ${d.minimum_travelers}`}
          tone={a.confirmed >= d.minimum_travelers ? "good" : "warning"}
        />
        <Stat label="On hold" value={a.held} hint="pending payment" />
        <Stat label="Available" value={a.available} />
        <Stat
          label="Price"
          value={money(d.price_amount, d.currency)}
          hint={`deposit ${money(d.deposit_amount, d.currency)}`}
        />
      </div>

      {issues.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#D9A441]/50 bg-[#D9A441]/10 p-4 text-sm">
          <p className="font-semibold">Issues</p>
          <ul className="mt-2 space-y-1">
            {issues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                {i.severity === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" aria-hidden />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 text-cyan" aria-hidden />
                )}
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <Section
          id="travelers"
          title={`Travelers (${travelers.length})`}
          description="Everyone on a booking for this departure, with group assignment."
        >
          <Table
            head={["Traveler", "Booking", "Status", "Info", "Group"]}
            rows={travelers.map((t) => [
              <span key="n">
                <span className="font-medium">
                  {t.first_name} {t.last_name}
                </span>
                {t.isLead && (
                  <Badge variant="info" className="ml-2">
                    lead
                  </Badge>
                )}
                <span className="block text-xs text-muted-foreground">
                  {t.email ?? "no email"}
                  {t.phone ? ` · ${t.phone}` : ""}
                </span>
              </span>,
              <Link key="b" href={`/admin/bookings/${t.booking.id}`} className="text-sm">
                {t.booking.confirmation_number}
              </Link>,
              <StatusBadge key="s" kind="booking" status={t.booking.status} />,
              <span key="i" className="text-xs">
                {!t.date_of_birth && <Badge variant="warning">no DOB</Badge>}{" "}
                {!t.nationality && <Badge variant="warning">no nationality</Badge>}
                {t.date_of_birth && t.nationality && (
                  <span className="text-muted-foreground">complete</span>
                )}
              </span>,
              canOps ? (
                <form
                  key="g"
                  action={assignTravelerGroupAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="departureId" value={d.id} />
                  <input type="hidden" name="bookingId" value={t.booking.id} />
                  <input type="hidden" name="travelerId" value={t.id} />
                  <select
                    name="groupId"
                    defaultValue={t.groupId ?? ""}
                    className={cn(inputClass, "h-8 w-32")}
                  >
                    <option value="">Unassigned</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton size="sm" variant="ghost" className="h-8">
                    Save
                  </SubmitButton>
                </form>
              ) : (
                groupName(t.groupId)
              ),
            ])}
            empty="No travelers yet."
          />
        </Section>

        <Section id="bookings" title={`Bookings (${bookings.length})`}>
          <Table
            head={["Confirmation", "Customer", "Travelers", "Status", "Payment", "Paid / Total"]}
            rows={bookings.map(({ booking: b, customer, travelers: bt }) => [
              <Link
                key="c"
                href={`/admin/bookings/${b.id}`}
                className="font-medium text-foreground no-underline hover:text-link"
              >
                {b.confirmation_number}
              </Link>,
              customer?.display_name ?? <span className="text-muted-foreground">—</span>,
              bt.length,
              <StatusBadge key="s" kind="booking" status={b.status} />,
              <StatusBadge key="p" kind="payment" status={b.payment_status} />,
              `${money(b.amount_paid, b.currency)} / ${money(b.total_amount, b.currency)}`,
            ])}
            empty="No bookings yet."
          />
        </Section>

        <Section
          id="trips"
          title="Groups & trips"
          description="Activating a group snapshots the itinerary into a live trip travelers can see (ADR-009)."
          actions={
            canOps && (
              <form action={addGroupAction}>
                <input type="hidden" name="departureId" value={d.id} />
                <SubmitButton size="sm" variant="secondary">
                  Add group
                </SubmitButton>
              </form>
            )
          }
        >
          <Table
            head={["Group", "Travelers assigned", "Trip", ""]}
            rows={groups.map((g) => {
              const trip = tripByGroup.get(g.id);
              const assigned = travelers.filter((t) => t.groupId === g.id).length;
              return [
                <span key="g" className="font-medium">
                  {g.name}
                </span>,
                `${assigned}${groups.length === 1 ? ` (+${travelers.filter((t) => !t.groupId).length} unassigned → this group)` : ""}`,
                trip ? (
                  <span key="t">
                    <StatusBadge kind="trip" status={trip.status} />{" "}
                    <span className="text-xs text-muted-foreground">
                      {trip.itemCount} items · {trip.memberCount} members
                    </span>
                  </span>
                ) : (
                  <span key="t" className="text-muted-foreground">
                    not activated
                  </span>
                ),
                trip ? (
                  <Link
                    key="a"
                    href={`/admin/departures/${d.id}/trips/${trip.id}`}
                    className="text-sm"
                  >
                    Live itinerary
                  </Link>
                ) : canOps ? (
                  <form key="a" action={activateTripAction}>
                    <input type="hidden" name="departureId" value={d.id} />
                    <input type="hidden" name="groupId" value={g.id} />
                    <SubmitButton
                      size="sm"
                      confirm={`Create the trip for ${g.name}? Confirmed travelers get access to the itinerary and chat.`}
                    >
                      Activate trip
                    </SubmitButton>
                  </form>
                ) : (
                  "—"
                ),
              ];
            })}
          />
        </Section>

        <Section
          id="stays"
          title={`Stay options (${extras.stays.length})`}
          description="Accommodation tiers customers choose at booking. One group, different hotels. Deltas are per traveler."
        >
          <div className="space-y-6">
            {extras.stays.map((st) => (
              <details key={st.id} className="rounded-lg border border-border p-4" open={false}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{st.name}</span>
                    {st.star_rating ? (
                      <span className="ml-1 text-muted-foreground">
                        {"★".repeat(st.star_rating)}
                      </span>
                    ) : null}
                    {st.is_default && (
                      <Badge variant="included" className="ml-2">
                        Default
                      </Badge>
                    )}
                    {!st.is_active && (
                      <Badge variant="neutral" className="ml-2">
                        Hidden
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {st.price_delta_amount === 0
                      ? "included"
                      : `${st.price_delta_amount > 0 ? "+" : "−"}${money(Math.abs(st.price_delta_amount), d.currency)} / traveler`}
                    {" · "}
                    {st.taken} booked{st.capacity !== null ? ` of ${st.capacity}` : ""}
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  <StayOptionForm
                    departureId={d.id}
                    stay={st}
                    destinations={extras.destinations}
                    hotels={extras.hotels}
                    currency={d.currency}
                    disabled={!canOps}
                  />
                  {canOps && (
                    <form action={toggleStayOptionAction}>
                      <input type="hidden" name="departureId" value={d.id} />
                      <input type="hidden" name="stayOptionId" value={st.id} />
                      <input type="hidden" name="isActive" value={String(!st.is_active)} />
                      <SubmitButton size="sm" variant="ghost">
                        {st.is_active ? "Hide from customers" : "Make bookable"}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </details>
            ))}
            {canOps && (
              <details className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Add a stay option</summary>
                <div className="mt-4">
                  <StayOptionForm
                    departureId={d.id}
                    destinations={extras.destinations}
                    hotels={extras.hotels}
                    currency={d.currency}
                  />
                </div>
              </details>
            )}
            {extras.stays.length === 0 && !canOps && (
              <p className="text-sm text-muted-foreground">
                No stay options; everyone books the base hotels.
              </p>
            )}
          </div>
        </Section>

        <Section
          id="add-ons"
          title={`Add-ons (${extras.addOns.length})`}
          description="Optional extras paid in full at booking or any time later. Each has a manifest for the supplier."
        >
          <Table
            head={["Add-on", "Price", "When", "Booked", "Status", ""]}
            rows={extras.addOns.map((a) => [
              <span key="t">
                <Link href={`/admin/departures/${d.id}/add-ons/${a.id}`} className="font-medium">
                  {a.title}
                </Link>
                {a.tier_group && (
                  <span className="block text-xs text-muted-foreground">tier: {a.tier_group}</span>
                )}
              </span>,
              `${money(a.price_amount, a.currency)} ${a.pricing_basis === "per_traveler" ? "/ traveler" : "/ booking"}`,
              a.day_number
                ? `Day ${a.day_number}${a.start_time ? ` · ${a.start_time.slice(0, 5)}` : ""}`
                : "Undated",
              <span key="b">
                {a.confirmed}
                {a.held > 0 ? ` (+${a.held} holding)` : ""}
                {a.capacity !== null ? ` of ${a.capacity}` : ""}
              </span>,
              a.is_active ? (
                <Badge key="s" variant="included">
                  Bookable
                </Badge>
              ) : (
                <Badge key="s" variant="neutral">
                  Hidden
                </Badge>
              ),
              <Link key="m" href={`/admin/departures/${d.id}/add-ons/${a.id}`} className="text-sm">
                Manifest
              </Link>,
            ])}
            empty="No add-ons yet."
          />
          <div className="mt-6 space-y-4">
            {extras.addOns.map((a) => (
              <details key={a.id} className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Edit: {a.title}</summary>
                <div className="mt-4 space-y-3">
                  <AddOnForm
                    departureId={d.id}
                    addOn={a}
                    currency={d.currency}
                    durationDays={tour.duration_days}
                    disabled={!canOps}
                  />
                  {canOps && (
                    <form action={toggleAddOnAction}>
                      <input type="hidden" name="departureId" value={d.id} />
                      <input type="hidden" name="addOnId" value={a.id} />
                      <input type="hidden" name="isActive" value={String(!a.is_active)} />
                      <SubmitButton size="sm" variant="ghost">
                        {a.is_active ? "Hide from customers" : "Make bookable"}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </details>
            ))}
            {canOps && (
              <details className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Add an add-on</summary>
                <div className="mt-4">
                  <AddOnForm
                    departureId={d.id}
                    currency={d.currency}
                    durationDays={tour.duration_days}
                  />
                </div>
              </details>
            )}
          </div>
        </Section>

        <Section
          id="suppliers"
          title="Supplier services"
          description="Hotels, rail, transfers, activities. Costs are staff-only."
          actions={
            canOps && (
              <details className="text-sm">
                <summary className="cursor-pointer text-link">New supplier</summary>
                <form
                  action={createSupplierAction}
                  className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-cloud p-3"
                >
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/admin/departures/${d.id}#suppliers`}
                  />
                  <input
                    name="name"
                    placeholder="Supplier name"
                    className={cn(inputClass, "w-44")}
                    required
                  />
                  <select name="kind" className={cn(inputClass, "w-32")} defaultValue="hotel">
                    {["hotel", "rail", "transfer", "activity", "restaurant", "other"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <input
                    name="countryCode"
                    placeholder="FR"
                    maxLength={2}
                    className={cn(inputClass, "w-16 uppercase")}
                  />
                  <SubmitButton size="sm" variant="secondary">
                    Add supplier
                  </SubmitButton>
                </form>
              </details>
            )
          }
        >
          <Table
            head={["Service", "Supplier", "Status", "Confirmation", "Cost", "Deadline", ""]}
            rows={services.map((s) => [
              <span key="t">
                <span className="font-medium">{s.title}</span>
                {s.internal_notes && (
                  <span className="block text-xs text-muted-foreground">{s.internal_notes}</span>
                )}
              </span>,
              s.supplier?.name ?? "—",
              <Badge
                key="s"
                variant={
                  s.status === "confirmed"
                    ? "included"
                    : s.status === "cancelled" || s.status === "failed"
                      ? "danger"
                      : "warning"
                }
              >
                {s.status}
              </Badge>,
              s.confirmation_number ?? <span className="text-muted-foreground">—</span>,
              s.cost_amount != null && s.cost_currency
                ? money(s.cost_amount, s.cost_currency)
                : "—",
              s.cancellation_deadline ? formatDate(s.cancellation_deadline.slice(0, 10)) : "—",
              canOps ? (
                <form
                  key="u"
                  action={updateSupplierServiceStatusAction}
                  className="flex items-center gap-1"
                >
                  <input type="hidden" name="departureId" value={d.id} />
                  <input type="hidden" name="serviceId" value={s.id} />
                  <select
                    name="status"
                    defaultValue={s.status}
                    className={cn(inputClass, "h-8 w-28")}
                  >
                    {SUPPLIER_SERVICE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <input
                    name="confirmationNumber"
                    placeholder="Conf #"
                    className={cn(inputClass, "h-8 w-24")}
                  />
                  <SubmitButton size="sm" variant="ghost" className="h-8">
                    Save
                  </SubmitButton>
                </form>
              ) : (
                ""
              ),
            ])}
            empty="No supplier services recorded."
          />
          {canOps && (
            <form
              action={addSupplierServiceAction}
              className="mt-5 grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-4"
            >
              <input type="hidden" name="departureId" value={d.id} />
              <label className={labelClass}>
                Supplier
                <select name="supplierId" className={inputClass} required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kind})
                    </option>
                  ))}
                </select>
              </label>
              <label className={cn(labelClass, "sm:col-span-2")}>
                Service
                <input
                  name="title"
                  placeholder="Nice hotel block, 3 nights"
                  className={inputClass}
                  required
                />
              </label>
              <label className={labelClass}>
                Status
                <select name="status" className={inputClass} defaultValue="requested">
                  {SUPPLIER_SERVICE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Cost (major units)
                <input
                  name="cost"
                  inputMode="decimal"
                  placeholder="1200.00"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Cost currency
                <select name="costCurrency" className={inputClass} defaultValue="EUR">
                  <option>EUR</option>
                  <option>USD</option>
                  <option>GBP</option>
                </select>
              </label>
              <label className={labelClass}>
                Confirmation #
                <input name="confirmationNumber" className={inputClass} />
              </label>
              <label className={labelClass}>
                Cancellation deadline
                <input name="cancellationDeadline" type="datetime-local" className={inputClass} />
              </label>
              <label className={cn(labelClass, "sm:col-span-3")}>
                Internal notes
                <input name="internalNotes" className={inputClass} />
              </label>
              <div className="flex items-end">
                <SubmitButton size="sm">Record service</SubmitButton>
              </div>
            </form>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Section
            title="Settings"
            description="Changing the version is not possible here; create a new departure for a new version."
          >
            <DepartureForm
              action={updateDepartureAction}
              tours={[
                {
                  id: tour.id,
                  name: tour.name,
                  current_version_id: tour.current_version_id,
                  duration_days: tour.duration_days,
                },
              ]}
              departure={d}
              disabled={!canOps}
              submitLabel="Save departure"
            />
          </Section>

          <Section id="notes" title="Staff notes" description="Never shown to travelers.">
            <form action={addDepartureNoteAction} className="mb-4 flex gap-2">
              <input type="hidden" name="departureId" value={d.id} />
              <input name="body" placeholder="Add a note…" className={inputClass} required />
              <SubmitButton size="sm" variant="secondary">
                Add
              </SubmitButton>
            </form>
            <ul className="space-y-3 text-sm">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-cloud p-3">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(n.created_at.slice(0, 10))}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-muted-foreground">No notes.</li>}
            </ul>
            <div className="mt-6">
              <DL
                rows={[
                  ["Booking deadline", d.booking_deadline ? formatDate(d.booking_deadline) : "—"],
                  ["Balance due", d.balance_due_date ? formatDate(d.balance_due_date) : "—"],
                  ["Created", formatDate(d.created_at.slice(0, 10))],
                ]}
              />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
