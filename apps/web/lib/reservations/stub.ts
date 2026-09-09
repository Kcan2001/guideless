import { formatDate } from "@guideless/utils";
import type { ReservationRequestInput } from "@guideless/validation";
import {
  ReservationError,
  type ReservationOutcome,
  type ReservationProvider,
  type ReservationQuote,
} from "@/lib/reservations/types";

/**
 * The only reservation provider that exists today.
 *
 * It books nothing. It holds a request for fifteen minutes and then hands the traveler a message
 * they can send themselves — which is exactly what "the assistant may make free reservations" can
 * honestly mean while we have no supplier to make them with.
 *
 * It is a full implementation of the contract rather than a `throw new Error("not implemented")`,
 * because the point is to prove the contract works end to end: the hold expires, confirming an
 * expired hold fails, cancelling an unknown reference is not a crash. When item 7 brings a real
 * provider, those behaviours are already exercised by tests written against this.
 */

interface Hold {
  request: ReservationRequestInput;
  expiresAt: number;
}

const HOLD_MS = 15 * 60 * 1000;

export class StubReservationProvider implements ReservationProvider {
  readonly id = "stub" as const;
  private readonly holds = new Map<string, Hold>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  quote(request: ReservationRequestInput): Promise<ReservationQuote | null> {
    const holdRef = `stub:${request.placeRef}:${request.date}:${request.time}`;
    this.holds.set(holdRef, { request, expiresAt: this.now() + HOLD_MS });
    return Promise.resolve({
      holdRef,
      // Zero, always. A provider that returns anything else is not allowed near the assistant.
      price: 0,
      currency: "EUR",
      expiresAt: new Date(this.now() + HOLD_MS).toISOString(),
      terms: "Guideless does not hold this table. The request below is yours to send.",
    });
  }

  confirm(holdRef: string, request: ReservationRequestInput): Promise<ReservationOutcome> {
    const hold = this.holds.get(holdRef);
    if (!hold) {
      return Promise.reject(new ReservationError("unknown_hold", "That hold is not one of ours"));
    }
    if (hold.expiresAt <= this.now()) {
      this.holds.delete(holdRef);
      return Promise.reject(new ReservationError("expired", "That hold has expired — ask again"));
    }
    this.holds.delete(holdRef);
    return Promise.resolve({
      status: "draft",
      message: draftMessage(request),
      contact: {},
    });
  }

  cancel(reference: string): Promise<{ cancelled: boolean; reason?: string }> {
    // Nothing was ever booked, so nothing can fail to cancel — but say so rather than claim
    // success, because a traveler reading "cancelled" should be able to trust the word.
    this.holds.delete(reference);
    return Promise.resolve({
      cancelled: false,
      reason: "Nothing was booked through us, so there is nothing for us to cancel.",
    });
  }
}

/** What the traveler sends. Written to be pasted into an email or read down a phone. */
export function draftMessage(request: ReservationRequestInput): string {
  const when = `${formatDate(request.date)} at ${request.time}`;
  const people = request.partySize === 1 ? "one person" : `${request.partySize} people`;
  const extra = request.notes ? `\n\n${request.notes}` : "";
  return `Hello ${request.placeName},\n\nCould we book a table for ${people} on ${when}?${extra}\n\nThank you.`;
}
