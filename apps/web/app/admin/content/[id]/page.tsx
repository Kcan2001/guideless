import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section } from "@/components/admin/ui";
import { CmsPageForm } from "@/components/content/cms-page-form";
import { Prose } from "@/components/content/prose";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { deleteCmsPageAction, updateCmsPageAction } from "@/lib/admin/actions/content";
import { getCmsPageAdmin, listTourOptions } from "@/lib/content/admin";
import { readingMinutes } from "@/lib/content/markdown";

export default async function EditCmsPage(props: PageProps<"/admin/content/[id]">) {
  const [{ id }, sp] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(CONTENT_ROLES),
  ]);
  const [page, tours] = await Promise.all([getCmsPageAdmin(id), listTourOptions()]);
  if (!page) notFound();

  const url = page.kind === "journal" ? `/journal/${page.slug}` : `/${page.slug}`;

  return (
    <>
      <PageHeader
        title={page.title}
        crumbs={<Link href="/admin/content">Content</Link>}
        description={
          page.is_published ? (
            <>
              Live at <a href={url}>{url}</a> · {readingMinutes(page.body_markdown)} min read
            </>
          ) : (
            "Draft — not visible to anyone but staff."
          )
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6">
        <Section title="Post">
          <CmsPageForm
            action={updateCmsPageAction}
            page={page}
            tours={tours}
            submitLabel="Save"
            returnTo={`/admin/content/${page.id}`}
          />
        </Section>

        <Section
          title="Preview"
          description="Exactly what a reader sees, rendered by the same component as the live page."
        >
          {page.body_markdown.trim() ? (
            <Prose markdown={page.body_markdown} />
          ) : (
            <p className="text-muted-foreground">Nothing written yet.</p>
          )}
        </Section>

        <Section title="Delete" description="Drafts only. Unpublish a live post first.">
          <form action={deleteCmsPageAction}>
            <input type="hidden" name="pageId" value={page.id} />
            <SubmitButton
              size="sm"
              variant="secondary"
              confirm="Delete this post? This cannot be undone."
            >
              Delete
            </SubmitButton>
          </form>
        </Section>
      </div>
    </>
  );
}
