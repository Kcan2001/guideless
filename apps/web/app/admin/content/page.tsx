import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { listCmsPagesAdmin } from "@/lib/content/admin";

export default async function AdminContentPage(props: PageProps<"/admin/content">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(CONTENT_ROLES)]);
  const pages = await listCmsPagesAdmin();
  const journal = pages.filter((p) => p.kind === "journal");
  const standing = pages.filter((p) => p.kind !== "journal");

  const rows = (list: typeof pages) =>
    list.map((p) => [
      <Link key="t" href={`/admin/content/${p.id}`} className="font-medium">
        {p.title}
      </Link>,
      <code key="s" className="text-xs text-muted-foreground">
        /{p.kind === "journal" ? "journal/" : ""}
        {p.slug}
      </code>,
      p.published_at ? new Date(p.published_at).toLocaleDateString("en-GB") : "—",
      p.tour_name ?? "—",
      <StatusBadge key="st" kind="generic" status={p.is_published ? "published" : "draft"} />,
      p.is_published ? (
        <a
          key="v"
          href={p.kind === "journal" ? `/journal/${p.slug}` : `/${p.slug}`}
          className="text-sm"
        >
          View
        </a>
      ) : (
        <span key="v" className="text-sm text-muted-foreground">
          —
        </span>
      ),
    ]);

  return (
    <>
      <PageHeader
        title="Content"
        description="Journal posts and standing pages. Every post can end at a real trip."
        actions={
          <Link href="/admin/content/new" className={buttonVariants({ size: "sm" })}>
            New post
          </Link>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6">
        <Section
          title={`Journal (${journal.length})`}
          description="Published posts appear at /journal, newest first."
        >
          <Table
            head={["Title", "URL", "Published", "Trip", "State", ""]}
            rows={rows(journal)}
            empty="No posts yet. The journal page shows an honest empty state until the first one is published."
          />
        </Section>

        <Section
          title={`Standing pages (${standing.length})`}
          description="Database-backed pages. The hand-built pages (About, FAQ, Why Guideless) are in code and are not listed here."
        >
          <Table
            head={["Title", "URL", "Published", "Trip", "State", ""]}
            rows={rows(standing)}
            empty="No database-backed pages."
          />
        </Section>
      </div>
    </>
  );
}
