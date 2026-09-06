/**
 * Guideless Tours design tokens — typography.
 *
 * Inter for UI/body, Manrope for headings. Large, clean, spacious, highly readable.
 * No decorative travel fonts. Mobile scales down naturally.
 */
export const fontFamilies = {
  body: "Inter",
  heading: "Manrope",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Web CSS font stacks (fall back sensibly when webfonts have not loaded). */
export const fontStacks = {
  body: `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  heading: `"Manrope", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  mono: fontFamilies.mono,
} as const;

/** Type scale in px. Web values; mobile uses the `mobile` column. */
export const typeScale = {
  hero: { web: 72, mobile: 40, lineHeight: 1.05, weight: 700, family: "heading" },
  h1: { web: 56, mobile: 32, lineHeight: 1.1, weight: 700, family: "heading" },
  h2: { web: 40, mobile: 28, lineHeight: 1.15, weight: 700, family: "heading" },
  h3: { web: 28, mobile: 22, lineHeight: 1.25, weight: 600, family: "heading" },
  h4: { web: 22, mobile: 18, lineHeight: 1.3, weight: 600, family: "heading" },
  bodyLarge: { web: 20, mobile: 18, lineHeight: 1.6, weight: 400, family: "body" },
  body: { web: 17, mobile: 16, lineHeight: 1.6, weight: 400, family: "body" },
  small: { web: 14, mobile: 14, lineHeight: 1.5, weight: 400, family: "body" },
  caption: { web: 12, mobile: 12, lineHeight: 1.4, weight: 500, family: "body" },
} as const;

export type TypeScaleToken = keyof typeof typeScale;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
