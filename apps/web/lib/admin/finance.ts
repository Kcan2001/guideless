import "server-only";

import type { Tables } from "@guideless/types";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

/**
 * Finance read models: the coupon list and the Stripe reconciliation.
 *
 * Reconciliation is read-only on both sides. It never writes to Stripe and never repairs the
 * ledger — it reports what a human has to look at. Live keys run in production, so nothing here
 * logs a Stripe response and no card, customer email or raw payload is returned to the page.
 */

export type CouponRow = Tables<"coupons">;

export interface CouponWithUsage extends CouponRow {
  /** Bookings that reference this coupon; may exceed `redemptions` only if data was edited by hand. */
  bookings_used: number;
  /** True when nothing references it and it has never been redeemed, so deleting is safe. */
  deletable: boolean;
}

/** Every coupon, newest first, with how many bookings actually reference it. */
export async function listCoupons(): Promise<CouponWithUsage[]> {
  const sb = await createClient();
  const [{ data: coupons, error }, { data: bookings, error: bErr }] = await Promise.all([
    sb.from("coupons").select("*").order("created_at", { ascending: false }),
    sb.from("bookings").select("coupon_id").not("coupon_id", "is", null),
  ]);
  if (error) throw error;
  if (bErr) throw bErr;

  const used = new Map<string, number>();
  for (const b of bookings ?? []) {
    if (b.coupon_id) used.set(b.coupon_id, (used.get(b.coupon_id) ?? 0) + 1);
  }
  return (coupons ?? []).map((c) => {
    const bookings_used = used.get(c.id) ?? 0;
    return { ...c, bookings_used, deletable: bookings_used === 0 && c.redemptions === 0 };
  });
}

