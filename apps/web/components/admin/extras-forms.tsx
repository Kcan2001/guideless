import type { Tables } from "@guideless/types";
import { ADD_ON_KINDS, OPTION_LABELS } from "@guideless/validation";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { saveAddOnAction, saveStayOptionAction } from "@/lib/admin/actions/extras";

type StayOption = Tables<"departure_stay_options">;
type AddOn = Tables<"departure_add_ons">;

const major = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? "" : (minor / 100).toFixed(2);
const lines = (values: string[] | null | undefined) => (values ?? []).join("\n");
const LABEL_TEXT: Record<(typeof OPTION_LABELS)[number], string> = {
  best_value: "Best value",
  most_popular: "Most popular",
  social: "Social",
  luxury: "Luxury",
};
type StayDetails = {
  neighborhood?: string;
  station_distance?: string;
  train_time?: string;
  breakfast?: string;
  room_type?: string;
  hotel_confirmed?: boolean;
};
const stayDetails = (value: unknown): StayDetails =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as StayDetails) : {};

/** Shared "Presentation" fields: photos, includes / excludes, label, why the price differs. */
function PresentationFields({
  prefix,
  imageUrls,
  includes,
  excludes,
  label,
  whyPriceNote,
  disabled,
}: {
  prefix: string;
  imageUrls: string[] | null | undefined;
  includes: string[] | null | undefined;
  excludes: string[] | null | undefined;
  label: string | null | undefined;
  whyPriceNote: string | null | undefined;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Presentation
      </legend>
      <div>
        <label htmlFor={`${prefix}-label`} className={labelClass}>
          Label (manual badge)
        </label>
        <select
          id={`${prefix}-label`}
          name="label"
          defaultValue={label ?? ""}
          className={inputClass}
          disabled={disabled}
        >
          <option value="">None</option>
          {OPTION_LABELS.map((l) => (
            <option key={l} value={l}>
              {LABEL_TEXT[l]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-why`} className={labelClass}>
          Why it costs what it costs (shown to customers)
        </label>
        <textarea
          id={`${prefix}-why`}
          name="whyPriceNote"
          rows={2}
          maxLength={500}
          defaultValue={whyPriceNote ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-inc`} className={labelClass}>
          Included (one per line, max 12)
        </label>
        <textarea
          id={`${prefix}-inc`}
          name="includes"
          rows={4}
          defaultValue={lines(includes)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-exc`} className={labelClass}>
          Not included (one per line, max 12)
        </label>
        <textarea
          id={`${prefix}-exc`}
          name="excludes"
          rows={4}
          defaultValue={lines(excludes)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-img`} className={labelClass}>
          Photo URLs (one per line, max 12; /photos/… or an uploaded file URL)
        </label>
        <textarea
          id={`${prefix}-img`}
          name="imageUrls"
          rows={3}
          defaultValue={lines(imageUrls)}
          className={`${inputClass} font-mono text-xs`}
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}

/** Create / edit a stay tier. Money is typed in major units; the action converts to minor units. */
export function StayOptionForm({
  departureId,
  stay,
  destinations,
  currency,
  disabled,
}: {
  departureId: string;
  stay?: StayOption;
  destinations: { id: string; name: string }[];
  currency: string;
  disabled?: boolean;
}) {
  const k = stay?.id ?? "new";
  const details = stayDetails(stay?.details);
  return (
    <form action={saveStayOptionAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="departureId" value={departureId} />
      {stay && <input type="hidden" name="stayOptionId" value={stay.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`stay-${k}-name`} className={labelClass}>
          Name
        </label>
        <input
          id={`stay-${k}-name`}
          name="name"
          defaultValue={stay?.name ?? ""}
          placeholder="Nice, near the port"
          className={inputClass}
          required
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`stay-${k}-tagline`} className={labelClass}>
          Tagline (one line on the tier card)
        </label>
        <input
          id={`stay-${k}-tagline`}
          name="tagline"
          maxLength={160}
          defaultValue={stay?.tagline ?? ""}
          placeholder="Spend less on the room. Spend more on the weekend."
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`stay-${k}-desc`} className={labelClass}>
          Description (shown to customers)
        </label>
        <textarea
          id={`stay-${k}-desc`}
          name="description"
          rows={2}
          defaultValue={stay?.description ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-hotel`} className={labelClass}>
          Hotel (staff reference)
        </label>
        <input
          id={`stay-${k}-hotel`}
          name="hotelName"
          defaultValue={stay?.hotel_name ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-area`} className={labelClass}>
          Area
        </label>
        <input
          id={`stay-${k}-area`}
          name="area"
          defaultValue={stay?.area ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-stars`} className={labelClass}>
          Stars
        </label>
        <select
          id={`stay-${k}-stars`}
          name="starRating"
          defaultValue={stay?.star_rating ?? ""}
          className={inputClass}
          disabled={disabled}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`stay-${k}-dest`} className={labelClass}>
          Destination
        </label>
        <select
          id={`stay-${k}-dest`}
          name="destinationId"
          defaultValue={stay?.destination_id ?? ""}
          className={inputClass}
          disabled={disabled}
        >
          <option value="">—</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`stay-${k}-delta`} className={labelClass}>
          Price delta per traveler ({currency})
        </label>
        <input
          id={`stay-${k}-delta`}
          name="priceDelta"
          type="number"
          step="0.01"
          defaultValue={major(stay?.price_delta_amount ?? 0)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-shared`} className={labelClass}>
          Shared-room discount per traveler ({currency}, blank = departure default)
        </label>
        <input
          id={`stay-${k}-shared`}
          name="sharedRoomDiscount"
          type="number"
          step="0.01"
          min={0}
          defaultValue={major(stay?.shared_room_discount_amount)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-cap`} className={labelClass}>
          Capacity (travelers, blank = unlimited)
        </label>
        <input
          id={`stay-${k}-cap`}
          name="capacity"
          type="number"
          min={0}
          defaultValue={stay?.capacity ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`stay-${k}-pos`} className={labelClass}>
          Position
        </label>
        <input
          id={`stay-${k}-pos`}
          name="position"
          type="number"
          min={1}
          defaultValue={stay?.position ?? 1}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-3">
        <legend className="px-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Practicalities
        </legend>
        {(
          [
            ["neighborhood", "Neighbourhood", details.neighborhood],
            ["stationDistance", "Distance to station", details.station_distance],
            ["trainTime", "Train time to the event / next stop", details.train_time],
            ["breakfast", "Breakfast", details.breakfast],
            ["roomType", "Room type", details.room_type],
          ] as const
        ).map(([name, text, value]) => (
          <div key={name}>
            <label htmlFor={`stay-${k}-${name}`} className={labelClass}>
              {text}
            </label>
            <input
              id={`stay-${k}-${name}`}
              name={name}
              maxLength={120}
              defaultValue={value ?? ""}
              className={inputClass}
              disabled={disabled}
            />
          </div>
        ))}
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="hotelConfirmed"
            defaultChecked={details.hotel_confirmed ?? false}
            disabled={disabled}
          />{" "}
          Property confirmed (unchecked shows “property named at booking”)
        </label>
      </fieldset>
      <PresentationFields
        prefix={`stay-${k}`}
        imageUrls={stay?.image_urls}
        includes={stay?.includes}
        excludes={stay?.excludes}
        label={stay?.label}
        whyPriceNote={stay?.why_price_note}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={stay?.is_default ?? false}
            disabled={disabled}
          />{" "}
          Default tier
        </label>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            name="isActive"
            defaultValue={String(stay?.is_active ?? true)}
            className={inputClass}
            disabled={disabled}
          >
            <option value="true">Bookable</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        <SubmitButton size="sm" variant={stay ? "secondary" : undefined} disabled={disabled}>
          {stay ? "Save" : "Add stay option"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Create / edit an add-on. Windows are "days before the add-on's date" (0 = the day itself). */
export function AddOnForm({
  departureId,
  addOn,
  currency,
  durationDays,
  disabled,
}: {
  departureId: string;
  addOn?: AddOn;
  currency: string;
  durationDays: number;
  disabled?: boolean;
}) {
  const k = addOn?.id ?? "new";
  return (
    <form action={saveAddOnAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="departureId" value={departureId} />
      {addOn && <input type="hidden" name="addOnId" value={addOn.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`ao-${k}-title`} className={labelClass}>
          Title
        </label>
        <input
          id={`ao-${k}-title`}
          name="title"
          defaultValue={addOn?.title ?? ""}
          className={inputClass}
          required
          disabled={disabled}
          placeholder="Boat day along the Riviera"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`ao-${k}-desc`} className={labelClass}>
          Description
        </label>
        <textarea
          id={`ao-${k}-desc`}
          name="description"
          rows={2}
          defaultValue={addOn?.description ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-kind`} className={labelClass}>
          Kind
        </label>
        <select
          id={`ao-${k}-kind`}
          name="kind"
          defaultValue={addOn?.kind ?? "activity"}
          className={inputClass}
          disabled={disabled}
        >
          {ADD_ON_KINDS.map((kd) => (
            <option key={kd} value={kd}>
              {kd.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`ao-${k}-basis`} className={labelClass}>
          Priced
        </label>
        <select
          id={`ao-${k}-basis`}
          name="pricingBasis"
          defaultValue={addOn?.pricing_basis ?? "per_traveler"}
          className={inputClass}
          disabled={disabled}
        >
          <option value="per_traveler">per traveler</option>
          <option value="per_booking">per booking</option>
        </select>
      </div>
      <div>
        <label htmlFor={`ao-${k}-price`} className={labelClass}>
          Price ({currency})
        </label>
        <input
          id={`ao-${k}-price`}
          name="price"
          type="number"
          step="0.01"
          min={0}
          defaultValue={major(addOn?.price_amount ?? 0)}
          className={inputClass}
          required
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-cap`} className={labelClass}>
          Capacity (blank = unlimited)
        </label>
        <input
          id={`ao-${k}-cap`}
          name="capacity"
          type="number"
          min={0}
          defaultValue={addOn?.capacity ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-day`} className={labelClass}>
          Day (1–{durationDays}, blank = undated)
        </label>
        <input
          id={`ao-${k}-day`}
          name="dayNumber"
          type="number"
          min={1}
          max={durationDays}
          defaultValue={addOn?.day_number ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`ao-${k}-start`} className={labelClass}>
            Start
          </label>
          <input
            id={`ao-${k}-start`}
            name="startTime"
            type="time"
            defaultValue={addOn?.start_time?.slice(0, 5) ?? ""}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`ao-${k}-end`} className={labelClass}>
            End
          </label>
          <input
            id={`ao-${k}-end`}
            name="endTime"
            type="time"
            defaultValue={addOn?.end_time?.slice(0, 5) ?? ""}
            className={inputClass}
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`ao-${k}-loc`} className={labelClass}>
          Location
        </label>
        <input
          id={`ao-${k}-loc`}
          name="locationName"
          defaultValue={addOn?.location_name ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-addr`} className={labelClass}>
          Address
        </label>
        <input
          id={`ao-${k}-addr`}
          name="address"
          defaultValue={addOn?.address ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`ao-${k}-lat`} className={labelClass}>
            Latitude
          </label>
          <input
            id={`ao-${k}-lat`}
            name="latitude"
            type="number"
            step="any"
            defaultValue={addOn?.latitude ?? ""}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`ao-${k}-lng`} className={labelClass}>
            Longitude
          </label>
          <input
            id={`ao-${k}-lng`}
            name="longitude"
            type="number"
            step="any"
            defaultValue={addOn?.longitude ?? ""}
            className={inputClass}
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`ao-${k}-tier`} className={labelClass}>
          Tier group (choose-one set, e.g. race_view)
        </label>
        <input
          id={`ao-${k}-tier`}
          name="tierGroup"
          defaultValue={addOn?.tier_group ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-meet`} className={labelClass}>
          Meeting point (shown to customers)
        </label>
        <input
          id={`ao-${k}-meet`}
          name="meetingPoint"
          maxLength={200}
          defaultValue={addOn?.meeting_point ?? ""}
          placeholder="Port Lympia, Nice · 10:00"
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor={`ao-${k}-age`} className={labelClass}>
          Minimum age (blank = none)
        </label>
        <input
          id={`ao-${k}-age`}
          name="minAge"
          type="number"
          min={0}
          max={99}
          defaultValue={addOn?.min_age ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`ao-${k}-book`} className={labelClass}>
            Bookable until (days before)
          </label>
          <input
            id={`ao-${k}-book`}
            name="bookableUntilDaysBefore"
            type="number"
            min={0}
            defaultValue={addOn?.bookable_until_days_before ?? 1}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`ao-${k}-cancel`} className={labelClass}>
            Cancellable until (days before)
          </label>
          <input
            id={`ao-${k}-cancel`}
            name="cancellableUntilDaysBefore"
            type="number"
            min={0}
            defaultValue={addOn?.cancellable_until_days_before ?? 7}
            className={inputClass}
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`ao-${k}-pos`} className={labelClass}>
          Position
        </label>
        <input
          id={`ao-${k}-pos`}
          name="position"
          type="number"
          min={1}
          defaultValue={addOn?.position ?? 1}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <PresentationFields
        prefix={`ao-${k}`}
        imageUrls={addOn?.image_urls}
        includes={addOn?.includes}
        excludes={addOn?.excludes}
        label={addOn?.label}
        whyPriceNote={addOn?.why_price_note}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={addOn?.is_featured ?? false}
            disabled={disabled}
          />{" "}
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            name="isActive"
            defaultValue={String(addOn?.is_active ?? true)}
            className={inputClass}
            disabled={disabled}
          >
            <option value="true">Bookable</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        <SubmitButton size="sm" variant={addOn ? "secondary" : undefined} disabled={disabled}>
          {addOn ? "Save" : "Add add-on"}
        </SubmitButton>
      </div>
    </form>
  );
}
