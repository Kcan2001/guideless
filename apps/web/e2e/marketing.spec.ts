import { expect, test } from "@playwright/test";
import { acceptCookies, resetRateLimit } from "./helpers";

test.describe("marketing site", () => {
  // A returning visitor has already answered the cookie banner; consent.spec.ts covers the banner.
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("home renders the promise and primary navigation", async ({ page, isMobile }) => {
    await page.goto("/");
    // The hero headline is page copy, not the brand tagline — it changed with the 2026-09-10
    // reskin and will change again. Assert the shape that has to hold: one h1, naming the product.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/group trips/i);
    // The header sits ON the hero until you scroll past it, which is the whole first impression.
    await expect(page.locator("header.site-header")).not.toHaveAttribute("data-scrolled", "");
    await expect(page.getByRole("heading", { name: /plan every damn thing/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /in your pocket/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /explore trips/i }).first()).toBeVisible();
    if (isMobile) {
      // Small screens collapse the nav into a <details> menu; it must be reachable by keyboard.
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
      await expect(page.getByRole("link", { name: "How it works" }).first()).toBeVisible();
    } else {
      // No desktop nav any more: wordmark, account, and the button. The full list is in the footer.
      await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "How it works" }),
      ).toBeVisible();
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
    // The departure route is server-rendered per request and answers in under three seconds on
    // Vercel. Here, several parallel workers share one local Supabase, so it can exceed the ten
    // second default under contention. Assert that the navigation happens, not how fast a
    // contended local stack renders it.
    await expect(page).toHaveURL(/\/departures\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /payment schedule/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /cancellation policy/i })).toBeVisible();
    // Assert that tiers render, not which percentages they hold: those are a commercial decision
    // that changes per departure in admin, and a test that pins them breaks on every price review.
    await expect(page.getByText(/^\d{1,3}%$/).first()).toBeVisible();
    await expect(page.getByText(/\d+\+? days before/).first()).toBeVisible();
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
    // Assert the ladder's SHAPE, not which hotels are in it: tier names and properties are
    // supplier data that changes with every reprice, and pinning them here is what made this spec
    // fail the moment Monaco was repriced from two tiers to four.
    const stays = page.getByTestId("stay-tiers");
    await expect(page.getByTestId("tier-legend")).toContainText("Explorer");
    await expect(stays.locator("[data-tier='explorer']")).toHaveText("Explorer");
    await expect(stays.locator("[data-tier='elite']")).toHaveText("Elite");
    // Every rung shows a price and how many places are left.
    await expect(stays).toContainText(/places? left|sold out/i);

    // The honesty line lives in the detail sheet now that the cards are condensed, so open one.
    // It is worth asserting because it is the promise we make about not naming an uncontracted
    // hotel, and it would be easy to lose in a redesign.
    // `showModal()` needs the component hydrated, and this page hydrates four carousels and four
    // modals. Clicking once and asserting immediately is a race the test loses on a cold server,
    // so retry the click until the dialog is actually open.
    const sheet = page.getByRole("dialog");
    await expect(async () => {
      await stays
        .getByRole("button", { name: /see the detail/i })
        .first()
        .click();
      await expect(sheet).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    // The tour page explains the price band; the properties are the builder's job. The sheet must
    // say so, because "which hotel?" is the first question this page now declines to answer.
    await expect(sheet).toContainText(/we name a hotel once we hold the rooms/i);
    await sheet.getByRole("button", { name: /close/i }).click();
    // Assert that race viewing renders as priced, tiered options, not which options the catalog
    // holds: the titles and prices are supplier data that changes with every reprice.
    const raceOptions = page.getByTestId("race-options");
    await expect(raceOptions.locator("[data-tier]").first()).toBeVisible();
    await expect(raceOptions).toContainText("per person");
    await expect(raceOptions).toContainText("Most popular");
    await expect(raceOptions.locator("[data-tier='classic']").first()).toHaveText("Classic");
    // Variants of one thing collapse to one card priced From the cheapest. The catalogue holds
    // three Amber Lounge yacht rows; the tour page must show one, and must not quote the dearest.
    await expect(raceOptions).toContainText(/From \$/);
    await expect(raceOptions).toContainText(/ways to do it/i);
    // Exactly one yacht card, not three. Matched on the heading: several nightlife cards mention
    // a superyacht in their copy, and a body-text match would pass for the wrong reason.
    await expect(raceOptions.getByRole("heading", { name: "Yacht", exact: true })).toHaveCount(1);
    // Race viewing is race viewing. The nightlife has six exclusive groups of its own and used to
    // render under "How you watch", which is nine nightclubs answering a question nobody asked.
    await expect(raceOptions).not.toContainText(/Jimmy'z|Sass Caf/i);
    await expect(page.getByTestId("night-options")).toContainText(/Jimmy'z/i);
    // Choosing happens in the builder. No card carries its own call to action.
    await expect(raceOptions.getByRole("link")).toHaveCount(0);
    await expect(stays.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("see-the-rooms")).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.flatMap((t) => JSON.parse(t)).map((d: { "@type": string }) => d["@type"]);
    expect(types).toEqual(expect.arrayContaining(["TouristTrip", "Event"]));
  });

  test("departure page shows the anonymized roster and when the group opens", async ({ page }) => {
    await page.goto("/tours/monaco-grand-prix");
    await page.getByRole("link", { name: "Details" }).first().click();
    // The departure route is server-rendered per request and answers in under three seconds on
    // Vercel. Here, several parallel workers share one local Supabase, so it can exceed the ten
    // second default under contention. Assert that the navigation happens, not how fast a
    // contended local stack renders it.
    await expect(page).toHaveURL(/\/departures\//, { timeout: 30_000 });
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
    // Public forms are rate limited per IP per hour. Correct in production, and it makes this test
    // fail on the seventh local run, so clear the window rather than weaken the assertion.
    await resetRateLimit("host_application");
    await page.goto("/host");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/pay less/i);
    await page.locator("#host-name").fill("E2E Host");
    await page.locator("#host-email").fill(`host+${Date.now()}@example.com`);
    await page
      .locator("#host-community")
      .fill("A running club of about forty people who travel together twice a year.");
    await page.locator("#host-size").fill("40");
    await page.getByRole("button", { name: /send application/i }).click();
    await expect(page.getByRole("status")).toContainText(/thank you/i);
  });

  test("the three explainer pages are one page, and the old URLs still land", async ({
    page,
    isMobile,
  }) => {
    for (const old of ["/why-guideless", "/group-travel"]) {
      const res = await page.goto(old);
      expect(res?.status(), old).toBe(200);
      await expect(page).toHaveURL(/\/how-it-works$/);
    }
    // The header is down to the wordmark and the way in. No desktop nav landmark at all — an empty
    // one would announce "Primary navigation" and then offer nothing.
    if (!isMobile) {
      await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
      await expect(page.locator("header").getByRole("link")).toHaveCount(3);
    }
  });

  test("marketing pages render with a heading, hero photo and breadcrumb data", async ({
    page,
  }) => {
    for (const path of [
      "/how-it-works",
      "/faq",
      "/contact",
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
    for (const path of ["/terms", "/privacy"]) {
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
    expect(body).toContain("/how-it-works");
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
