import { describe, expect, it } from "vitest";
import type { HotelSearchInput } from "../types";
import { MockSupplier } from "./mock";

const HOTEL_ID = "22222222-2222-4222-8222-222222222222";
const base: Omit<HotelSearchInput, "checkIn" | "checkOut"> = {
  hotelIds: [HOTEL_ID],
  adults: 2,
  currency: "EUR",
};
const raceWeek: HotelSearchInput = { ...base, checkIn: "2027-06-03", checkOut: "2027-06-07" };
const offSeason: HotelSearchInput = { ...base, checkIn: "2027-03-01", checkOut: "2027-03-05" };

describe("MockSupplier", () => {
  const mock = new MockSupplier();

  it("presents as the manual supplier and lists the fixture hotels, filtered by mapping", async () => {
    expect(mock.id).toBe("manual");
    const all = await mock.searchHotels(raceWeek);
    expect(all.map((h) => h.city)).toEqual(["Nice", "Nice", "Monaco"]);
    const one = await mock.searchHotels({
      ...raceWeek,
      supplierHotelIds: { [HOTEL_ID]: "mock_monaco_carlo" },
    });
    expect(one).toHaveLength(1);
    expect(one[0]!.starRating).toBe(5);
    expect(one[0]!.countryCode).toBe("MC");
  });

  it("prices deterministically, scaling by nights and race week", async () => {
    const off = await mock.getRates({ ...offSeason, supplierHotelId: "mock_nice_port" });
    const race = await mock.getRates({ ...raceWeek, supplierHotelId: "mock_nice_port" });
    const flexOff = off.find((r) => r.supplierRateId === "mock_nice_port_classic_flex_bb")!;
    const flexRace = race.find((r) => r.supplierRateId === "mock_nice_port_classic_flex_bb")!;
    // 4 nights × 165.00 net + 4 × 4.00 taxes
    expect(flexOff.totalAmount).toBe(16500 * 4 + 400 * 4);
    expect(flexRace.netAmount).toBe(Math.round(16500 * 4 * 1.6));
    expect(flexRace.totalAmount).toBeGreaterThan(flexOff.totalAmount);
    expect(flexRace.refundable).toBe(true);
    expect(flexRace.breakfastIncluded).toBe(true);
    expect(flexRace.cancellationPolicy.deadline).toBe(
      new Date(Date.parse("2027-06-03") - 3 * 86_400_000).toISOString(),
    );
    const nrf = race.find((r) => r.supplierRateId === "mock_nice_port_classic_nrf_ro")!;
    expect(nrf.refundable).toBe(false);
    expect(nrf.cancellationPolicy).toEqual({ description: "Non-refundable" });
  });

  it("marks sold-out rates and over-occupancy as unavailable", async () => {
    const rates = await mock.getRates({ ...raceWeek, supplierHotelId: "mock_monaco_carlo" });
    expect(
      rates.find((r) => r.supplierRateId === "mock_monaco_carlo_harbour_soldout")!.available,
    ).toBe(false);
    const three = await mock.getRates({
      ...raceWeek,
      adults: 3,
      supplierHotelId: "mock_monaco_carlo",
    });
    expect(three.every((r) => r.available === false)).toBe(true);
  });

  it("rechecks with drift and withdrawal conventions", async () => {
    const same = await mock.recheckRate("mock_nice_port_classic_flex_bb");
    const drift = await mock.recheckRate("mock_nice_port_classic_flex_bb-drift");
    expect(same).not.toBeNull();
    expect(drift!.netAmount).toBe(Math.round(same!.netAmount * 1.08));
    expect(await mock.recheckRate("mock_nice_port_classic_flex_bb-gone")).toBeNull();
    expect(await mock.recheckRate("nonsense")).toBeNull();
  });

  it("books and cancels", async () => {
    const booking = await mock.book({
      supplierRateId: "mock_nice_port_classic_flex_bb",
      guests: [{ firstName: "Alice", lastName: "Martin", isLead: true }],
      contact: { email: "alice@example.com" },
    });
    expect(booking.status).toBe("confirmed");
    expect(booking.confirmationNumber).toMatch(/^MOCK-/);
    await expect(
      mock.book({
        supplierRateId: "mock_monaco_carlo_harbour_soldout",
        guests: [{ firstName: "A", lastName: "B" }],
        contact: { email: "a@b.c" },
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    const cancelled = await mock.cancel(booking.supplierBookingId);
    expect(cancelled.cancelled).toBe(true);
  });
});
