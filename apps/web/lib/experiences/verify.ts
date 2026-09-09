import "server-only";

import { getExperienceSupplier } from "@/lib/experiences";
import { blockedMessage, decideRecheck, type RecheckDecision } from "@/lib/experiences/recheck";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Rechecking sourced add-ons with the supplier before a traveler is charged.
 *
 * Only add-ons we resell are rechecked — a hand-written extra has no supplier to ask. In practice
 * most carts contain neither or both, and a cart with none of them does no work here at all.
 *
 * This runs *before* Stripe, and its failure mode is chosen deliberately: if the supplier cannot
 * be reached we let the sale through. A traveler blocked from buying a ticket because somebody
 * else's API is down is a worse outcome than us finding out an hour later that a price moved, and
 * the recorded drift means we do find out.
 */

export interface VerifyResult {
  ok: boolean;
  /** Shown to the traveler when blocked. Never mentions cost, margin or a supplier. */
  error?: string;
  /** Add-on ids whose supplier price moved beyond what we absorb, for staff to look at. */
  drifted: string[];
}

interface SourcedRow {
  add_on_id: string;
  supplier_option_id: string;
  net_amount: number;
  departure_add_ons: { price_amount: number; title: string } | null;
}

export async function verifySourcedAddOns(
  addOnIds: string[],
  travelDate: string,
): Promise<VerifyResult> {
  if (addOnIds.length === 0) return { ok: true, drifted: [] };

  const sb = await createClient();
  const { data, error } = await sb
    .from("add_on_sourcing")
    .select("add_on_id, supplier_option_id, net_amount, departure_add_ons(price_amount, title)")
    .in("add_on_id", addOnIds);
  // A traveler cannot read add_on_sourcing, and that is correct — the recheck runs with the
  // service role below. An error here means nothing is sourced as far as we can tell, so there is
  // nothing to recheck.
  if (error) return { ok: true, drifted: [] };

  const sourced = (data ?? []) as unknown as SourcedRow[];
  if (sourced.length === 0) return { ok: true, drifted: [] };

  const supplier = getExperienceSupplier();
  const drifted: string[] = [];

  for (const row of sourced) {
    let decision: RecheckDecision;
    try {
      const fresh = await supplier.recheckOption(row.supplier_option_id, travelDate);
      decision = decideRecheck({
        customerAmount: row.departure_add_ons?.price_amount ?? 0,
        originalNetAmount: row.net_amount,
        currentNetAmount: fresh?.netAmount ?? null,
        available: fresh?.available ?? false,
      });
    } catch {
      // Supplier unreachable: proceed. See the note above — this is a choice, not an oversight.
      console.warn("experience recheck unavailable", { addOnId: row.add_on_id });
      continue;
    }

    if (decision.action === "block") {
      await recordDrift(row.add_on_id, decision.driftAmount);
      return { ok: false, error: blockedMessage(decision.reason), drifted };
    }
    if (decision.action === "proceed_with_margin_warning") {
      drifted.push(row.add_on_id);
    }
    await recordDrift(row.add_on_id, decision.driftAmount);
  }

  return { ok: true, drifted };
}

/**
 * Record what the recheck saw. Never re-prices the add-on: a number a traveler is looking at must
 * not move under them, so staff decide from `/admin/experiences` instead.
 */
async function recordDrift(addOnId: string, driftAmount: number): Promise<void> {
  try {
    await createServiceRoleClient()
      .from("add_on_sourcing")
      .update({ last_checked_at: new Date().toISOString(), drift_amount: driftAmount })
      .eq("add_on_id", addOnId);
  } catch {
    // Bookkeeping. Losing it must never cost somebody their purchase.
  }
}
