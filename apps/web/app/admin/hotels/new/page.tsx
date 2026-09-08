import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { HotelForm } from "@/components/admin/hotel-form";
import { PageHeader, Section } from "@/components/admin/ui";
import { createHotelAction } from "@/lib/admin/actions/hotels";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export default async function NewHotelPage(props: PageProps<"/admin/hotels/new">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(OPS_ROLES)]);
  const sb = await createClient();
  const { data: destinations } = await sb.from("destinations").select("id, name").order("name");

  return (
    <>
      <PageHeader
        title="Add hotel"
        description="Only properties Guideless actually sells. Map it to a supplier afterwards so rates can be fetched."
        crumbs={
          <>
            <Link href="/admin/hotels">Hotels</Link> / New
          </>
        }
      />
      <Flash searchParams={sp} />
      <Section title="Details">
        <HotelForm
          action={createHotelAction}
          destinations={destinations ?? []}
          submitLabel="Add hotel"
        />
      </Section>
    </>
  );
}
