import type {
  HotelBookingContact,
  HotelGuest,
  HotelSearchInput,
  HotelSupplier,
  NormalizedHotel,
  NormalizedRate,
  SupplierBookingResult,
  SupplierCancelResult,
} from "@/lib/hotels/types";
import { asCurrency, asIsoDate, nights } from "@/lib/hotels/normalize";
import fixtures from "../__fixtures__/mock-hotels.json";
import { HotelSupplierError } from "./shared";

/**
 * Deterministic supplier backed by __fixtures__/mock-hotels.json. It presents itself as the
 * `manual` supplier (rates maintained by hand), so admin screens, the cron and tests behave the same
 * on every machine without a Duffel account.
 *
 * Conventions:
 * - totals scale with nights; stays overlapping the fixture's race week are multiplied per hotel;
 * - a rate id ending in `-drift` re-prices 8 % higher on recheck (tests the recheck guard);
 * - a rate id ending in `-gone` is unknown on recheck (rate withdrawn).
 */

interface MockRate {
  id: string;
  currency: string;
  nightlyNet: number;
  taxesPerNight: number;
  feesPerNight: number;
  refundable: boolean;
  refundableUntilDaysBefore?: number;
  breakfastIncluded: boolean;
  paymentType: "pay_now" | "pay_at_property";
  available: boolean;
}
interface MockRoom {
  name: string;
  bedType: string;
  maxAdults: number;
  rates: MockRate[];
}
interface MockHotel {
  supplierHotelId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  starRating: number;
  images: string[];
  raceWeekMultiplier: number;
  rooms: MockRoom[];
}
interface MockFixtures {
  hotels: MockHotel[];
  raceWeek: { from: string; to: string };
}

const data = fixtures as MockFixtures;
const DAY = 86_400_000;
const SUPPLIER = "manual" as const;

function stayNights(checkIn: string, checkOut: string): number {
  const n = nights(asIsoDate(checkIn), asIsoDate(checkOut));
  if (!Number.isFinite(n) || n < 1)
    throw new HotelSupplierError(SUPPLIER, "invalid_request", "check-out must be after check-in");
  return n;
}
function overlapsRaceWeek(checkIn: string, checkOut: string): boolean {
  return checkIn <= data.raceWeek.to && checkOut >= data.raceWeek.from;
}

function findRate(id: string): { hotel: MockHotel; room: MockRoom; rate: MockRate } | null {
  const base = id.replace(/-(drift|gone)$/, "");
  for (const hotel of data.hotels)
    for (const room of hotel.rooms)
      for (const rate of room.rates) if (rate.id === base) return { hotel, room, rate };
  return null;
}

export function mockRateTotal(
  rate: MockRate,
  hotel: MockHotel,
  checkIn: string,
  checkOut: string,
  driftPct = 0,
): { net: number; taxes: number; fees: number; total: number } {
  const n = stayNights(checkIn, checkOut);
  const mult = overlapsRaceWeek(checkIn, checkOut) ? hotel.raceWeekMultiplier : 1;
  const net = Math.round(rate.nightlyNet * n * mult * (1 + driftPct / 100));
  const taxes = rate.taxesPerNight * n;
  const fees = rate.feesPerNight * n;
  return { net, taxes, fees, total: net + taxes + fees };
}

function toHotel(h: MockHotel): NormalizedHotel {
  return {
    supplier: SUPPLIER,
    supplierHotelId: h.supplierHotelId,
    name: h.name,
    address: h.address,
    city: h.city,
    countryCode: h.country,
    latitude: h.latitude,
    longitude: h.longitude,
    starRating: h.starRating,
    images: h.images,
    amenities: [],
  };
}

function toRate(
  hotel: MockHotel,
  room: MockRoom,
  rate: MockRate,
  input: { checkIn: string; checkOut: string; adults: number; children?: number },
  opts: { id?: string; driftPct?: number } = {},
): NormalizedRate {
  const money = mockRateTotal(rate, hotel, input.checkIn, input.checkOut, opts.driftPct ?? 0);
  const deadline = rate.refundable
    ? new Date(
        Date.parse(input.checkIn) - (rate.refundableUntilDaysBefore ?? 1) * DAY,
      ).toISOString()
    : undefined;
  return {
    supplier: SUPPLIER,
    supplierHotelId: hotel.supplierHotelId,
    supplierRateId: opts.id ?? rate.id,
    roomName: room.name,
    bedType: room.bedType,
    occupancy: { adults: input.adults, children: input.children ?? 0 },
    checkIn: asIsoDate(input.checkIn),
    checkOut: asIsoDate(input.checkOut),
    currency: asCurrency(rate.currency),
    netAmount: money.net,
    taxesAmount: money.taxes,
    feesAmount: money.fees,
    totalAmount: money.total,
    refundable: rate.refundable,
    cancellationPolicy: deadline
      ? { deadline, penaltyAmount: money.total, description: `Free cancellation until ${deadline}` }
      : { description: "Non-refundable" },
    breakfastIncluded: rate.breakfastIncluded,
    paymentType: rate.paymentType,
    available: rate.available && input.adults <= room.maxAdults,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    raw: { mock: true },
  };
}

export class MockSupplier implements HotelSupplier {
  readonly id = SUPPLIER;

  async searchHotels(input: HotelSearchInput): Promise<NormalizedHotel[]> {
    stayNights(input.checkIn, input.checkOut);
    const wanted = Object.values(input.supplierHotelIds ?? {});
    return data.hotels
      .filter((h) => wanted.length === 0 || wanted.includes(h.supplierHotelId))
      .map(toHotel);
  }

  async getRates(input: HotelSearchInput & { supplierHotelId: string }): Promise<NormalizedRate[]> {
    const hotel = data.hotels.find((h) => h.supplierHotelId === input.supplierHotelId);
    if (!hotel) return [];
    const out: NormalizedRate[] = [];
    for (const room of hotel.rooms)
      for (const rate of room.rates) out.push(toRate(hotel, room, rate, input));
    return out;
  }

  async recheckRate(supplierRateId: string): Promise<NormalizedRate | null> {
    if (supplierRateId.endsWith("-gone")) return null;
    const hit = findRate(supplierRateId);
    if (!hit) return null;
    const drift = supplierRateId.endsWith("-drift") ? 8 : 0;
    // Recheck has no dates of its own; the mock re-prices the fixture's race-week stay.
    return toRate(
      hit.hotel,
      hit.room,
      hit.rate,
      { checkIn: "2027-06-03", checkOut: "2027-06-07", adults: 2 },
      { id: supplierRateId, driftPct: drift },
    );
  }

  async book(input: {
    supplierRateId: string;
    guests: HotelGuest[];
    contact: HotelBookingContact;
  }): Promise<SupplierBookingResult> {
    const rate = await this.recheckRate(input.supplierRateId);
    if (!rate)
      throw new HotelSupplierError(SUPPLIER, "not_found", "That rate is no longer offered");
    if (!rate.available)
      throw new HotelSupplierError(SUPPLIER, "unavailable", "That room is sold out");
    return {
      supplierBookingId: `mockbok_${input.supplierRateId}_${input.guests.length}`,
      confirmationNumber: `MOCK-${input.supplierRateId.slice(-6).toUpperCase()}`,
      status: "confirmed",
      raw: { mock: true, contact: input.contact.email ? "provided" : "missing" },
    };
  }

  async cancel(supplierBookingId: string): Promise<SupplierCancelResult> {
    return { cancelled: Boolean(supplierBookingId), raw: { mock: true } };
  }
}
