import { expect, test } from "@playwright/test";

const DEPARTURE_ID = "30000000-0000-4000-8000-000000000001"; // seeded May 2027 Southern France

/**
 * Full customer funnel against local Supabase: sign up → wizard → payment step.
 * Without STRIPE_SECRET_KEY the action must refuse before creating any booking or hold.
 */
test("a new customer can sign up and reach the payment step, and is refused cleanly without Stripe", async ({
  page,
}) => {
  const email = `e2e+${Date.now()}@example.com`;

  await page.goto(`/login?next=${encodeURIComponent(`/checkout/${DEPARTURE_ID}`)}`);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.locator("#su-name").fill("E2E Traveler");
  await page.locator("#su-email").fill(email);
  await page.locator("#su-password").fill("guideless2027test");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(new RegExp(`/checkout/${DEPARTURE_ID}`));
  await expect(page.getByRole("heading", { name: /who.s traveling/i })).toBeVisible();
  await expect(page.locator("#t0-email")).toHaveValue(email);

  // Step 2 — travelers
  await page.locator("#t0-first").fill("E2E");
  await page.locator("#t0-last").fill("Traveler");
  await page.locator("#t0-dob").fill("1990-05-14");
  await page.locator("#t0-nat").fill("us");
  await page.locator("#ec-name").fill("Pat Tester");
  await page.locator("#ec-rel").fill("Sibling");
  await page.locator("#ec-phone").fill("+1 415 555 0123");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — rooms & stay (own room by default, default tier preselected)
  await expect(page.getByRole("heading", { name: /rooms and stay/i })).toBeVisible();
  await expect(page.getByText(/Room 1 · own room/)).toBeVisible();
  const summary = page.getByTestId("order-summary");
  await expect(summary.getByTestId("quote-due-now")).toHaveText(/\$750/);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 — add-ons: the seeded boat for the traveler raises today's total by $145
  await expect(page.getByRole("heading", { name: /make it yours/i })).toBeVisible();
  const boat = page.getByRole("article", { name: /boat day along the riviera/i });
  await boat.getByText("E2E", { exact: true }).click();
  await expect(summary.getByTestId("quote-due-now")).toHaveText(/\$895/);
  await expect(summary.getByText("Boat day along the Riviera")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5 — preferences (defaults)
  await expect(page.getByRole("heading", { name: /a few preferences/i })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6 — account (already signed in)
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 7 — terms
  for (const label of [
    "I accept the Terms of Service.",
    "I understand the cancellation policy for this departure.",
    "I understand I am responsible for my own flights, insurance and documents.",
    "I accept the Privacy Policy.",
  ]) {
    await page.getByRole("checkbox", { name: label }).check();
  }
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // Step 8 — review & pay: the add-on is listed
  await expect(page.getByRole("heading", { name: /review and pay/i })).toBeVisible();
  await expect(page.getByText("E2E Traveler")).toBeVisible();
  await expect(page.getByTestId("review-add-ons")).toContainText("Boat day along the Riviera");
  await page.getByRole("button", { name: /continue to secure payment/i }).click();
  await expect(page.getByText(/online payment isn.t switched on yet/i)).toBeVisible();

  // No booking was created: the account page still shows the empty state.
  await page.goto("/account");
  await expect(page.getByText("No trips booked yet.")).toBeVisible();
});

test("protected routes redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});
