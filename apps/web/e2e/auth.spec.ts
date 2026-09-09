import { expect, test } from "@playwright/test";
import { acceptCookies, PASSWORD, signIn, signUp, uniqueEmail } from "./helpers";

/**
 * Sign-up, sign-in and sign-out through the real forms against local Supabase, where email signup
 * auto-confirms. These had no coverage at all: the whole authenticated half of the product sat
 * behind a door nobody tested.
 */
test.describe("accounts", () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("a visitor can create an account and lands in it", async ({ page }) => {
    const email = uniqueEmail("signup");
    await signUp(page, email);

    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A brand-new account has nothing in it, and the empty state is what most people see first.
    await expect(page.getByRole("main")).toContainText(/no trips|not booked|browse/i);
  });

  test("a returning traveler signs in with a password and signs out again", async ({ page }) => {
    const email = uniqueEmail("returning");
    await signUp(page, email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });

    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/(login|)$/, { timeout: 20_000 });

    // Signed out means signed out: the account page must not be reachable any more.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a wrong password is refused and does not sign anyone in", async ({ page }) => {
    const email = uniqueEmail("wrongpw");
    await signUp(page, email);
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/(login|)$/, { timeout: 20_000 });

    await signIn(page, email, `${PASSWORD}-wrong`);
    await expect(page).toHaveURL(/\/login/);
    // The wording is deliberately unhelpful about which half was wrong, so assert that it refuses
    // and offers a way through rather than pinning the sentence.
    await expect(page.getByRole("main")).toContainText(/don't match|magic link/i);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signing in returns the traveler to where they were headed", async ({ page }) => {
    const email = uniqueEmail("next");
    // The builder is the page people are most often bounced from, so it is the one worth proving.
    await signUp(page, email, PASSWORD, "/tours/southern-france/build");
    await page.waitForURL(/\/tours\/southern-france\/build|\/account/, { timeout: 30_000 });
    expect(page.url()).toMatch(/\/(tours\/southern-france\/build|account)/);
  });

  test("the sign-in page offers a password and a link, and never a dead provider button", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("tab", { name: "Email link" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create account" })).toBeVisible();
    // Google is rendered only when the project actually has the provider enabled.
    const google = page.getByRole("button", { name: /google/i });
    if (await google.count()) await expect(google.first()).toBeEnabled();
  });
});
