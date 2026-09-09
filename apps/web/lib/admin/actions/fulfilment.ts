"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@guideless/validation";
import { flash, parseForm } from "@/lib/admin/form";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Recording what we actually booked with a supplier after a traveler paid us for it.
 *
 * The traveler has already been charged, so both outcomes here are consequential: recording a
 * reference is what lets them see their ticket, and marking one failed is an admission that we owe
 * them a refund. Neither is a state to arrive at by accident, which is why the database functions
 * demand a reference for one and a reason for the other.
 */

const BACK = "/admin/fulfilment";

const recordSchema = z.object({
  fulfilmentId: uuidSchema,
  reference: z.string().trim().min(1, "The supplier's booking reference is required").max(200),
  supplierBookingId: z.string().trim().max(200).optional(),
  voucherUrl: z.url().max(2000).optional().or(z.literal("")),
  instructions: z.string().trim().max(2000).optional(),
});

const failSchema = z.object({
  fulfilmentId: uuidSchema,
  reason: z.string().trim().min(1, "Say what went wrong — somebody has to refund this").max(500),
});

export async function recordFulfilmentAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(recordSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const data = parsed.data;

  const sb = await createClient();
  const { error } = await sb.rpc("record_fulfilment", {
    p_fulfilment_id: data.fulfilmentId,
    p_reference: data.reference,
    p_supplier_booking_id: data.supplierBookingId || undefined,
    p_voucher_url: data.voucherUrl || undefined,
    p_instructions: data.instructions || undefined,
  });
  if (error) flash(BACK, "error", error.message);

  revalidatePath(BACK);
  flash(BACK, "ok", "Booked. The traveler can now see the reference and the operator's terms.");
}

export async function failFulfilmentAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(failSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  const sb = await createClient();
  const { error } = await sb.rpc("fail_fulfilment", {
    p_fulfilment_id: parsed.data.fulfilmentId,
    p_reason: parsed.data.reason,
  });
  if (error) flash(BACK, "error", error.message);

  revalidatePath(BACK);
  // Deliberately blunt: the money is already ours and it should not stay that way quietly.
  flash(
    BACK,
    "ok",
    "Marked as not bookable. This traveler has paid for something they will not get — refund them from the booking and tell them why.",
  );
}
