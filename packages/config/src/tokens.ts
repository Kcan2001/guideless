/**
 * Guideless Travel design tokens — colors.
 *
 * Source of truth for every surface (web CSS variables, Tailwind theme, React Native theme).
 * Values are extracted from the brand logo. See docs/design-system.md.
 *
 * Usage ratio: ~70% neutral (cloud/sand/white), ~20% ink, ~10% aqua/cyan accents.
 * Do not make the whole product turquoise.
 */
export const colors = {
  /** Deep navy-green. Primary text, nav, primary buttons, headers, footer, dark surfaces. */
  ink: "#0B2025",
  /** Primary accent. Highlights, active states, map routes, positive travel moments. */
  aqua: "#60E1BB",
  /** Secondary accent. Links, interactive elements, activity accents, secondary CTA states. */
  cyan: "#17B1DF",
  /** Supporting teal. Use sparingly. */
  teal: "#40B4BD",
  /** Warm neutral. Secondary backgrounds, cards, section backgrounds, journal surfaces. */
  sand: "#DAD9D0",
  /** Primary page background. */
  cloud: "#F5F6F2",
  white: "#FFFFFF",
} as const;

export type ColorToken = keyof typeof colors;

/** Tints/shades derived from the core palette for UI states. Keep this list short. */
export const colorScale = {
  ink: {
    900: "#0B2025",
    800: "#122F36",
    700: "#1B424B",
    600: "#2A5862",
    500: "#3E727D",
    400: "#6A9AA3",
    300: "#9DBFC5",
    200: "#CBDEE1",
    100: "#E7F0F1",
    50: "#F3F8F8",
  },
  aqua: {
    700: "#2FA88A",
    600: "#43C6A3",
    500: "#60E1BB",
    400: "#86EACB",
    300: "#ACF1DB",
    200: "#CFF7EA",
    100: "#E7FBF4",
  },
  cyan: {
    700: "#0F7E9F",
    600: "#1297BF",
    500: "#17B1DF",
    400: "#4CC4E7",
    300: "#83D7EF",
    200: "#B7E8F6",
    100: "#DDF4FB",
  },
  neutral: {
    900: "#1E2325",
    800: "#3A4245",
    700: "#586266",
    600: "#77828A",
    500: "#98A2A6",
    400: "#B8BFC1",
    300: "#D0D3D0",
    200: "#DAD9D0",
    100: "#ECECE6",
    50: "#F5F6F2",
  },
} as const;

/** Semantic roles — what the UI should reference instead of raw palette values. */
export const semantic = {
  background: colors.cloud,
  surface: colors.white,
  surfaceMuted: colors.sand,
  surfaceInverse: colors.ink,
  text: colors.ink,
  textMuted: colorScale.neutral[700],
  textInverse: colors.cloud,
  border: colorScale.neutral[200],
  borderStrong: colorScale.neutral[400],
  primary: colors.ink,
  primaryForeground: colors.white,
  accent: colors.aqua,
  accentForeground: colors.ink,
  link: colors.cyan,
  linkHover: colorScale.cyan[700],
  focusRing: colors.cyan,
  success: "#2FA88A",
  warning: "#D9A441",
  danger: "#C9484D",
  info: colors.cyan,
} as const;

export type SemanticToken = keyof typeof semantic;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;
