import type { Currency, Money } from "@guideless/types";

/**
 * Money helpers. All amounts are integer minor units (cents, pence, …).
 * Never use floating point for financial values.
 */

/** Minor-unit exponent per currency. Every supported currency is 2 today; JPY-style zero-decimal
 *  currencies would be added here alongside the CURRENCIES enum. */
const MINOR_UNIT_DIGITS: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
};

export function minorUnitDigits(currency: Currency): number {
  return MINOR_UNIT_DIGITS[currency];
}

export function money(amount: number, currency: Currency): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`Money amount must be an integer in minor units, got ${amount}`);
  }
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function multiply(m: Money, factor: number): Money {
  return money(Math.round(m.amount * factor), m.currency);
}

export function sum(items: readonly Money[], currency: Currency): Money {
  return items.reduce<Money>((acc, m) => add(acc, m), money(0, currency));
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

/**
 * Percentage of an amount, rounded half-up to the nearest minor unit.
 * `percent` is 0–100. Used for deposits and refund tiers.
 */
export function percentage(m: Money, percent: number): Money {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`percent must be between 0 and 100, got ${percent}`);
  }
  return money(Math.round((m.amount * percent) / 100), m.currency);
}

/**
 * Format for display in the given locale, e.g. formatMoney({amount: 349500, currency: "USD"})
 * → "$3,495.00". Hides trailing ".00" when `compact` is true.
 */
export function formatMoney(
  m: Money,
  options: { locale?: string; compact?: boolean } = {},
): string {
  const { locale = "en-US", compact = false } = options;
  const digits = minorUnitDigits(m.currency);
  const major = m.amount / 10 ** digits;
  const isWhole = m.amount % 10 ** digits === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: compact && isWhole ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(major);
}

/** Parse a user-entered decimal string ("3,495.00", "3495") into minor units. */
export function parseMoney(input: string, currency: Currency): Money {
  const cleaned = input.replace(/[^\d.-]/g, "");
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === "" || cleaned === "-") {
    throw new TypeError(`Cannot parse money from "${input}"`);
  }
  const digits = minorUnitDigits(currency);
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const paddedFraction = (fraction + "0".repeat(digits)).slice(0, digits);
  const sign = whole.startsWith("-") ? -1 : 1;
  const amount = sign * (Math.abs(Number(whole)) * 10 ** digits + Number(paddedFraction));
  return money(amount, currency);
}
