/**
 * The veil between a hero photograph and the text on top of it.
 *
 * This exists because "a photograph is not an ink ground" is a rule that is easy to write and easy
 * to break: a hero *looks* dark, so an accent eyebrow on it looks safe, and then the type sits over
 * whatever the picture is doing behind it — which on the home page is a bright sky at 2.3:1.
 *
 * Four heroes had the same gradient copied into them (`from-ink/90 via-ink/70 to-ink/20`) and that
 * was not strong enough: measured against the brightest decile of the actual painted pixels under
 * the eyebrow, even pure cloud only reached 3.4:1 against a 4.5 minimum. Copied values drift and
 * nobody re-measures them, so the value lives here once, with the number it has to hit.
 *
 * The requirement: **cloud text over this scrim clears 4.5:1 against the brightest part of any
 * photograph we ship.** Verified by sampling rendered pixels, not by reading the token.
 *
 * The gradient is horizontal because hero text is left-aligned in a column that ends around 60% of
 * the width — so the left stays near-ink and the right keeps the photograph legible as a picture.
 */
export function HeroScrim({ hasPhoto = true }: { hasPhoto?: boolean }) {
  return (
    <div
      className={
        hasPhoto
          ? "absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/88 to-ink/35"
          : "absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
      }
      aria-hidden
    />
  );
}

/**
 * Eyebrow over a hero photograph.
 *
 * Cloud, not aqua. Aqua on ink is 10.4:1 and is the accent's home; aqua on a photograph is 2.3:1
 * and has been shipped three times by someone (me) who had just finished writing the rule against
 * it. Accent colours go on ink, not on pictures of the sea.
 */
export const heroEyebrowClass =
  "text-sm font-heading font-extrabold uppercase tracking-[0.22em] text-cloud";
