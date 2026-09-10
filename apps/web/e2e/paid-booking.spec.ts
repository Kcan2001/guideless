import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PASSWORD, serviceClient, signIn } from "./helpers";

/**
 * The money path, end to end, through real Stripe Checkout sessions.
 *
 * WHY THIS EXISTS SEPARATELY
 * `checkout.spec.ts` walks the whole funnel and then asserts the payment step refuses cleanly when
 * Stripe is not configured, which is correct for CI against a local stack with no keys. It means
 * everything past that click — the Checkout session, the redirect, the payment, the webhook that is
 * the *authoritative* source of payment state, the confirmation, the booking appearing in the
 * account, buying an extra afterwards, the refund the customer is shown if they cancel — has never
 * been executed by a test or by a person.
 *
 * That is the last untested stretch before the company takes money, so it gets its own spec, run
 * deliberately against an environment that has test-mode Stripe rather than in the default CI run:
 *
 *   E2E_BASE_URL=https://guideless-staging.vercel.app \
 *   E2E_BYPASS=<vercel protection bypass> \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx playwright test e2e/paid-booking.spec.ts --project=desktop
 *
 * It skips itself rather than failing when those are absent, so a normal CI run is unaffected.
 *
 * The traveler is created with the service role rather than through the sign-up form: hosted
 * Supabase rate-limits its built-in mailer hard, so a form sign-up on a shared staging project
 * fails for reasons that have nothing to do with payments. Sign-up through the form is already
 * covered against the local stack. Everything after that point here is the real UI.
 *
 * It books the cheapest tier on the cheapest departure and cleans up after itself. Staging has no
 * real customers, but a test that leaves seats consumed is a test people stop running.
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const BYPASS = process.env.E2E_BYPASS ?? "";
const REMOTE = /^https:\/\//.test(BASE);

const TOUR_SLUG = "southern-france";
const DEPARTURE_ID = "30000000-0000-4000-8000-000000000001";
const BUILD = `/tours/${TOUR_SLUG}/build?departure=${DEPARTURE_ID}`;

const t0 = Date.now();
/** Where the wall clock goes. This spec walks two Stripe sessions and is slow by nature; without
 *  this a timeout tells you only which line was awaiting, not which stretch was expensive. */
