import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, avatarUploadSchema } from "@guideless/validation";
import { supabase } from "@/lib/supabase";

/**
 * Profile photos. The picker crops to a square, the file goes to `user-avatars/<uid>/` (the only
 * folder a traveler may write to), and the public URL is stored on the profile so the group roster
 * can show it. Storage enforces the size and type limits too; we check first for a kind error.
 */

export type AvatarResult =
  | { ok: true; url: string }
  | { ok: false; reason: "cancelled" | "permission" | "too_large" | "unsupported" | "failed" };

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function mimeFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType && asset.mimeType in EXTENSIONS) return asset.mimeType;
  const ext = asset.uri.split(".").pop()?.toLowerCase();
  const guess = Object.entries(EXTENSIONS).find(([, e]) => e === ext);
  return guess?.[0] ?? "image/jpeg";
}

/** Opens the library, uploads the chosen image and returns its public URL. */
export async function pickAndUploadAvatar(userId: string): Promise<AvatarResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: "permission" };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    exif: false,
  });
  if (picked.canceled || !picked.assets[0]) return { ok: false, reason: "cancelled" };

  const asset = picked.assets[0];
  const mimeType = mimeFor(asset);
  const sizeBytes = asset.fileSize ?? 0;
  const parsed = avatarUploadSchema.safeParse({ mimeType, sizeBytes: sizeBytes || 1 });
  if (!parsed.success) {
    const tooBig = sizeBytes > AVATAR_MAX_BYTES;
    return { ok: false, reason: tooBig ? "too_large" : "unsupported" };
  }
  if (!AVATAR_MIME_TYPES.includes(mimeType as (typeof AVATAR_MIME_TYPES)[number]))
    return { ok: false, reason: "unsupported" };

  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > AVATAR_MAX_BYTES) return { ok: false, reason: "too_large" };

    // One object per traveler: a new photo replaces the old one instead of piling up.
    const path = `${userId}/avatar.${EXTENSIONS[mimeType]}`;
    const { error } = await supabase.storage
      .from("user-avatars")
      .upload(path, bytes, { contentType: mimeType, upsert: true });
    if (error) return { ok: false, reason: "failed" };

    const { data } = supabase.storage.from("user-avatars").getPublicUrl(path);
    // Cache-bust so a replaced photo shows immediately.
    return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Human wording for a failed pick; `cancelled` is silent. */
export function avatarErrorMessage(reason: Exclude<AvatarResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "permission":
      return "Guideless needs access to your photos to set a picture.";
    case "too_large":
      return "That image is over 5 MB. Try a smaller one.";
    case "unsupported":
      return "That file type is not supported. Use a JPEG, PNG or HEIC.";
    case "failed":
      return "Could not upload that photo. Try again.";
    default:
      return "";
  }
}
