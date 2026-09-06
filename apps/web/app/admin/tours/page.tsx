import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listTours } from "@/lib/admin/queries";

export default async function AdminToursPage(props: PageProps<"/admin/tours">) {
  const sp = await props.searchParams;
  const tours = await listTours();
  return (
    <>
      <PageHeader
        title="Tours"
        description="Products. Content lives on versions; departures pin a version."
        actions={
          <Link href="/admin/tours/new" className={buttonVariants({ size: "sm" })}>
            New tour
          </Link>
        }
      />
      <Flash searchParams={sp} />
      <Section title="All tours">
        <Table
          head={["Tour", "Published", "Current version", "Drafts", "Upcoming departures", ""]}
          rows={tours.map((t) => [
            <Link
              key="n"
              href={`/admin/tours/${t.tour.id}`}
              className="font-medium text-foreground no-underline hover:text-link"
            >
              {t.tour.name}
              <span className="block text-xs text-muted-foreground">
                /{t.tour.slug} · {t.tour.duration_days} days
              </span>
            </Link>,
            t.tour.is_published ? (
              <Badge key="p" variant="included">
                live
              </Badge>
            ) : (
              <Badge key="p" variant="neutral">
                hidden
              </Badge>
            ),
            t.currentVersion ? (
              `v${t.currentVersion.version_number}`
            ) : (
              <span className="text-muted-foreground">none</span>
            ),
            t.draftCount > 0 ? (
              <Badge key="d" variant="warning">
                {t.draftCount} draft
              </Badge>
            ) : (
              "—"
            ),
            t.upcomingDepartures,
            <Link key="l" href={`/admin/tours/${t.tour.id}`} className="text-sm">
              Manage
            </Link>,
          ])}
          empty="No tours yet."
        />
      </Section>
    </>
  );
}
