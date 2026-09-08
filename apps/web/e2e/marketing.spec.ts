import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test("home renders the promise and primary navigation", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Travel with a plan.");
    await expect(page.getByRole("heading", { name: /plan every damn thing/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /in your pocket/i })).toBeVisible();
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
    const build = page.getByRole("link", { name: /build my trip/i }).first();
    await expect(build).toBeVisible();
    await expect(build).toHaveAttribute("href", /\/build\?departure=/);
  });

  test("tour page offers stay tiers, add-ons and the night-one anchor", async ({ page }) => {
    await page.goto("/tours/southern-france");
    await expect(page.getByTestId("base-includes")).toContainText("Add only what you want.");
    await expect(page.getByTestId("compare-block")).toContainText("Traditional group tour");
    await expect(page.getByRole("heading", { name: /pick your tier/i })).toBeVisible();
    await expect(page.getByTestId("stay-tiers")).toContainText("Well-located hotels");
    await expect(page.getByTestId("experience-options")).toContainText(
      "Boat day along the Riviera",
    );
    await expect(page.getByText(/your own room is the default/i)).toBeVisible();
    await expect(page.getByTestId("add-later")).toContainText(/add experiences later/i);
    await expect(page.getByTestId("anchor-callout")).toContainText("Welcome drinks");
    await expect(page.getByText(/friend.s code/i)).toBeVisible();
  });

  test("event tour shows the event hero, both stay tiers and Event structured data", async ({
    page,
  }) => {
    await page.goto("/tours/monaco-grand-prix");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Monaco Grand Prix Weekend");
    await expect(page.getByTestId("event-hero")).toContainText("Circuit de Monaco");
    const build = page.getByRole("link", { name: /build my trip/i }).first();
    await expect(build).toBeVisible();
    await expect(build).toHaveAttribute("href", /\/tours\/monaco-grand-prix\/build\?departure=/);
    await expect(page.getByTestId("compare-block")).toContainText(/traditional .* package/i);
    await expect(page.getByRole("heading", { name: /how you watch/i })).toBeVisible();
    const stays = page.getByTestId("stay-tiers");
    await expect(stays).toContainText("Nice, near the port");
    await expect(stays).toContainText("Monaco, Monte Carlo");
    await expect(stays).toContainText(/property confirmed at booking/i);
    await expect(stays).not.toContainText("★");
    await expect(page.getByTestId("tier-legend")).toContainText("Explorer");
    await expect(stays.locator("[data-tier='explorer']")).toHaveText("Explorer");
    await expect(stays.locator("[data-tier='elite']")).toHaveText("Elite");
    await expect(page.getByTestId("race-options")).toContainText("Yacht in the harbour (Sun)");
    await expect(page.getByTestId("race-options")).toContainText("Most popular");
    await expect(page.getByTestId("race-options").locator("[data-tier='classic']")).toHaveText(
      "Classic",
    );
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.flatMap((t) => JSON.parse(t)).map((d: { "@type": string }) => d["@type"]);
    expect(types).toEqual(expect.arrayContaining(["TouristTrip", "Event"]));
  });

  test("departure page shows the anonymized roster and when the group opens", async ({ page }) => {
    await page.goto("/tours/monaco-grand-prix");
    await page.getByRole("link", { name: "Details" }).first().click();
    await expect(page).toHaveURL(/\/departures\//);
    const roster = page.getByTestId("roster-strip");
    await expect(roster).toContainText("Your Group");
    await expect(roster).toContainText(/group opens on|group is open/i);
    await expect(page.getByRole("heading", { name: /make it yours/i })).toBeVisible();
    await expect(page.getByText("Paid in full when chosen", { exact: true })).toBeVisible();
  });

  test("city evenings list the seeded New York evening", async ({ page }) => {
    await page.goto("/meetups");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet the group");
    await expect(page.getByRole("heading", { name: "New York" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Guideless Evening · New York" })).toBeVisible();
    await page.getByRole("link", { name: "Guideless Evening · New York" }).click();
    await expect(page).toHaveURL(/\/meetups\//);
    await expect(page.getByRole("button", { name: /I.ll be there/i })).toBeVisible();
  });

  test("host application submits and thanks the applicant", async ({ page }) => {
    await page.goto("/host");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("travel free");
    await page.locator("#host-name").fill("E2E Host");
    await page.locator("#host-email").fill(`host+${Date.now()}@example.com`);
    await page
      .locator("#host-community")
      .fill("A running club of about forty people who travel together twice a year.");
    await page.locator("#host-size").fill("40");
    await page.getByRole("button", { name: /send application/i }).click();
    await expect(page.getByRole("status")).toContainText(/thank you/i);
  });

  test("marketing pages render with a heading, hero photo and breadcrumb data", async ({
    page,
  }) => {
    for (const path of [
      "/why-guideless",
      "/faq",
      "/contact",
      "/group-travel",
      "/cancellation",
      "/travel-insurance",
      "/about",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    }
    await page.goto("/faq");
    // The header's mobile menu is also a <details>; scope to the page body.
    const first = page.locator("main details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
    await page.goto("/cancellation");
    await expect(page.getByText(/refund of trip price/i).first()).toBeVisible();
  });

  test("terms and privacy are published for Guideless LLC", async ({ page }) => {
    for (const path of ["/terms", "/privacy", "/booking-agreement"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Guideless LLC").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
      await expect(page.getByText(/Version 2026-09/)).toBeVisible();
    }
  });

  test("sitemap and robots are served", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const body = await sitemap.text();
    expect(body).toContain("/tours/southern-france");
    expect(body).toContain("/tours/monaco-grand-prix");
    expect(body).toContain("/meetups");
    expect(body).toContain("/host");
    expect(body).toContain("/terms");
    expect(body).toContain("/privacy");
    expect(body).toContain("/why-guideless");
    expect(body).toContain("/faq");
    expect(body).toContain("/cancellation");
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /checkout/");
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
