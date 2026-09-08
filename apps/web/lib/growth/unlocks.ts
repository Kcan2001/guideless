import "server-only";

import type { DepartureUnlock } from "@/components/growth/unlock-progress";
import { createPublicClient } from "@/lib/supabase/public";

export interface UnlockProgressResult {
  confirmed: number;
  unlocks: DepartureUnlock[];
}

const EMPTY: UnlockProgressResult = { confirmed: 0, unlocks: [] };

/**
 * "6 of 8 — at 8 everyone gets the boat." Confirmed traveler counts and the active promises for
 * one departure. Public data: the RPC exposes counts, never who booked.
 */
export async function getUnlockProgress(departureId: string): Promise<UnlockProgressResult> {
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("departure_unlock_progress", {
    p_departure_id: departureId,
  });
  if (error || !data) return EMPTY;
  const parsed = data as { confirmed?: number; unlocks?: DepartureUnlock[] };
  return {
    confirmed: typeof parsed.confirmed === "number" ? parsed.confirmed : 0,
    unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks : [],
  };
}
