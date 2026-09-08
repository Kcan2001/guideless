import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import type { HotelRow } from "@/lib/hotels/catalog";

/** Curated hotel record (hotelFormSchema). Plain form; works without JavaScript like every admin form. */
export function HotelForm({
  action,
  hotel,
  destinations,
  submitLabel,
  returnTo,
}: {
  action: (fd: FormData) => Promise<void>;
  hotel?: HotelRow;
  destinations: Array<{ id: string; name: string }>;
  submitLabel: string;
  returnTo?: string;
}) {
  const k = hotel?.id ?? "new";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {hotel && <input type="hidden" name="hotelId" value={hotel.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div>
        <label htmlFor={`hotel-${k}-name`} className={labelClass}>
          Name (as contracted)
        </label>
        <input
          id={`hotel-${k}-name`}
          name="name"
          defaultValue={hotel?.name ?? ""}
          className={inputClass}
          required
          minLength={2}
          maxLength={160}
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-slug`} className={labelClass}>
          Slug (lowercase, hyphens)
        </label>
        <input
          id={`hotel-${k}-slug`}
          name="slug"
          defaultValue={hotel?.slug ?? ""}
          className={inputClass}
          required
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          placeholder="hotel-du-port-nice"
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-dest`} className={labelClass}>
          Destination
        </label>
        <select
          id={`hotel-${k}-dest`}
          name="destinationId"
          defaultValue={hotel?.destination_id ?? ""}
          className={inputClass}
          required
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
        <label htmlFor={`hotel-${k}-stars`} className={labelClass}>
          Stars (only when the property is contracted)
        </label>
        <select
          id={`hotel-${k}-stars`}
          name="starRating"
          defaultValue={hotel?.star_rating ?? ""}
          className={inputClass}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`hotel-${k}-address`} className={labelClass}>
          Address
        </label>
        <input
          id={`hotel-${k}-address`}
          name="address"
          defaultValue={hotel?.address ?? ""}
          className={inputClass}
          maxLength={400}
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-city`} className={labelClass}>
          City
        </label>
        <input
          id={`hotel-${k}-city`}
          name="city"
          defaultValue={hotel?.city ?? ""}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-country`} className={labelClass}>
          Country (ISO 2-letter)
        </label>
        <input
          id={`hotel-${k}-country`}
          name="countryCode"
          maxLength={2}
          defaultValue={hotel?.country_code ?? ""}
          className={inputClass}
          placeholder="FR"
          required
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-lat`} className={labelClass}>
          Latitude
        </label>
        <input
          id={`hotel-${k}-lat`}
          name="latitude"
          type="number"
          step="0.000001"
          defaultValue={hotel?.latitude ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-lng`} className={labelClass}>
          Longitude
        </label>
        <input
          id={`hotel-${k}-lng`}
          name="longitude"
          type="number"
          step="0.000001"
          defaultValue={hotel?.longitude ?? ""}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`hotel-${k}-desc`} className={labelClass}>
          Description (staff reference; tier cards use the stay option copy)
        </label>
        <textarea
          id={`hotel-${k}-desc`}
          name="description"
          rows={2}
          defaultValue={hotel?.description ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-images`} className={labelClass}>
          Photo URLs (one per line)
        </label>
        <textarea
          id={`hotel-${k}-images`}
          name="imageUrls"
          rows={2}
          defaultValue={(hotel?.image_urls ?? []).join("\n")}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`hotel-${k}-amenities`} className={labelClass}>
          Amenities (one per line)
        </label>
        <textarea
          id={`hotel-${k}-amenities`}
          name="amenities"
          rows={2}
          defaultValue={(hotel?.amenities ?? []).join("\n")}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={hotel?.is_active ?? true}
        />
        Active (selectable on stay options)
      </label>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
