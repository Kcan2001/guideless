/**
 * Mobile theme. Values come from the shared design tokens in @guideless/config so web and
 * mobile never drift. Dark mode uses ink as the ground and cloud as text.
 *
 * Mobile UX rules: usable one-handed, in bright sunlight, while walking, with poor signal.
 * No tiny text, no tiny controls. The current trip state must always be obvious.
 */
import "@/global.css";

import { Platform } from "react-native";
import { colors, colorScale, semantic } from "@guideless/config";

export const Brand = colors;

export const Colors = {
  light: {
    text: semantic.text,
    textSecondary: semantic.textMuted,
    background: semantic.background,
    backgroundElement: semantic.surface,
    backgroundSelected: colorScale.aqua[100],
    border: semantic.border,
    primary: semantic.primary,
    primaryText: semantic.primaryForeground,
    accent: semantic.accent,
    link: semantic.link,
    success: semantic.success,
    warning: semantic.warning,
    danger: semantic.danger,
  },
  dark: {
    text: colors.cloud,
    textSecondary: colorScale.neutral[400],
    background: colors.ink,
    backgroundElement: colorScale.ink[800],
    backgroundSelected: colorScale.ink[700],
    border: colorScale.ink[600],
    primary: colors.aqua,
    primaryText: colors.ink,
    accent: colors.aqua,
    link: colorScale.cyan[400],
    success: colorScale.aqua[600],
    warning: semantic.warning,
    danger: "#E06B6F",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Inter / Manrope are loaded with expo-font in the root layout (Milestone 6).
 * Until then these resolve to sensible platform defaults.
 */
export const Fonts = Platform.select({
  ios: {
    sans: "Inter",
    heading: "Manrope",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "Inter",
    heading: "Manrope",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    heading: "var(--font-display)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

/** Minimum touch target (WCAG 2.2 / platform guidance). */
export const MinTouchTarget = 44;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
