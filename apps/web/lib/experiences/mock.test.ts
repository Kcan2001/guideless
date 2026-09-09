import { describe, expect, it } from "vitest";
import { MockExperienceSupplier } from "@/lib/experiences/mock";
import { ExperienceError } from "@/lib/experiences/types";

/**
 * The mock supplier is what the whole pipeline runs on until there is a Viator key to probe, so it
 * is tested like a real integration rather than treated as scaffolding.
 *
 * What is actually being pinned down here is the *contract* — the sequence a real adapter will
 * have to honour. When the Viator adapter is written from probed responses, these are the
 * behaviours it has to reproduce.
 */

const supplier = new MockExperienceSupplier();
const DATE = "2027-05-20";

describe("search", () => {
  it("finds something by what it is", async () => {
    const results = await supplier.search({ query: "food walk" });
    expect(results[0]?.title).toContain("food walk");
  });

  it("matches on the supplier's own category words too", async () => {
    const results = await supplier.search({ query: "wine" });
    expect(results.some((r) => r.title.includes("Châteauneuf"))).toBe(true);
  });

  it("returns everything for an empty query, so browsing works", async () => {
    expect((await supplier.search({})).length).toBeGreaterThan(3);
  });

  it("limits by distance when given a position", async () => {
    // Monaco, tight radius: the Avignon and Paris products must not come back.
    const results = await supplier.search({
      latitude: 43.7314,
      longitude: 7.4207,
      radiusMeters: 20000,
    });
    expect(results.every((r) => !r.title.includes("Seine"))).toBe(true);
    expect(results.some((r) => r.title.includes("Monaco"))).toBe(true);
  });

  it("gives a cost to sanity-check a markup against", async () => {
    const [first] = await supplier.search({ query: "kayak" });
    expect(first?.fromAmount).toBeGreaterThan(0);
    expect(first?.currency).toBe("EUR");
  });
});

describe("options", () => {
  it("prices a product for a date", async () => {
    const options = await supplier.getOptions("mock-exp-nice-food-tour", DATE);
    expect(options).toHaveLength(2);
    expect(options[0]?.travelDate).toBe(DATE);
    expect(options[0]?.netAmount).toBeGreaterThan(0);
  });

  // The hotel work found single-deadline models lose money; the same shape is required here.
  it("returns a cancellation ladder rather than one deadline", async () => {
    const [option] = await supplier.getOptions("mock-exp-nice-food-tour", DATE);
    expect(option?.cancellationPolicy.length).toBeGreaterThan(1);
    expect(option?.cancellationPolicy[0]).toMatchObject({ refundPercentage: 100 });
  });

  it("says when something is unavailable rather than omitting it", async () => {
    const options = await supplier.getOptions("mock-exp-nice-sea-kayak", DATE);
    expect(options.some((o) => !o.available)).toBe(true);
  });

  it("refuses a product it does not have", async () => {
    await expect(supplier.getOptions("nope", DATE)).rejects.toBeInstanceOf(ExperienceError);
  });
});

describe("recheck — the call that stops us selling yesterday's price", () => {
  it("confirms an unchanged price", async () => {
    const fresh = await supplier.recheckOption("mock-exp-nice-food-tour-am", DATE);
    expect(fresh?.netAmount).toBe(6500);
  });

  it("reports a price that moved", async () => {
    const fresh = await supplier.recheckOption("mock-exp-nice-food-tour-pm-drift", DATE);
    expect(fresh?.netAmount).toBe(Math.round(6900 * 1.12));
  });

  // Null, not an empty option: "gone" and "free" must never be confusable.
  it("returns null for an option that has been withdrawn", async () => {
    expect(await supplier.recheckOption("mock-exp-monaco-old-town-pm-gone", DATE)).toBeNull();
  });

  it("returns null for an option it has never heard of", async () => {
    expect(await supplier.recheckOption("made-up", DATE)).toBeNull();
  });
});

describe("book and cancel", () => {
  it("returns a reference the traveler can show on the day", async () => {
    const result = await supplier.book({
      supplierOptionId: "mock-exp-nice-food-tour-am",
      travelDate: DATE,
      travelers: 2,
      leadName: "Sam",
      leadEmail: "sam@example.com",
    });
    expect(result.reference).toMatch(/^MOCK-/);
    expect(result.instructions).toBeTruthy();
  });

  it("refuses to book something withdrawn or sold out", async () => {
    for (const id of [
      "mock-exp-monaco-old-town-pm-gone",
      "mock-exp-nice-sea-kayak-sunset-soldout",
    ]) {
      await expect(
        supplier.book({
          supplierOptionId: id,
          travelDate: DATE,
          travelers: 1,
          leadName: "Sam",
          leadEmail: "sam@example.com",
        }),
      ).rejects.toMatchObject({ code: "sold_out" });
    }
  });

  // What the supplier refunds us is not what we refund a traveler — that follows our own ladder.
  it("does not conflate the supplier's refund with the traveler's", async () => {
    const result = await supplier.cancel("mock-booking-MOCK-TOUR-AM-20270520");
    expect(result.cancelled).toBe(true);
    expect(result.refundAmount).toBeNull();
  });

  it("does not claim to cancel a booking it never made", async () => {
    expect((await supplier.cancel("someone-elses-booking")).cancelled).toBe(false);
  });
});
