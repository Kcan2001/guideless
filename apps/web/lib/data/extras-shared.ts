import type { Tables } from "@guideless/types";

/** Client-safe helpers shared by the tour pages and the Trip Builder (no server-only import). */
export type StayOptionRow = Tables<"departure_stay_options">;

/** Practical facts about a stay tier, read from the `details` jsonb (migration 039). */
export interface StayDetails {
  neighborhood?: string;
  stationDistance?: string;
  trainTime?: string;
  breakfast?: string;
  roomType?: string;
  /** False until a property is contracted; the UI then says "Property confirmed at booking". */
  hotelConfirmed: boolean;
}

/** Safe parse of `departure_stay_options.details`; unknown or malformed keys are ignored. */
export function stayDetails(option: Pick<StayOptionRow, "details">): StayDetails {
  const raw = option.details;
  const obj: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const str = (key: string): string | undefined => {
    const v = obj[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    neighborhood: str("neighborhood"),
    stationDistance: str("station_distance"),
    trainTime: str("train_time"),
    breakfast: str("breakfast"),
    roomType: str("room_type"),
    hotelConfirmed: obj.hotel_confirmed === true,
  };
}
