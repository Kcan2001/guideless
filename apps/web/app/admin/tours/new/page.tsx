import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, inputClass, labelClass } from "@/components/admin/ui";
import { createTourAction } from "@/lib/admin/actions/tours";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";

export default async function NewTourPage(props: PageProps<"/admin/tours/new">) {
  await requireStaff(CONTENT_ROLES, "/admin/tours/new");
  const sp = await props.searchParams;
  return (
    <>
      <PageHeader
        title="New tour"
        crumbs={<Link href="/admin/tours">Tours</Link>}
        description="Creates the tour and an empty draft version 1. Add content, then publish."
      />
      <Flash searchParams={sp} />
      <Section title="Basics">
        <form action={createTourAction} className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Name
            <input name="name" className={inputClass} required placeholder="Southern France" />
          </label>
          <label className={labelClass}>
            Slug (URL)
            <input
              name="slug"
              className={inputClass}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="southern-france"
            />
          </label>
          <label className={labelClass}>
            Duration (days)
            <input
              name="durationDays"
              type="number"
              min={1}
              max={60}
              className={inputClass}
              required
              defaultValue={9}
            />
          </label>
          <label className={labelClass}>
            Pace
            <select name="activityLevel" className={inputClass} defaultValue="moderate">
              <option value="relaxed">Relaxed</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
            </select>
          </label>
          <label className={labelClass}>
            Group size min
            <input
              name="groupSizeMin"
              type="number"
              min={1}
              className={inputClass}
              required
              defaultValue={6}
            />
          </label>
          <label className={labelClass}>
            Group size max
            <input
              name="groupSizeMax"
              type="number"
              min={1}
              className={inputClass}
              required
              defaultValue={14}
            />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton>Create tour</SubmitButton>
          </div>
        </form>
      </Section>
    </>
  );
}
