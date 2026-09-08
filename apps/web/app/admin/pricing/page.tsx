import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { HotelPricingRuleForm } from "@/components/admin/hotel-pricing-rule-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge } from "@/components/admin/ui";
import { deletePricingRuleAction } from "@/lib/admin/actions/hotels";
import { FINANCE_ROLES, requireStaff } from "@/lib/auth/staff";
import { listPricingRulesAdmin } from "@/lib/hotels/catalog";

export default async function AdminPricingPage(props: PageProps<"/admin/pricing">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(FINANCE_ROLES)]);
  const { rules, destinations, hotels } = await listPricingRulesAdmin();
  const name = (list: Array<{ id: string; name: string }>, id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? "?") : "Any";

  return (
    <>
      <PageHeader
        title="Hotel pricing rules"
        description="Markup applied to supplier net rates to suggest a customer price. Highest priority matching rule wins; change prices here, not in code."
        crumbs={
          <>
            <Link href="/admin/hotels">Hotels</Link> / Pricing
          </>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid gap-6">
        {rules.map((rule) => (
          <Section
            key={rule.id}
            title={`${name(destinations, rule.destination_id)} · ${name(hotels, rule.hotel_id)}`}
            description={`${rule.percentage_markup}% + fixed ${(rule.fixed_markup_amount / 100).toFixed(2)}, minimum ${(rule.min_markup_amount / 100).toFixed(2)} · priority ${rule.priority}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge kind="generic" status={rule.is_active ? "active" : "inactive"} />
                <form action={deletePricingRuleAction}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <SubmitButton size="sm" variant="ghost" confirm="Delete this rule?">
                    Delete
                  </SubmitButton>
                </form>
              </div>
            }
          >
            <HotelPricingRuleForm rule={rule} destinations={destinations} hotels={hotels} />
          </Section>
        ))}
        <Section title="New rule" description="Blank destination and hotel = applies everywhere.">
          <HotelPricingRuleForm destinations={destinations} hotels={hotels} />
        </Section>
      </div>
    </>
  );
}
