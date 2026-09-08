import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section } from "@/components/admin/ui";
import { CmsPageForm } from "@/components/content/cms-page-form";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { createCmsPageAction } from "@/lib/admin/actions/content";
import { listTourOptions } from "@/lib/content/admin";

export default async function NewCmsPage(props: PageProps<"/admin/content/new">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(CONTENT_ROLES)]);
  const tours = await listTourOptions();

  return (
    <>
      <PageHeader
        title="New post"
        crumbs={<Link href="/admin/content">Content</Link>}
        description="Save as a draft first; publishing needs a summary and a body."
      />
      <Flash searchParams={sp} />
      <Section title="Post">
        <CmsPageForm action={createCmsPageAction} tours={tours} submitLabel="Save" />
      </Section>
    </>
  );
}
