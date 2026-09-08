import { supabase } from "@/lib/supabase";

/**
 * Per-activity chat rooms: everyone who bought the Friday boat gets a room for the Friday boat.
 * RLS hides a room from anyone who has not bought into it, so there is nothing to filter here.
 *
 * The RPCs land with the activity-chat migration; until every environment has them, a missing
 * function is treated as "the feature is not available here" and the UI simply hides its entry
 * point rather than showing an error.
 *
 * TODO(types): drop the `never` casts once packages/types/src/database.ts includes
 * `ensure_add_on_chat_room` and `chat_rooms.add_on_id`.
 */

/** PostgREST codes for "no such function" / "no such column". */
function isMissingObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42703") return true;
  return /could not find the function|does not exist/i.test(error.message ?? "");
}

let unavailable = false;

export interface AddOnRoom {
  id: string;
  add_on_id: string | null;
}

export const addOnRoomsService = {
  /** True once the database has told us these RPCs are not here. */
  get isUnavailable(): boolean {
    return unavailable;
  },

  /**
   * The room for one add-on, creating and joining it on first use. Returns null when the feature
   * is unavailable or the traveler is not entitled to the room.
   */
  async ensureRoom(tripId: string, addOnId: string): Promise<AddOnRoom | null> {
    if (unavailable) return null;
    const { data, error } = await supabase.rpc(
      "ensure_add_on_chat_room" as never,
      {
        p_trip_id: tripId,
        p_add_on_id: addOnId,
      } as never,
    );
    if (error) {
      if (isMissingObject(error)) {
        unavailable = true;
        return null;
      }
      throw error;
    }
    const room = (Array.isArray(data) ? data[0] : data) as AddOnRoom | null;
    return room ?? null;
  },
};
