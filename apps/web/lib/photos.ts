import manifest from "../public/photos/manifest.json";

/**
 * Photography built by scripts/build-web-photos.mjs. Alt text travels with the file so every
 * surface (pages, cards, OG images) says the same thing about the same picture.
 */
export interface SitePhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS object-position keeping the subject in frame when the photo is cropped. */
  position: string | null;
}

const byPath = new Map<string, SitePhoto>(
  (manifest as SitePhoto[]).map((p) => [
    p.src,
    { src: p.src, alt: p.alt, width: p.width, height: p.height, position: p.position ?? null },
  ]),
);

/** Alt text for a photo URL; falls back to the supplied description for admin-uploaded images. */
export function photoAlt(src: string | null | undefined, fallback: string): string {
  if (!src) return fallback;
  return byPath.get(src)?.alt ?? fallback;
}

/** Focal point for a photo URL, or the fallback (default "center"). */
export function photoPosition(src: string | null | undefined, fallback = "center"): string {
  if (!src) return fallback;
  return byPath.get(src)?.position ?? fallback;
}

export function photo(src: string): SitePhoto | null {
  return byPath.get(src) ?? null;
}

/** Fixed picks for surfaces that are not driven by a database row. */
export const sitePhotos = {
  home: "/photos/nice-promenade-dusk.jpg",
  homeSecondary: "/photos/monaco-hairpin-race.jpg",
  howItWorks: "/photos/nice-cours-saleya-flowers.jpg",
  solo: "/photos/nice-old-town-evening.jpg",
} as const;

/** Local photos are served from /public; anything else is an admin upload (Supabase Storage). */
export function isLocalPhoto(src: string): boolean {
  return src.startsWith("/photos/");
}
