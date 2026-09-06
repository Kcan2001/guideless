import Link from "next/link";
import { notFound } from "next/navigation";
import { TRIP_STATUSES } from "@guideless/types";
import { formatDate, formatDateRange, formatInZone } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { ItineraryEditor } from "@/components/admin/itinerary-editor";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge, Table, inputClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  addTripItemAction,
  addTripNoteAction,
  createLiveMomentAction,
  deleteTripItemAction,
  setLiveMomentStatusAction,
  setTripStatusAction,
  updateTripItemAction,
} from "@/lib/admin/actions/trips";
import { getTripAdmin } from "@/lib/admin/queries";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

export default async function AdminTripPage(
  props: PageProps<"/admin/departures/[id]/trips/[tripId]">,
) {
  const [{ id, tripId }, sp, ctx] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(),
  ]);
  const data = await getTripAdmin(tripId);
  if (!data || data.departure.id !== id) notFound();
  const { trip, departure, tour, days, members, notes, destinations, moments } = data;
  const canOps = ctx.can(OPS_ROLES);

  return (
    <>
      <PageHeader
        title={`${trip.name} — live itinerary`}
        crumbs={
          <>
            <Link href="/admin/departures">Departures</Link> /{" "}
            <Link href={`/admin/departures/${departure.id}`}>
              {formatDateRange(departure.start_date, departure.end_date)}
            </Link>
          </>
        }
        description={
          <>
            <StatusBadge kind="trip" status={trip.status} /> · snapshot taken{" "}
            {trip.snapshot_taken_at ? formatDate(trip.snapshot_taken_at.slice(0, 10)) : "—"} · edits
            here are what travelers see; the tour template is untouched.
          </>
        }
        actions={
          canOps && (
            <form action={setTripStatusAction} className="flex items-center gap-2">
              <input type="hidden" name="departureId" value={departure.id} />
              <input type="hidden" name="tripId" value={trip.id} />
              <select name="status" defaultValue={trip.status} className={cn(inputClass, "w-36")}>
                {TRIP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <SubmitButton size="sm" variant="secondary">
                Set status
              </SubmitButton>
            </form>
          )
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Section title="Itinerary" description={`${tour.name} · times local to each item's zone.`}>
          <ItineraryEditor
            scope="trip"
            hidden={{ departureId: departure.id, tripId: trip.id }}
            days={days.map((d) => ({
              ...d,
              destination: d.destination
                ? { id: d.destination.id, name: d.destination.name }
                : null,
            }))}
            destinations={destinations}
            defaultTimezone={trip.timezone}
            locked={!canOps}
            actions={{
              addItem: addTripItemAction,
              updateItem: updateTripItemAction,
              deleteItem: deleteTripItemAction,
            }}
          />
        </Section>

        <div className="space-y-6">
          <Section
            title={`Members (${members.length})`}
            description="Travelers with app access to this trip."
          >
            <Table
              head={["Member", "Role", "Joined"]}
              rows={members.map((m) => [
                <span key="n">
                  {m.profile?.display_name ?? m.user_id.slice(0, 8)}
                  {m.removed_at && (
                    <Badge variant="danger" className="ml-2">
                      removed
                    </Badge>
                  )}
                </span>,
                m.member_role,
                formatDate(m.joined_at.slice(0, 10)),
              ])}
              empty="No members yet — travelers are enrolled when their booking is confirmed at activation."
            />
          </Section>

          <Section
            id="moments"
            title={`Live Moments (${moments.length})`}
            description="Optional gatherings announced to the group. Travelers can suggest their own; official ones carry the Guideless badge."
          >
            {canOps && (
              <form action={createLiveMomentAction} className="mb-4 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="departureId" value={departure.id} />
                <input type="hidden" name="tripId" value={trip.id} />
                <label className="text-sm sm:col-span-2">
                  <span className="sr-only">Title</span>
                  <input
                    name="title"
                    placeholder="e.g. Sunset drinks on the terrace"
                    className={inputClass}
                    required
                    minLength={3}
                    maxLength={120}
                  />
                </label>
                <label className="text-sm">
                  <span className="sr-only">Date</span>
                  <input type="date" name="date" className={inputClass} required />
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-sm">
                    <span className="sr-only">Start time</span>
                    <input type="time" name="startTime" className={inputClass} required />
                  </label>
                  <label className="flex-1 text-sm">
                    <span className="sr-only">End time</span>
                    <input type="time" name="endTime" className={inputClass} />
                  </label>
                </div>
                <label className="text-sm">
                  <span className="sr-only">Location</span>
                  <input
                    name="locationName"
                    placeholder="Where (e.g. Hotel lobby)"
                    className={inputClass}
                    maxLength={200}
                  />
                </label>
                <label className="text-sm">
                  <span className="sr-only">Capacity</span>
                  <input
                    type="number"
                    name="capacity"
                    min={1}
                    max={500}
                    placeholder="Max people (optional)"
                    className={inputClass}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="sr-only">Details</span>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Details travelers should know (optional)"
                    className={inputClass}
                    maxLength={2000}
                  />
                </label>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <select
                    name="status"
                    defaultValue="scheduled"
                    className={inputClass}
                    aria-label="Publish state"
                  >
                    <option value="scheduled">Announce now</option>
                    <option value="draft">Save as draft</option>
                  </select>
                  <SubmitButton size="sm">Add moment</SubmitButton>
                </div>
              </form>
            )}
            <ul className="space-y-3 text-sm">
              {moments.map((m) => (
                <li key={m.id} className="rounded-lg bg-cloud p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {m.title}{" "}
                        {m.is_official ? (
                          <Badge variant="guideless">Guideless</Badge>
                        ) : (
                          <Badge variant="traveler">Traveler</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatInZone(m.start_at, m.timezone)}
                        {m.location_name ? ` · ${m.location_name}` : ""} · {m.joined} going
                        {m.capacity ? ` of ${m.capacity}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="generic" status={m.status} />
                      {canOps && (
                        <form action={setLiveMomentStatusAction} className="flex gap-1">
                          <input type="hidden" name="departureId" value={departure.id} />
                          <input type="hidden" name="tripId" value={trip.id} />
                          <input type="hidden" name="momentId" value={m.id} />
                          {m.status === "draft" && (
                            <SubmitButton
                              size="sm"
                              variant="secondary"
                              name="status"
                              value="scheduled"
                            >
                              Announce
                            </SubmitButton>
                          )}
                          {m.status === "scheduled" && (
                            <SubmitButton size="sm" variant="secondary" name="status" value="live">
                              Start
                            </SubmitButton>
                          )}
                          {m.status === "live" && (
                            <SubmitButton
                              size="sm"
                              variant="secondary"
                              name="status"
                              value="completed"
                            >
                              Finish
                            </SubmitButton>
                          )}
                          {(m.status === "draft" ||
                            m.status === "scheduled" ||
                            m.status === "live") && (
                            <SubmitButton size="sm" variant="ghost" name="status" value="cancelled">
                              Cancel
                            </SubmitButton>
                          )}
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {moments.length === 0 && (
                <li className="text-muted-foreground">Nothing planned yet.</li>
              )}
            </ul>
          </Section>

          <Section id="notes" title="Staff notes" description="Never shown to travelers.">
            <form action={addTripNoteAction} className="mb-4 flex gap-2">
              <input type="hidden" name="departureId" value={departure.id} />
              <input type="hidden" name="tripId" value={trip.id} />
              <input
                name="body"
                placeholder="e.g. Room 12 arriving a day early"
                className={inputClass}
                required
              />
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
          </Section>
        </div>
      </div>
    </>
  );
}
