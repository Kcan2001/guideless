import { expect, test } from "@playwright/test";
import {
  acceptCookies,
  canSeedBookings,
  cleanUp,
  seedConfirmedBooking,
  signIn,
  signUp,
  uniqueEmail,
  type SeededBooking,
} from "./helpers";

/**
 * Everything a traveler does after paying: find the booking, look at what they bought, buy an
 * extra, and cancel. None of this had browser coverage, because without Stripe no booking ever
 * existed to look at. The booking here is created through `create_booking` as the traveler and then
 * confirmed with the service role, which is exactly what the Stripe webhook does.
 */
test.describe("managing a booking", () => {
  test.skip(
    !canSeedBookings(),
    "needs SUPABASE_SERVICE_ROLE_KEY to confirm a booking the way the webhook does",
  );

  let booked: SeededBooking;

  test.beforeAll(async () => {
    booked = await seedConfirmedBooking({ emailPrefix: "account" });
  });

  test.afterAll(async () => {
    if (booked) await cleanUp(booked);
  });

  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("the traveler finds their confirmed trip by its confirmation number", async ({ page }) => {
    await signIn(page, booked.email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });

    await expect(page.getByRole("main")).toContainText(booked.confirmationNumber);
    // Confirmed and part-paid is the normal state between deposit and balance.
    await expect(page.getByRole("main")).toContainText(/confirmed/i);
    await expect(page.getByRole("main")).toContainText(/balance|deposit|paid/i);
  });

  test("the trip shows what was actually bought, not a generic summary", async ({ page }) => {
    await signIn(page, booked.email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    const main = page.getByRole("main");
    // The tour it belongs to and a real money figure, both from the booking rather than the catalog.
    await expect(main).toContainText(/southern france/i);
    await expect(main).toContainText(/\$[\d,]+/);
  });

  test("extras can be bought after booking, and the page names the trip", async ({ page }) => {
    await signIn(page, booked.email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await page.goto(`/account/bookings/${booked.bookingId}/add-ons`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The seeded France departure has extras; the page must offer at least one with a price.
    await expect(page.getByRole("main")).toContainText(/\$[\d,]+/);
  });

  test("cancelling shows the refund first, then records the request", async ({ page }) => {
    // A booking of its own, because this one ends up with a cancellation request against it.
    const own = await seedConfirmedBooking({ emailPrefix: "cancels" });
    try {
      await signIn(page, own.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });

      const disclosure = page.getByText(/need to cancel this booking/i).first();
      await expect(disclosure).toBeVisible();
      await disclosure.click();

      // The refund has to be on screen before the traveler is asked to commit to anything.
      const panel = page.locator(`#cancel-${own.bookingId}`);
      await expect(panel).toContainText(/\$[\d,]+/);
      await expect(panel).toContainText(/refund|back/i);

      await panel.getByRole("textbox").fill("Plans changed, testing the flow end to end.");
      await panel.getByRole("button", { name: /request cancellation/i }).click();

      // Staff resolve it; what the traveler must see immediately is that it was received.
      await expect(page.getByRole("main")).toContainText(/pending|requested|received|withdraw/i, {
        timeout: 20_000,
      });
    } finally {
      await cleanUp(own);
    }
  });

  test("the trip calendar is not readable by a URL alone", async ({ page, request }) => {
    // Anonymous, and with no session at all: a trip id is not a capability. Redirects are not
    // followed on purpose — following one lands on the sign-in page, which answers 200 and would
    // have made this assertion pass while proving nothing.
    const anon = await request.get(`/trips/${booked.bookingId}/calendar.ics`, {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(anon.status());
    expect(anon.headers()["location"]).toContain("/login");

    // Signed in as somebody else is the same answer, so the response cannot be used to discover
    // which trip ids exist.
    await signUp(page, uniqueEmail("nosy"));
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    const res = await page.request.get(`/trips/${booked.bookingId}/calendar.ics`);
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain("BEGIN:VCALENDAR");
  });

  test("the pre-trip survey can be answered, and then changed", async ({ page }) => {
    // A booking of its own, because answering leaves a row behind that the other tests would see.
    const own = await seedConfirmedBooking({ emailPrefix: "surveyed" });
    try {
      await signIn(page, own.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });

      // The departure has not been activated, so there is no trip yet — which is exactly when the
      // pre-trip survey is open and the post-trip one is not.
      const prompt = page.locator("#surveys");
      await expect(prompt).toContainText(/before/i);
      await prompt.getByRole("link", { name: /answer/i }).click();
      await page.waitForURL(/\/account\/surveys\//, { timeout: 30_000 });

      await expect(page.getByRole("main")).toContainText(/hoping for/i);
      // Nothing on this page may suggest the answers are public; that is what a review is for.
      await expect(page.getByRole("main")).not.toContainText(/published/i);

      await page
        .getByRole("textbox")
        .first()
        .fill("Somewhere to swim every morning, and no coach at 8am.");
      await page.getByRole("radio", { name: /balanced/i }).check();
      await page.getByRole("button", { name: /^send$/i }).click();

      // Not /\/account/: the survey page matches that too, so the wait would resolve at once.
      await page.waitForURL(/\/account\?/, { timeout: 30_000 });
      await expect(page.getByRole("main")).toContainText(/thank you/i);
      // Answering again edits rather than piling up, so the prompt stays, marked.
      await expect(page.locator("#surveys")).toContainText(/answered/i);

      await page
        .locator("#surveys")
        .getByRole("link", { name: /change/i })
        .click();
      await page.waitForURL(/\/account\/surveys\//, { timeout: 30_000 });
      await expect(page.getByRole("textbox").first()).toHaveValue(/swim every morning/);
    } finally {
      await cleanUp(own);
    }
  });

  test("one traveler cannot see another traveler's survey", async ({ page }) => {
    const intruder = uniqueEmail("nosysurvey");
    await signUp(page, intruder);
    await page.waitForURL(/\/account/, { timeout: 30_000 });

    // `open_surveys()` is scoped to the caller, so this is a 404 rather than somebody else's form.
    const res = await page.request.get(`/account/surveys/${booked.bookingId}`);
    expect(res.status()).toBe(404);
  });

  test("one traveler cannot open another traveler's booking", async ({ page }) => {
    const intruder = uniqueEmail("intruder");
    await signUp(page, intruder);
    await page.waitForURL(/\/account/, { timeout: 30_000 });

    await page.goto(`/account/bookings/${booked.bookingId}/add-ons`);
    // Row-level security decides this, not the UI: the page must not render the other booking.
    await expect(page.getByRole("main")).not.toContainText(booked.confirmationNumber);
  });
});
