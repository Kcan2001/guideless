import type { Tables } from "@guideless/types";

/** Client-safe helpers shared by the tour pages and the Trip Builder (no server-only import). */
export type StayOptionRow = Tables<"departure_stay_options">;

/**
 * The public profile of one property a tier is priced against (migration 20260910001000).
 *
 * A tier is a *list* of these, one per city, because a multi-city trip is several hotels. A
 * single-city tier has exactly one, covering the whole departure.
 */
export interface StayHotel {
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  starRating: number | null;
  description: string | null;
  amenities: string[];
  imageUrls: string[];
  /** The city as the itinerary names it ("Avignon"), for the label above the card. */
  legName: string | null;
  /** Nights in this city, and the dates they fall on. */
  nights: number;
  checkIn: string;
  checkOut: string;
}

/**
 * Photographs for a tier card, taken from the properties themselves and falling back to the
 * seeded destination shot.
 *
 * On a multi-city tier the frames are interleaved rather than concatenated, so the first thing a
 * traveler sees is the first city rather than eight photographs of Nice followed by Paris.
 */
export function stayGallery(
  hotels: readonly StayHotel[],
  fallback: readonly string[],
  perHotel = 3,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < perHotel; i++) {
    for (const h of hotels) {
      const url = h.imageUrls[i];
      if (url) out.push(url);
    }
  }
  return out.length > 0 ? out : [...fallback];
}

/** "Hôtel Windsor · Le Cloître · Hôtel Fabric", or a single name, or null. */
export function stayHotelNames(hotels: readonly StayHotel[]): string | null {
  const names = hotels.map((h) => h.name).filter(Boolean);
  return names.length > 0 ? names.join(" · ") : null;
}

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
