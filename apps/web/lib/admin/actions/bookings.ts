"use server";

import { revalidatePath } from "next/cache";
import { cancelBookingSchema, noteSchema, uuidSchema } from "@guideless/validation";
import { daysBetween } from "@guideless/utils";
import { FINANCE_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

export async function addBookingNoteAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff();
  const bookingId = id(fd, "bookingId");
  const back = `/admin/bookings/${bookingId}#notes`;
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("booking_notes")
    .insert({ booking_id: bookingId, body: parsed.data.body, created_by: ctx.user.id });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidatePath(`/admin/bookings/${bookingId}`);
  flash(back, "ok", "Note added.");
}

/**
 * Cancel a booking. The refund percentage comes from the departure's data-driven policy
 * (refund_percentage_for), optionally overridden by finance/admin. If Stripe is configured and
 * money was collected, a refund is requested; the charge.refunded webhook then updates the
 * booking's payment state. Otherwise the booking is cancelled and the refund is noted for
 * manual processing.
 */
export async function cancelBookingAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(OPS_ROLES);
  const bookingId = id(fd, "bookingId");
  const back = `/admin/bookings/${bookingId}`;
  const parsed = parseForm(cancelBookingSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const { reason, refundPercentageOverride } = parsed.data;
  if (refundPercentageOverride !== undefined && !ctx.can(FINANCE_ROLES)) {
    flash(back, "error", "Only finance or admin can override the refund percentage.");
  }

  const sb = await createClient();
  const { data: booking } = await sb.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) flash(back, "error", "Booking not found.");
  if (["cancelled", "refunded"].includes(booking.status))
    flash(back, "error", "This booking is already cancelled.");
  const { data: departure } = await sb
    .from("departures")
    .select("start_date, cancellation_policy")
    .eq("id", booking.departure_id)
    .maybeSingle();
  if (!departure) flash(back, "error", "Departure not found.");

  const daysBefore = daysBetween(new Date().toISOString().slice(0, 10), departure.start_date);
  let pct = refundPercentageOverride;
  if (pct === undefined) {
    const { data } = await sb.rpc("refund_percentage_for", {
      policy: departure.cancellation_policy,
      days_before: daysBefore,
    });
    pct = data ?? 0;
  }
  const refundable = booking.amount_paid - booking.amount_refunded;
  const refundAmount = Math.round((refundable * pct) / 100);

  let stripeNote = "";
  if (refundAmount > 0 && isStripeConfigured()) {
    const { data: payments } = await sb
      .from("payments")
      .select("stripe_payment_intent_id, amount")
      .eq("booking_id", bookingId)
      .eq("stripe_status", "succeeded")
      .order("created_at", { ascending: false });
    let remaining = refundAmount;
    try {
      const stripe = getStripe();
      for (const p of payments ?? []) {
        if (remaining <= 0 || !p.stripe_payment_intent_id) continue;
        const amount = Math.min(remaining, p.amount);
        await stripe.refunds.create({
          payment_intent: p.stripe_payment_intent_id,
          amount,
          reason: "requested_by_customer",
          metadata: { booking_id: bookingId, cancelled_by: ctx.user.id },
        });
        remaining -= amount;
      }
      stripeNote = ` Stripe refund requested for ${(refundAmount / 100).toFixed(2)} ${booking.currency}.`;
    } catch (err) {
      console.error("stripe refund failed", { bookingId, err });
      stripeNote = " Stripe refund FAILED — process manually.";
    }
  } else if (refundAmount > 0) {
    stripeNote = ` Refund of ${(refundAmount / 100).toFixed(2)} ${booking.currency} must be processed manually (Stripe not configured).`;
  }

  const { error } = await sb
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      refund_percentage: pct,
      hold_expires_at: null,
    })
    .eq("id", bookingId);
  if (error) flash(back, "error", dbErrorMessage(error));

  await sb.from("booking_notes").insert({
    booking_id: bookingId,
    created_by: ctx.user.id,
    body: `Cancelled ${daysBefore} days before departure. Refund ${pct}% (${(refundAmount / 100).toFixed(2)} ${booking.currency}). Reason: ${reason}.${stripeNote}`,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/departures/${booking.departure_id}`);
  revalidatePath("/admin");
  flash(back, "ok", `Booking cancelled with a ${pct}% refund.${stripeNote}`);
}

/** Record an off-platform payment (bank transfer, cheque). Finance/admin only. */
export async function recordManualPaymentAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(FINANCE_ROLES);
  const bookingId = id(fd, "bookingId");
  const back = `/admin/bookings/${bookingId}#payments`;
  const raw = fd.get("amount");
  const amount = Math.round(Number(String(raw ?? "").replace(/[^\d.]/g, "")) * 100);
  if (!Number.isInteger(amount) || amount <= 0) flash(back, "error", "Enter a positive amount.");
  const sb = await createClient();
  const { data: booking } = await sb.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) flash(back, "error", "Booking not found.");
  const kind =
    booking.amount_paid === 0 ? (amount >= booking.total_amount ? "full" : "deposit") : "balance";
  const { error: pErr } = await sb.from("payments").insert({
    booking_id: bookingId,
    kind,
    amount,
    currency: booking.currency,
    stripe_status: "manual",
    paid_at: new Date().toISOString(),
  });
  if (pErr) flash(back, "error", dbErrorMessage(pErr));
  const amountPaid = booking.amount_paid + amount;
  const paymentStatus =
    amountPaid >= booking.total_amount
      ? "paid"
      : booking.deposit_amount > 0 && amountPaid >= booking.deposit_amount
        ? amountPaid > booking.deposit_amount
          ? "partially_paid"
          : "deposit_paid"
        : "partially_paid";
  const { error } = await sb
    .from("bookings")
    .update({
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      status:
        booking.status === "draft" || booking.status === "pending_payment"
          ? "confirmed"
          : booking.status,
      hold_expires_at: null,
    })
    .eq("id", bookingId);
  if (error) flash(back, "error", dbErrorMessage(error));
  await sb.from("booking_notes").insert({
    booking_id: bookingId,
    created_by: ctx.user.id,
    body: `Manual payment recorded: ${(amount / 100).toFixed(2)} ${booking.currency}.`,
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  flash(back, "ok", "Payment recorded.");
}
