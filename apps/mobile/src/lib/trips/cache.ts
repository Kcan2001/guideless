import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TripDetail } from "@/lib/trips/service";

/**
 * Offline cache for the current trip (spec §49). Travelers are underground, roaming or on hotel
 * Wi-Fi; the itinerary, hotel details and emergency numbers must open instantly and degrade to
 * "Last synced 8 minutes ago" rather than a spinner.
 */
const KEY = (tripId: string) => `guideless:trip:${tripId}`;
const INDEX_KEY = "guideless:trips:index";
/**
 * Bump whenever the cached `TripDetail` shape changes. An entry written by an older build is
 * ignored rather than parsed, so a shape change costs one refetch instead of a crash.
 */
const CACHE_VERSION = 2;

export interface CachedTrip {
  detail: TripDetail;
  syncedAt: string; // ISO
  version?: number;
}

export const tripCache = {
  async save(detail: TripDetail): Promise<void> {
    try {
      const entry: CachedTrip = {
        detail,
        syncedAt: new Date().toISOString(),
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(KEY(detail.trip.id), JSON.stringify(entry));
      const ids = await tripCache.index();
      if (!ids.includes(detail.trip.id)) {
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...ids, detail.trip.id]));
      }
    } catch {
      /* storage full or unavailable — cache is best effort */
    }
  },

  async load(tripId: string): Promise<CachedTrip | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY(tripId));
      if (!raw) return null;
      const entry = JSON.parse(raw) as CachedTrip;
      // Written by an older build: drop it and let the query refetch.
      if (entry.version !== CACHE_VERSION) return null;
      return entry;
    } catch {
      return null;
    }
  },

  async index(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  },

  async clear(): Promise<void> {
    try {
      const ids = await tripCache.index();
      await AsyncStorage.multiRemove([...ids.map(KEY), INDEX_KEY]);
    } catch {
      /* ignore */
    }
  },
};

/** "Just now", "8 minutes ago", "2 hours ago", "yesterday". */
export function syncedAgo(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
