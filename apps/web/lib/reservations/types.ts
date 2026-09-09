import type { ReservationRequestInput } from "@guideless/validation";

/**
 * Booking a table, a tour, a time slot — the contract, written before there is a provider.
 *
 * The decision was that the assistant may make *free* reservations and may never spend money. We
 * have no reservation supplier until item 7 (Viator or similar), so today the only implementation
 * is a stub that produces a request the traveler sends themselves. Defining the contract now costs
 * an afternoon and means item 7 plugs in rather than rewrites.
 *
 * The shape is copied from the hotel supplier on purpose — search, hold, confirm, cancel — because
 * that sequence is what makes a booking safe: nothing is confirmed that was not first held at a
 * known price, and a hold that cannot be confirmed is released rather than charged.
 *
 * The one rule no implementation may break: `quote.price` must be zero. A provider that wants
 * money belongs behind the same recheck-before-charge discipline as the hotel engine, and behind a
 * decision that has not been taken.
 */

export type ReservationProviderId = "stub" | "viator";

export interface ReservationQuote {
  /** Provider-scoped id for the held slot. Opaque to us. */
  holdRef: string;
  /** Integer minor units. Must be 0 — see the note above. */
  price: number;
  currency: string;
  /** After this, the hold is gone and confirming must fail rather than re-price. */
  expiresAt: string;
  /** What the traveler is agreeing to, in their own language where the provider gives it. */
  terms: string | null;
}

export type ReservationOutcome =
  | { status: "confirmed"; reference: string; instructions: string | null }
  /**
   * The honest answer while no provider exists: here is the request, you send it. A `draft` is not
   * a failure and must not be rendered as one.
   */
  | { status: "draft"; message: string; contact: { phone?: string; email?: string; url?: string } }
  | { status: "unavailable"; reason: string };

export interface ReservationProvider {
  readonly id: ReservationProviderId;
  /** Can this place be booked through us at all, and on what terms? */
  quote(request: ReservationRequestInput): Promise<ReservationQuote | null>;
  /** Turn a quote into a booking. Must refuse an expired or unknown hold. */
  confirm(holdRef: string, request: ReservationRequestInput): Promise<ReservationOutcome>;
  cancel(reference: string): Promise<{ cancelled: boolean; reason?: string }>;
}

export class ReservationError extends Error {
  constructor(
    readonly code: "expired" | "unknown_hold" | "unavailable" | "would_charge",
    message: string,
  ) {
    super(message);
    this.name = "ReservationError";
  }
}
