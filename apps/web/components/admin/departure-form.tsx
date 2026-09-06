import { DEPARTURE_STATUSES } from "@guideless/types";
import type { Tables } from "@guideless/types";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const DEFAULT_POLICY = [
  { daysBeforeDeparture: 60, refundPercentage: 100 },
  { daysBeforeDeparture: 30, refundPercentage: 75 },
  { daysBeforeDeparture: 15, refundPercentage: 50 },
  { daysBeforeDeparture: 0, refundPercentage: 0 },
];

/** Shared by /admin/departures/new and the edit panel on a departure page. */
export function DepartureForm({
  action,
  tours,
  departure,
  disabled = false,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  tours: Array<Pick<Tables<"tours">, "id" | "name" | "current_version_id" | "duration_days">>;
  departure?: Tables<"departures">;
  disabled?: boolean;
  submitLabel: string;
}) {
  const major = (minor: number | undefined) => (minor != null ? (minor / 100).toFixed(2) : "");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      {departure && <input type="hidden" name="departureId" value={departure.id} />}
      <label className={cn(labelClass, "sm:col-span-2")}>
        Tour
        <select
          name="tourId"
          defaultValue={departure?.tour_id ?? ""}
          className={inputClass}
          required
          disabled={disabled || !!departure}
        >
          {!departure && (
            <option value="" disabled>
              Choose a tour…
            </option>
          )}
          {tours.map((t) => (
            <option key={t.id} value={t.id} disabled={!t.current_version_id}>
              {t.name}
              {!t.current_version_id ? " (no published version)" : ""}
            </option>
          ))}
        </select>
        {departure && <input type="hidden" name="tourId" value={departure.tour_id} />}
      </label>
      <label className={labelClass}>
        Status
        <select
          name="status"
          defaultValue={departure?.status ?? "draft"}
          className={inputClass}
          disabled={disabled}
        >
          {DEPARTURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Start date
        <input
          name="startDate"
          type="date"
          defaultValue={departure?.start_date ?? ""}
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        End date
        <input
          name="endDate"
          type="date"
          defaultValue={departure?.end_date ?? ""}
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Time zone (IANA)
        <input
          name="timezone"
          defaultValue={departure?.timezone ?? "Europe/Paris"}
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Capacity
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={departure?.capacity ?? 14}
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Minimum travelers
        <input
          name="minimumTravelers"
          type="number"
          min={0}
          defaultValue={departure?.minimum_travelers ?? 6}
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Currency
        <select
          name="currency"
          defaultValue={departure?.currency ?? "USD"}
          className={inputClass}
          disabled={disabled}
        >
          <option>USD</option>
          <option>EUR</option>
          <option>GBP</option>
        </select>
      </label>
      <label className={labelClass}>
        Price per traveler
        <input
          name="price"
          inputMode="decimal"
          defaultValue={major(departure?.price_amount)}
          placeholder="3495.00"
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Deposit per traveler
        <input
          name="deposit"
          inputMode="decimal"
          defaultValue={major(departure?.deposit_amount) || "0"}
          placeholder="750.00"
          className={inputClass}
          required
          disabled={disabled}
        />
      </label>
      <div />
      <label className={labelClass}>
        Booking deadline
        <input
          name="bookingDeadline"
          type="date"
          defaultValue={departure?.booking_deadline ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Balance due date
        <input
          name="balanceDueDate"
          type="date"
          defaultValue={departure?.balance_due_date ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <div />
      <label className={cn(labelClass, "sm:col-span-3")}>
        Cancellation policy (JSON tiers: daysBeforeDeparture → refundPercentage)
        <textarea
          name="cancellationPolicy"
          defaultValue={JSON.stringify(departure?.cancellation_policy ?? DEFAULT_POLICY)}
          className={cn(inputClass, "h-16 py-1.5 font-mono text-xs")}
          disabled={disabled}
        />
      </label>
      {!disabled && (
        <div className="sm:col-span-3">
          <SubmitButton size="sm">{submitLabel}</SubmitButton>
        </div>
      )}
    </form>
  );
}
