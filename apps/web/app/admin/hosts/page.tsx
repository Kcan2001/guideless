import Link from "next/link";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/staff";
import { listHostApplications } from "@/lib/data/community";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "pending", "approved", "declined"] as const;

export default async function AdminHostsPage(props: PageProps<"/admin/hosts">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff()]);
  const status = typeof sp.status === "string" && sp.status !== "all" ? sp.status : undefined;
  const applications = await listHostApplications(status);

  return (
    <>
      <PageHeader
        title="Host applications"
        description="People offering to bring their community. Approve, then open a departure or point them at one."
      />
      <Flash searchParams={sp} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/hosts" : (`/admin/hosts?status=${f}` as "/admin/hosts")}
            className={cn(
              buttonVariants({
                variant: (status ?? "all") === f ? "primary" : "secondary",
                size: "sm",
              }),
            )}
          >
            {f[0]!.toUpperCase() + f.slice(1)}
          </Link>
        ))}
      </div>
      <Section title={`Applications (${applications.length})`}>
        <Table
          head={["Name", "Community", "Size", "City", "Preferred", "Status", "Received", ""]}
          rows={applications.map((a) => [
            <span key="n" className="font-medium">
              {a.name}
              <span className="block text-xs text-muted-foreground">{a.email}</span>
            </span>,
            <span key="c" className="block max-w-xs truncate" title={a.community_description}>
              {a.community_description}
            </span>,
            a.community_size ?? "—",
            a.city ?? "—",
            a.preferred_month ?? "—",
            <StatusBadge key="s" kind="generic" status={a.status} />,
            formatDate(a.created_at.slice(0, 10)),
            <Link key="l" href={`/admin/hosts/${a.id}`} className="text-sm">
              Review
            </Link>,
          ])}
          empty="No applications yet. The form lives at /host."
        />
      </Section>
    </>
  );
}
