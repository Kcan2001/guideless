import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { deleteHotelRoomAction, saveHotelRoomAction } from "@/lib/admin/actions/hotels";
import type { HotelRoomRow } from "@/lib/hotels/catalog";

export function HotelRoomForm({ hotelId, room }: { hotelId: string; room?: HotelRoomRow }) {
  const k = room?.id ?? "new";
  return (
    <div className="grid gap-2">
      <form
        action={saveHotelRoomAction}
        className="grid gap-2 sm:grid-cols-[2fr_1.5fr_0.8fr_0.6fr_auto]"
      >
        <input type="hidden" name="hotelId" value={hotelId} />
        {room && <input type="hidden" name="roomId" value={room.id} />}
        <div>
          <label htmlFor={`room-${k}-name`} className={labelClass}>
            Room name (as the supplier names it)
          </label>
          <input
            id={`room-${k}-name`}
            name="name"
            defaultValue={room?.name ?? ""}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor={`room-${k}-bed`} className={labelClass}>
            Bed
          </label>
          <input
            id={`room-${k}-bed`}
            name="bedType"
            defaultValue={room?.bed_type ?? ""}
            placeholder="1× king"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`room-${k}-max`} className={labelClass}>
            Max adults
          </label>
          <input
            id={`room-${k}-max`}
            name="maxOccupancy"
            type="number"
            min={1}
            max={8}
            defaultValue={room?.max_occupancy ?? 2}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`room-${k}-pos`} className={labelClass}>
            Order
          </label>
          <input
            id={`room-${k}-pos`}
            name="position"
            type="number"
            min={1}
            max={50}
            defaultValue={room?.position ?? 1}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <SubmitButton size="sm" variant={room ? "secondary" : "primary"}>
            {room ? "Save" : "Add room"}
          </SubmitButton>
        </div>
      </form>
      {room && (
        <form action={deleteHotelRoomAction} className="-mt-1">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomId" value={room.id} />
          <SubmitButton
            size="sm"
            variant="ghost"
            confirm="Remove this room? Stay options pointing at it lose the link."
          >
            Remove
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
