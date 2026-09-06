import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Table, inputClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listTravelers } from "@/lib/admin/queries";

export default async function AdminCustomersPage(props: PageProps<"/admin/customers">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : undefined;
  const travelers = await listTravelers(q);

  return (
    <>
      <PageHeader
        title="Customers & travelers"
        description="Every traveler record. Personal data — handle with care, never paste into chat or email."
      />
      <Flash searchParams={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs font-medium text-muted-foreground">
          Search name or email
          <input name="q" defaultValue={q ?? ""} className={inputClass + " w-64"} />
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Search
        </button>
      </form>
      <Section title={`${travelers.length} traveler${travelers.length === 1 ? "" : "s"}`}>
        <Table
          head={["Traveler", "Contact", "Born", "Nationality", "Bookings", "Since"]}
          rows={travelers.map((t) => [
            <span key="n" className="font-medium">
              {t.first_name} {t.last_name}
              {t.user_id && (
                <Badge variant="info" className="ml-2">
                  has account
                </Badge>
              )}
            </span>,
            <span key="c" className="text-xs">
              {t.email ?? "—"}
              <br />
              {t.phone ?? ""}
            </span>,
            t.date_of_birth ? (
              formatDate(t.date_of_birth)
            ) : (
              <Badge variant="warning">missing</Badge>
            ),
            t.nationality ?? <Badge variant="warning">missing</Badge>,
            <span key="b" className="text-xs">
              {t.bookings.length === 0
                ? "—"
                : t.bookings.map((s, i) => (
                    <Badge
                      key={i}
                      variant={s === "confirmed" ? "included" : "neutral"}
                      className="mr-1"
                    >
                      {s.replace("_", " ")}
                    </Badge>
                  ))}
            </span>,
            formatDate(t.created_at.slice(0, 10)),
          ])}
          empty="No travelers match."
        />
      </Section>
    </>
  );
}
