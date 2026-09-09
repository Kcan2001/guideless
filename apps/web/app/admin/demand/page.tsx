import { formatDate } from "@guideless/utils";
import { PageHeader, Section, Stat, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Demand" };
export const dynamic = "force-dynamic";

/**
 * Where people asked us to go, and what they kept for later.
 *
 * This is the screen the whole of brief item 8 was really for. Guideless runs two trips and has to
 * pick a third; the alternative to reading this is guessing. A saved tour is a soft signal and a
 * named place we do not sell is a hard one — somebody typed it in unprompted.
 */
export default async function AdminDemandPage() {
  await requireStaff();
  const sb = await createClient();

  const [{ data: wanted }, { data: saves }, { data: alerts }] = await Promise.all([
    sb.from("wanted_places").select("*").limit(50),
    sb.from("tour_save_counts").select("tour_id, saves").order("saves", { ascending: false }),
    sb
      .from("destination_alerts")
      .select("id, destination_id, wanted_place, created_at, user_id, destinations(name)")
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const tourIds = (saves ?? []).map((s) => s.tour_id).filter((v): v is string => Boolean(v));
  const names = new Map<string, string>();
  if (tourIds.length > 0) {
    const { data: tours } = await sb.from("tours").select("id, name").in("id", tourIds);
    for (const t of tours ?? []) names.set(t.id, t.name);
  }

  const rows = (wanted ?? []).filter((w) => w.place);
  const totalRequests = rows.reduce((sum, w) => sum + (w.requests ?? 0), 0);
  const onList = (alerts ?? []).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Demand"
        description="What people asked for and what they kept. The alternative to reading this is guessing where to go next."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Places requested" value={rows.length} hint="somewhere we don't go yet" />
        <Stat label="Requests" value={totalRequests} hint="people who asked" />
        <Stat label="On an alert list" value={onList} hint="waiting to hear from us" />
      </div>

      <Section
        title="Where people want us to go"
        description="Typed in unprompted, most-asked first. A hard signal: nobody fills this in idly."
      >
        <Table
          head={["Place", "Asked", "By travelers", "First asked", "Last asked"]}
          rows={rows.map((w) => [
            <span key="p" className="font-medium capitalize">
              {w.place}
            </span>,
            w.requests,
            w.from_travelers ? (
              <Badge key="t" variant="included">
                {w.from_travelers} booked with us
              </Badge>
            ) : (
              "—"
            ),
            w.first_asked ? formatDate(w.first_asked.slice(0, 10)) : "—",
            w.last_asked ? formatDate(w.last_asked.slice(0, 10)) : "—",
          ])}
          empty="Nobody has asked for anywhere yet. The form is on /whats-coming and every tour page."
        />
      </Section>

      <Section
        title="Kept for later"
        description="Saves per tour. A softer signal than a request, but it is interest with no prompt attached."
      >
        <Table
          head={["Tour", "Saves"]}
          rows={(saves ?? []).map((s) => [names.get(s.tour_id ?? "") ?? "—", s.saves ?? 0])}
          empty="Nothing saved yet."
        />
      </Section>

      <Section title="Recent asks" description="The last fifty, newest first.">
        <Table
          head={["Wants", "Kind", "When"]}
          rows={(alerts ?? []).map((a) => {
            const destination = (a as unknown as { destinations: { name: string } | null })
              .destinations;
            return [
              destination?.name ?? a.wanted_place ?? "—",
              a.destination_id ? (
                <Badge key="k">somewhere we go</Badge>
              ) : (
                <Badge key="k" variant="optional">
                  a request
                </Badge>
              ),
              formatDate(a.created_at.slice(0, 10)),
            ];
          })}
          empty="Nothing yet."
        />
      </Section>
    </div>
  );
}
