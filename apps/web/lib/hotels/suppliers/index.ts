import "server-only";

import type { HotelSupplierId } from "@guideless/types";
import type { HotelSupplier } from "@/lib/hotels/types";
import { getServerEnv } from "@/lib/env";
import { DuffelSupplier } from "./duffel";
import { MockSupplier } from "./mock";

export {
  HotelSupplierError,
  SUPPLIER_TIMEOUTS,
  withTimeout,
  type SupplierErrorCode,
} from "./shared";

let cached: HotelSupplier | null = null;
let warned = false;

/**
 * The configured supplier. `HOTEL_SUPPLIER=duffel` needs `DUFFEL_ACCESS_TOKEN`; anything else, or a
 * missing token, uses the deterministic mock (supplier id `manual`) so admin screens and tests work
 * without an account.
 */
export function getHotelSupplier(): HotelSupplier {
  if (cached) return cached;
  const env = getServerEnv();
  const wanted = env.HOTEL_SUPPLIER ?? "mock";
  if (wanted === "duffel" && env.DUFFEL_ACCESS_TOKEN) {
    cached = new DuffelSupplier({ token: env.DUFFEL_ACCESS_TOKEN });
  } else {
    if (wanted === "duffel" && !warned) {
      warned = true;
      console.warn(
        "HOTEL_SUPPLIER=duffel but DUFFEL_ACCESS_TOKEN is missing; using the mock supplier",
      );
    }
    cached = new MockSupplier();
  }
  return cached;
}

export function getHotelSupplierId(): HotelSupplierId {
  return getHotelSupplier().id;
}

/** Test seam. */
export function resetHotelSupplierCache(): void {
  cached = null;
}
