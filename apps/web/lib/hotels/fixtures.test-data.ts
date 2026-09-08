import type { NormalizedRate } from "./types";

/**
 * Race-week Monaco style fixtures for the hotel engine tests: four nights, 3–7 June 2027, two
 * adults, prices in USD minor units. Not exported from the app; test-only data.
 */
export const HOTEL = "11111111-1111-4111-8111-111111111111";
export const DESTINATION = "22222222-2222-4222-8222-222222222222";

export function rate(overrides: Partial<NormalizedRate> = {}): NormalizedRate {
  return {
    supplier: "duffel",
    supplierHotelId: "hot_duf_monaco_1",
    supplierRateId: `rat_${Math.random().toString(36).slice(2, 8)}`,
    roomName: "Superior King Room",
    bedType: "King",
    occupancy: { adults: 2, children: 0 },
    checkIn: "2027-06-03",
    checkOut: "2027-06-07",
    currency: "USD",
    netAmount: 3_600_00,
    taxesAmount: 360_00,
    feesAmount: 40_00,
    totalAmount: 4_000_00,
    refundable: true,
    cancellationPolicy: { deadline: "2027-05-20T23:59:00Z" },
    breakfastIncluded: true,
    paymentType: "pay_now",
    available: true,
    ...overrides,
  };
}
