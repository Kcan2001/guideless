import "server-only";

import type { HotelSupplierId } from "@guideless/types";
import type { HotelSupplier } from "@/lib/hotels/types";
import { getServerEnv } from "@/lib/env";
import { DuffelSupplier } from "./duffel";
import { LiteApiSupplier } from "./liteapi";
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
 * The configured supplier. `liteapi` needs `LITEAPI_KEY`, `duffel` needs `DUFFEL_ACCESS_TOKEN`;
 * anything else, or a missing key, uses the deterministic mock (supplier id `manual`) so admin
 * screens and tests work without an account.
 */
export function getHotelSupplier(): HotelSupplier {
  if (cached) return cached;
  const env = getServerEnv();
  const wanted = env.HOTEL_SUPPLIER ?? "mock";
  if (wanted === "liteapi" && env.LITEAPI_KEY) {
    cached = new LiteApiSupplier({ apiKey: env.LITEAPI_KEY });
  } else if (wanted === "duffel" && env.DUFFEL_ACCESS_TOKEN) {
    cached = new DuffelSupplier({ token: env.DUFFEL_ACCESS_TOKEN });
  } else {
    // Falling back silently would be worse than the mock itself: a missing key would look like
    // working inventory that happens to be wrong.
    if (wanted !== "mock" && !warned) {
      warned = true;
      const missing = wanted === "liteapi" ? "LITEAPI_KEY" : "DUFFEL_ACCESS_TOKEN";
      console.warn(`HOTEL_SUPPLIER=${wanted} but ${missing} is missing; using the mock supplier`);
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