export async function getCoupon(id: string): Promise<CouponRow | null> {
  const sb = await createClient();
  const { data, error } = await sb.from("coupons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export const RECONCILE_WINDOWS = [7, 30, 90] as const;
export type ReconcileWindow = (typeof RECONCILE_WINDOWS)[number];

export type DiscrepancyKind =
  | "stripe_only" // succeeded in Stripe, no payments row
  | "ledger_only" // paid in our ledger, no Stripe intent
  | "amount_mismatch" // both exist, amount or currency differs
  | "refund_mismatch" // refunded in Stripe, missing or different here
  | "booking_total"; // booking.amount_paid disagrees with its paid payments

export interface Discrepancy {
  kind: DiscrepancyKind;
  /** Short, human sentence naming what disagrees. Never contains customer data. */
  detail: string;
  stripeId?: string;
  stripeObject?: "payment_intent" | "charge" | "refund";
  bookingId?: string;
  confirmationNumber?: string;
  ourAmount?: number;
  stripeAmount?: number;
  currency?: string;
  occurredAt?: string;
}

export interface ReconciliationReport {
  configured: boolean;
  windowDays: ReconcileWindow;
  since: string;
  /** How much was compared, so a clean result is evidence rather than an empty table. */
  checked: { stripeIntents: number; payments: number; refunds: number; bookings: number };
  discrepancies: Discrepancy[];
  /** Set when Stripe could not be read; the page says so instead of implying everything matches. */
  error?: string;
  livemode: boolean;
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // 1,000 intents is far beyond any window we expect at this stage.

/**
 * Compares Stripe against our ledger for the window and returns only what needs a human.
 * Amounts are integer minor units on both sides, so they compare directly.
 */
export async function reconcile(windowDays: ReconcileWindow): Promise<ReconciliationReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const empty = {
    windowDays,
    since: sinceIso,
    checked: { stripeIntents: 0, payments: 0, refunds: 0, bookings: 0 },
    discrepancies: [],
    livemode: false,
  };
  if (!isStripeConfigured()) return { ...empty, configured: false };

  const sb = await createClient();
  const [{ data: payments, error: pErr }, { data: refunds, error: rErr }] = await Promise.all([
    sb
      .from("payments")
      .select("id, booking_id, amount, currency, stripe_payment_intent_id, paid_at, stripe_status")
      .gte("created_at", sinceIso),
    sb
      .from("refunds")
      .select("id, booking_id, amount, currency, stripe_refund_id, stripe_status")
      .gte("created_at", sinceIso),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const ours = payments ?? [];
  const ourRefunds = refunds ?? [];
  const byIntent = new Map(
    ours.filter((p) => p.stripe_payment_intent_id).map((p) => [p.stripe_payment_intent_id!, p]),
  );
  const bookingIds = [...new Set(ours.map((p) => p.booking_id))];
  const { data: bookings } = bookingIds.length
    ? await sb
        .from("bookings")
        .select("id, confirmation_number, amount_paid, currency")
        .in("id", bookingIds)
    : {
        data: [] as Array<{
          id: string;
          confirmation_number: string;
          amount_paid: number;
          currency: string;
        }>,
      };
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));
  const conf = (id: string | null | undefined) =>
    id ? bookingById.get(id)?.confirmation_number : undefined;

  const discrepancies: Discrepancy[] = [];
  let stripeIntents = 0;
  let livemode = false;

  try {
    const stripe = getStripe();
    const seen = new Set<string>();
    let startingAfter: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await stripe.paymentIntents.list({
        limit: PAGE_LIMIT,
        created: { gte: Math.floor(since.getTime() / 1000) },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const intent of batch.data) {
        stripeIntents++;
        livemode ||= intent.livemode;
        seen.add(intent.id);
        const ourPayment = byIntent.get(intent.id);
        const at = new Date(intent.created * 1000).toISOString();

        if (intent.status === "succeeded" && !ourPayment) {
          discrepancies.push({
            kind: "stripe_only",
            detail: "Succeeded in Stripe with no payment recorded here.",
            stripeId: intent.id,
            stripeObject: "payment_intent",
            stripeAmount: intent.amount_received || intent.amount,
            currency: intent.currency.toUpperCase(),
            occurredAt: at,
          });
          continue;
        }
        if (!ourPayment) continue;

        const stripeAmount = intent.amount_received || intent.amount;
        const sameCurrency = intent.currency.toUpperCase() === ourPayment.currency;
        if (
          intent.status === "succeeded" &&
          (stripeAmount !== ourPayment.amount || !sameCurrency)
        ) {
          discrepancies.push({
            kind: "amount_mismatch",
            detail: sameCurrency
              ? "Stripe and our ledger disagree on the amount."
              : `Currency differs: Stripe ${intent.currency.toUpperCase()}, ledger ${ourPayment.currency}.`,
            stripeId: intent.id,
            stripeObject: "payment_intent",
            bookingId: ourPayment.booking_id,
            confirmationNumber: conf(ourPayment.booking_id),
            ourAmount: ourPayment.amount,
            stripeAmount,
            currency: ourPayment.currency,
            occurredAt: at,
          });
        }
      }
      if (!batch.has_more) break;
      startingAfter = batch.data.at(-1)?.id;
      if (!startingAfter) break;
    }

    // Paid here, but Stripe never saw it (ignoring payments recorded off-platform by staff).
    for (const p of ours) {
      if (!p.paid_at) continue;
      if (!p.stripe_payment_intent_id) continue; // manual/off-platform payment, not Stripe's to know
      if (seen.has(p.stripe_payment_intent_id)) continue;
      discrepancies.push({
        kind: "ledger_only",
        detail: "Marked paid here with no matching Stripe payment in this window.",
        stripeId: p.stripe_payment_intent_id,
        stripeObject: "payment_intent",
        bookingId: p.booking_id,
        confirmationNumber: conf(p.booking_id),
        ourAmount: p.amount,
        currency: p.currency,
        occurredAt: p.paid_at,
      });
    }

    // Refunds: Stripe is the source of truth for what was actually returned.
    const ourRefundById = new Map(
      ourRefunds.filter((r) => r.stripe_refund_id).map((r) => [r.stripe_refund_id!, r]),
    );
    const refundList = await stripe.refunds.list({
      limit: PAGE_LIMIT,
      created: { gte: Math.floor(since.getTime() / 1000) },
    });
    for (const refund of refundList.data) {
      const mine = ourRefundById.get(refund.id);
      if (!mine) {
        discrepancies.push({
          kind: "refund_mismatch",
          detail: "Refunded in Stripe with no refund recorded here.",
          stripeId: refund.id,
          stripeObject: "refund",
          stripeAmount: refund.amount,
          currency: refund.currency.toUpperCase(),
          occurredAt: new Date(refund.created * 1000).toISOString(),
        });
        continue;
      }
      if (refund.amount !== mine.amount) {
        discrepancies.push({
          kind: "refund_mismatch",
          detail: "Stripe and our ledger disagree on the refunded amount.",
          stripeId: refund.id,
          stripeObject: "refund",
          bookingId: mine.booking_id,
          confirmationNumber: conf(mine.booking_id),
          ourAmount: mine.amount,
          stripeAmount: refund.amount,
          currency: mine.currency,
          occurredAt: new Date(refund.created * 1000).toISOString(),
        });
      }
    }
  } catch (err) {
    return {
      ...empty,
      configured: true,
      checked: {
        stripeIntents,
        payments: ours.length,
        refunds: ourRefunds.length,
        bookings: bookingIds.length,
      },
      error: err instanceof Error ? err.message : "Could not read from Stripe.",
      livemode,
    };
  }

  // Internal consistency: a booking's amount_paid should equal the sum of its paid payments.
  // Summed over ALL of the booking's payments, not just this window — a deposit taken before the
  // window would otherwise make every older booking look short, which is noise, not a finding.
  if (bookingIds.length) {
    const { data: allPayments, error: apErr } = await sb
      .from("payments")
      .select("booking_id, amount, paid_at")
      .in("booking_id", bookingIds)
      .not("paid_at", "is", null);
    if (apErr) throw apErr;

    const paidByBooking = new Map<string, number>();
    for (const p of allPayments ?? []) {
      paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount);
    }
    for (const bookingId of bookingIds) {
      const booking = bookingById.get(bookingId);
      if (!booking) continue;
      const sum = paidByBooking.get(bookingId) ?? 0;
      if (booking.amount_paid === sum) continue;
      discrepancies.push({
        kind: "booking_total",
        detail:
          booking.amount_paid > sum
            ? "The booking says more has been paid than its payments add up to."
            : "The booking says less has been paid than its payments add up to.",
        bookingId,
        confirmationNumber: booking.confirmation_number,
        ourAmount: booking.amount_paid,
        stripeAmount: sum,
        currency: booking.currency,
      });
    }
  }

  return {
    configured: true,
    windowDays,
    since: sinceIso,
    checked: {
      stripeIntents,
      payments: ours.length,
      refunds: ourRefunds.length,
      bookings: bookingIds.length,
    },
    discrepancies,
    livemode,
  };
}

/** Dashboard link for a Stripe object; test-mode keys live under /test. */
export function stripeUrl(
  object: NonNullable<Discrepancy["stripeObject"]>,
  id: string,
  livemode: boolean,
): string {
  const base = `https://dashboard.stripe.com${livemode ? "" : "/test"}`;
  const path =
    object === "payment_intent" ? "payments" : object === "refund" ? "payments" : "charges";
  return `${base}/${path}/${id}`;
}
