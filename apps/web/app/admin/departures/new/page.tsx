import Link from "next/link";
import { DepartureForm } from "@/components/admin/departure-form";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section } from "@/components/admin/ui";
import { createDepartureAction } from "@/lib/admin/actions/departures";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export default async function NewDeparturePage(props: PageProps<"/admin/departures/new">) {
  await requireStaff(OPS_ROLES, "/admin/departures/new");
  const sp = await props.searchParams;
  const sb = await createClient();
  const { data: tours } = await sb
    .from("tours")
    .select("id, name, current_version_id, duration_days")
    .order("name");

  return (
    <>
      <PageHeader
        title="New departure"
        crumbs={<Link href="/admin/departures">Departures</Link>}
        description="Pins the tour's current published version. Prices are per traveler, in major units."
      />
      <Flash searchParams={sp} />
      <Section title="Departure">
        <DepartureForm
          action={createDepartureAction}
          tours={tours ?? []}
          submitLabel="Create departure"
        />
      </Section>
    </>
  );
}
