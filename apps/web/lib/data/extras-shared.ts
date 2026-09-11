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

/**
 * One entry on the tour page, standing for one *thing* you can add rather than one row you can buy.
 *
 * The tour page and the builder answer different questions. "Can I watch this from a yacht?" is a
 * tour-page question; "qualifying day, race day, or both?" is a builder question, and answering it
 * on the tour page turned a four-card ladder into a twelve-card wall. So rows that share a `family`
 * collapse into one entry here, and the builder keeps every row untouched.
 *
 * The price is the cheapest variant's, because a Friday yacht and a Sunday yacht are not the same
 * price. Quoting the dearest would mislead in the other direction, so a collapsed family always
 * renders as "From".
 */
export interface AddOnFamily<T extends AddOnLike> {
  /** Stable per departure: the family name, or the add-on's id when it stands alone. */
  key: string;
  title: string;
  /** Family-level copy, falling back to the cheapest variant's own description. */
  summary: string | null;
  /** Cheapest variant's price. Render with `isFrom` — never bare when the family has variants. */
  fromAmount: number;
  /** True when this stands for more than one row, which is exactly when "From" is required. */
  isFrom: boolean;
  variantCount: number;
  /** The cheapest variant, whose tier, photos and kind the card borrows. */
  cheapest: T;
  /** Every row behind this entry, cheapest first, for the detail sheet. */
  variants: T[];
}

/** The subset of an add-on this module needs. Keeps the helper usable from client components. */
export interface AddOnLike {
  id: string;
  title: string;
  description: string | null;
  family: string | null;
  family_summary: string | null;
  price_amount: number;
}

/**
 * Collapse add-ons into families, preserving the order they arrived in.
 *
 * A null `family` is not a missing value — it means the add-on is its own family, which is the
 * common case (a transfer, a dinner). Those pass through as single-variant entries priced exactly,
 * because there is nothing for a "From" to range over.
 */
export function addOnFamilies<T extends AddOnLike>(addOns: readonly T[]): AddOnFamily<T>[] {
  const order: string[] = [];
  const groups = new Map<string, T[]>();

  for (const a of addOns) {
    const key = a.family ?? a.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(a);
    } else {
      groups.set(key, [a]);
      order.push(key);
    }
  }

  return order.map((key) => {
    // Non-null: every key in `order` was inserted alongside its group.
    const variants = [...groups.get(key)!].sort((a, b) => a.price_amount - b.price_amount);
    const cheapest = variants[0]!;
    return {
      key,
      title: cheapest.family ?? cheapest.title,
      summary: cheapest.family_summary ?? cheapest.description,
      fromAmount: cheapest.price_amount,
      isFrom: variants.length > 1,
      variantCount: variants.length,
      cheapest,
      variants,
    };
  });
}
