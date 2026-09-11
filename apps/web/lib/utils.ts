import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conditional logic (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Tailwind column classes for a grid of `count` equal cards.
 *
 * A fixed three-column grid strands the fourth card alone on its own row with two empty columns
 * beside it, which reads as a mistake rather than a layout. The tier ladders are four rungs and the
 * race-viewing set is four options, so four is the common case and it should be four across.
 *
 * Counts that do not divide evenly fall back to the three-column grid: there is no arrangement that
 * fills every row, and three keeps the cards a readable width.
 */
export function gridColumns(count: number): string {
  if (count <= 1) return "";
  if (count === 2) return "sm:grid-cols-2";
  if (count === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  if (count === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count % 3 === 0) return "sm:grid-cols-2 lg:grid-cols-3";
  if (count % 2 === 0) return "sm:grid-cols-2 xl:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}
