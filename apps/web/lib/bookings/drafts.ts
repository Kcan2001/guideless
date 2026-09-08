"use server";

import type { Json } from "@guideless/types";
import { builderDraftSchema } from "@guideless/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Saved Trip Builder configurations (`builder_drafts`, migration 043: one row per user and
 * departure, owner-only RLS). Signed-in travelers resume on any device; anonymous visitors keep
 * the sessionStorage copy the client already maintains. Money is never stored here — only
 * choices; the quote is recomputed from them.
 */

const MAX_BYTES = 32 * 1024;

export interface SavedBuilderDraft {
  draft: Record<string, unknown>;
  /** Index into the derived step list (the step key also travels inside `draft.step`). */
  stepIndex: number;
  updatedAt: string;
}

export interface SaveDraftResult {
  ok: boolean;
  /** Anonymous visitor: nothing saved server-side, the client keeps sessionStorage. */
  unavailable?: boolean;
}

export async function saveBuilderDraft(input: {
  departureId: string;
  draft: unknown;
  stepIndex: number;
}): Promise<SaveDraftResult> {
  const parsed = builderDraftSchema.safeParse({
    departureId: input.departureId,
    step: Math.max(0, Math.min(7, Math.round(input.stepIndex))),
    draft: input.draft,
  });
  if (!parsed.success) return { ok: false };
  if (JSON.stringify(parsed.data.draft).length > MAX_BYTES) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, unavailable: true };

  const { error } = await supabase.from("builder_drafts").upsert(
    {
      user_id: user.id,
      departure_id: parsed.data.departureId,
      draft: parsed.data.draft as Json,
      step: parsed.data.step,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,departure_id" },
  );
  if (error) {
    console.error("saveBuilderDraft failed", { code: error.code, message: error.message });
    return { ok: false };
  }
  return { ok: true };
}

export async function loadBuilderDraft(departureId: string): Promise<SavedBuilderDraft | null> {
  const id = builderDraftSchema.shape.departureId.safeParse(departureId);
  if (!id.success) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("builder_drafts")
    .select("draft, step, updated_at")
    .eq("user_id", user.id)
    .eq("departure_id", id.data)
    .maybeSingle();
  if (error) {
    console.error("loadBuilderDraft failed", { code: error.code, message: error.message });
    return null;
  }
  if (!data || !data.draft || typeof data.draft !== "object" || Array.isArray(data.draft)) {
    return null;
  }
  return {
    draft: data.draft as Record<string, unknown>,
    stepIndex: data.step,
    updatedAt: data.updated_at,
  };
}

/** Called from the confirmation page: a booked configuration must not resurface as a draft. */
export async function clearBuilderDraft(departureId: string): Promise<void> {
  const id = builderDraftSchema.shape.departureId.safeParse(departureId);
  if (!id.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("builder_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("departure_id", id.data);
  if (error)
    console.error("clearBuilderDraft failed", { code: error.code, message: error.message });
}
