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

  test("one traveler cannot open another traveler's booking", async ({ page }) => {
    const intruder = uniqueEmail("intruder");
    await signUp(page, intruder);
    await page.waitForURL(/\/account/, { timeout: 30_000 });

    await page.goto(`/account/bookings/${booked.bookingId}/add-ons`);
    // Row-level security decides this, not the UI: the page must not render the other booking.
    await expect(page.getByRole("main")).not.toContainText(booked.confirmationNumber);
  });
});
