import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import type { Tables } from "@guideless/types";
import { sendBookingConfirmedEmail } from "@/lib/email/send";
import { requireServerEnv } from "@/lib/env";
import {
  applyAbandonedCheckout,
  applyRefund,
  applySuccessfulPayment,
  paymentKind,
} from "@/lib/bookings/payments";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createServiceRoleClient>;
type Booking = Tables<"bookings">;

/**
 * Stripe webhook — the single authoritative source of payment state (ADR-004).
 *
 *  1. Verify the signature.
 *  2. Insert into webhook_events; if (provider, event_id) already exists → 200 and stop (idempotent).
 *  3. Apply the event inside a service-role session; mark processed / failed.
 *
 * Returning non-2xx makes Stripe retry, so only genuine processing failures return 500.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireServerEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (err) {
    console.warn("stripe webhook signature rejected", { message: (err as Error).message });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  const { data: inserted, error: insErr } = await admin
    .from("webhook_events")
    .upsert(
      {
        provider: "stripe",
        event_id: event.id,
        event_type: event.type,
        status: "received",
        payload_hash: payloadHash,
        payload: event as unknown as Tables<"webhook_events">["payload"],
      },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insErr) {
    console.error("webhook_events insert failed", { eventId: event.id, insErr });
    return NextResponse.json({ error: "ledger unavailable" }, { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  const ledgerId = inserted[0]!.id;

  try {
    const outcome = await handle(admin, event);
    await admin
      .from("webhook_events")
      .update({ status: outcome, processed_at: new Date().toISOString() })
      .eq("id", ledgerId);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error("stripe webhook processing failed", { eventId: event.id, type: event.type, err });
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        error: (err as Error).message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ledgerId);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

async function handle(admin: Admin, event: Stripe.Event): Promise<"processed" | "skipped"> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutPaid(admin, event.data.object);
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      return handleCheckoutAbandoned(admin, event.data.object);
    case "payment_intent.payment_failed":
      return handlePaymentFailed(admin, event.data.object);
    case "charge.refunded":
      return handleChargeRefunded(admin, event.data.object);
    default:
      return "skipped";
  }
}

async function loadBooking(
  admin: Admin,
  bookingId: string | null | undefined,
): Promise<Booking | null> {
  if (!bookingId) return null;
  const { data, error } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleCheckoutPaid(admin: Admin, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return "skipped";
  if (session.metadata?.add_on_purchase_id) return handleAddOnPurchasePaid(admin, session);
  const booking = await loadBooking(
    admin,
    session.metadata?.booking_id ?? session.client_reference_id,
  );
  if (!booking) throw new Error(`booking not found for session ${session.id}`);

  const amount = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (amount <= 0 || !paymentIntentId) throw new Error(`session ${session.id} has no charge`);

  // Dedupe on the payment intent: a replayed/duplicate event must not double-count.
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (existing) return "skipped";

  const kind = paymentKind(booking, amount);
  const { error: payErr } = await admin.from("payments").insert({
    booking_id: booking.id,
    kind,
    amount,
    currency: booking.currency,
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: session.id,
    stripe_status: "succeeded",
    paid_at: new Date().toISOString(),
  });
  if (payErr) throw payErr;

  const patch = applySuccessfulPayment(booking, amount);
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      ...patch,
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : booking.stripe_customer_id,
    })
    .eq("id", booking.id);
  if (updErr) throw updErr;

  // In-app / push notification for the owner; idempotent per payment intent (dedupe_key).
  const { error: notifyErr } = await admin.rpc("notify_booking_paid", {
    p_booking_id: booking.id,
    p_payment_intent_id: paymentIntentId,
    p_kind: kind,
  });
  if (notifyErr) throw notifyErr;

  const email = session.customer_details?.email ?? session.customer_email;
  if (email) {
    await sendBookingConfirmedEmail(admin, {
      to: email,
      userId: booking.customer_id,
      bookingId: booking.id,
      confirmationNumber: booking.confirmation_number,
      departureId: booking.departure_id,
      amountPaid: amount,
      totalAmount: booking.total_amount,
      amountPaidToDate: patch.amount_paid,
      currency: booking.currency,
    });
  }
  return "processed";
}

/**
 * Add-ons bought after the booking (account page or app). `confirm_add_on_purchase` is atomic and
 * idempotent on the payment intent: it records the payment, confirms the rows, writes line items
 * and raises the booking totals in one transaction.
 */
