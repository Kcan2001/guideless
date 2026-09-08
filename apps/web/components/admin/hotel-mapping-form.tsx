import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { saveHotelMappingAction } from "@/lib/admin/actions/hotels";
import type { HotelRoomRow } from "@/lib/hotels/catalog";

const SUPPLIERS = [
  { id: "duffel", label: "Duffel Stays" },
  { id: "manual", label: "Manual (mock rates on local / staging)" },
  { id: "expedia", label: "Expedia Rapid (adapter not built yet)" },
  { id: "hotelbeds", label: "Hotelbeds (adapter not built yet)" },
] as const;

/** Links one Guideless hotel (and optionally one room) to a supplier's own identifiers. */
export function HotelMappingForm({ hotelId, rooms }: { hotelId: string; rooms: HotelRoomRow[] }) {
  return (
    <form
      action={saveHotelMappingAction}
      className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto]"
    >
      <input type="hidden" name="hotelId" value={hotelId} />
      <div>
        <label htmlFor="map-supplier" className={labelClass}>
          Supplier
        </label>
        <select id="map-supplier" name="supplier" className={inputClass} defaultValue="duffel">
          {SUPPLIERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="map-hotel" className={labelClass}>
          Supplier hotel id
        </label>
        <input
          id="map-hotel"
          name="supplierHotelId"
          className={inputClass}
          placeholder="acc_0000…"
          required
        />
      </div>
      <div>
        <label htmlFor="map-room" className={labelClass}>
          Room (optional)
        </label>
        <select id="map-room" name="hotelRoomId" className={inputClass} defaultValue="">
          <option value="">Whole hotel</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="map-room-id" className={labelClass}>
          Supplier room id (optional)
        </label>
        <input id="map-room-id" name="supplierRoomId" className={inputClass} />
      </div>
      <div className="flex items-end">
        <SubmitButton size="sm">Add mapping</SubmitButton>
      </div>
    </form>
  );
}
