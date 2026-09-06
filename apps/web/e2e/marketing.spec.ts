import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test("home renders the promise and primary navigation", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Travel organized.");
    await expect(page.getByRole("link", { name: /explore trips/i }).first()).toBeVisible();
    if (isMobile) {
      // Small screens collapse the nav into a <details> menu; it must be reachable by keyboard.
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
      await expect(page.getByRole("link", { name: "How it works" }).first()).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    }
  });

  test("trips list filters by month without JavaScript state", async ({ page }) => {
    await page.goto("/tours");
    await expect(page.getByRole("heading", { level: 1, name: /pick a route/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Southern France — view trip/i })).toBeVisible();

    await page.goto("/tours?month=2028-01");
    await expect(page.getByText(/no trips match/i)).toBeVisible();

    await page.goto("/tours?destination=paris");
    await expect(page.getByRole("status")).toContainText("1 trip matches");
  });

  test("tour detail shows the itinerary, responsibilities and structured data", async ({
    page,
  }) => {
    await page.goto("/tours/southern-france");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Southern France");
    await expect(page.getByRole("heading", { name: /day by day/i })).toBeVisible();
    await expect(page.getByText("Free time").first()).toBeVisible();
    await expect(page.getByText("Guideless handles").first()).toBeVisible();
    await expect(page.getByText("You book").first()).toBeVisible();

    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.flatMap((t) => JSON.parse(t)).map((d: { "@type": string }) => d["@type"]);
    expect(types).toEqual(expect.arrayContaining(["TouristTrip", "FAQPage", "BreadcrumbList"]));

    await expect(page).toHaveTitle(/Southern France/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/tours\/southern-france$/,
    );
  });

  test("unknown tour is a real 404", async ({ page }) => {
    const res = await page.goto("/tours/not-a-trip");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/isn.t on the map/i)).toBeVisible();
  });

  test("departure page exposes price, payment schedule and cancellation tiers", async ({
    page,
  }) => {
    await page.goto("/tours/southern-france");
    await page.getByRole("link", { name: "Details" }).first().click();
    await expect(page).toHaveURL(/\/departures\//);
    await expect(page.getByRole("heading", { name: /payment schedule/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /cancellation policy/i })).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
    await expect(page.getByRole("link", { name: /book this departure/i })).toBeVisible();
  });

  test("sitemap and robots are served", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("/tours/southern-france");
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /checkout/");
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
