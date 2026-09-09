import * as Location from "expo-location";
import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/assistant/service";

/**
 * Where the traveler is, and — only if they say so — where the group is.
 *
 * Two separate things that are easy to conflate, and the whole design depends on not conflating
 * them:
 *
 *   `current()` reads the device position and gives it to the caller. Nothing is stored, nothing
 *   leaves the phone except as a query parameter on a request that answers a question and forgets.
 *
 *   `startSharing()` writes a row that other people on the trip can see. That is a different
 *   promise entirely, it is off by default, it lapses on its own, and `stopSharing()` deletes the
 *   row rather than hiding it.
 *
 * Foreground only. There is no background permission, no geofence and no significant-change
 * listener, because a travel app that follows you around when it is closed is a different product
 * from the one we said we were building.
 */

export type TripLocation = Tables<"trip_locations">;

export interface Position {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export type PositionResult =
  { ok: true; position: Position } | { ok: false; reason: "denied" | "disabled" | "unavailable" };

export const locationService = {
  /** Whether we already hold permission, without asking for it — for rendering the prompt. */
  async permission(): Promise<"granted" | "denied" | "undetermined"> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return "granted";
    if (status === Location.PermissionStatus.DENIED) return "denied";
    return "undetermined";
  },

  /**
   * One position, now. Balanced accuracy on purpose: street-level is enough to sort what is a
   * five-minute walk away, and the best-accuracy modes cost battery for precision nobody needs.
   */
  async current(): Promise<PositionResult> {
    try {
      if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "disabled" };
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return { ok: false, reason: "denied" };

      const reading = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        ok: true,
        position: {
          latitude: reading.coords.latitude,
          longitude: reading.coords.longitude,
          accuracyMeters: reading.coords.accuracy ?? null,
        },
      };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  },

  // ── Sharing with the group ─────────────────────────────────────────────────

  /** Everyone on this trip whose position we are allowed to see. RLS does the deciding. */
  async sharedOnTrip(tripId: string): Promise<TripLocation[]> {
    const { data, error } = await supabase.from("trip_locations").select("*").eq("trip_id", tripId);
    if (error) throw error;
    return data;
  },

  /** Whether *I* am currently sharing, and until when. */
  async mySharing(tripId: string, userId: string): Promise<TripLocation | null> {
    const { data } = await supabase
      .from("trip_locations")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  },

  /**
   * Turn sharing on for a bounded window and write the first position. The database clamps the
   * window to its own ceiling, so a bug here cannot make somebody share for a year.
   */
  async startSharing(tripId: string, userId: string, hours: number): Promise<PositionResult> {
    const result = await this.current();
    if (!result.ok) return result;

    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    const { error } = await supabase.from("trip_locations").upsert(
      {
        trip_id: tripId,
        user_id: userId,
        latitude: result.position.latitude,
        longitude: result.position.longitude,
        accuracy_meters: result.position.accuracyMeters,
        sharing_until: until,
      },
      { onConflict: "trip_id,user_id" },
    );
    if (error) return { ok: false, reason: "unavailable" };
    return result;
  },

  /** A position refresh that does NOT extend the window — sharing still lapses when it was going to. */
  async refreshShared(tripId: string, userId: string): Promise<void> {
    const result = await this.current();
    if (!result.ok) return;
    await supabase
      .from("trip_locations")
      .update({
        latitude: result.position.latitude,
        longitude: result.position.longitude,
        accuracy_meters: result.position.accuracyMeters,
      })
      .eq("trip_id", tripId)
      .eq("user_id", userId);
  },

  /** Going dark. Deletes the row: there is nothing left to show, not a hidden row. */
  async stopSharing(tripId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_locations")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId);
    if (error) throw new Error("Could not stop sharing. Try again.");
  },
};

// ── What's good near me ──────────────────────────────────────────────────────

export interface NearbyPlace {
  id: string;
  name: string;
  source: "curated" | "live";
  description: string | null;
  categories: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  priceLevel: number | null;
  rating: number | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  matchedTaste: string[];
}

export interface NearbyResult {
  places: NearbyPlace[];
  liveUnavailable: boolean;
  provider: string;
}

/**
 * The nearby list. Goes through the web app because the places provider and its key live there;
 * the position is a query parameter and is not stored at either end.
 */
export async function fetchNearby(position: Position, query?: string): Promise<NearbyResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { places: [], liveUnavailable: true, provider: "none" };

  const params = new URLSearchParams({
    lat: String(position.latitude),
    lng: String(position.longitude),
  });
  if (query) params.set("q", query);

  const res = await fetch(`${SITE_URL}/api/places/nearby?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) return { places: [], liveUnavailable: true, provider: "none" };
  return (await res.json()) as NearbyResult;
}

/** Human wording for a refused or impossible position. `denied` is the one that needs a route out. */
export function positionErrorMessage(
  reason: Exclude<PositionResult, { ok: true }>["reason"],
): string {
  switch (reason) {
    case "denied":
      return "Guideless needs location access to show what is near you. You can turn it on in Settings.";
    case "disabled":
      return "Location services are off on this device.";
    default:
      return "Couldn't get your location. Try again in a moment.";
  }
}
