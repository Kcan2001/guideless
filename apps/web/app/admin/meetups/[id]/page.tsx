import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { MeetupForm } from "@/components/admin/meetup-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import {
  deleteMeetupAction,
  setMeetupPublishedAction,
  updateMeetupAction,
} from "@/lib/admin/actions/community";
import { CONTENT_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { getMeetupAdmin } from "@/lib/data/community";

export default async function AdminMeetupPage(props: PageProps<"/admin/meetups/[id]">) {
  const [{ id }, sp] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff([...new Set([...CONTENT_ROLES, ...OPS_ROLES])]),
  ]);
  const data = await getMeetupAdmin(id);
  if (!data) notFound();
  const { meetup, rsvps } = data;
  const going = rsvps.filter((r) => r.status === "going");

  return (
    <>
      <PageHeader
        title={meetup.title}
        description={`${meetup.city} · ${meetup.venue_name ?? "venue TBC"}`}
        crumbs={
          <>
            <Link href="/admin/meetups">City evenings</Link> / {meetup.title}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="generic" status={meetup.is_published ? "published" : "draft"} />
            <form action={setMeetupPublishedAction}>
              <input type="hidden" name="meetupId" value={meetup.id} />
              <input type="hidden" name="publish" value={meetup.is_published ? "false" : "true"} />
              <SubmitButton size="sm" variant="secondary">
                {meetup.is_published ? "Unpublish" : "Publish"}
              </SubmitButton>
            </form>
            <Link
              href={`/meetups/${meetup.id}`}
              className="text-sm"
              target="_blank"
              rel="noreferrer"
            >
              View public page
            </Link>
          </div>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Details">
          <MeetupForm action={updateMeetupAction} meetup={meetup} submitLabel="Save" />
          <form action={deleteMeetupAction} className="mt-6 border-t border-border pt-4">
            <input type="hidden" name="meetupId" value={meetup.id} />
            <SubmitButton size="sm" variant="ghost" confirm="Delete this evening and its RSVPs?">
              Delete evening
            </SubmitButton>
          </form>
        </Section>
        <Section
          title={`Going (${going.length}${meetup.capacity ? ` of ${meetup.capacity}` : ""})`}
          description="Display names only; contact details stay in the account."
        >
          <Table
            head={["Name", "Country", "RSVP'd"]}
            rows={going.map((r) => [
              r.profile?.display_name || "Traveler",
              r.profile?.home_country ?? "—",
              formatDate(r.created_at.slice(0, 10)),
            ])}
            empty="Nobody yet."
          />
        </Section>
      </div>
    </>
  );
}
