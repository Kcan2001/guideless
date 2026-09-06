import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  PageHeader,
  Section,
  StatusBadge,
  Table,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  createDraftVersionAction,
  publishVersionAction,
  updateTourAction,
} from "@/lib/admin/actions/tours";
import { getTourAdmin } from "@/lib/admin/queries";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";

export default async function AdminTourPage(props: PageProps<"/admin/tours/[id]">) {
  const [{ id }, sp, ctx] = await Promise.all([props.params, props.searchParams, requireStaff()]);
  const data = await getTourAdmin(id);
  if (!data) notFound();
  const { tour, versions, departures } = data;
  const canEdit = ctx.can(CONTENT_ROLES);
  const hasDraft = versions.some((v) => v.status === "draft");

  return (
    <>
      <PageHeader
        title={tour.name}
        crumbs={<Link href="/admin/tours">Tours</Link>}
        description={
          <>
            /{tour.slug} · {tour.duration_days} days · {tour.group_size_min}–{tour.group_size_max}{" "}
            travelers ·{" "}
            {tour.is_published ? <Badge variant="included">live</Badge> : <Badge>hidden</Badge>}
          </>
        }
        actions={
          <>
            <Link
              href={`/tours/${tour.slug}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              View public page
            </Link>
            {canEdit && !hasDraft && (
              <form action={createDraftVersionAction}>
                <input type="hidden" name="tourId" value={tour.id} />
                <SubmitButton size="sm">New draft version</SubmitButton>
              </form>
            )}
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Section
          title="Versions"
          description="Departures keep the version they were sold on (ADR-008)."
        >
          <Table
            head={["Version", "Status", "Published", ""]}
            rows={versions.map((v) => [
              <span key="v" className="font-medium">
                v{v.version_number}
                {tour.current_version_id === v.id && (
                  <Badge variant="included" className="ml-2">
                    current
                  </Badge>
                )}
              </span>,
              <Badge
                key="s"
                variant={
                  v.status === "published"
                    ? "included"
                    : v.status === "draft"
                      ? "warning"
                      : "neutral"
                }
              >
                {v.status}
              </Badge>,
              v.published_at ? formatDate(v.published_at.slice(0, 10)) : "—",
              <div key="a" className="flex gap-3">
                <Link href={`/admin/tours/${tour.id}/versions/${v.id}`} className="text-sm">
                  {v.status === "draft" && canEdit ? "Edit" : "View"}
                </Link>
                {v.status === "draft" && canEdit && (
                  <form action={publishVersionAction}>
                    <input type="hidden" name="tourId" value={tour.id} />
                    <input type="hidden" name="versionId" value={v.id} />
                    <SubmitButton
                      size="sm"
                      variant="link"
                      className="h-auto p-0"
                      confirm={`Publish v${v.version_number}? New departures will use it.`}
                    >
                      Publish
                    </SubmitButton>
                  </form>
                )}
              </div>,
            ])}
          />
        </Section>

        <Section title="Settings">
          <form action={updateTourAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="tourId" value={tour.id} />
            <label className={labelClass}>
              Name
              <input
                name="name"
                defaultValue={tour.name}
                className={inputClass}
                required
                disabled={!canEdit}
              />
            </label>
            <label className={labelClass}>
              Slug
              <input
                name="slug"
                defaultValue={tour.slug}
                className={inputClass}
                required
                disabled={!canEdit}
              />
            </label>
            <label className={labelClass}>
              Duration (days)
              <input
                name="durationDays"
                type="number"
                defaultValue={tour.duration_days}
                className={inputClass}
                required
                disabled={!canEdit}
              />
            </label>
            <label className={labelClass}>
              Pace
              <select
                name="activityLevel"
                defaultValue={tour.activity_level}
                className={inputClass}
                disabled={!canEdit}
              >
                <option value="relaxed">Relaxed</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className={labelClass}>
              Group min
              <input
                name="groupSizeMin"
                type="number"
                defaultValue={tour.group_size_min}
                className={inputClass}
                required
                disabled={!canEdit}
              />
            </label>
            <label className={labelClass}>
              Group max
              <input
                name="groupSizeMax"
                type="number"
                defaultValue={tour.group_size_max}
                className={inputClass}
                required
                disabled={!canEdit}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="isPublished"
                defaultChecked={tour.is_published}
                className="accent-ink"
                disabled={!canEdit}
              />
              Published on the public site (requires a published version)
            </label>
            {canEdit && (
              <div className="sm:col-span-2">
                <SubmitButton size="sm">Save settings</SubmitButton>
              </div>
            )}
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section
          title="Departures"
          actions={
            <Link href="/admin/departures/new" className="text-sm">
              New departure
            </Link>
          }
        >
          <Table
            head={["Dates", "Status", "Version", "Capacity", ""]}
            rows={departures.map((d) => [
              formatDateRange(d.start_date, d.end_date),
              <StatusBadge key="s" kind="departure" status={d.status} />,
              `v${versions.find((v) => v.id === d.tour_version_id)?.version_number ?? "?"}`,
              d.capacity,
              <Link key="l" href={`/admin/departures/${d.id}`} className="text-sm">
                Open
              </Link>,
            ])}
            empty="No departures for this tour yet."
          />
        </Section>
      </div>
    </>
  );
}
