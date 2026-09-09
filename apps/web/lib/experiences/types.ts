import type { Currency } from "@guideless/types";

/**
 * Bookable experiences from a supplier — the same contract as hotels, on purpose.
 *
 * `search → rates → recheck → book → cancel` is not a coincidence of naming. It is the sequence
 * that makes reselling somebody else's inventory safe: you do not charge for a thing whose price
 * you last saw an hour ago, and you do not confirm what you could not hold. The hotel engine
 * earned that shape the hard way (a LiteAPI probe found 116 of 200 real rates carried more than
 * one cancellation window), and an experience is the same problem with a shorter stay.
 *
 * Two things are deliberately different from the hotel supplier. An experience has *options*
 * rather than rooms — the 10am English tour and the 2pm French one are the same product — and it
 * happens on a date rather than across a range.
 */

export type ExperienceSupplierId = "mock" | "viator";

export interface ExperienceProduct {
  supplierProductId: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  /** The supplier's own vocabulary, unmapped. Turning it into ours is a judgement made at import. */
  supplierCategories: string[];
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  ratingCount: number | null;
  /** Cheapest advertised price, for a staff sanity check. Never shown to a customer. */
  fromAmount: number | null;
  currency: Currency | null;
}

export interface ExperienceOption {
  supplierOptionId: string;
  name: string;
  travelDate: string;
  startTime: string | null;
  currency: Currency;
  /** Integer minor units, what the supplier charges us. */
  netAmount: number;
  totalAmount: number;
  /** Null means the supplier did not say — which is not the same as unlimited. */
  capacity: number | null;
  available: boolean;
  /** A ladder: `[{ daysBefore, refundPercentage }]`, like the hotel cancellation work. */
  cancellationPolicy: Array<{ daysBefore: number; refundPercentage: number }>;
}

export interface ExperienceSearchInput {
  /** Free text, a destination name, or both. Suppliers vary in what they accept. */
  query?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  /** Only products bookable on this date, when the supplier can filter that far. */
  travelDate?: string;
  limit?: number;
}

export interface ExperienceBookingResult {
  supplierBookingId: string;
  reference: string;
  /** What the traveler needs on the day: a voucher, a meeting point, a barcode. */
  voucherUrl: string | null;
  instructions: string | null;
}

export interface ExperienceSupplier {
  readonly id: ExperienceSupplierId;
  search(input: ExperienceSearchInput): Promise<ExperienceProduct[]>;
  /** Bookable options for one product on one date, with what each costs us. */
  getOptions(supplierProductId: string, travelDate: string): Promise<ExperienceOption[]>;
  /**
   * The price right now, for an option somebody is about to be charged for. Null means it is gone.
   * This is the call that stops us selling yesterday's price.
   */
  recheckOption(supplierOptionId: string, travelDate: string): Promise<ExperienceOption | null>;
  book(input: {
    supplierOptionId: string;
    travelDate: string;
    travelers: number;
    leadName: string;
    leadEmail: string;
  }): Promise<ExperienceBookingResult>;
  cancel(supplierBookingId: string): Promise<{ cancelled: boolean; refundAmount: number | null }>;
}

export type ExperienceErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "sold_out"
  | "price_moved"
  | "bad_request";

export class ExperienceError extends Error {
  constructor(
    readonly code: ExperienceErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ExperienceError";
  }
}

export const EXPERIENCE_TIMEOUT_MS = 8000;

export async function withTimeout<T>(p: Promise<T>, ms = EXPERIENCE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ExperienceError("timeout", "The experience supplier timed out")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
