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

  test("race viewing is one choice per traveler, not several", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const raceOptions = page.getByTestId("race-options");
    await expect(raceOptions).toBeVisible();
    const choices = raceOptions.getByRole("checkbox");
    expect(await choices.count()).toBeGreaterThan(1);

    await choices.first().check();
    await expect(choices.first()).toBeChecked();

    await choices.nth(1).check();
    await expect(choices.nth(1)).toBeChecked();
    // The tier group is mutually exclusive: choosing a second view drops the first.
    await expect(choices.first()).not.toBeChecked();
  });

  test("an extra outside the race group stacks on top of one inside it", async ({ page }) => {
    const read = total(page);
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const race = page.getByTestId("race-options").getByRole("checkbox").first();
    await race.check();
    await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(0);
    const withRace = await read();

    await page.getByTestId("step-continue").first().click();
    await expect(page.getByRole("heading", { name: /what do you want to add/i })).toBeVisible();
    const extras = page.getByTestId("experiences-options").getByRole("checkbox");
    if (!(await extras.count())) test.skip(true, "this departure has no non-exclusive extras");
    await extras.first().check();

    await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(withRace);
  });

  test("the summary names what was chosen, not just a number", async ({ page }) => {
    await page.getByTestId("step-continue").first().click();
    await page.getByTestId("step-continue").first().click();

    const raceOptions = page.getByTestId("race-options");
    const firstTitle = await raceOptions.getByRole("article").first().locator("h3").innerText();
    await raceOptions.getByRole("checkbox").first().check();

    // What a traveler is buying has to be named in the summary, not only priced.
    await expect(page.getByTestId("order-summary").first()).toContainText(firstTitle.trim(), {
      timeout: 15_000,
    });
  });
});
