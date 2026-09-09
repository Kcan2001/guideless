import "server-only";

import { StubReservationProvider } from "@/lib/reservations/stub";
import type { ReservationProvider } from "@/lib/reservations/types";

export {
  ReservationError,
  type ReservationOutcome,
  type ReservationProvider,
  type ReservationQuote,
} from "@/lib/reservations/types";

let cached: ReservationProvider | null = null;

/**
 * The configured reservation provider. There is exactly one, and `RESERVATION_PROVIDER` only
 * accepts `stub` — the env var exists so that adding Viator in item 7 is a value, not a refactor.
 */
export function getReservationProvider(): ReservationProvider {
  cached ??= new StubReservationProvider();
  return cached;
}

/** Test seam. */
export function setReservationProvider(provider: ReservationProvider | null): void {
  cached = provider;
}
