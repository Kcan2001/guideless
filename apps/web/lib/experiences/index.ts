import "server-only";

import { getServerEnv } from "@/lib/env";
import { MockExperienceSupplier } from "@/lib/experiences/mock";
import type { ExperienceSupplier } from "@/lib/experiences/types";

export {
  ExperienceError,
  EXPERIENCE_TIMEOUT_MS,
  type ExperienceOption,
  type ExperienceProduct,
  type ExperienceSupplier,
} from "@/lib/experiences/types";

let cached: ExperienceSupplier | null = null;
let warned = false;

/**
 * The configured experience supplier.
 *
 * There is currently one implementation, and that is a deliberate state rather than an unfinished
 * one. `EXPERIENCE_SUPPLIER=viator` is accepted by the schema so the wiring is real, but selecting
 * it falls back to the mock with a warning, because no Viator adapter exists yet and shipping one
 * written from documentation is the specific mistake this codebase already made once with Duffel
 * and wrote a probe script to avoid repeating.
 *
 * The sequence that worked for LiteAPI: get a sandbox key, run `scripts/viator-probe.mjs`, read
 * what actually comes back, then write the adapter against the fixtures it captures.
 */
export function getExperienceSupplier(): ExperienceSupplier {
  if (cached) return cached;
  const wanted = getServerEnv().EXPERIENCE_SUPPLIER;
  if (wanted === "viator" && !warned) {
    warned = true;
    console.warn(
      "EXPERIENCE_SUPPLIER=viator but no Viator adapter exists yet; using the mock supplier. " +
        "Probe a sandbox key with scripts/viator-probe.mjs and write the adapter from real responses.",
    );
  }
  cached = new MockExperienceSupplier();
  return cached;
}

export function getExperienceSupplierId(): ExperienceSupplier["id"] {
  return getExperienceSupplier().id;
}

/** Test seam, mirroring lib/hotels/suppliers. */
export function setExperienceSupplier(supplier: ExperienceSupplier | null): void {
  cached = supplier;
  warned = false;
}
