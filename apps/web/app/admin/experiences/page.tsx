import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, Table, inputClass, labelClass, money } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  importExperienceAction,
  refreshOptionsAction,
  searchExperiencesAction,
} from "@/lib/admin/actions/experiences";
import { getExperienceSupplierId } from "@/lib/experiences";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Experiences" };
export const dynamic = "force-dynamic";

/**
 * Sourcing extras from a supplier rather than typing them out — the point of brief item 7.
 *
 * Everything on this screen is staff-only data: supplier product ids, what things cost us, what the
 * margin would be. None of it reaches `departure_add_ons`, which anon can read; the import writes
 * the commercial half to `add_on_sourcing` instead.
 */
export default async function AdminExperiencesPage(props: PageProps<"/admin/experiences">) {
  await requireStaff(OPS_ROLES);
  const sp = await props.searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const productId = typeof sp.product === "string" ? sp.product : null;
  const travelDate = typeof sp.date === "string" ? sp.date : "";

  const sb = await createClient();
  const supplierId = getExperienceSupplierId();

  const [{ data: products }, { data: departures }, { data: options }, { data: sourced }] =
    await Promise.all([
      sb
        .from("experience_products")
        .select(
          "id, title, description, address, duration_minutes, rating, rating_count, from_amount, currency, supplier_categories",
        )
        .order("fetched_at", { ascending: false })
        .limit(30),
      sb
        .from("departures")
        .select("id, start_date, tours(name)")
        .gte("start_date", new Date().toISOString().slice(0, 10))
        .order("start_date")
        .limit(20),
      productId && travelDate
        ? sb
            .from("experience_rates")
            .select(
              "id, supplier_option_id, option_name, start_time, currency, net_amount, capacity, available, cancellation_policy",
            )
            .eq("product_id", productId)
            .eq("travel_date", travelDate)
            .order("fetched_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      sb
        .from("add_on_sourcing")
        .select(
          "add_on_id, net_amount, currency, drift_amount, last_checked_at, departure_add_ons(title, price_amount, is_active)",
        )
        .order("updated_at", { ascending: false })
        .limit(40),
    ]);

  const selected = (products ?? []).find((p) => p.id === productId) ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Experiences"
        description="Search a supplier and turn what it sells into an add-on, instead of typing the extras list out per departure."
      />
      <Flash searchParams={sp} />

      {supplierId === "mock" && (
        <p className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm">
          <strong>Running on the mock supplier.</strong> There is no Viator adapter yet, on purpose:
          the last adapter written from documentation rather than a real response was never
          trustworthy. Get a key, run <code>node scripts/viator-probe.mjs</code>, and write it from
          what comes back. Everything below — search, pricing, import, recheck — works exactly the
          same once it exists.
        </p>
      )}

      <Section
        title="Search"
        description="Results are cached, so browsing costs nothing after the first call."
      >
        <form action={searchExperiencesAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className={labelClass} htmlFor="q">
              What are you looking for?
            </label>
            <input
              id="q"
              name="query"
              defaultValue={query}
              className={inputClass}
              placeholder="food walk, kayak, wine"
            />
          </div>
          <SubmitButton size="sm" pendingText="Searching…">
            Search
          </SubmitButton>
        </form>
      </Section>

      <Section
        title="What the supplier sells"
        description="Costs here are ours, not the customer's. Nothing on this screen reaches a public page."
      >
        <Table
          head={["Experience", "Where", "Length", "Rated", "From (our cost)", ""]}
          rows={(products ?? []).map((p) => [
            <div key="t">
              <p className="font-medium">{p.title}</p>
              {p.supplier_categories.length > 0 && (
                <p className="text-xs text-muted-foreground">{p.supplier_categories.join(" · ")}</p>
              )}
            </div>,
            p.address ?? "—",
            p.duration_minutes ? `${Math.round(p.duration_minutes / 60)} h` : "—",
            p.rating ? `${p.rating} (${p.rating_count ?? 0})` : "—",
            p.from_amount && p.currency ? money(p.from_amount, p.currency) : "—",
            <form key="o" action={refreshOptionsAction} className="flex items-center gap-2">
              <input type="hidden" name="productId" value={p.id} />
              <input
                name="travelDate"
                type="date"
                required
                defaultValue={travelDate || undefined}
                className={`${inputClass} w-36`}
              />
              <SubmitButton size="sm" variant="secondary" pendingText="Pricing…">
                Price a date
              </SubmitButton>
            </form>,
          ])}
          empty="Nothing cached yet. Search above."
        />
      </Section>

      {selected && travelDate && (
        <Section
          title={`Options for ${selected.title}`}
          description={`What the supplier sells on ${formatDate(travelDate)}. We match their public price and earn the commission rather than marking up — a traveler can check the same activity in one search. Imports land hidden and in-trip only: Explore and the assistant, never the tour page.`}
        >
          {(options ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing bookable on that date. Try another.
            </p>
          ) : (
            <div className="grid gap-5">
              {(options ?? []).map((o) => (
                <form
                  key={o.id}
                  action={importExperienceAction}
                  className="grid gap-3 border-b border-border pb-5 last:border-0 last:pb-0"
                >
                  <input type="hidden" name="productId" value={selected.id} />
                  <input type="hidden" name="supplierOptionId" value={o.supplier_option_id} />
                  <input type="hidden" name="travelDate" value={travelDate} />

                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium">{o.option_name}</p>
                    {!o.available && <Badge variant="danger">unavailable</Badge>}
                    <p className="text-sm text-muted-foreground">
                      public price {money(o.net_amount, o.currency)}
                      {o.capacity !== null ? ` · ${o.capacity} places` : ""}
                      {o.start_time ? ` · ${o.start_time.slice(0, 5)}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className={labelClass}>Departure</label>
                      <select name="departureId" required className={`${inputClass} w-64`}>
                        {(departures ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {(d as unknown as { tours: { name: string } | null }).tours?.name} ·{" "}
                            {formatDate(d.start_date)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Sell at (matches theirs)</label>
                      <input
                        name="price"
                        type="number"
                        step="0.01"
                        min={o.net_amount / 100}
                        required
                        defaultValue={(o.net_amount / 100).toFixed(2)}
                        className={`${inputClass} w-32`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Day (optional)</label>
                      <input
                        name="dayNumber"
                        type="number"
                        min="1"
                        className={`${inputClass} w-24`}
                      />
                    </div>
                    <SubmitButton size="sm" pendingText="Importing…" disabled={!o.available}>
                      Import as add-on
                    </SubmitButton>
                  </div>
                </form>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section
        title="What we have sourced"
        description="Add-ons that came from a supplier, and how far their price has moved since we set ours. Nothing reprices itself — a price a traveler is looking at should not change under them."
      >
        <Table
          head={["Add-on", "Live", "Their price", "We charge", "Difference", "Drift", "Checked"]}
          rows={(sourced ?? []).map((s) => {
            const addOn = (
              s as unknown as {
                departure_add_ons: {
                  title: string;
                  price_amount: number;
                  is_active: boolean;
                } | null;
              }
            ).departure_add_ons;
            const margin = (addOn?.price_amount ?? 0) - s.net_amount;
            return [
              addOn?.title ?? "—",
              addOn?.is_active ? (
                <Badge key="a" variant="included">
                  live
                </Badge>
              ) : (
                <Badge key="a">hidden</Badge>
              ),
              money(s.net_amount, s.currency),
              addOn ? money(addOn.price_amount, s.currency) : "—",
              <span key="m" className={margin < 0 ? "text-danger" : undefined}>
                {money(margin, s.currency)}
              </span>,
              s.drift_amount ? money(s.drift_amount, s.currency) : "—",
              s.last_checked_at ? formatDate(s.last_checked_at.slice(0, 10)) : "never",
            ];
          })}
          empty="Nothing sourced from a supplier yet."
        />
      </Section>
    </div>
  );
}
