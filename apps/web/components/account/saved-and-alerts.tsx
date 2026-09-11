import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Bell, Bookmark } from "lucide-react";
import { formatDate, formatDateRange } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/admin/submit-button";
import { stopAlertAction, toggleSavedTourAction } from "@/lib/growth/saved-actions";
import type { DestinationAlert, SavedTour } from "@/lib/growth/saved";

/**
 * The between-trips half of the account page: what you kept, and what you asked to hear about.
 *
 * Renders nothing when both are empty rather than showing an encouraging placeholder — an account
 * page full of empty states for features somebody has not used is noise, and the invitation to save
 * things belongs on the tour pages where there is something to save.
 */
export function SavedAndAlerts({
  saved,
  alerts,
}: {
  saved: SavedTour[];
  alerts: Array<DestinationAlert & { destinationName: string | null }>;
}) {
  if (saved.length === 0 && alerts.length === 0) return null;

  return (
    <section className="mt-12" id="saved">
      <h2 className="text-xl font-semibold">Kept for later</h2>

      {saved.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded border border-border bg-surface">
          {saved.map((s) => (
            <li key={s.tourId} className="flex flex-wrap items-center gap-4 p-5">
              <Bookmark className="h-4 w-4 text-teal" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {s.nextDeparture ? (
                    <>
                      Next {formatDateRange(s.nextDeparture.startDate, s.nextDeparture.endDate)}
                      {s.nextDeparture.notYetOpen && s.nextDeparture.opensAt
                        ? ` · opens ${formatDate(s.nextDeparture.opensAt.slice(0, 10))}`
                        : ""}
                    </>
                  ) : (
                    "No dates announced yet — we'll put some up."
                  )}
                </p>
                {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
              </div>
              <Link
                href={`/tours/${s.slug}` as Route}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Open
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
              <form action={toggleSavedTourAction}>
                <input type="hidden" name="tourId" value={s.tourId} />
                <input type="hidden" name="slug" value={s.slug} />
                <SubmitButton size="sm" variant="secondary" pendingText="Removing…">
                  Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {alerts.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium">You&rsquo;ll hear from us about</h3>
          <ul className="mt-3 divide-y divide-border rounded border border-border bg-surface">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                <Bell className="h-4 w-4 text-teal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.destinationName ?? a.wanted_place}</p>
                  {!a.destination_id && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Somewhere we don&rsquo;t go yet — we&rsquo;re counting.
                    </p>
                  )}
                </div>
                {!a.destination_id && <Badge variant="optional">a request</Badge>}
                <form action={stopAlertAction}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <SubmitButton size="sm" variant="secondary" pendingText="Stopping…">
                    Stop
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/whats-coming" className="mt-4 inline-block text-sm text-link no-underline">
        See everything that&rsquo;s coming →
      </Link>
    </section>
  );
}
