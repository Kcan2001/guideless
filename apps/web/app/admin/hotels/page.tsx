import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, StatusBadge, Table } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/staff";
import { listHotelsAdmin } from "@/lib/hotels/catalog";

export default async function AdminHotelsPage(props: PageProps<"/admin/hotels">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff()]);
  const hotels = await listHotelsAdmin();

  return (
    <>
      <PageHeader
        title="Hotels"
        description="The curated catalog behind stay tiers. Suppliers price these; travelers never see supplier names or net rates."
        actions={
          <>
            <Link
              href="/admin/pricing"
              className={buttonVariants({ size: "sm", variant: "secondary" })}
            >
              Pricing rules
            </Link>
            <Link href="/admin/hotels/new" className={buttonVariants({ size: "sm" })}>
              Add hotel
            </Link>
          </>
        }
      />
      <Flash searchParams={sp} />
      <Section title={`Hotels (${hotels.length})`}>
        <Table
          head={["Hotel", "Destination", "Stay options", "Suppliers", "Rates fetched", "State", ""]}
          rows={hotels.map((h) => [
            <span key="n" className="font-medium">
              {h.name}
              {h.city ? <span className="text-muted-foreground"> · {h.city}</span> : null}
            </span>,
            h.destination_name ?? "—",
            h.stay_option_count,
            h.mappings.length ? (
              <span key="m">{[...new Set(h.mappings.map((m) => m.supplier))].join(", ")}</span>
            ) : (
              <span key="m" className="text-muted-foreground">
                not mapped
              </span>
            ),
            h.last_rate_fetched_at
              ? new Date(h.last_rate_fetched_at).toLocaleString("en-GB")
              : "never",
            <StatusBadge key="s" kind="generic" status={h.is_active ? "active" : "inactive"} />,
            <Link key="l" href={`/admin/hotels/${h.id}`} className="text-sm">
              Open
            </Link>,
          ])}
          empty="No hotels yet. Add the contracted properties for each destination and tier."
        />
      </Section>
    </>
  );
}
