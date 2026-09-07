import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  DL,
  PageHeader,
  Section,
  StatusBadge,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { decideHostApplicationAction } from "@/lib/admin/actions/community";
import { requireStaff } from "@/lib/auth/staff";
import { getHostApplication, HOST_FREE_SPOT_THRESHOLD } from "@/lib/data/community";

export default async function AdminHostApplicationPage(props: PageProps<"/admin/hosts/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams, requireStaff()]);
  const data = await getHostApplication(id);
  if (!data) notFound();
  const { application: a, tour } = data;

  return (
    <>
      <PageHeader
        title={a.name}
        description={`Applied ${formatDate(a.created_at.slice(0, 10))} · ${a.email}`}
        crumbs={
          <>
            <Link href="/admin/hosts">Host applications</Link> / {a.name}
          </>
        }
        actions={<StatusBadge kind="generic" status={a.status} />}
      />
      <Flash searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Their community">
          <p className="whitespace-pre-line text-sm leading-relaxed">{a.community_description}</p>
          <div className="mt-6">
            <DL
              rows={[
                ["Size", a.community_size?.toLocaleString("en-US") ?? "—"],
                ["City", a.city ?? "—"],
                ["Preferred month", a.preferred_month ?? "—"],
                [
                  "Preferred route",
                  tour ? <Link href={`/admin/tours/${tour.id}`}>{tour.name}</Link> : "Not sure yet",
                ],
                [
                  "Links",
                  a.links ? (
                    <a
                      href={a.links.startsWith("http") ? a.links : `https://${a.links}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {a.links}
                    </a>
                  ) : (
                    "—"
                  ),
                ],
                ["Account", a.user_id ? "Signed-in customer" : "No account yet"],
              ]}
            />
          </div>
        </Section>
        <Section
          title="Decision"
          description={`Approved hosts travel free at ${HOST_FREE_SPOT_THRESHOLD} confirmed travelers (system setting host_free_spot_threshold).`}
        >
          <form action={decideHostApplicationAction} className="space-y-3">
            <input type="hidden" name="applicationId" value={a.id} />
            <label className="block">
              <span className={labelClass}>Status</span>
              <select name="status" defaultValue={a.status} className={inputClass}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Staff notes (never shown to the applicant)</span>
              <textarea
                name="staffNotes"
                defaultValue={a.staff_notes ?? ""}
                className={inputClass}
                rows={4}
                maxLength={2000}
              />
            </label>
            <SubmitButton size="sm">Save decision</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Next steps after approval: reply from the support inbox, then create or point them at a
            departure and note the host in the departure&rsquo;s staff notes.
          </p>
        </Section>
      </div>
    </>
  );
}
