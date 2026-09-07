import Link from "next/link";
import { formatInZone } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/staff";
import { listMeetupsAdmin } from "@/lib/data/community";

export default async function AdminMeetupsPage(props: PageProps<"/admin/meetups">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff()]);
  const meetups = await listMeetupsAdmin();

  return (
    <>
      <PageHeader
        title="City evenings"
        description="Monthly meetups: the funnel. Publish to show on /meetups; RSVPs need a signed-in account."
        actions={
          <Link href="/admin/meetups/new" className={buttonVariants({ size: "sm" })}>
            New evening
          </Link>
        }
      />
      <Flash searchParams={sp} />
      <Section title={`Evenings (${meetups.length})`}>
        <Table
          head={["When (local)", "Title", "City", "Venue", "Going", "State", ""]}
          rows={meetups.map((m) => [
            <span key="w" className={m.isPast ? "text-muted-foreground" : undefined}>
              {formatInZone(m.starts_at, m.timezone)}
            </span>,
            <span key="t" className="font-medium">
              {m.title}
            </span>,
            m.city,
            m.venue_name ?? "—",
            `${m.going}${m.capacity ? ` / ${m.capacity}` : ""}`,
            <StatusBadge key="s" kind="generic" status={m.is_published ? "published" : "draft"} />,
            <Link key="l" href={`/admin/meetups/${m.id}`} className="text-sm">
              Edit
            </Link>,
          ])}
          empty="No evenings yet."
        />
      </Section>
    </>
  );
}
