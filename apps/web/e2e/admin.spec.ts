import { expect, test, type Page } from "@playwright/test";
import {
  acceptCookies,
  canSeedBookings,
  cleanUp,
  confirmDialogs,
  removeUser,
  seedConfirmedBooking,
  seedStaff,
  signIn,
  signUp,
  switchUser,
  uniqueEmail,
  type SeededBooking,
  type SeededStaff,
} from "./helpers";

/**
 * The staff half of the money path, which had no browser coverage at all.
 *
 * Everything a traveler does after paying was already covered in account.spec.ts, up to and
 * including asking to cancel. What happens next — staff opening the booking, cancelling it,
 * issuing the refund, and the credit going back on the balance — only ever ran by hand. The
 * database invariant behind the last of those has a pgTAP test
 * (supabase/tests/credit_restore.test.sql); nothing exercised it through the product, which is
 * where the trigger is actually reached from.
 *
 * Roles are granted with the service role because `user_roles` is admin-managed under RLS. That is
 * the point rather than a shortcut: a test that could grant itself a role through the product would
 * be proving a hole exists. Signing in still goes through the real form.
 */
test.describe("operations", () => {
  test.skip(!canSeedBookings(), "needs SUPABASE_SERVICE_ROLE_KEY to seed staff and bookings");

  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  // ── The gate ───────────────────────────────────────────────────────────────

  test("/admin is shut to visitors and to signed-in travelers alike", async ({ page, request }) => {
    // Not signed in: sent to the sign-in page carrying where they were going. Redirects are not
    // followed on purpose — following one lands on /login, which answers 200 and would have made
    // this pass whatever the gate did.
    const anon = await request.get("/admin", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(anon.status());
    expect(anon.headers()["location"]).toContain("/login");
    expect(decodeURIComponent(anon.headers()["location"] ?? "")).toContain("next=/admin");

    // Signed in with no staff role is a different answer, and it must not be the sign-in page:
    // bouncing a signed-in traveler to /login would loop forever.
    await signUp(page, uniqueEmail("outsider"));
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await page.goto("/admin/bookings");
    await expect(page).toHaveURL(/\/no-access/);
    await expect(page.getByRole("main")).not.toContainText(/confirmation/i);
  });

  // ── Finding the booking ────────────────────────────────────────────────────

  test.describe("with a confirmed booking on the books", () => {
    let booked: SeededBooking;
    let staff: SeededStaff;

    test.beforeAll(async () => {
      [booked, staff] = await Promise.all([
        seedConfirmedBooking({ emailPrefix: "ops" }),
        seedStaff(["admin"], "ops.admin"),
      ]);
    });

    test.afterAll(async () => {
      if (booked) await cleanUp(booked);
      if (staff) await removeUser(staff.userId);
    });

    test("staff find a booking by its confirmation number", async ({ page }) => {
      await signIn(page, staff.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });

      await page.goto("/admin/bookings");
      await page.getByLabel(/confirmation/i).fill(booked.confirmationNumber);
      await page.getByRole("button", { name: /filter/i }).click();

      await page.getByRole("link", { name: booked.confirmationNumber }).click();
      await page.waitForURL(new RegExp(`/admin/bookings/${booked.bookingId}`), { timeout: 30_000 });

      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { name: booked.confirmationNumber })).toBeVisible();
      // The things staff actually open a booking for: who is travelling, and the money.
      await expect(main).toContainText("Seeded Traveler");
      await expect(main).toContainText(/\$[\d,]+/);
    });

    test("a booking is not visible to a signed-in traveler without a role", async ({ page }) => {
      // The same URL, one ordinary account later. The gate decides this, not the nav.
      await signUp(page, uniqueEmail("curious"));
      await page.waitForURL(/\/account/, { timeout: 30_000 });
      await page.goto(`/admin/bookings/${booked.bookingId}`);
      await expect(page).toHaveURL(/\/no-access/);
      await expect(page.getByRole("main")).not.toContainText(booked.confirmationNumber);
    });
  });

  // ── Cancelling, which is where the money moves ─────────────────────────────

  test("cancelling a booking refunds at the policy rate, and says which rate", async ({ page }) => {
    const booked = await seedConfirmedBooking({ emailPrefix: "cancelled.by.ops" });
    const staff = await seedStaff(["admin"], "ops.cancels");
    try {
      await confirmDialogs(page);
      await signIn(page, staff.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });
      await page.goto(`/admin/bookings/${booked.bookingId}`);

      const cancel = cancelSection(page);
      // The percentage is on screen before staff commit, the same way it is for the traveler.
      await expect(cancel).toContainText(/%\s*refund/i);
      await cancel.getByRole("textbox").fill("E2E: traveler asked to cancel.");
      await cancel.getByRole("button", { name: /cancel booking/i }).click();

      // The flash names the rate that was applied. It reads the departure's own policy, so
      // asserting a particular number would only be asserting the seed.
      const main = page.getByRole("main");
      await expect(main).toContainText(/cancelled with a \d+% refund/i, { timeout: 20_000 });

      // Cancelled is now a state of the booking, not just a message about it.
      await expect(main.getByRole("heading", { name: "Cancelled" })).toBeVisible();
      // And the form is gone, so the second cancel that would double-refund cannot be submitted.
      await expect(main.getByRole("button", { name: /cancel booking/i })).toHaveCount(0);

      // What the traveler sees. A cancelled booking leaves the live list rather than sitting there
      // looking bookable.
      await switchUser(page, booked.email);
      await expect(page.getByRole("main")).toContainText(/past and cancelled/i);
    } finally {
      await cleanUp(booked);
      await removeUser(staff.userId);
    }
  });

  test("cancelling gives back the credit the traveler spent on the trip", async ({ page }) => {
    // $150 of credit, granted before booking so the quote spends it the way it would for anyone.
    // Credit is not part of `amount_paid`, so the refund percentage never touches it: it comes back
    // whole, because it was a discount on a future trip rather than money. That rule lives in a
    // trigger; this is the only test that reaches it the way production does.
    const booked = await seedConfirmedBooking({ emailPrefix: "credited", creditMinor: 15_000 });
    const staff = await seedStaff(["admin"], "ops.credit");
    try {
      await confirmDialogs(page);
      await signIn(page, booked.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });

      // Spent: the grant and the redemption net to nothing, so there is no balance to show.
      await expect(creditAvailable(page)).toHaveText(/none yet/i);

      await switchUser(page, staff.email);
      await page.goto(`/admin/bookings/${booked.bookingId}`);
      const cancel = cancelSection(page);
      await cancel.getByRole("textbox").fill("E2E: checking the credit comes back.");
      await cancel.getByRole("button", { name: /cancel booking/i }).click();
      await expect(page.getByRole("main")).toContainText(/cancelled with a \d+% refund/i, {
        timeout: 20_000,
      });

      // Back on the balance in full, not at the refund tier.
      await switchUser(page, booked.email);
      await expect(creditAvailable(page)).toContainText(/\$150/);
    } finally {
      await cleanUp(booked);
      await removeUser(staff.userId);
    }
  });

  test("a traveler's cancellation request reaches staff, and the decision is recorded", async ({
    page,
  }) => {
    const booked = await seedConfirmedBooking({ emailPrefix: "requests" });
    const staff = await seedStaff(["trip_staff"], "ops.resolves");
    const reason = "E2E: a reason staff have to be able to read.";
    try {
      await confirmDialogs(page);
      await signIn(page, booked.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });
      await page
        .getByText(/need to cancel this booking/i)
        .first()
        .click();
      const panel = page.locator(`#cancel-${booked.bookingId}`);
      await panel.getByRole("textbox").fill(reason);
      await panel.getByRole("button", { name: /request cancellation/i }).click();
      await expect(page.getByRole("main")).toContainText(/pending|requested|received|withdraw/i, {
        timeout: 20_000,
      });

      await switchUser(page, staff.email);
      await page.goto(`/admin/bookings/${booked.bookingId}`);

      // The traveler's own words, not a status code: staff decide on what was actually said.
      const request = page.locator("#cancellation");
      await expect(request).toContainText(reason);
      await expect(request).toContainText(/pending/i);
      await expect(request).toContainText(/%\s*refund/i);

      // Approving is deliberately separate from cancelling, so money and ticket cannot move on one
      // click. Cancel first, which is what the copy on the page tells staff to do.
      const cancel = cancelSection(page);
      await cancel.getByRole("textbox").fill("E2E: approving the traveler's request.");
      await cancel.getByRole("button", { name: /cancel booking/i }).click();
      await expect(page.getByRole("main")).toContainText(/cancelled with a \d+% refund/i, {
        timeout: 20_000,
      });

      await page
        .locator("#cancellation")
        .getByRole("button", { name: /mark approved/i })
        .click();
      await expect(page.getByRole("main")).toContainText(/request approved/i, { timeout: 20_000 });
      await expect(page.locator("#cancellation")).not.toContainText(/pending/i);
    } finally {
      await cleanUp(booked);
      await removeUser(staff.userId);
    }
  });

  // ── Who is allowed to touch the money ──────────────────────────────────────

  test("trip staff can cancel but cannot move money; finance can do both", async ({ page }) => {
    const booked = await seedConfirmedBooking({ emailPrefix: "roles" });
    const ops = await seedStaff(["trip_staff"], "ops.tripstaff");
    const finance = await seedStaff(["finance"], "ops.finance");
    try {
      await signIn(page, ops.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });
      await page.goto(`/admin/bookings/${booked.bookingId}`);

      // Ops can cancel — that is their job — but the two controls that decide amounts are finance's.
      await expect(
        cancelSection(page).getByRole("button", { name: /cancel booking/i }),
      ).toBeVisible();
      await expect(page.getByLabel(/override refund/i)).toHaveCount(0);
      await expect(page.getByLabel(/off-platform payment/i)).toHaveCount(0);

      await switchUser(page, finance.email);
      await page.goto(`/admin/bookings/${booked.bookingId}`);
      await expect(page.getByLabel(/override refund/i)).toBeVisible();
      await expect(page.getByLabel(/off-platform payment/i)).toBeVisible();
    } finally {
      await cleanUp(booked);
      await removeUser(ops.userId);
      await removeUser(finance.userId);
    }
  });

  test("a refund override from someone who is not finance is refused by the server", async ({
    page,
  }) => {
    // The field is hidden from ops, so this posts it anyway. Hiding a control is not a permission
    // check, and the only way to know the server has one is to send what the UI would not.
    const booked = await seedConfirmedBooking({ emailPrefix: "override" });
    const ops = await seedStaff(["trip_staff"], "ops.override");
    try {
      await confirmDialogs(page);
      await signIn(page, ops.email);
      await page.waitForURL(/\/account/, { timeout: 30_000 });
      await page.goto(`/admin/bookings/${booked.bookingId}`);

      const cancel = cancelSection(page);
      await cancel.getByRole("textbox").fill("E2E: trying a 100% refund without finance.");
      await cancel.locator("form").evaluate((form: HTMLFormElement) => {
        const injected = document.createElement("input");
        injected.name = "refundPercentageOverride";
        injected.value = "100";
        form.append(injected);
      });
      await cancel.getByRole("button", { name: /cancel booking/i }).click();

      const main = page.getByRole("main");
      await expect(main).toContainText(/only finance or admin/i, { timeout: 20_000 });
      // Refused means refused: the booking is still live, not cancelled at some other rate.
      await expect(main.getByRole("heading", { name: "Cancelled" })).toHaveCount(0);
    } finally {
      await cleanUp(booked);
      await removeUser(ops.userId);
    }
  });
});

/** The "Cancel booking" panel. Admin sections are plain <section>s titled by an <h2>. */
function cancelSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Cancel booking" }),
  });
}

/** The balance on the referral card, which is the only place a traveler sees their credit. */
function creditAvailable(page: Page) {
  return page.locator("dt", { hasText: "Credit available" }).locator("+ dd");
}
