import type { Tables } from "@guideless/types";

/**
 * Pure helpers for the Map tab: turn trip data into markers, filter them by day and compute the
 * region that shows them. No react-native imports so this stays unit-testable in node.
 */

export type MarkerKind =
  "hotel" | "anchor" | "item" | "moment" | "recommendation" | "add_on" | "meeting_point";

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  title: string;
  subtitle: string | null;
  latitude: number;
  longitude: number;
  /** ISO date the marker belongs to; null = every day (hotel spanning nights, recommendations). */
  date: string | null;
  /** Deep route inside the app, when the marker has a detail screen. */
  route: string | null;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

type Item = Pick<
  Tables<"trip_itinerary_items">,
  | "id"
  | "title"
  | "type"
  | "latitude"
  | "longitude"
  | "start_time"
  | "location_name"
  | "is_anchor"
  | "visibility"
>;
type Day = Pick<Tables<"trip_days">, "id" | "date"> & { items: Item[] };
type Hotel = Pick<
  Tables<"accommodations">,
  "id" | "name" | "address" | "latitude" | "longitude" | "check_in_date" | "check_out_date"
>;
type Recommendation = Pick<
  Tables<"recommendations">,
  "id" | "title" | "latitude" | "longitude" | "neighborhood" | "destination_id"
>;
type Moment = Pick<
  Tables<"live_moments">,
  "id" | "title" | "latitude" | "longitude" | "start_at" | "location_name" | "status"
>;
type AddOn = Pick<
  Tables<"departure_add_ons">,
  "id" | "title" | "latitude" | "longitude" | "day_number" | "location_name" | "start_time"
>;

function hasCoords<T extends { latitude: number | null; longitude: number | null }>(
  x: T,
): x is T & { latitude: number; longitude: number } {
  return typeof x.latitude === "number" && typeof x.longitude === "number";
}

function clock(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

export function buildMarkers(input: {
  days: Day[];
  accommodations: Hotel[];
  recommendations?: Recommendation[];
  moments?: Moment[];
  addOns?: AddOn[];
  tripStartDate?: string;
}): MapMarker[] {
  const out: MapMarker[] = [];

  for (const h of input.accommodations) {
    if (!hasCoords(h)) continue;
    out.push({
      id: `hotel:${h.id}`,
      kind: "hotel",
      title: h.name,
      subtitle: h.address ?? "Your hotel",
      latitude: h.latitude,
      longitude: h.longitude,
      date: null,
      route: null,
    });
  }

  for (const day of input.days) {
    for (const i of day.items) {
      if (!hasCoords(i) || i.visibility === "staff_only") continue;
      out.push({
        id: `item:${i.id}`,
        kind: i.is_anchor ? "anchor" : i.type === "meeting_point" ? "meeting_point" : "item",
        title: i.title,
        subtitle: [clock(i.start_time), i.location_name].filter(Boolean).join(" · ") || null,
        latitude: i.latitude,
        longitude: i.longitude,
        date: day.date,
        route: `/item/${i.id}`,
      });
    }
  }

  for (const m of input.moments ?? []) {
    if (!hasCoords(m) || m.status === "cancelled") continue;
    out.push({
      id: `moment:${m.id}`,
      kind: "moment",
      title: m.title,
      subtitle: m.location_name ?? "Live Moment",
      latitude: m.latitude,
      longitude: m.longitude,
      date: m.start_at.slice(0, 10),
      route: "/group",
    });
  }

  for (const a of input.addOns ?? []) {
    if (!hasCoords(a)) continue;
    out.push({
      id: `addon:${a.id}`,
      kind: "add_on",
      title: a.title,
      subtitle: [clock(a.start_time), a.location_name, "Optional add-on"]
        .filter(Boolean)
        .join(" · "),
      latitude: a.latitude,
      longitude: a.longitude,
      date:
        a.day_number && input.tripStartDate ? addDays(input.tripStartDate, a.day_number - 1) : null,
      route: null,
    });
  }

  for (const r of input.recommendations ?? []) {
    if (!hasCoords(r)) continue;
    out.push({
      id: `rec:${r.id}`,
      kind: "recommendation",
      title: r.title,
      subtitle: r.neighborhood ?? "Recommendation",
      latitude: r.latitude,
      longitude: r.longitude,
      date: null,
      route: "/explore",
    });
  }

  return out;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "all" keeps everything; a date keeps that day's markers plus the undated ones (hotel, recommendations). */
export function filterMarkers(markers: MapMarker[], dayFilter: "all" | string): MapMarker[] {
  if (dayFilter === "all") return markers;
  return markers.filter((m) => m.date === null || m.date === dayFilter);
}

/** A region that contains every marker with some breathing room; null when there is nothing to show. */
export function regionFor(
  markers: MapMarker[],
  fallback?: { latitude: number; longitude: number },
): Region | null {
  if (markers.length === 0) {
    return fallback
      ? {
          latitude: fallback.latitude,
          longitude: fallback.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : null;
  }
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
  };
}

/** Native maps deep link for a marker. */
export function directionsUrl(m: Pick<MapMarker, "latitude" | "longitude" | "title">): string {
  return `https://maps.google.com/?q=${m.latitude},${m.longitude}(${encodeURIComponent(m.title)})`;
}

export const MARKER_COLOR: Record<MarkerKind, string> = {
  hotel: "#0B2025",
  anchor: "#60E1BB",
  item: "#17B1DF",
  meeting_point: "#40B4BD",
  moment: "#F2B84B",
  add_on: "#8E6BD9",
  recommendation: "#8A8F93",
};
