import "server-only";

import { brand } from "@guideless/config";
import type { Currency, Tables } from "@guideless/types";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { getServerEnv, publicEnv } from "@/lib/env";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";

type Admin = ReturnType<typeof createServiceRoleClient>;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  userId: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Sends through Resend's REST API (no SDK needed) and records the attempt in email_events.
 * Without RESEND_API_KEY (local dev) the email is recorded as `skipped` and logged, never thrown.
 */
export async function sendEmail(admin: Admin, input: SendEmailInput): Promise<void> {
  const apiKey = getServerEnv().RESEND_API_KEY;
  const from = getServerEnv().EMAIL_FROM ?? `${brand.name} <hello@guidelesstravel.com>`;

  const { data: row } = await admin
    .from("email_events")
    .insert({
      user_id: input.userId,
      template: input.template,
      recipient: input.to,
      provider: "resend",
      status: apiKey ? "queued" : "skipped",
      payload: (input.payload ?? {}) as Tables<"email_events">["payload"],
    })
    .select("id")
    .maybeSingle();

  if (!apiKey) {
    console.info(
      `[email skipped — no RESEND_API_KEY] ${input.template} → ${input.to}: ${input.subject}`,
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (row) {
      await admin
        .from("email_events")
        .update({
          status: res.ok ? "sent" : "failed",
          provider_message_id: body.id ?? null,
          error: res.ok ? null : (body.message ?? `HTTP ${res.status}`),
        })
        .eq("id", row.id);
    }
    if (!res.ok)
      console.error("resend rejected email", {
        template: input.template,
        status: res.status,
        body,
      });
  } catch (err) {
    console.error("resend request failed", { template: input.template, err });
    if (row) {
      await admin
        .from("email_events")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", row.id);
    }
  }
}

export async function sendBookingConfirmedEmail(
  admin: Admin,
  input: {
    to: string;
    userId: string;
    bookingId: string;
    confirmationNumber: string;
    departureId: string;
    amountPaid: number;
    amountPaidToDate: number;
    totalAmount: number;
    currency: string;
  },
): Promise<void> {
  const { data: departure } = await admin
    .from("departures")
    .select("start_date, end_date, balance_due_date, tour_id")
    .eq("id", input.departureId)
    .maybeSingle();
  const { data: tour } = departure
    ? await admin.from("tours").select("name").eq("id", departure.tour_id).maybeSingle()
    : { data: null };

  const currency = input.currency as Currency;
  const balance = Math.max(input.totalAmount - input.amountPaidToDate, 0);
  const email = bookingConfirmedEmail({
    tourName: tour?.name ?? "your Guideless trip",
    dates: departure ? formatDateRange(departure.start_date, departure.end_date) : "",
    confirmationNumber: input.confirmationNumber,
    amountPaid: formatMoney({ amount: input.amountPaid, currency }),
    balance: balance > 0 ? formatMoney({ amount: balance, currency }) : null,
    balanceDueDate: departure?.balance_due_date ?? null,
    accountUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/account`,
  });

  await sendEmail(admin, {
    to: input.to,
    userId: input.userId,
    template: "booking-confirmed",
    subject: email.subject,
    html: email.html,
    text: email.text,
    payload: { booking_id: input.bookingId, confirmation_number: input.confirmationNumber },
  });
}
