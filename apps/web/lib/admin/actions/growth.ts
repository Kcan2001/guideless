"use server";

import { revalidatePath } from "next/cache";
import { departureDropSchema, departureUnlockFormSchema, uuidSchema } from "@guideless/validation";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/** Growth levers staff control: who gets told, when a departure drops, what the group unlocks. */

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

/**
 * Mark a departure's waitlist as told. Writes an in-app notification for anyone with an account;
 * email is not wired yet, so this records that they were notified, it does not send.
 */
export async function notifyWaitlistAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const to = "/admin/waitlists";
  const sb = await createClient();
  const { data, error } = await sb.rpc("notify_waitlist", { p_departure_id: departureId });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  const n = typeof data === "number" ? data : 0;
  flash(
    to,
    "ok",
    n === 0
      ? "Nobody new to notify on that departure."
      : `Marked ${n} ${n === 1 ? "person" : "people"} notified. Email is not sent automatically yet.`,
  );
}

/** Set or clear a trip drop. Clearing opens the departure immediately. */
export async function setDepartureDropAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(departureDropSchema, fd);
  const to = "/admin/waitlists";
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("departures")
    .update({ opens_at: parsed.data.opensAt ?? null })
    .eq("id", parsed.data.departureId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  revalidatePath(`/admin/departures/${parsed.data.departureId}`);
  flash(to, "ok", parsed.data.opensAt ? "Drop scheduled." : "Drop cleared — bookable now.");
}

/** Promise the group something once N of them have booked. */
export async function saveDepartureUnlockAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(departureUnlockFormSchema, fd);
  const to = "/admin/waitlists";
  if (!parsed.ok) flash(to, "error", parsed.error);
  const { departureId, threshold, reward, isActive } = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("departure_unlocks").upsert(
    {
      departure_id: departureId,
      threshold,
      reward,
      is_active: isActive,
    },
    { onConflict: "departure_id,threshold" },
  );
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", `Unlock at ${threshold} travelers saved.`);
}

/** Record that a reached unlock has actually been given to the group. */
export async function grantDepartureUnlockAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const unlockId = id(fd, "unlockId");
  const to = "/admin/waitlists";
  const sb = await createClient();
  const { error } = await sb
    .from("departure_unlocks")
    .update({ granted_at: new Date().toISOString() })
    .eq("id", unlockId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Marked as granted.");
}
