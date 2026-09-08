import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { TRIP_PHOTO_MAX_BYTES, TRIP_PHOTO_MIME_TYPES } from "@guideless/validation";
import { supabase } from "@/lib/supabase";

/**
 * Reviews and photos from the app, after a trip has ended. Eligibility lives in the database
 * (`submit_review` refuses anyone whose trip is not finished), so this layer only carries the
 * request and turns a refusal into something a person can read.
 */

export interface ReviewableTrip {
  bookingId: string;
  tripId: string;
  tourId: string;
  tourName: string;
  tripName: string;
  endDate: string;
}

export interface MyReview {
  id: string;
  status: "pending" | "published" | "rejected";
  rating: number;
  title: string | null;
  body: string;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export type PhotoResult =
  | { ok: true; id: string }
  | { ok: false; reason: "cancelled" | "permission" | "too_large" | "unsupported" | "failed" };

function mimeFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType && asset.mimeType in EXTENSIONS) return asset.mimeType;
  const ext = asset.uri.split(".").pop()?.toLowerCase();
  const guess = Object.entries(EXTENSIONS).find(([, e]) => e === ext);
  return guess?.[0] ?? "image/jpeg";
}

export const reviewService = {
  /** Trips this traveler could write about right now. Empty for everyone else. */
  async reviewable(): Promise<ReviewableTrip[]> {
    const { data, error } = await supabase.rpc("reviewable_bookings");
    if (error) {
      if (error.code === "42501") return [];
      throw error;
    }
    return (data ?? []).map((r) => ({
      bookingId: r.booking_id,
      tripId: r.trip_id,
      tourId: r.tour_id,
      tourName: r.tour_name,
      tripName: r.trip_name,
      endDate: r.end_date,
    }));
  },

  async mine(): Promise<MyReview[]> {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, status, rating, title, body")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async submit(input: {
    bookingId: string;
    rating: number;
    body: string;
    title?: string;
    wouldRepeat?: boolean;
  }): Promise<void> {
    const { error } = await supabase.rpc("submit_review", {
      p_booking_id: input.bookingId,
      p_rating: input.rating,
      p_body: input.body,
      p_title: input.title || undefined,
      p_would_repeat: input.wouldRepeat,
    });
    if (error) {
      if (error.hint === "already_reviewed")
        throw new Error("You have already reviewed this trip.");
      if (error.hint === "not_eligible")
        throw new Error("You can review a trip once it has ended.");
      throw new Error("Could not send that. Try again.");
    }
  },

  /**
   * Pick a photo and attach it to a finished trip. The file goes to
   * `trip-media/{trip_id}/{user_id}/`, which is the only path the storage policy and
   * `submit_trip_photo()` both accept, so a row can never point at someone else's file.
   */
  async addPhoto(trip: ReviewableTrip, userId: string, caption?: string): Promise<PhotoResult> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: "permission" };

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      exif: false,
    });
    if (picked.canceled || !picked.assets[0]) return { ok: false, reason: "cancelled" };

    const asset = picked.assets[0];
    const mimeType = mimeFor(asset);
    if (!TRIP_PHOTO_MIME_TYPES.includes(mimeType as (typeof TRIP_PHOTO_MIME_TYPES)[number]))
      return { ok: false, reason: "unsupported" };
    if ((asset.fileSize ?? 0) > TRIP_PHOTO_MAX_BYTES) return { ok: false, reason: "too_large" };

    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      if (bytes.byteLength > TRIP_PHOTO_MAX_BYTES) return { ok: false, reason: "too_large" };

      const path = `${trip.tripId}/${userId}/${Date.now()}.${EXTENSIONS[mimeType]}`;
      const { error: upErr } = await supabase.storage
        .from("trip-media")
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (upErr) return { ok: false, reason: "failed" };

      const { data, error } = await supabase.rpc("submit_trip_photo", {
        p_booking_id: trip.bookingId,
        p_storage_path: path,
        p_caption: caption || undefined,
      });
      if (error || !data) return { ok: false, reason: "failed" };
      return { ok: true, id: (data as { id: string }).id };
    } catch {
      return { ok: false, reason: "failed" };
    }
  },
};

/** Human wording for a failed photo attempt; `cancelled` is silent. */
export function photoErrorMessage(reason: Exclude<PhotoResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "permission":
      return "Guideless needs access to your photos to add one.";
    case "too_large":
      return "That image is over 25 MB. Try a smaller one.";
    case "unsupported":
      return "That file type is not supported. Use a JPEG, PNG or HEIC.";
    case "failed":
      return "Could not add that photo. Try again.";
    default:
      return "";
  }
}
