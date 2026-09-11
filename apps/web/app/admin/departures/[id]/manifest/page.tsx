import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { formatDateRange } from "@guideless/utils";
import { PageHeader, Section, Stat, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDepartureManifest } from "@/lib/admin/ops";
import { missingDetails, sharingWith } from "@/lib/admin/manifest";

export const metadata: Metadata = { title: "Manifest" };
export const dynamic = "force-dynamic";

/**
 * The sheet an operator takes to a hotel. Print styles strip the admin chrome and break between
 * sections, so Cmd-P produces something you can hand over.
 */
export default async function ManifestPage(props: PageProps<"/admin/departures/[id]/manifest">) {
  const { id } = await props.params;
  const data = await getDepartureManifest(id);
  if (!data) notFound();
  const { departure, tour, travelers, rooming } = data;

  const incomplete = travelers.filter((t) => missingDetails(t).length > 0);
  const dietary = travelers.filter((t) => t.dietary);
  const accessibility = travelers.filter((t) => t.accessibility);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Manifest"
          crumbs={
            <>
              <Link href="/admin/departures">Departures</Link> ·{" "}
              <Link href={`/admin/departures/${departure.id}`}>{tour.name}</Link>
            </>
          }
          description={`${formatDateRange(departure.start_date, departure.end_date)} · ${travelers.length} confirmed travelers`}
          actions={
            <a
              href={`/admin/departures/${departure.id}/manifest/csv`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Download CSV
            </a>
          }
        />
      </div>

      {/* Print header: the page loses its chrome, so the sheet has to name itself. */}
      <header className="hidden print:mb-6 print:block">
        <h1 className="text-2xl font-bold">{tour.name}</h1>
        <p className="text-sm">
          {formatDateRange(departure.start_date, departure.end_date)} · {travelers.length} travelers
          · Guideless Travel
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-4 print:hidden">
        <Stat label="Travelers" value={travelers.length} hint="confirmed" />
        <Stat
          label="Rooms"
          value={rooming.rooms.length}
          hint={`${rooming.sharing} shared, ${rooming.ownRoom} single`}
        />
        <Stat
          label="Dietary notes"
          value={dietary.length}
          hint={accessibility.length > 0 ? `${accessibility.length} accessibility` : "none flagged"}
        />
        <Stat
          label="Missing details"
          value={incomplete.length}
          hint={incomplete.length === 0 ? "ready for suppliers" : "date of birth or nationality"}
          tone={incomplete.length > 0 ? "warning" : "good"}
        />
      </div>

      {rooming.overfilled.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded border border-danger-border bg-danger-surface p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <span>
            {rooming.overfilled.length} room
            {rooming.overfilled.length === 1 ? " holds" : "s hold"} more than two travelers, which
            booking does not allow. Check the room numbers on{" "}
            {rooming.overfilled.map((r) => r.confirmationNumber).join(", ")}.
          </span>
        </p>
      )}

      <div className="mt-6 break-inside-avoid print:mt-4">
        <Section title="Travelers" description="Everyone confirmed on this departure.">
          <Table
            head={["Traveler", "Room", "Contact", "Needs", "Add-ons", "Docs"]}
            rows={travelers.map((t) => {
              const missing = missingDetails(t);
              const roommate = sharingWith(t, rooming.rooms);
              return [
                <span key="n">
                  <span className="font-medium">{t.name}</span>
                  {t.preferredName && (
                    <span className="text-muted-foreground"> “{t.preferredName}”</span>
                  )}
                  {t.isLead && (
                    <Badge variant="neutral" className="ml-2">
                      Lead
                    </Badge>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {t.confirmationNumber}
                    {t.nationality && ` · ${t.nationality}`}
                    {t.dateOfBirth && ` · ${t.dateOfBirth}`}
                  </span>
                  {missing.length > 0 && (
                    <span className="block text-xs text-warning">Missing {missing.join(", ")}</span>
                  )}
                </span>,
                <span key="r" className="whitespace-nowrap">
                  {t.roomIndex}
                  <span className="block text-xs text-muted-foreground">
                    {roommate ? `with ${roommate}` : "own room"}
                  </span>
                  {t.stayName && (
                    <span className="block text-xs text-muted-foreground">{t.stayName}</span>
                  )}
                </span>,
                <span key="c" className="text-xs">
                  {t.email ?? "—"}
                  {t.phone && <span className="block">{t.phone}</span>}
                </span>,
                <span key="d" className="text-xs">
                  {t.dietary && <span className="block">Diet: {t.dietary}</span>}
                  {t.accessibility && <span className="block">Access: {t.accessibility}</span>}
                  {t.airportTransfer && (
                    <span className="block text-muted-foreground">{t.airportTransfer}</span>
                  )}
                  {!t.dietary && !t.accessibility && !t.airportTransfer && "—"}
                </span>,
                <span key="a" className="text-xs">
                  {t.addOns.length ? t.addOns.join(", ") : "—"}
                </span>,
                <span key="doc" className="tabular-nums text-xs">
                  {t.documentCount}
                </span>,
              ];
            })}
            empty="Nobody has confirmed on this departure yet."
          />
        </Section>
      </div>

      <div className="mt-6 break-before-page print:mt-4">
        <Section title="Rooming" description="Rooms are numbered within each booking.">
          <Table
            head={["Booking", "Room", "Occupants", "Tier"]}
            rows={rooming.rooms.map((r) => [
              r.confirmationNumber,
              <span key="i" className="tabular-nums">
                {r.index}
              </span>,
              <span key="o">
                {r.travelers.map((t) => t.name).join(" · ")}
                {r.overfilled && (
                  <Badge variant="danger" className="ml-2">
                    Over two
                  </Badge>
                )}
              </span>,
              <span key="s" className="text-xs text-muted-foreground">
                {r.stayName ?? "—"}
              </span>,
            ])}
            empty="No rooms to show."
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {rooming.sharing} shared · {rooming.ownRoom} own room · {rooming.rooms.length} total
          </p>
        </Section>
      </div>
    </>
  );
}
