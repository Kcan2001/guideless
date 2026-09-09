import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

/**
 * Shared machinery for the authenticated end-to-end tests.
 *
 * Everything talks to the LOCAL Supabase stack. Local email signup auto-confirms
 * (`enable_confirmations = false` in supabase/config.toml), so a browser can sign up and land
 * signed in without a mailbox, which is what lets these tests exercise the real forms rather than
 * injecting a session.
 *
 * Bookings are seeded the way they actually happen: sign in as the traveler, call `create_booking`
 * with their own session so every trigger and RLS policy applies, then move the row to confirmed
 * with the service role, which is exactly what the Stripe webhook does. Nothing is inserted behind
 * the schema's back.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Seeded ids, from supabase/seed. Structural, not business values. */
export const SEED = {
  franceTourSlug: "southern-france",
  franceDeparture: "30000000-0000-4000-8000-000000000001",
  monacoTourSlug: "monaco-grand-prix",
  monacoDeparture: "30000000-0000-4000-8000-000000000004",
  monacoStayNice: "31000000-0000-4000-8000-000000000001",
  monacoStayMonteCarlo: "31000000-0000-4000-8000-000000000002",
} as const;

/** A fresh address per test, so specs never collide when run in parallel. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const PASSWORD = "Guideless!e2e-2027";

export function serviceClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The authenticated e2e specs need it to confirm a booking the way the Stripe webhook does.",
    );
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the stack this run points at can seed bookings; specs skip rather than fail without it. */
export function canSeedBookings(): boolean {
  return Boolean(SERVICE_ROLE_KEY);
}

// ── Browser flows, driven through the real forms ─────────────────────────────

/**
 * Answer the cookie banner before the page loads, which is what a returning visitor has already
 * done. Without this every spec fights a fixed dialog that floats over the bottom of the page.
 * The banner's own behaviour is covered explicitly in consent.spec.ts rather than incidentally
 * everywhere else.
 */
export async function acceptCookies(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("guideless-consent-v1", "granted");
    } catch {
      /* private mode: the banner shows and the spec deals with it */
    }
  });
}

/** Only one mode's form is mounted at a time, so the field ids are unambiguous. */
export async function signUp(
  page: Page,
  email: string,
  password = PASSWORD,
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.locator("#su-name").fill("E2E Traveler");
  await page.locator("#su-email").fill(email);
  await page.locator("#su-password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Password" }).click();
  await page.locator("#pw-email").fill(email);
  await page.locator("#pw-password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

export async function expectSignedIn(page: Page): Promise<void> {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// ── Seeding ──────────────────────────────────────────────────────────────────

export interface SeededBooking {
  email: string;
  userId: string;
  bookingId: string;
  confirmationNumber: string;
}

/**
 * A confirmed booking for a brand-new traveler, created through `create_booking` as that traveler
 * and then confirmed with the service role. Add-ons are passed as the builder would pass them.
 */
export async function seedConfirmedBooking(opts: {
  departureId?: string;
  stayOptionId?: string | null;
  addOnIds?: string[];
  emailPrefix?: string;
}): Promise<SeededBooking> {
  const email = uniqueEmail(opts.emailPrefix ?? "booked");
  const admin = serviceClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`could not create user: ${createErr?.message}`);

  // Book as the traveler, so RLS, capacity guards and the quote all apply exactly as in production.
  const asUser = anonClient();
  const { error: signInErr } = await asUser.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`could not sign in the seeded traveler: ${signInErr.message}`);

  const { data: rows, error: rpcErr } = await asUser.rpc("create_booking", {
    p_departure_id: opts.departureId ?? SEED.franceDeparture,
    p_travelers: [
      {
        firstName: "Seeded",
        lastName: "Traveler",
        dateOfBirth: "1990-01-15",
        nationality: "US",
        roomIndex: 1,
      },
    ],
    p_emergency_contact: { name: "Pat", relationship: "Friend", phone: "+14155550123" },
    p_preferences: {},
    p_payment_option: "deposit",
    p_terms_version: "v1",
    p_stay_option_id: opts.stayOptionId ?? null,
    p_add_ons: (opts.addOnIds ?? []).map((id) => ({ addOnId: id, travelerIndexes: [1] })),
    p_code: null,
    p_group_code: null,
  });
  if (rpcErr) throw new Error(`create_booking failed: ${rpcErr.message}`);
  const booking = Array.isArray(rows) ? rows[0] : rows;
  const bookingId = (booking as { booking_id: string }).booking_id;

  // What the Stripe webhook does on payment: confirm, mark the deposit paid, release the hold.
  const { error: confirmErr } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: "deposit_paid",
      amount_paid: (booking as { deposit_amount: number }).deposit_amount,
      hold_expires_at: null,
    })
    .eq("id", bookingId);
  if (confirmErr) throw new Error(`could not confirm the booking: ${confirmErr.message}`);

  return {
    email,
    userId: created.user.id,
    bookingId,
    confirmationNumber: (booking as { confirmation_number: string }).confirmation_number,
  };
}

/**
 * Removes a seeded booking and its traveler.
 *
 * The booking has to go explicitly. Deleting the auth user leaves the row behind, and a booking
 * holds a seat: a few runs of these specs filled the 14-seat France departure and every other spec
 * started failing with "Departure is sold out". Test data that does not clean up after itself
 * becomes everyone else's flake.
 */
export async function removeBooking(bookingId: string): Promise<void> {
  try {
    await serviceClient().from("bookings").delete().eq("id", bookingId);
  } catch {
    // Best effort.
  }
}

/**
 * Clears the fixed-window rate limit for a public form.
 *
 * Public forms are limited per IP per hour, which is correct in production and hostile to a suite
 * run more than once an hour from one machine: the host-application test began failing after the
 * seventh submission, which was the limiter doing its job rather than a defect. Resetting keeps the
 * happy-path assertion honest instead of softening it to "thanks OR rate limited".
 */
export async function resetRateLimit(prefix: string): Promise<void> {
  try {
    await serviceClient().from("rate_limits").delete().like("key", `${prefix}:%`);
  } catch {
    // Best effort: without the service key there is nothing to reset.
  }
}

/** Removes a seeded traveler and everything that cascades from them. */
export async function removeUser(userId: string): Promise<void> {
  try {
    await serviceClient().auth.admin.deleteUser(userId);
  } catch {
    // Best effort: a leftover test user is noise, not a failure.
  }
}

/** Tears down a seeded booking completely: the seat first, then the account. */
export async function cleanUp(booked: SeededBooking): Promise<void> {
  await removeBooking(booked.bookingId);
  await removeUser(booked.userId);
}
