import "server-only";

import { getServerEnv } from "@/lib/env";
import { GooglePlacesProvider } from "@/lib/places/google";
import { MockPlacesProvider } from "@/lib/places/mock";
import type { PlacesProvider } from "@/lib/places/types";

export {
  PlacesError,
  PLACES_TIMEOUT_MS,
  type Place,
  type PlacesProvider,
} from "@/lib/places/types";

let cached: PlacesProvider | null = null;
let warned = false;

/**
 * The configured places provider. `google` needs `GOOGLE_PLACES_KEY` (and a billing account on the
 * Cloud project); anything else, or a missing key, uses the deterministic mock.
 *
 * The fallback is loud in the log and honest on screen — every result carries its `source`, so a
 * mock answer is labelled as one rather than passed off as a live lookup. Silently degrading to
 * fixtures would be the worst of the options: it looks like coverage and is not.
 */
export function getPlacesProvider(): PlacesProvider {
  if (cached) return cached;
  const env = getServerEnv();
  const wanted = env.PLACES_PROVIDER;
  if (wanted === "google" && env.GOOGLE_PLACES_KEY) {
    cached = new GooglePlacesProvider({ apiKey: env.GOOGLE_PLACES_KEY });
  } else {
    if (wanted === "google" && !warned) {
      warned = true;
      console.warn(
        "PLACES_PROVIDER=google but GOOGLE_PLACES_KEY is missing; using the mock provider",
      );
    }
    cached = new MockPlacesProvider();
  }
  return cached;
}

/** Test seam, mirroring lib/hotels/suppliers. */
export function setPlacesProvider(provider: PlacesProvider | null): void {
  cached = provider;
  warned = false;
}
