"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { brand } from "@guideless/config";
import { createBookingSchema, type CreateBookingInput } from "@guideless/validation";
import { formatDateRange } from "@guideless/utils";
import { publicEnv } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export interface CheckoutActionResult {
  error?: string;
  code?: "auth_required" | "sold_out" | "closed" | "invalid" | "payments_unavailable" | "unknown";
}

const HINT_MESSAGES: Record<string, { code: CheckoutActionResult["code"]; error: string }> = {
  departure_sold_out: {
    code: "sold_out",
    error: "This departure just sold out. Nothing was charged.",
  },
  departure_closed: {
    code: "closed",
    error: "This departure is no longer open for booking. Nothing was charged.",
  },
  deadline_passed: {
    code: "closed",
    error: "The booking deadline for this departure has passed. Nothing was charged.",
  },
  auth_required: { code: "auth_required", error: "Please sign in to continue." },
  traveler_count: { code: "invalid", error: "A booking can include 1 to 8 travelers." },
};

/**
 * Step 6: create the booking (atomically, with a seat hold) and send the customer to Stripe Checkout.
 *
 * Order matters: we refuse early if payments are not configured so we never leave a hold behind.
 * Payment state is NOT touched here — the Stripe webhook is authoritative (ADR-004).
 */
export async function startCheckout(input: CreateBookingInput): Promise<CheckoutActionResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { code: "invalid", error: "Some details need another look. Nothing was charged." };
  }
  const data = parsed.data;

  if (!isStripeConfigured()) {
    return {
      code: "payments_unavailable",
      error: `Online payment isn't switched on yet. Email ${brand.supportEmail} and we'll hold your place.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return HINT_MESSAGES.auth_required!;

  // 1. Atomic booking + hold, as the signed-in user (security definer RPC).
  const { data: rows, error: rpcError } = await supabase.rpc("create_booking", {
    p_departure_id: data.departureId,
    p_travelers: data.travelers,
    p_emergency_contact: data.emergencyContact,
    p_preferences: data.preferences,
    p_payment_option: data.paymentOption,
    p_terms_version: brand.termsVersion,
  });
  if (rpcError) {
    const hint = (rpcError as { hint?: string }).hint ?? "";
    const known = HINT_MESSAGES[hint];
    if (known) return known;
    console.error("create_booking failed", { code: rpcError.code, message: rpcError.message });
    return {
      code: "unknown",
      error: "We couldn't start your booking. Nothing was charged. Please try again.",
    };
  }
  const booking = rows?.[0];
  if (!booking)
    return { code: "unknown", error: "We couldn't start your booking. Nothing was charged." };

  // 2. Stripe Checkout session for the amount due now.
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const { data: departure } = await supabase
    .from("departures_public")
    .select("start_date, end_date, tour_id")
    .eq("id", data.departureId)
    .maybeSingle();
  const { data: tour } = departure?.tour_id
    ? await supabase.from("tours").select("name").eq("id", departure.tour_id).maybeSingle()
    : { data: null };
  const dates =
    departure?.start_date && departure.end_date
      ? formatDateRange(departure.start_date, departure.end_date)
      : "";
  const label =
    data.paymentOption === "full" || booking.deposit_amount === 0 ? "Full payment" : "Deposit";

  let checkoutUrl: string | null = null;
  try {
    const stripe = getStripe();
    const holdExpiry = Math.floor(new Date(booking.hold_expires_at).getTime() / 1000);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: booking.booking_id,
      customer_email: user.email ?? undefined,
      // Stripe requires 30 min–24 h; our hold is 30 min so clamp to at least 30 min from now.
      expires_at: Math.max(holdExpiry, Math.floor(Date.now() / 1000) + 30 * 60 + 5),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: booking.currency.toLowerCase(),
            unit_amount: booking.amount_due_now,
            product_data: {
              name: `${tour?.name ?? "Guideless trip"} — ${label}`,
              description: `${dates} · ${data.travelers.length} ${data.travelers.length === 1 ? "traveler" : "travelers"} · ${booking.confirmation_number}`,
            },
          },
        },
      ],
      metadata: {
        booking_id: booking.booking_id,
        confirmation_number: booking.confirmation_number,
        payment_option: data.paymentOption,
      },
      payment_intent_data: {
        metadata: {
          booking_id: booking.booking_id,
          confirmation_number: booking.confirmation_number,
        },
        description: `${booking.confirmation_number} · ${label}`,
      },
      success_url: `${site}/checkout/${data.departureId}/confirmation?booking=${booking.booking_id}`,
      cancel_url: `${site}/checkout/${data.departureId}?cancelled=1`,
    });
    checkoutUrl = session.url;

    // 3. Remember the session on the booking (service role: customers cannot update pending rows).
    const admin = createServiceRoleClient();
    const { error: updErr } = await admin
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", booking.booking_id);
    if (updErr)
      console.error("failed to store checkout session id", {
        bookingId: booking.booking_id,
        updErr,
      });
  } catch (err) {
    console.error("stripe checkout session failed", { bookingId: booking.booking_id, err });
    // Release the hold immediately rather than waiting for the cron.
    const admin = createServiceRoleClient();
    await admin
      .from("bookings")
      .update({ status: "draft", hold_expires_at: null })
      .eq("id", booking.booking_id)
      .eq("status", "pending_payment");
    return {
      code: "unknown",
      error: "We couldn't reach our payment provider. Nothing was charged. Please try again.",
    };
  }

  if (!checkoutUrl) {
    return {
      code: "unknown",
      error: "We couldn't open the payment page. Nothing was charged. Please try again.",
    };
  }
  redirect(checkoutUrl as Route); // external Stripe URL; typedRoutes only knows internal paths
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Account → "Pay balance": a second Stripe Checkout for what is still owed on a confirmed booking.
 * The webhook classifies the payment (`paymentKind` → "balance") and updates the booking; this
 * action only creates the session. Errors land back on /account as a one-line message.
 */
export async function payBalance(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID_RE.test(bookingId)) redirect("/account?error=invalid" as Route);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account" as Route);
  if (!isStripeConfigured()) redirect("/account?error=payments_unavailable" as Route);

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!booking || booking.status !== "confirmed") redirect("/account?error=not_payable" as Route);
  const balance = booking.total_amount - booking.amount_paid;
  if (balance <= 0) redirect("/account?error=nothing_due" as Route);

  const { data: departure } = await supabase
    .from("departures_public")
    .select("start_date, end_date, tour_id")
    .eq("id", booking.departure_id)
    .maybeSingle();
  const { data: tour } = departure?.tour_id
    ? await supabase.from("tours").select("name").eq("id", departure.tour_id).maybeSingle()
    : { data: null };
  const dates =
    departure?.start_date && departure.end_date
      ? formatDateRange(departure.start_date, departure.end_date)
      : "";
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;

  let url: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: booking.id,
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: booking.currency.toLowerCase(),
            unit_amount: balance,
            product_data: {
              name: `${tour?.name ?? "Guideless trip"} — Balance`,
              description: `${dates}${dates ? " · " : ""}${booking.confirmation_number}`,
            },
          },
        },
      ],
      metadata: {
        booking_id: booking.id,
        confirmation_number: booking.confirmation_number,
        payment_option: "balance",
      },
      payment_intent_data: {
        metadata: { booking_id: booking.id, confirmation_number: booking.confirmation_number },
        description: `${booking.confirmation_number} · Balance`,
      },
      success_url: `${site}/account?paid=${encodeURIComponent(booking.confirmation_number)}`,
      cancel_url: `${site}/account`,
    });
    url = session.url;
  } catch (err) {
    console.error("balance checkout session failed", { bookingId: booking.id, err });
  }
  if (!url) redirect("/account?error=unknown" as Route);
  redirect(url as Route);
}