function mark(label: string): void {
  console.log(`[paid-booking] ${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);
}

/**
 * A select that fails loudly. Reading only `data` turns a mistyped column into "zero rows", which
 * reads exactly like a missing payment — an hour went into that once already.
 */
async function rows<T>(
  q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(`query failed: ${error.message}`);
  return data ?? [];
}

/**
 * Give the seat back. A test that consumes inventory is a test nobody runs twice.
 *
 * Most things hanging off a booking cascade, but `payments`, `refunds` and `hotel_bookings`
 * reference it `on delete restrict` — deliberately, because a paid booking is a financial record
 * and production must never lose one. So a *paid* booking cannot be deleted until those go first,
 * and while the booking stands, neither can the auth user. The first version of this swallowed
 * both failures and left six travelers and seven bookings sitting on staging.
 */
async function removeTraveler(sb: SupabaseClient, userId: string): Promise<void> {
  const bookings = await rows(sb.from("bookings").select("id").eq("customer_id", userId));
  for (const b of bookings) {
    for (const table of ["refunds", "payments", "hotel_bookings"] as const) {
      const { error } = await sb.from(table).delete().eq("booking_id", b.id);
      if (error) throw new Error(`could not clear ${table} for booking ${b.id}: ${error.message}`);
    }
  }
  const { error: bookErr } = await sb.from("bookings").delete().eq("customer_id", userId);
  if (bookErr) throw new Error(`could not delete bookings: ${bookErr.message}`);
  const { error: userErr } = await sb.auth.admin.deleteUser(userId);
  if (userErr) throw new Error(`could not delete traveler ${userId}: ${userErr.message}`);
}

/** Stripe's own hosted form. These ids are stable across their Checkout versions. */
async function payOnStripe(page: Page, email: string): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  mark("stripe: checkout loaded");
  await page
    .locator("#email")
    .fill(email)
    .catch(() => {
      /* prefilled from customer_email, and then the field is not editable */
    });
  // With several payment methods enabled on the account, Checkout renders an accordion and the
  // card fields only exist once Card is chosen. With card alone they are already on the page.
  const cardNumber = page.locator("#cardNumber");
  if (!(await cardNumber.isVisible().catch(() => false))) {
    const card = page.getByRole("radio", { name: "Card", exact: true });
    // The radio is visually hidden behind its own label, so an ordinary click never becomes
    // actionable and waits out the whole test budget. Escalate rather than hang.
    await card.click({ timeout: 10_000 }).catch(async () => {
      await card
        .click({ force: true, timeout: 10_000 })
        .catch(async () => card.dispatchEvent("click"));
    });
    await cardNumber.waitFor({ state: "visible", timeout: 30_000 });
  }
  mark("stripe: card fields ready");
  await cardNumber.fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("E2E Paid");
  const postal = page.locator("#billingPostalCode");
  if (await postal.count()) await postal.fill("94105");
  // "Save my information for faster checkout" is ticked by default and demands a phone number,
  // which silently blocks Pay. A real customer sees the same field; the test declines Link.
  const saveInfo = page.getByRole("checkbox", { name: /save my information/i });
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck({ timeout: 10_000 }).catch(() => saveInfo.click({ force: true }));
  }
  await page.getByTestId("hosted-payment-submit-button").click();
  // Where Stripe returns to is `NEXT_PUBLIC_SITE_URL`, which on staging may be another host
  // entirely. Only leaving Stripe matters; the assertions below read the database and navigate
  // back to the environment under test explicitly.
  await page.waitForURL((u) => !/checkout\.stripe\.com/.test(u.href), { timeout: 120_000 });
  mark("stripe: paid and returned");
}

test.describe("paid booking", () => {
  test.skip(
    !REMOTE || !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Needs E2E_BASE_URL pointing at an environment with test-mode Stripe, plus a service key to verify and clean up.",
  );
  test.use({
    extraHTTPHeaders: BYPASS ? { "x-vercel-protection-bypass": BYPASS } : {},
    // Playwright waits forever for actionability by default. On a third-party page that turns a
    // moved selector into a dead six-minute run instead of a failure with a screenshot.
    actionTimeout: 20_000,
  });
  test.setTimeout(600_000);

  test("a customer pays, the webhook confirms, and the trip appears in their account", async ({
    page,
  }) => {
    const sb = serviceClient();
    // Resend refuses `example.com` outright, so a run against a real environment would always
    // record the confirmation as failed. `delivered@resend.dev` is their sink address — it accepts
    // mail, never bounces, and never reaches a person — and it takes a plus tag, which keeps each
    // run's traveler a distinct account. Cleanup below is by user id, not by domain.
    const email = `delivered+guideless-e2e-${Date.now().toString(36)}@resend.dev`;
    let userId: string | null = null;

    try {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created.user)
        throw new Error(`could not create user: ${createErr?.message}`);
      userId = created.user.id;

      // ── Sign in and walk the builder ────────────────────────────────────
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem("guideless-consent-v1", "granted");
        } catch {
          /* private mode: the banner shows and the steps below step around it */
        }
      });
      mark("user created");
      await signIn(page, email);
      await expect(page).toHaveURL(/\/account/, { timeout: 60_000 });
      mark("signed in");
      await page.goto(BUILD);

      const next = async () => {
        await page.getByTestId("step-continue").first().click();
        await page.waitForTimeout(400);
      };
      await next(); // dates → stay
      await page.getByTestId("stay-tiers").getByRole("radio").first().check();
      await next(); // stay → days
      await next(); // days → travelers

      await expect(page.getByRole("heading", { name: /who.s traveling/i })).toBeVisible();
      await page.locator("#t0-first").fill("E2E");
      await page.locator("#t0-last").fill("Paid");
      await page.locator("#t0-dob").fill("1990-05-14");
      await page.locator("#t0-nat").fill("us");
      await page.locator("#ec-name").fill("Pat Tester");
      await page.locator("#ec-rel").fill("Sibling");
      await page.locator("#ec-phone").fill("+1 415 555 0123");
      await next();

      for (const label of [
        "I accept the Terms of Service.",
        "I understand the cancellation policy for this departure.",
        "I understand I am responsible for my own flights, insurance and documents.",
        "I accept the Privacy Policy.",
      ]) {
        await page.getByRole("checkbox", { name: label }).check();
      }
      await page.getByRole("button", { name: "Continue to payment" }).first().click();
      await expect(page.getByRole("heading", { name: /review and pay/i })).toBeVisible();
      mark("builder walked");

      // ── Into Stripe ─────────────────────────────────────────────────────
      await page.getByRole("button", { name: /continue to secure payment/i }).click();
      await payOnStripe(page, email);

      // ── Back on our side ────────────────────────────────────────────────
      // The webhook is authoritative and arrives out of band, so poll the database rather than
      // trusting the redirect — which is the rule the app itself follows.
      const latestBooking = async () => {
        const { data } = await sb
          .from("bookings")
          .select(
            "id, status, amount_paid, deposit_amount, total_amount, confirmation_number, currency",
          )
          .eq("customer_id", userId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      };
      await expect
        .poll(async () => (await latestBooking())?.status ?? "none", {
          timeout: 120_000,
          intervals: [2000],
        })
        .toBe("confirmed");
      const booking = (await latestBooking())!;
      mark("webhook confirmed the booking");

      // Money actually moved, and it is the deposit rather than the whole total.
      expect(Number(booking.amount_paid)).toBeGreaterThan(0);
      expect(Number(booking.amount_paid)).toBe(Number(booking.deposit_amount));
      expect(Number(booking.amount_paid)).toBeLessThan(Number(booking.total_amount));
      expect(String(booking.confirmation_number)).toMatch(/^GL-/);

      // A payment row was recorded, and the webhook was logged so a retry cannot double-charge.
      const payments = await rows(
        sb.from("payments").select("id, amount, stripe_status").eq("booking_id", booking.id),
      );
      expect(payments.length).toBe(1);
      expect(Number(payments[0].amount)).toBe(Number(booking.amount_paid));
      expect(payments[0].stripe_status).toBe("succeeded");

      const { count: events } = await sb
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "processed");
      expect(events ?? 0).toBeGreaterThan(0);

      // The traveler was written, and the trip shows up where a customer would look for it.
      const { count: travelers } = await sb
        .from("booking_travelers")
        .select("booking_id", { count: "exact", head: true })
        .eq("booking_id", booking.id);
      expect(travelers).toBe(1);

      await page.goto("/account");
      // The number appears twice on the page: in the trip card heading and on its own line.
      await expect(page.getByText(String(booking.confirmation_number)).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("No trips booked yet.")).toHaveCount(0);

      // The confirmation notification is written by the same webhook that confirmed the booking.
      const { count: notes } = await sb
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      expect(notes ?? 0).toBeGreaterThan(0);

      // The confirmation email was handed to Resend and accepted. `skipped` means the environment
      // has no API key, which is a legitimate state for a preview deploy but not for staging;
      // `failed` means a traveler paid and heard nothing, which is the case worth catching.
      const sentEmails = await rows(
        sb
          .from("email_events")
          .select("id, status, recipient, error")
          .eq("user_id", userId!)
          .eq("template", "booking-confirmed"),
      );
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].recipient).toBe(email);
      expect(sentEmails[0].status, `email error: ${sentEmails[0].error ?? "none"}`).toBe("sent");

      // ── An extra, bought after the fact ─────────────────────────────────
      // A second, separate Stripe session against an already-confirmed booking. This is the path
      // that runs for months after someone books, and it must not disturb the trip balance.
      await page.goto(`/account/bookings/${booking.id}/add-ons`);
      await expect(page.getByRole("heading", { name: /add to your trip/i })).toBeVisible({
        timeout: 30_000,
      });

      // Per-traveler extras are chosen by clicking a name pill, whose checkbox is screen-reader
      // only; per-booking extras use a quantity select. Take whichever the first extra offers.
      const pill = page.locator("label:has(> input[type='checkbox'])").first();
      if (await pill.count()) {
        await pill.click();
      } else {
        await page.locator("select[id^='qty-']").first().selectOption("1");
      }
      await expect(page.getByTestId("purchase-total")).not.toHaveText("…", { timeout: 30_000 });
      await page.getByRole("button", { name: /pay and add to my trip/i }).click();
      await payOnStripe(page, email);

      await expect
        .poll(
          async () => {
            const { count } = await sb
              .from("booking_add_ons")
              .select("id", { count: "exact", head: true })
              .eq("booking_id", booking.id)
              .eq("status", "confirmed");
            return count ?? 0;
          },
          { timeout: 120_000, intervals: [2000] },
        )
        .toBeGreaterThan(0);

      // The extra is paid in full and on its own; the trip's deposit is untouched.
      const after = (await latestBooking())!;
      expect(Number(after.deposit_amount)).toBe(Number(booking.deposit_amount));
      expect(Number(after.amount_paid)).toBeGreaterThan(Number(booking.amount_paid));
      const allPayments = await rows(
        sb.from("payments").select("id, amount").eq("booking_id", booking.id),
      );
      expect(allPayments.length).toBe(2);

      // ── What they would get back if they cancelled today ─────────────────
      await page.goto("/account");
      const cancel = page.locator(`#cancel-${booking.id}`);
      await expect(cancel).toBeVisible({ timeout: 30_000 });
      await cancel.getByText(/need to cancel this booking/i).click();
      await expect(cancel.getByText("Total refund today")).toBeVisible();
      // The preview must be derived from what was actually paid, not from the trip price: a ladder
      // refunding more than we can recover is the bug this section exists to catch.
      await expect(cancel.getByText(/paid so far/i)).toBeVisible();
      await expect(cancel).not.toContainText("NaN");
    } finally {
      if (userId) await removeTraveler(sb, userId);
    }
  });
});
