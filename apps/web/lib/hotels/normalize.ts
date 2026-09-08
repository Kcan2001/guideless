import type { Currency, ISODate } from "@guideless/types";
import { CURRENCIES } from "@guideless/types";
import { minorUnitDigits } from "@guideless/utils";

/**
 * Helpers shared by supplier adapters when translating an API payload into NormalizedRate /
 * NormalizedHotel. Pure functions; no I/O.
 */

/** "1234.50" | 1234.5 in major units → 123450 minor units for the currency. */
export function toMinorUnits(amount: string | number, currency: Currency): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new TypeError(`Not a number: ${String(amount)}`);
  const factor = 10 ** minorUnitDigits(currency);
  return Math.round(n * factor);
}

/** Suppliers sometimes return lowercase or unexpected codes; only the currencies we sell pass. */
export function asCurrency(code: string): Currency {
  const upper = code.trim().toUpperCase();
  if ((CURRENCIES as readonly string[]).includes(upper)) return upper as Currency;
  throw new RangeError(`Unsupported currency ${code}`);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Guards a supplier date; accepts full ISO timestamps and keeps the date part. */
export function asIsoDate(value: string): ISODate {
  const v = value.trim();
  if (ISO_DATE.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  throw new RangeError(`Not an ISO date: ${value}`);
}

/** Nights between two ISO dates (check-out exclusive). */
export function nights(checkIn: ISODate, checkOut: ISODate): number {
  const a = Date.UTC(+checkIn.slice(0, 4), +checkIn.slice(5, 7) - 1, +checkIn.slice(8, 10));
  const b = Date.UTC(+checkOut.slice(0, 4), +checkOut.slice(5, 7) - 1, +checkOut.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Lowercase, collapse whitespace, strip punctuation noise so "King Room" == "king  room". */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BED_ALIASES: Array<[RegExp, string]> = [
  [/\b(king|super king)\b/, "king"],
  [/\bqueen\b/, "queen"],
  [/\b(twin|2 single|two single)\b/, "twin"],
  [/\bdouble\b/, "double"],
  [/\bsingle\b/, "single"],
];

/** Supplier bed descriptions → a small vocabulary used by the fingerprint. */
export function normalizeBedType(value: string | null | undefined): string | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;
  for (const [re, name] of BED_ALIASES) if (re.test(text)) return name;
  return text;
}

/** True when a supplier flag or phrase means breakfast is part of the rate. */
export function impliesBreakfast(...hints: Array<string | boolean | null | undefined>): boolean {
  return hints.some((h) =>
    typeof h === "boolean"
      ? h
      : /\b(breakfast|bed and breakfast|b&b|half board|full board)\b/i.test(h ?? ""),
  );
}
