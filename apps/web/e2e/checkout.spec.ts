import { expect, test } from "@playwright/test";

const TOUR_SLUG = "southern-france";
const DEPARTURE_ID = "30000000-0000-4000-8000-000000000001"; // seeded May 2027 Southern France
const BUILD = `/tours/${TOUR_SLUG}/build?departure=${DEPARTURE_ID}`;

/**
 * Full customer funnel against local Supabase: sign up → Trip Builder → payment step.
 * Without STRIPE_SECRET_KEY the action must refuse before creating any booking or hold.
 */
test("a new customer can build a trip up to the payment step, and is refused cleanly without Stripe", async ({
  page,
}) => {
  const email = `e2e+${Date.now()}@example.com`;

  await page.goto(`/login?next=${encodeURIComponent(BUILD)}`);
  // The consent banner overlays the bottom of the page until answered; a real visitor answers it once.
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible().catch(() => false)) await consent.click();
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.locator("#su-name").fill("E2E Traveler");
  await page.locator("#su-email").fill(email);
  await page.locator("#su-password").fill("guideless2027test");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(new RegExp(`/tours/${TOUR_SLUG}/build`));
  const summary = page.getByTestId("order-summary").first();
  const next = () => page.getByTestId("step-continue").first().click();

  // Dates: the departure from the link is preselected, one traveler
  await expect(page.getByRole("heading", { name: /when do you want to go/i })).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toBeVisible();
  await expect(summary.getByTestId("quote-due-now")).toHaveText(/\$750/);
  await next();

  // Stay: the default tier is preselected
  await expect(page.getByRole("heading", { name: /where do you want to stay/i })).toBeVisible();
  await expect(page.getByTestId("stay-tiers").getByRole("radio", { checked: true })).toBeVisible();
  await next();

  // Experiences: the seeded boat raises today's total by $145
  await expect(page.getByRole("heading", { name: /what do you want to add/i })).toBeVisible();
  const boat = page.getByRole("article", { name: /boat day along the riviera/i });
  await boat.getByRole("checkbox").check();
  await expect(summary.getByTestId("quote-due-now")).toHaveText(/\$895/);
  await expect(summary.getByText("Boat day along the Riviera")).toBeVisible();
  await next();

  // Transfers (if the departure offers any) — skip through
  if (
    await page
      .getByRole("heading", { name: /get from the airport/i })
      .isVisible()
      .catch(() => false)
  ) {
    await next();
  }

  // Travelers: names, emergency contact, preferences (defaults)
  await expect(page.getByRole("heading", { name: /who.s traveling/i })).toBeVisible();
  await expect(page.locator("#t0-email")).toHaveValue(email);
  await page.locator("#t0-first").fill("E2E");
  await page.locator("#t0-last").fill("Traveler");
  await page.locator("#t0-dob").fill("1990-05-14");
  await page.locator("#t0-nat").fill("us");
  await page.locator("#ec-name").fill("Pat Tester");
  await page.locator("#ec-rel").fill("Sibling");
  await page.locator("#ec-phone").fill("+1 415 555 0123");
  // A friend's trip code is checked live; an unknown one says so and is not applied
  await page.locator("#group-code").fill("NOPE-CODE-99");
  await expect(page.locator("#group-code-status")).toHaveText(/don.t recognise that code/i);
  await page.locator("#group-code").fill("");
  await next();

  // Review: signed in. The draft is saved server-side, so a fresh browser state resumes here.
  await expect(page.getByRole("heading", { name: /almost there/i })).toBeVisible();
  await page.waitForTimeout(2000); // debounced server save
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BUILD);
  await expect(page.getByRole("heading", { name: /almost there/i })).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  for (const label of [
    "I accept the Booking Agreement and the Terms of Service.",
    "I understand the cancellation policy for this departure.",
    "I understand I am responsible for my own flights, insurance and documents.",
    "I accept the Privacy Policy.",
  ]) {
    await page.getByRole("checkbox", { name: label }).check();
  }
  await page.getByRole("button", { name: "Continue to payment" }).first().click();

  // Payment: the extra is listed; without Stripe the action refuses before any hold is created
  await expect(page.getByRole("heading", { name: /review and pay/i })).toBeVisible();
  await expect(page.getByText("E2E Traveler")).toBeVisible();
  await expect(page.getByTestId("review-add-ons")).toContainText("Boat day along the Riviera");
  await page.getByRole("button", { name: /continue to secure payment/i }).click();
  await expect(page.getByText(/online payment isn.t switched on yet/i)).toBeVisible();

  // No booking was created: the account page still shows the empty state.
  await page.goto("/account");
  await expect(page.getByText("No trips booked yet.")).toBeVisible();
});

test("the old checkout URL forwards to the builder", async ({ page }) => {
  await page.goto(`/checkout/${DEPARTURE_ID}?cancelled=1`);
  await expect(page).toHaveURL(
    new RegExp(`/tours/${TOUR_SLUG}/build\\?departure=${DEPARTURE_ID}&cancelled=1`),
  );
});

test("protected routes redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});
