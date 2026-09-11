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
/**
 * The home hero film: a short silent loop cut from Kyle's own Monaco footage across the 2024, 2025
 * and 2026 race weekends. Built by scripts/build-hero-video.mjs, which is where the clip list and
 * the encode settings live.
 *
 * Two files because no single codec is both small and universal: WebM/VP9 is meaningfully lighter
 * and every current browser takes it; the H.264 MP4 is the fallback for older Safari. The browser
 * picks the first `<source>` it understands, so WebM is listed first.
 */
export const heroVideo = {
  webm: "/video/monaco-hero.webm",
  mp4: "/video/monaco-hero.mp4",
} as const;

export const sitePhotos = {
  home: "/photos/nice-promenade-dusk.jpg",
  homeSecondary: "/photos/monaco-hairpin-race.jpg",
  howItWorks: "/photos/nice-cours-saleya-flowers.jpg",
  solo: "/photos/nice-old-town-evening.jpg",
  /** Why Guideless — one per benefit block. */
  choices: "/photos/monaco-yacht-deck-view.jpg",
  people: "/photos/paris-seine-quay.jpg",
  app: "/photos/paris-metropolitain-sign.jpg",
  addLater: "/photos/monaco-harbour-yachts.jpg",
  /** Independent, not alone. */
  together: "/photos/paris-cafe-terrace.jpg",
  /** Founder / about. */
  founder: "/photos/chateauneuf-cellar-barrels.jpg",
  about: "/photos/chateauneuf-vineyard-road.jpg",
  /** Page heroes. */
  whyGuideless: "/photos/nice-beach-castle-hill.jpg",
  faq: "/photos/paris-covered-passage.jpg",
  contact: "/photos/nice-place-massena-wide.jpg",
  groupTravel: "/photos/nice-bay-promenade.jpg",
  cancellation: "/photos/paris-arcades-street.jpg",
  insurance: "/photos/provence-view-vines.jpg",
} as const;

/** Local photos are served from /public; anything else is an admin upload (Supabase Storage). */
export function isLocalPhoto(src: string): boolean {
  return src.startsWith("/photos/");
}
