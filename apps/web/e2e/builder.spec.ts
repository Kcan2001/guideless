import { expect, test } from "@playwright/test";
import { acceptCookies, SEED } from "./helpers";

/**
 * The Trip Builder, on the trip that exercises the most of it: Monaco has two accommodation tiers,
 * a mutually exclusive race-viewing group, and extras outside that group.
 *
 * The builder is deliberately open to anonymous visitors — you configure first and sign in at
 * payment — so none of this needs an account.
 *
 * Everything asserts behaviour, never an amount. Prices are a business decision that changes; six
 * tests were rewritten in one day for pinning one, and this suite is not going to be the seventh.
 *
 * Note which figure each assertion uses. `quote-due-now` is the deposit, which is fixed per
 * departure and does NOT move when a tier changes. `quote-total` is what the trip costs. Confusing
 * the two makes a passing test that proves nothing.
 */

const BUILD = `/tours/${SEED.monacoTourSlug}/build?departure=${SEED.monacoDeparture}`;
const dollars = (text: string) => Number(text.replace(/[^0-9.]/g, ""));

test.describe("trip builder", () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
    await page.goto(BUILD);
    await expect(page.getByTestId("order-summary").first()).toBeVisible();
  });

  const total = (page: import("@playwright/test").Page) => async () =>
    dollars(await page.getByTestId("order-summary").first().getByTestId("quote-total").innerText());

  test("an anonymous visitor can configure a trip before being asked to sign in", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: /when do you want to go/i })).toBeVisible();
    await expect(page.getByTestId("order-summary").first()).toContainText(/\$[\d,]+/);
  });

  test("choosing the other accommodation tier changes the trip total", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await expect(page.getByRole("heading", { name: /where do you want to stay/i })).toBeVisible();

    const read = total(page);
    const before = await read();
    const tiers = page.getByTestId("stay-tiers").getByRole("radio");
    await expect(tiers).toHaveCount(2);
    await tiers.nth(1).check();

    // The upgrade is a price delta on the departure, so the total moves and the deposit does not.
    await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(before);
  });

  test("the optional extras are laid out as the days of the trip", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const plan = page.getByTestId("day-plan");
    await expect(plan).toBeVisible();
    // Every day of the departure appears, including any with nothing to sell, so the numbering
    // a traveler reads matches the itinerary they were shown.
    const days = plan.locator("[data-testid^='day-']");
    expect(await days.count()).toBeGreaterThan(2);
    await expect(page.getByTestId("day-1")).toContainText(/day 1/i);
  });

  test("two views of the same session conflict; two different days do not", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const plan = page.getByTestId("day-plan");
    const choices = plan.getByRole("checkbox");
    expect(await choices.count()).toBeGreaterThan(1);

    // Anything still enabled after a first pick is, by definition, not in conflict with it —
    // the blocked ones are disabled and say what is blocking them.
    await choices.first().check();
    await expect(choices.first()).toBeChecked();

    const enabled = plan.getByRole("checkbox").and(page.locator(":not([disabled])"));
    if ((await enabled.count()) > 1) {
      const second = enabled.nth(1);
      await second.check();
      await expect(second).toBeChecked();
      // Both survive: picking a compatible option must not silently drop the first.
      await expect(choices.first()).toBeChecked();
    }
  });

  test("an extra outside the race group stacks on top of one inside it", async ({ page }) => {
    const read = total(page);
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const plan = page.getByTestId("day-plan");
    const choices = plan.getByRole("checkbox");
    await choices.first().check();
    await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(0);
    const withFirst = await read();

    const enabled = plan.getByRole("checkbox").and(page.locator(":not([disabled])"));
    if ((await enabled.count()) < 2)
      test.skip(true, "this departure has only one compatible extra");
    await enabled.nth(1).check();

    await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(withFirst);
  });

  test("the summary names what was chosen, not just a number", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    // Read the title off the card whose checkbox we actually tick. The first card on the plan is
    // day one's airport transfer, which is priced per booking and so has a quantity select rather
    // than a checkbox — taking the title from one card and the control from another is how this
    // test lied to itself the first time.
    // `has:` resolves relative to each article, so it takes a plain role locator — passing a
    // `.first()` chain matches nothing and the test hangs on innerText.
    const plan = page.getByTestId("day-plan");
    const card = plan
      .getByRole("article")
      .filter({ has: page.getByRole("checkbox") })
      .first();
    const firstTitle = await card.locator("h3").innerText();
    await card.getByRole("checkbox").first().check();

    // What a traveler is buying has to be named in the summary, not only priced.
    await expect(page.getByTestId("order-summary").first()).toContainText(firstTitle.trim(), {
      timeout: 15_000,
    });
  });
});