async function handleAddOnPurchasePaid(admin: Admin, session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.add_on_purchase_id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const amount = session.amount_total ?? 0;
  if (!purchaseId || !paymentIntentId || amount <= 0)
    throw new Error(`add-on session ${session.id} is missing purchase, intent or amount`);
  const { data, error } = await admin.rpc("confirm_add_on_purchase", {
    p_purchase_id: purchaseId,
    p_amount: amount,
    p_payment_intent_id: paymentIntentId,
    p_session_id: session.id,
  });
  if (error) throw error;
  return data ? "processed" : "skipped";
}

async function handleCheckoutAbandoned(admin: Admin, session: Stripe.Checkout.Session) {
  if (session.metadata?.add_on_purchase_id) {
    // Release the add-on hold now instead of waiting for the 5-minute cron.
    const { error } = await admin
      .from("booking_add_ons")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("purchase_id", session.metadata.add_on_purchase_id)
      .eq("status", "pending");
    if (error) throw error;
    return "processed";
  }
  const booking = await loadBooking(
    admin,
    session.metadata?.booking_id ?? session.client_reference_id,
  );
  if (!booking) return "skipped";
  if (booking.stripe_checkout_session_id && booking.stripe_checkout_session_id !== session.id)
    return "skipped";
  const patch = applyAbandonedCheckout(booking);
  if (!patch) return "skipped";
  const { error } = await admin
    .from("bookings")
    .update(patch)
    .eq("id", booking.id)
    .eq("status", "pending_payment");
  if (error) throw error;
  return "processed";
}

async function handlePaymentFailed(admin: Admin, intent: Stripe.PaymentIntent) {
  const bookingId = intent.metadata?.booking_id;
  const booking = await loadBooking(admin, bookingId);
  if (!booking) return "skipped";
  const failure = intent.last_payment_error;
  await admin.from("payments").upsert(
    {
      booking_id: booking.id,
      kind: paymentKind(booking, intent.amount),
      amount: intent.amount,
      currency: booking.currency,
      stripe_payment_intent_id: intent.id,
      stripe_status: intent.status,
      failure_code: failure?.code ?? failure?.decline_code ?? null,
      failure_message: failure?.message ?? null,
    },
    { onConflict: "stripe_payment_intent_id" },
  );
  if (booking.amount_paid === 0 && booking.payment_status !== "failed") {
    await admin.from("bookings").update({ payment_status: "failed" }).eq("id", booking.id);
  }
  return "processed";
}

async function handleChargeRefunded(admin: Admin, charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return "skipped";
  const { data: payment } = await admin
    .from("payments")
    .select("id, booking_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  const booking = await loadBooking(admin, payment?.booking_id ?? charge.metadata?.booking_id);
  if (!booking) return "skipped";

  // charge.refunds may be omitted from the event payload; fetch the authoritative list.
  const refunds = await getStripe().refunds.list({ charge: charge.id, limit: 100 });
  for (const r of refunds.data) {
    const { error } = await admin.from("refunds").upsert(
      {
        booking_id: booking.id,
        payment_id: payment?.id ?? null,
        amount: r.amount,
        currency: booking.currency,
        reason: r.reason ?? null,
        stripe_refund_id: r.id,
        stripe_status: r.status ?? "succeeded",
      },
      { onConflict: "stripe_refund_id" },
    );
    if (error) throw error;
  }

  const { data: allRefunds, error: sumErr } = await admin
    .from("refunds")
    .select("amount, stripe_status")
    .eq("booking_id", booking.id);
  if (sumErr) throw sumErr;
  const totalRefunded = allRefunds
    .filter((r) => r.stripe_status === "succeeded")
    .reduce((sum, r) => sum + r.amount, 0);

  const patch = applyRefund(booking, totalRefunded, new Date());
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      status: patch.status,
      payment_status: patch.payment_status,
      amount_refunded: patch.amount_refunded,
      ...(patch.cancelled_at ? { cancelled_at: patch.cancelled_at } : {}),
    })
    .eq("id", booking.id);
  if (updErr) throw updErr;
  return "processed";
}
