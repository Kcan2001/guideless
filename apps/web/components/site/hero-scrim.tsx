/**
 * The veil between a hero photograph and everything drawn on top of it.
 *
 * This exists because "a photograph is not an ink ground" is a rule that is easy to write and easy
 * to break: a hero *looks* dark, so light text on it looks safe, and then the type sits over
 * whatever the picture is doing behind it — which on the home page was a bright sky at 2.3:1.
 * Four heroes had the same gradient copied into them and none of them had been measured.
 *
 * Three layers, each with a job:
 *
 *   1. **The header band.** The site header is transparent over a dark hero, so the top ~140px has
 *      to be dark enough for cloud nav links whatever the photograph is doing up there.
 *   2. **The text column.** Hero copy is left-aligned in a column ending around 60% of the width,
 *      so the left stays near-ink and the right keeps the photograph legible as a picture.
 *   3. **The base.** The hero fades to full ink at the bottom so it dissolves into the ink band
 *      below it rather than stopping at a hard horizontal edge.
 *
 * The requirement: **cloud text over this scrim clears 4.5:1 against the brightest part of any
 * photograph we ship.** Verified by sampling rendered pixels, not by reading the token.
 */
export function HeroScrim({
  hasPhoto = true,
  /** Fade the base to solid ink. On for a hero that sits directly above an ink section. */
  fadeToInk = false,
}: {
  hasPhoto?: boolean;
  fadeToInk?: boolean;
}) {
  if (!hasPhoto) {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
        aria-hidden
      />
    );
  }
  return (
    <>
      {/* 2 — the text column */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink/98 via-ink/92 to-ink/75 lg:to-ink/22"
        aria-hidden
      />
      {/* 1 — the header band */}
      <div
        className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-ink/90 via-ink/60 to-transparent"
        aria-hidden
      />
      {/* 3 — the base, dissolving into whatever comes next */}
      {fadeToInk && (
        <div
          className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-ink"
          aria-hidden
        />
      )}
    </>
  );
}

/**
 * Eyebrow over a hero photograph.
 *
 * Cloud, not aqua. Aqua on ink is 10.4:1 and is the accent's home; aqua on a photograph is 2.3:1
 * and has been shipped three times by someone (me) who had just finished writing the rule against
 * it. Accent colours go on ink, not on pictures of the sea.
 */
export const heroEyebrowClass = "eyebrow tracking-[0.22em] text-cloud";
