import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { MeetupForm } from "@/components/admin/meetup-form";
import { PageHeader, Section } from "@/components/admin/ui";
import { createMeetupAction } from "@/lib/admin/actions/community";
import { CONTENT_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";

export default async function NewMeetupPage(props: PageProps<"/admin/meetups/new">) {
  const [sp] = await Promise.all([
    props.searchParams,
    requireStaff([...new Set([...CONTENT_ROLES, ...OPS_ROLES])]),
  ]);
  return (
    <>
      <PageHeader
        title="New evening"
        description="Keep it to one bar, one city, one calm sentence about who it is for."
        crumbs={
          <>
            <Link href="/admin/meetups">City evenings</Link> / New
          </>
        }
      />
      <Flash searchParams={sp} />
      <Section title="Details">
        <MeetupForm action={createMeetupAction} submitLabel="Create evening" />
      </Section>
    </>
  );
}
