import { describe, expect, it } from "vitest";
import bookingFixture from "../__fixtures__/duffel-booking.json";
import quoteFixture from "../__fixtures__/duffel-quote.json";
import ratesFixture from "../__fixtures__/duffel-rates.json";
import searchFixture from "../__fixtures__/duffel-search.json";
import type { HotelSearchInput } from "../types";
import {
  DuffelSupplier,
  normalizeHotel,
  normalizeQuote,
  normalizeResultRates,
  policyFromTimeline,
} from "./duffel";
import { HotelSupplierError, withTimeout } from "./shared";

const HOTEL_ID = "11111111-1111-4111-8111-111111111111";
const ACC = "acc_0000AbCdEfGhIjKlMnOpQs";
const input: HotelSearchInput = {
  hotelIds: [HOTEL_ID],
  supplierHotelIds: { [HOTEL_ID]: ACC },
  checkIn: "2027-06-03",
  checkOut: "2027-06-07",
  adults: 2,
  currency: "EUR",
};

/** A fetch stub that answers by path so search → rates → quote → book → cancel runs offline. */
function fakeFetch(overrides: Record<string, () => Response> = {}): typeof fetch {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    const path = new URL(href).pathname;
    if (overrides[path]) return overrides[path]!();
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Duffel-Version")).toBe("v2");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test_token");
    if (path === "/stays/search") return json(searchFixture);
    if (path.endsWith("/actions/fetch_all_rates")) return json(ratesFixture);
    if (path === "/stays/quotes") return json(quoteFixture);
    if (path === "/stays/bookings") return json(bookingFixture);
    if (path.endsWith("/actions/cancel"))
      return json({
        data: { ...bookingFixture.data, status: "cancelled", cancelled_at: "2026-09-09T10:00:00Z" },
      });
    return json({ errors: [{ code: "not_found", message: "no route" }] }, 404);
  }) as typeof fetch;
}

describe("Duffel normalisation", () => {
  it("normalises an accommodation into a Guideless hotel", () => {
    const result = searchFixture.data.results[0]!;
    const hotel = normalizeHotel(result.accommodation);
    expect(hotel).toMatchObject({
      supplier: "duffel",
      supplierHotelId: ACC,
      name: "Hôtel du Port Nice",
      city: "Nice",
      countryCode: "FR",
      starRating: 3,
      latitude: 43.6963,
    });
    expect(hotel.images).toEqual(["https://assets.example.test/port-1.jpg"]);
    expect(hotel.amenities).toEqual([]);
  });

  it("flattens rooms × rates into normalised rates with minor units, refundability and board", () => {
    const rates = normalizeResultRates(ratesFixture.data as never, input);
    expect(rates).toHaveLength(3);
    const flex = rates.find((r) => r.supplierRateId === "rat_0000AbCdEfGhIjKlMnOpQt")!;
    expect(flex).toMatchObject({
      supplier: "duffel",
      supplierHotelId: ACC,
      roomName: "Classic Double Room",
      occupancy: { adults: 2, children: 0 },
      checkIn: "2027-06-03",
      checkOut: "2027-06-07",
      currency: "EUR",
      netAmount: 110000,
      taxesAmount: 8000,
      feesAmount: 0,
      totalAmount: 118000,
      refundable: true,
      breakfastIncluded: true,
      paymentType: "pay_now",
      available: true,
    });
    expect(flex.bedType).toBeDefined();
    expect(flex.cancellationPolicy.deadline).toBe("2027-05-31T22:00:00Z");
    // After the free deadline the next step refunds 590.00 → penalty is the rest.
    expect(flex.cancellationPolicy.penaltyAmount).toBe(118000 - 59000);

    const nonRefundable = rates.find((r) => r.supplierRateId === "rat_0000AbCdEfGhIjKlMnOpQu")!;
    expect(nonRefundable.refundable).toBe(false);
    expect(nonRefundable.cancellationPolicy).toEqual({ description: "Non-refundable" });
    expect(nonRefundable.breakfastIncluded).toBe(false);
    expect(nonRefundable.available).toBe(false);

    const halfBoard = rates.find((r) => r.supplierRateId === "rat_0000AbCdEfGhIjKlMnOpQv")!;
    expect(halfBoard.breakfastIncluded).toBe(true);
    expect(halfBoard.paymentType).toBe("pay_at_property");
    expect(halfBoard.totalAmount).toBe(154000);
    expect(halfBoard.cancellationPolicy.penaltyAmount).toBe(154000);
  });

  it("normalises a quote as the re-priced rate and keeps the quote id for booking", () => {
    const rate = normalizeQuote(quoteFixture.data as never, "rat_0000AbCdEfGhIjKlMnOpQt");
    expect(rate.totalAmount).toBe(121000);
    expect(rate.netAmount).toBe(113000);
    expect(rate.refundable).toBe(true);
    expect(rate.expiresAt).toBe("2026-09-08T14:30:00Z");
    expect(rate.raw).toMatchObject({ quoteId: "quo_0000AbCdEfGhIjKlMnOpQw" });
  });

  it("treats a partial-refund-only timeline as non-refundable with a penalty", () => {
    const { policy, refundable } = policyFromTimeline(
      [{ before: "2027-06-01T22:00:00Z", refund_amount: "500.00", currency: "EUR" }],
      118000,
      "EUR",
    );
    expect(refundable).toBe(false);
    expect(policy).toMatchObject({ deadline: "2027-06-01T22:00:00Z", penaltyAmount: 68000 });
  });
});

