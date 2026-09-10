import { describe, expect, it, vi } from "vitest";
import {
  LiteApiSupplier,
  LITEAPI_HOTEL_TYPES,
  ROOMABLE_HOTEL_TYPES,
  policyFromLite,
  toIsoInstant,
} from "./liteapi";
import { cancellationWindows, freeUntil, penaltyAt } from "../cancellation-policy";
import hotelsFixture from "../__fixtures__/liteapi-hotels.json";
import ratesFixture from "../__fixtures__/liteapi-rates.json";
import prebookFixture from "../__fixtures__/liteapi-prebook.json";
import bookingFixture from "../__fixtures__/liteapi-booking.json";
import cancelFixture from "../__fixtures__/liteapi-cancel.json";

/**
 * Every fixture here is a real sandbox response captured by scripts/liteapi-probe.mjs, including a
 * rate with a two-rung cancellation ladder and one that is non-refundable. Nothing was hand-written
 * from documentation, which is the failure mode this adapter exists to avoid.
 */

const KEY = "sand_test_key_not_real";

/** Routes each endpoint to its captured response and records what was asked for. */
function stubFetch(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const impl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const pick = () => {
      for (const [fragment, value] of Object.entries(overrides))
        if (url.includes(fragment)) return value;
      if (url.includes("/data/hotels")) return hotelsFixture;
      if (url.includes("/hotels/rates")) return ratesFixture;
      if (url.includes("/rates/prebook")) return prebookFixture;
      if (url.includes("/rates/book")) return bookingFixture;
      if (url.includes("/bookings/")) return cancelFixture;
      return { data: null };
    };
    return new Response(JSON.stringify(pick()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function supplier(overrides?: Partial<Record<string, unknown>>) {
  const { impl, calls } = stubFetch(overrides);
  return { s: new LiteApiSupplier({ apiKey: KEY, fetchImpl: impl }), calls };
}

const searchInput = {
  hotelIds: ["guideless-hotel-1"],
  supplierHotelIds: { "guideless-hotel-1": "lp2febb" },
  checkIn: "2026-11-08" as const,
  checkOut: "2026-11-11" as const,
  adults: 1,
  currency: "USD" as const,
};

describe("toIsoInstant", () => {
  it("treats a naive GMT timestamp as UTC, because that is what the field says", () => {
    expect(toIsoInstant("2026-11-05 10:00:00", "GMT")).toBe("2026-11-05T10:00:00.000Z");
  });

  it("reads a naive timestamp the same way on every machine", () => {
    // The first version left an unrecognised zone to Date, which parses naive strings in the
    // SERVER's timezone: the same response produced different refund deadlines on a laptop in New
    // York and a runner in UTC. CI caught it. A deadline must not depend on where the code runs.
    for (const zone of ["GMT", "UTC", "Europe/Paris", "", undefined, null]) {
      expect(toIsoInstant("2026-11-05 10:00:00", zone)).toBe("2026-11-05T10:00:00.000Z");
    }
  });

  it("respects an offset the supplier actually sent", () => {
    expect(toIsoInstant("2026-11-05T10:00:00+02:00", "GMT")).toBe("2026-11-05T08:00:00.000Z");
  });

  it("returns null rather than an Invalid Date", () => {
    expect(toIsoInstant("not a time", "GMT")).toBeNull();
    expect(toIsoInstant("", "GMT")).toBeNull();
  });
});

describe("policyFromLite", () => {
  it("maps cancelPolicyInfos straight onto our ladder", () => {
    const { policy, refundable } = policyFromLite(
      {
        refundableTag: "RFN",
        cancelPolicyInfos: [
          { cancelTime: "2036-10-23 10:00:00", amount: 372.49, timezone: "GMT", type: "amount" },
          { cancelTime: "2036-10-08 10:00:00", amount: 186.25, timezone: "GMT", type: "amount" },
        ],
      },
      37249,
    );
    expect(cancellationWindows(policy).map((w) => w.penaltyAmount)).toEqual([18625, 37249]);
    expect(freeUntil(policy)).toBe("2036-10-08T10:00:00.000Z");
    expect(refundable).toBe(true);
  });

  it("gives a non-refundable rate a window from the epoch, not a free period it never had", () => {
    const { policy, refundable } = policyFromLite(
      { refundableTag: "NRFN", cancelPolicyInfos: [] },
      37239,
    );
    expect(refundable).toBe(false);
    expect(penaltyAt(policy, "2020-01-01T00:00:00Z")).toBe(37239);
    expect(policy.description).toBe("Non-refundable");
  });

  it("does not call a rate refundable when its free window has already passed", () => {
    const { refundable } = policyFromLite(
      {
        refundableTag: "RFN",
        cancelPolicyInfos: [{ cancelTime: "2000-01-01 10:00:00", amount: 10, timezone: "GMT" }],
      },
      5000,
    );
    expect(refundable).toBe(false);
  });
});

describe("LiteApiSupplier", () => {
  it("looks properties up by supplier id rather than searching a destination", async () => {
    const { s, calls } = supplier();
    const hotels = await s.searchHotels(searchInput);
    expect(calls[0]!.url).toContain("hotelIds=lp2febb");
    expect(hotels[0]).toMatchObject({ supplier: "liteapi", supplierHotelId: "lp2febb" });
    expect(hotels[0]!.name.length).toBeGreaterThan(0);
  });

  it("returns nothing rather than a destination search when no hotel is mapped", async () => {
    const { s, calls } = supplier();
    const hotels = await s.searchHotels({ ...searchInput, supplierHotelIds: {} });
    expect(hotels).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("normalises rates with money in minor units and the ladder intact", async () => {
    const { s } = supplier();
    const rates = await s.getRates({ ...searchInput, supplierHotelId: "lp2febb" });
    expect(rates.length).toBeGreaterThan(0);
    for (const r of rates) {
      expect(Number.isInteger(r.totalAmount)).toBe(true);
      expect(r.totalAmount).toBeGreaterThan(0);
      expect(r.netAmount + r.taxesAmount).toBe(r.totalAmount);
      expect(r.supplier).toBe("liteapi");
      // The offer id is the handle prebook accepts; a rate id alone cannot be re-priced.
      expect(r.supplierRateId.length).toBeGreaterThan(0);
    }
    const laddered = rates.filter((r) => cancellationWindows(r.cancellationPolicy).length > 1);
    expect(laddered.length).toBeGreaterThan(0);
  });

  // Regression, 2026-09-10. `children` was sent as a COUNT, and LiteAPI wants an array of AGES:
  // every rate request 400'd with "models.Occupancy.Children: []int: decode slice: expect [".
  // The adapter had therefore never fetched a rate in production, and nothing caught it because
  // the fixtures only ever exercised the response side. Assert the request body, not just the reply.
  it("sends occupancy the way LiteAPI parses it: no children key when there are none", async () => {
    const { s, calls } = supplier();
    await s.getRates({ ...searchInput, supplierHotelId: "lp2febb", children: 0 });
    const body = calls.at(-1)!.body as { occupancies: Array<Record<string, unknown>> };
    expect(body.occupancies).toEqual([{ adults: searchInput.adults }]);
    expect(body.occupancies[0]).not.toHaveProperty("children");
  });

  it("sends children as an array of ages, never a count", async () => {
    const { s, calls } = supplier();
    await s.getRates({ ...searchInput, supplierHotelId: "lp2febb", children: 2 });
    const body = calls.at(-1)!.body as { occupancies: Array<{ children?: number[] }> };
    expect(Array.isArray(body.occupancies[0]!.children)).toBe(true);
    expect(body.occupancies[0]!.children).toHaveLength(2);
    for (const age of body.occupancies[0]!.children!) expect(Number.isInteger(age)).toBe(true);
  });

  it("carries the offer expiry through from the response", async () => {
    const { s } = supplier();
    const [rate] = await s.getRates({ ...searchInput, supplierHotelId: "lp2febb" });
    expect(rate!.expiresAt).toBeDefined();
    expect(Date.parse(rate!.expiresAt!)).toBeGreaterThan(Date.now());
  });

  it("rechecks through prebook and keeps the prebook id and drift flags", async () => {
    const { s, calls } = supplier();
    const rate = await s.recheckRate("offer-123");
    expect(calls[0]!.url).toContain("/rates/prebook");
    expect(calls[0]!.body).toMatchObject({ offerId: "offer-123" });
    const raw = rate!.raw as Record<string, unknown>;
    expect(raw.prebookId).toBeTruthy();
    expect(raw).toHaveProperty("priceDifferencePercent");
    expect(raw).toHaveProperty("cancellationChanged");
  });

  it("treats a vanished offer as gone rather than as an outage", async () => {
    const impl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 404, message: "offer not found" } }), {
          status: 404,
        }),
    ) as unknown as typeof fetch;
    const s = new LiteApiSupplier({ apiKey: KEY, fetchImpl: impl });
    await expect(s.recheckRate("stale-offer")).resolves.toBeNull();
  });

  it("prebooks again before booking, because a checkout-time prebook can expire", async () => {
    const { s, calls } = supplier();
    const result = await s.book({
      supplierRateId: "offer-123",
      guests: [{ firstName: "Kyle", lastName: "Tester", isLead: true }],
      contact: { email: "traveler@example.com" },
    });
    expect(calls.map((c) => c.url).some((u) => u.includes("/rates/prebook"))).toBe(true);
    expect(calls.map((c) => c.url).some((u) => u.includes("/rates/book"))).toBe(true);
    expect(result.status).toBe("confirmed");
    expect(result.supplierBookingId.length).toBeGreaterThan(0);
  });

  it("sends one guest entry per traveler with sequential occupancy numbers", async () => {
    const { s, calls } = supplier();
    await s.book({
      supplierRateId: "offer-123",
      guests: [
        { firstName: "Kyle", lastName: "Tester", isLead: true },
        { firstName: "Sam", lastName: "Friend" },
      ],
      contact: { email: "traveler@example.com" },
    });
    const bookCall = calls.find((c) => c.url.includes("/rates/book"))!;
    const body = bookCall.body as { guests: Array<{ occupancyNumber: number }> };
    expect(body.guests.map((g) => g.occupancyNumber)).toEqual([1, 2]);
  });

  it("reports what the supplier actually refunded on cancellation", async () => {
    const { s, calls } = supplier();
    const result = await s.cancel("booking-abc");
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toContain("/bookings/booking-abc");
    // The reason this supplier outranked Duffel: Duffel's cancel returns a status and nothing else.
    expect(result).toHaveProperty("refundAmount");
  });

  it("surfaces an unauthorized key as unauthorized, not as an outage", async () => {
    const impl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 401, message: "unauthorized" } }), {
          status: 401,
        }),
    ) as unknown as typeof fetch;
    const s = new LiteApiSupplier({ apiKey: "bad", fetchImpl: impl });
    await expect(s.getRates({ ...searchInput, supplierHotelId: "lp2febb" })).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("filters discovery to property types we can sell as a per-traveler room", async () => {
    const { s, calls } = supplier();
    await s.discoverHotels({
      countryCode: "FR",
      cityName: "Nice",
      hotelTypeIds: ROOMABLE_HOTEL_TYPES,
    });
    expect(calls[0]!.url).toContain(`hotelTypeIds=${LITEAPI_HOTEL_TYPES.hotels}`);
    expect(calls[0]!.url).toContain(String(LITEAPI_HOTEL_TYPES.aparthotels));
    // Whole homes are not a per-traveler room, so they must not be in the default filter.
    expect(ROOMABLE_HOTEL_TYPES).not.toContain(LITEAPI_HOTEL_TYPES.villas);
    expect(ROOMABLE_HOTEL_TYPES).not.toContain(LITEAPI_HOTEL_TYPES.privateVacationHome);
  });
});
