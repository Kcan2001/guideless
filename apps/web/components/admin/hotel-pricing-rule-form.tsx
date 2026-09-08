import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { savePricingRuleAction } from "@/lib/admin/actions/hotels";
import type { PricingRuleRow } from "@/lib/hotels/catalog";

const major = (minor: number) => (minor / 100).toFixed(2);

/**
 * One pricing rule: where it applies (destination and/or hotel, blank = everywhere) and the markup
 * (percentage, fixed, minimum). Higher priority wins when several match (strategy §3).
 */
export function HotelPricingRuleForm({
  rule,
  destinations,
  hotels,
}: {
  rule?: PricingRuleRow;
  destinations: Array<{ id: string; name: string }>;
  hotels: Array<{ id: string; name: string }>;
}) {
  const k = rule?.id ?? "new";
  return (
    <form action={savePricingRuleAction} className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`rule-${k}-dest`} className={labelClass}>
          Destination
        </label>
        <select
          id={`rule-${k}-dest`}
          name="destinationId"
          defaultValue={rule?.destination_id ?? ""}
          className={inputClass}
        >
          <option value="">Any</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`rule-${k}-hotel`} className={labelClass}>
          Hotel
        </label>
        <select
          id={`rule-${k}-hotel`}
          name="hotelId"
          defaultValue={rule?.hotel_id ?? ""}
          className={inputClass}
        >
          <option value="">Any</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`rule-${k}-pct`} className={labelClass}>
          Markup %
        </label>
        <input
          id={`rule-${k}-pct`}
          name="percentageMarkup"
          type="number"
          step="0.1"
          min={0}
          defaultValue={rule?.percentage_markup ?? 10}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`rule-${k}-fixed`} className={labelClass}>
          Fixed markup
        </label>
        <input
          id={`rule-${k}-fixed`}
          name="fixedMarkup"
          type="number"
          step="0.01"
          min={0}
          defaultValue={major(rule?.fixed_markup_amount ?? 0)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`rule-${k}-min`} className={labelClass}>
          Minimum markup
        </label>
        <input
          id={`rule-${k}-min`}
          name="minMarkup"
          type="number"
          step="0.01"
          min={0}
          defaultValue={major(rule?.min_markup_amount ?? 0)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`rule-${k}-prio`} className={labelClass}>
          Priority
        </label>
        <input
          id={`rule-${k}-prio`}
          name="priority"
          type="number"
          defaultValue={rule?.priority ?? 0}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`rule-${k}-from`} className={labelClass}>
          Effective from
        </label>
        <input
          id={`rule-${k}-from`}
          name="effectiveFrom"
          type="date"
          defaultValue={rule?.effective_from ?? ""}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`rule-${k}-to`} className={labelClass}>
          Effective to
        </label>
        <input
          id={`rule-${k}-to`}
          name="effectiveTo"
          type="date"
          defaultValue={rule?.effective_to ?? ""}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={rule?.is_active ?? true}
        />
        Active
      </label>
      <div className="flex items-end sm:col-span-2">
        <SubmitButton size="sm" variant={rule ? "secondary" : "primary"}>
          {rule ? "Save rule" : "Add rule"}
        </SubmitButton>
      </div>
    </form>
  );
}