describe("DuffelSupplier", () => {
  const supplier = new DuffelSupplier({ token: "test_token", fetchImpl: fakeFetch() });

  it("searches, fetches rates, rechecks, books and cancels through the documented endpoints", async () => {
    const hotels = await supplier.searchHotels(input);
    expect(hotels.map((h) => h.name)).toEqual(["Hôtel du Port Nice"]);
    expect(await supplier.searchHotels({ ...input, supplierHotelIds: {} })).toEqual([]);

    const rates = await supplier.getRates({ ...input, supplierHotelId: ACC });
    expect(rates).toHaveLength(3);

    const rechecked = await supplier.recheckRate("rat_0000AbCdEfGhIjKlMnOpQt");
    expect(rechecked?.totalAmount).toBe(121000);

    const booking = await supplier.book({
      supplierRateId: "rat_0000AbCdEfGhIjKlMnOpQt",
      guests: [{ firstName: "Alice", lastName: "Martin", isLead: true }],
      contact: { email: "alice@example.com" },
    });
    expect(booking).toMatchObject({
      supplierBookingId: "bok_0000AbCdEfGhIjKlMnOpQx",
      confirmationNumber: "GL7Q2M",
      status: "confirmed",
    });

    const cancelled = await supplier.cancel("bok_0000AbCdEfGhIjKlMnOpQx");
    expect(cancelled.cancelled).toBe(true);
  });

  it("returns null when a quote 404s and typed errors otherwise", async () => {
    const notFound = new DuffelSupplier({
      token: "test_token",
      fetchImpl: fakeFetch({
        "/stays/quotes": () =>
          new Response(
            JSON.stringify({ errors: [{ code: "not_found", message: "rate expired" }] }),
            {
              status: 404,
            },
          ),
      }),
    });
    expect(await notFound.recheckRate("rat_gone")).toBeNull();

    const limited = new DuffelSupplier({
      token: "test_token",
      fetchImpl: fakeFetch({
        "/stays/search": () =>
          new Response(JSON.stringify({ errors: [{ message: "slow down" }] }), { status: 429 }),
      }),
    });
    await expect(limited.searchHotels(input)).rejects.toMatchObject({
      name: "HotelSupplierError",
      supplier: "duffel",
      code: "rate_limited",
      retryable: true,
    } satisfies Partial<HotelSupplierError>);
  });

  it("surfaces an abort as a retryable timeout error", async () => {
    await expect(
      withTimeout(
        "duffel",
        20,
        (signal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    ).rejects.toMatchObject({ name: "HotelSupplierError", code: "timeout", retryable: true });
  });
});
