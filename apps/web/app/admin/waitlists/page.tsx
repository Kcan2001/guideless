import { formatDate, formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import {
  grantDepartureUnlockAction,
  notifyWaitlistAction,
  saveDepartureUnlockAction,
  setDepartureDropAction,
} from "@/lib/admin/actions/growth";
import { listWaitlists } from "@/lib/growth/admin-queries";
import { requireStaff } from "@/lib/auth/staff";

export const metadata = { title: "Waitlists" };

/**
 * Demand that has nowhere to go yet: who is waiting, which departures have not dropped, and what
 * the group unlocks. Notifying marks the rows and writes an in-app notice; email is still manual.
 */
export default async function AdminWaitlistsPage(props: PageProps<"/admin/waitlists">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff()]);
  const { departures, tourOnly } = await listWaitlists();

  return (
    <>
      <PageHeader
        title="Waitlists"
        description="Who is waiting, when each departure drops, and what the group unlocks."
      />
      <Flash searchParams={sp} />

      <Section
        title={`Departures (${departures.length})`}
        description="Waiting counts include people we have already told."
      >
        <div className="space-y-6">
          {departures.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nobody is waiting on a specific departure yet.
            </p>
          )}
          {departures.map((d) => (
            <div key={d.departureId} className="rounded border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {d.tourName}{" "}
                    <span className="text-muted-foreground">
                      {formatDateRange(d.startDate, d.endDate)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.waiting} waiting · {d.notified} already told ·{" "}
                    {d.opensAt ? `drops ${formatDate(d.opensAt.slice(0, 10))}` : "open now"}
                  </p>
                </div>
                <StatusBadge kind="generic" status={d.status} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <form action={notifyWaitlistAction} className="rounded border border-border p-3">
                  <input type="hidden" name="departureId" value={d.departureId} />
                  <p className="text-sm font-medium">Tell them it is open</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marks {d.waiting - d.notified} unnotified{" "}
                    {d.waiting - d.notified === 1 ? "person" : "people"} and writes an in-app
                    notice. Email is not sent automatically.
                  </p>
                  <SubmitButton className="mt-3" size="sm" disabled={d.waiting - d.notified === 0}>
                    Mark notified
                  </SubmitButton>
                </form>

                <form action={setDepartureDropAction} className="rounded border border-border p-3">
                  <input type="hidden" name="departureId" value={d.departureId} />
                  <label className="text-sm font-medium" htmlFor={`drop-${d.departureId}`}>
                    Drop at
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Until then the dates show a countdown and the waitlist instead of a booking
                    button. Clear to open now.
                  </p>
                  <input
                    id={`drop-${d.departureId}`}
                    name="opensAt"
                    type="datetime-local"
                    defaultValue={d.opensAt ? d.opensAt.slice(0, 16) : ""}
                    className="mt-2 h-9 w-full rounded border border-border px-2 text-sm"
                  />
                  <SubmitButton className="mt-3" size="sm" variant="secondary">
                    Save drop
                  </SubmitButton>
                </form>

                <form
                  action={saveDepartureUnlockAction}
                  className="rounded border border-border p-3"
                >
                  <input type="hidden" name="departureId" value={d.departureId} />
                  <p className="text-sm font-medium">Group unlock</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    At N confirmed travelers everyone gets this. Granting it stays a staff action.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      name="threshold"
                      type="number"
                      min={2}
                      max={200}
                      required
                      placeholder="8"
                      aria-label="Travelers needed"
                      className="h-9 w-20 rounded border border-border px-2 text-sm"
                    />
                    <input
                      name="reward"
                      required
                      maxLength={200}
                      placeholder="A harbour boat for everyone"
                      aria-label="What they get"
                      className="h-9 min-w-0 flex-1 rounded border border-border px-2 text-sm"
                    />
                  </div>
                  <input type="hidden" name="isActive" value="on" />
                  <SubmitButton className="mt-3" size="sm" variant="secondary">
                    Save unlock
                  </SubmitButton>
                </form>
              </div>

              {d.unlocks.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                  {d.unlocks.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{u.threshold} travelers</span>
                      <span className="text-muted-foreground">{u.reward}</span>
                      <StatusBadge
                        kind="generic"
                        status={
                          u.grantedAt
                            ? "granted"
                            : d.confirmed >= u.threshold
                              ? "reached"
                              : "waiting"
                        }
                      />
                      {!u.grantedAt && d.confirmed >= u.threshold && (
                        <form action={grantDepartureUnlockAction}>
                          <input type="hidden" name="unlockId" value={u.id} />
                          <SubmitButton size="sm" variant="secondary">
                            Mark granted
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={`Whole-tour interest (${tourOnly.length})`}
        description="People who asked about a tour with no open dates at all."
      >
        <Table
          head={["Tour", "Email", "Party", "Asked", "Told"]}
          rows={tourOnly.map((w) => [
            w.tourName,
            w.email,
            String(w.partySize),
            formatDate(w.createdAt.slice(0, 10)),
            w.notifiedAt ? formatDate(w.notifiedAt.slice(0, 10)) : "—",
          ])}
          empty="Nobody is waiting on a tour without dates."
        />
      </Section>
    </>
  );
}
