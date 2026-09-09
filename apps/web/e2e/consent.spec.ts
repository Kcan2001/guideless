import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

/**
 * The cookie banner, tested on purpose rather than fought incidentally.
 *
 * This suite exists because of a real defect. The banner is `fixed` at the bottom of the viewport,
 * so on a short page it floated over the primary button and intercepted clicks: a visitor could not
 * press "Create account" until they had answered it. Worse, it never showed in CI, because the
 * banner only renders when an analytics tool is configured and CI built without those keys. The
 * workflow now sets a placeholder so this page matches production.
 *
 * No `acceptCookies` here: these tests want the banner.
 */

/**
 * The banner is client-rendered, so counting it the instant a page loads can miss it entirely.
 * Waiting first is the difference between a real skip and a silent one.
 */
async function consentBanner(page: import("@playwright/test").Page) {
  const banner = page.getByRole("dialog", { name: /cookie preferences/i });
  await banner.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  return (await banner.count()) ? banner : null;
}

test.describe("cookie consent", () => {
  test("the banner never blocks the primary action on a page", async ({ page }) => {
    await page.goto("/login");
    const banner = await consentBanner(page);
    if (!banner) test.skip(true, "no analytics configured in this build");
    await expect(banner!).toBeVisible();

    // The regression: this click used to time out with the banner intercepting pointer events.
    await page.getByRole("tab", { name: "Create account" }).click();
    await page.locator("#su-name").fill("Consent Tester");
    await page.locator("#su-email").fill(uniqueEmail("consent"));
    await page.locator("#su-password").fill("Guideless!e2e-2027");
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/account/, { timeout: 30_000 });
  });

  test("answering it puts the choice away and keeps it away", async ({ page }) => {
    await page.goto("/");
    const banner = await consentBanner(page);
    if (!banner) test.skip(true, "no analytics configured in this build");

    await banner!.getByRole("button", { name: /accept analytics/i }).click();
    await expect(banner!).toHaveCount(0);

    // A stored choice survives navigation; asking again on every page would be its own bug.
    await page.goto("/tours");
    await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toHaveCount(0);
  });

  test("essential only is a real choice, not a softer accept", async ({ page }) => {
    await page.goto("/");
    const banner = await consentBanner(page);
    if (!banner) test.skip(true, "no analytics configured in this build");

    await banner!.getByRole("button", { name: /essential only/i }).click();
    await expect(banner!).toHaveCount(0);
    const stored = await page.evaluate(() => window.localStorage.getItem("guideless-consent-v1"));
    expect(stored).toBe("denied");
  });

  test("it does not cover the sign-in form it bounces staff to", async ({ page }) => {
    // /admin sends anonymous visitors to sign in, and the banner must not block that form either.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("tab", { name: "Password" }).click();
    await page.locator("#pw-email").fill("staff@example.com");
    await page.locator("#pw-password").fill("not-the-real-password");
    // The click is the assertion: with the banner floating over it, this used to time out.
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("main")).toContainText(/don't match|magic link/i);
  });
});
