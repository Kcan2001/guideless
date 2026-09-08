import { CURRENCIES } from "@guideless/types";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { createCouponAction, updateCouponAction } from "@/lib/admin/actions/coupons";
import type { CouponRow } from "@/lib/admin/finance";

/**
 * One coupon: the code, what it takes off (a percentage, or an amount in one currency), when it
 * is valid and how many times it may be used. Percent and amount are mutually exclusive, which
 * is what the database enforces too.
 */
export function CouponForm({ coupon }: { coupon?: CouponRow }) {
  const k = coupon?.id ?? "new";
  const isAmount = Boolean(coupon?.amount_off);
  const major = (minor: number | null) => (minor === null ? "" : (minor / 100).toFixed(2));

  return (
    <form
      action={coupon ? updateCouponAction : createCouponAction}
      className="grid gap-3 sm:grid-cols-6"
    >
      {coupon && <input type="hidden" name="couponId" value={coupon.id} />}

      <div className="sm:col-span-2">
        <label htmlFor={`c-${k}-code`} className={labelClass}>
          Code
        </label>
        <input
          id={`c-${k}-code`}
          name="code"
          required
          defaultValue={coupon?.code ?? ""}
          placeholder="EARLYBIRD"
          className={`${inputClass} uppercase`}
          aria-describedby={`c-${k}-code-hint`}
        />
        <p id={`c-${k}-code-hint`} className="mt-1 text-xs text-muted-foreground">
          Capitalisation is ignored when a traveler types it.
        </p>
      </div>

      <div className="sm:col-span-4">
        <label htmlFor={`c-${k}-desc`} className={labelClass}>
          Description (internal)
        </label>
        <input
          id={`c-${k}-desc`}
          name="description"
          defaultValue={coupon?.description ?? ""}
          placeholder="Launch offer for the newsletter list"
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`c-${k}-kind`} className={labelClass}>
          Takes off
        </label>
        <select
          id={`c-${k}-kind`}
          name="kind"
          defaultValue={isAmount ? "amount" : "percent"}
          className={inputClass}
        >
          <option value="percent">A percentage</option>
          <option value="amount">A fixed amount</option>
        </select>
      </div>

      <div>
        <label htmlFor={`c-${k}-pct`} className={labelClass}>
          Percent off
        </label>
        <input
          id={`c-${k}-pct`}
          name="percentOff"
          type="number"
          min={1}
          max={100}
          defaultValue={coupon?.percent_off ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`c-${k}-amt`} className={labelClass}>
          Amount off
        </label>
        <input
          id={`c-${k}-amt`}
          name="amountOff"
          inputMode="decimal"
          defaultValue={major(coupon?.amount_off ?? null)}
          placeholder="100.00"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`c-${k}-cur`} className={labelClass}>
          Currency
        </label>
        <select
          id={`c-${k}-cur`}
          name="currency"
          defaultValue={coupon?.currency ?? ""}
          className={inputClass}
        >
          <option value="">—</option>
          {CURRENCIES.map((cur) => (
            <option key={cur} value={cur}>
              {cur}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`c-${k}-max`} className={labelClass}>
          Max uses
        </label>
        <input
          id={`c-${k}-max`}
          name="maxRedemptions"
          type="number"
          min={1}
          defaultValue={coupon?.max_redemptions ?? ""}
          placeholder="∞"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`c-${k}-from`} className={labelClass}>
          Valid from
        </label>
        <input
          id={`c-${k}-from`}
          name="validFrom"
          type="date"
          defaultValue={coupon?.valid_from?.slice(0, 10) ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`c-${k}-until`} className={labelClass}>
          Valid until
        </label>
        <input
          id={`c-${k}-until`}
          name="validUntil"
          type="date"
          defaultValue={coupon?.valid_until?.slice(0, 10) ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={coupon ? coupon.is_active : true}
            className="size-4 rounded border-border"
          />
          Active
        </label>
      </div>

      <div className="flex items-end sm:col-span-2">
        <SubmitButton size="sm">{coupon ? "Save" : "Create coupon"}</SubmitButton>
      </div>
    </form>
  );
}
