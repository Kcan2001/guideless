"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Friend / group codes (plan v2 §20, migration 042). A traveler shares a code like
 * KYLE-MONACO-27; friends who enter it in the builder land on the same departure and in the same
 * group while keeping their own booking and their own money. `create_group_code` is owner-only
 * and idempotent.
 */
export interface GroupCodeInfo {
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns null when the caller is not signed in or does not own the booking. */
export async function ensureGroupCode(bookingId: string): Promise<GroupCodeInfo | null> {
  if (!UUID_RE.test(bookingId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("create_group_code", { p_booking_id: bookingId });
  if (error) {
    console.error("create_group_code failed", { code: error.code, message: error.message });
    return null;
  }
  if (!data?.code) return null;
  return {
    code: data.code,
    uses: data.uses,
    maxUses: data.max_uses,
    expiresAt: data.expires_at,
  };
}
