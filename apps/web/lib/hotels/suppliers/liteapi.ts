import type {
  CancellationPolicy,
  CancellationWindow,
  HotelBookingContact,
  HotelGuest,
  HotelSearchInput,
  HotelSupplier,
  NormalizedHotel,
  NormalizedRate,
  SupplierBookingResult,
  SupplierCancelResult,
} from "@/lib/hotels/types";
import { asCurrency, asIsoDate, impliesBreakfast, normalizeBedType } from "@/lib/hotels/normalize";
import { HotelSupplierError, SUPPLIER_TIMEOUTS, withTimeout } from "./shared";

/**
 * LiteAPI / Nuitée Connect adapter (https://docs.liteapi.travel).
 *
 * Written against real sandbox responses, not documentation. Every shape below was captured with
 * `scripts/liteapi-probe.mjs` and is frozen in `__fixtures__/liteapi-*.json`, which is what the
 * tests run against. That is deliberate: the Duffel adapter in this directory was written from
 * public docs and has never met a live account, and this is the correction.
 *
 * Flow: /data/hotels → /hotels/rates → /rates/prebook (our recheck) → /rates/book → PUT /bookings.
 *
 * Two things worth knowing before editing:
 *   * amounts are decimal numbers, not strings and not minor units, so everything goes through
 *     `toMinor` on the way in;
 *   * `cancelPolicyInfos` is our ladder almost exactly — `cancelTime` is the moment a penalty
 *     starts applying and `amount` is what it costs — but the timestamps are naive with a separate
 *     timezone field, so they need normalising before they can be compared.
 *
 * Never log the key, guest names or contact details.
 */

const BASE = "https://api.liteapi.travel/v3.0";

/**
 * Age used when we know a child is travelling but not how old they are. LiteAPI prices by age and
 * rejects an occupancy that gives a count instead. Ten is mid-range and errs towards the adult
 * fare, so a quote is never lower than what the traveler is actually charged.
 */
const CHILD_AGE_UNKNOWN = 10;

// ── Wire shapes (subset; optional-heavy because sandbox and production differ) ─
interface LiteMoney {
  amount?: number | null;
  currency?: string | null;
}
interface LiteCancelInfo {
  cancelTime?: string | null;
  amount?: number | null;
  currency?: string | null;
  type?: string | null;
  timezone?: string | null;
}
interface LiteRate {
  rateId?: string | null;
  name?: string | null;
  maxOccupancy?: number | null;
  adultCount?: number | null;
  childCount?: number | null;
  boardType?: string | null;
  boardName?: string | null;
  priceType?: string | null;
  commission?: LiteMoney[] | null;
  retailRate?: {
    total?: LiteMoney[] | null;
    initialPrice?: LiteMoney[] | null;
    suggestedSellingPrice?: Array<LiteMoney & { source?: string | null }> | null;
    taxesAndFees?: Array<
      LiteMoney & { included?: boolean | null; description?: string | null }
    > | null;
  } | null;
  cancellationPolicies?: {
    cancelPolicyInfos?: LiteCancelInfo[] | null;
    refundableTag?: string | null;
    hotelRemarks?: unknown;
  } | null;
  paymentTypes?: string[] | null;
}
interface LiteRoomType {
  roomTypeId?: string | null;
  offerId?: string | null;
  supplier?: string | null;
  rates?: LiteRate[] | null;
  offerRetailRate?: LiteMoney | null;
}
interface LiteRatesEntry {
  hotelId?: string | null;
  roomTypes?: LiteRoomType[] | null;
  /** Seconds the offer stays valid. 10800 in the sandbox. */
  et?: number | null;
}
interface LiteHotel {
  id?: string | null;
  name?: string | null;
  hotelTypeId?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  stars?: number | null;
  main_photo?: string | null;
  thumbnail?: string | null;
  hotelImages?: Array<{ url?: string | null }> | null;
  facilityIds?: number[] | null;
}
interface LitePrebook {
  prebookId?: string | null;
  offerId?: string | null;
  hotelId?: string | null;
  currency?: string | null;
  price?: number | null;
  suggestedSellingPrice?: number | null;
  priceDifferencePercent?: number | null;
  cancellationChanged?: boolean | null;
  boardChanged?: boolean | null;
  roomTypes?: LiteRoomType[] | null;
  paymentTypes?: string[] | null;
  checkin?: string | null;
  checkout?: string | null;
  commission?: number | null;
}
interface LiteBooking {
  bookingId?: string | null;
  supplierBookingId?: string | null;
  hotelConfirmationCode?: string | null;
  status?: string | null;
}
interface LiteCancel {
  bookingId?: string | null;
  cancellation_fee?: number | null;
  refund_amount?: number | null;
  currency?: string | null;
  status?: string | null;
}

/** Property types that are not hotels. Read from /data/hotelTypes with a real key, 2026-09-08. */
export const LITEAPI_HOTEL_TYPES = {
  apartments: 201,
  hostels: 203,
  hotels: 204,
  resorts: 206,
  residences: 207,
  bedAndBreakfasts: 208,
  villas: 213,
  guestHouses: 216,
  aparthotels: 219,
  holidayHomes: 220,
  condos: 229,
  privateVacationHome: 250,
} as const;

/**
 * The types worth selling as a per-traveler room: sold per unit, occupied per person, hotel-style
 * terms. Whole homes are deliberately absent — a three-bedroom villa is one indivisible booking
 * with one cancellation ladder, not three sellable rooms (docs/hotel-provider-audit.md).
 */
export const ROOMABLE_HOTEL_TYPES: readonly number[] = [
  LITEAPI_HOTEL_TYPES.hotels,
  LITEAPI_HOTEL_TYPES.aparthotels,
  LITEAPI_HOTEL_TYPES.residences,
  LITEAPI_HOTEL_TYPES.resorts,
  LITEAPI_HOTEL_TYPES.bedAndBreakfasts,
  LITEAPI_HOTEL_TYPES.guestHouses,
];

/** Decimal major units to integer minor units. LiteAPI sends 368.31, we store 36831. */
function toMinor(amount: number | null | undefined): number {
  return Math.round((amount ?? 0) * 100);
}

/**
 * `cancelTime` is naive ("2026-11-05 10:00:00") with the zone in a sibling field, and every sandbox
 * response so far says GMT.
 *
 * A timestamp with no offset is read as UTC, **always**, including when the zone field says
 * something we do not understand. The first version left those to `Date`, which parses a naive
 * string in the *server's* timezone: the same supplier response produced a different refund
 * deadline on a laptop in New York and on a runner in UTC. A deadline that moves with the machine
 * reading it is worse than one that is occasionally a few hours out, and CI caught it precisely
 * because the two disagreed.
 *
 * We do not carry IANA zones. If a supplier ever sends one, this needs a real zone library rather
 * than a guess, and `hotelRemarks` is where that would surface first.
 */
export function toIsoInstant(cancelTime: string, timezone?: string | null): string | null {
  const raw = cancelTime.trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized);
  const parsed = Date.parse(hasOffset ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * LiteAPI states the penalty that starts applying at each `cancelTime`, which is our ladder without
 * translation. A non-refundable rate arrives with no windows at all, so it gets one opening at the
 * epoch: saying "free until the first window" of a rate that was never refundable would be a lie
 * that costs money.
 */
export function policyFromLite(
  policies: LiteRate["cancellationPolicies"],
  total: number,
): { policy: CancellationPolicy; refundable: boolean } {
  const tag = (policies?.refundableTag ?? "").toUpperCase();
  const infos = policies?.cancelPolicyInfos ?? [];
  const windows: CancellationWindow[] = infos
    .map((i) => {
      const from = i.cancelTime ? toIsoInstant(i.cancelTime, i.timezone) : null;
      return from ? { from, penaltyAmount: toMinor(i.amount) } : null;
    })
    .filter((w): w is CancellationWindow => w !== null)
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));

  if (!windows.length) {
    // NRFN, or a refundable tag with no usable windows, which we treat the same way: charged in full.
    return {
      policy: {
        windows: [{ from: new Date(0).toISOString(), penaltyAmount: total }],
        description: tag === "NRFN" ? "Non-refundable" : "No cancellation window given",
      },
      refundable: false,
    };
  }
  const first = windows[0]!;
  return {
    policy: {
      windows,
      deadline: first.from,
      penaltyAmount: first.penaltyAmount,
      description: `Free cancellation until ${first.from}`,
    },
    refundable: tag !== "NRFN" && Date.parse(first.from) > Date.now(),
  };
}

export function normalizeHotel(hotel: LiteHotel): NormalizedHotel {
  return {
    supplier: "liteapi",
    supplierHotelId: hotel.id ?? "",
    name: hotel.name ?? "Unnamed property",
    address: hotel.address ?? null,
    city: hotel.city ?? null,
    countryCode: hotel.country ? hotel.country.toUpperCase().slice(0, 2) : null,
    latitude: hotel.latitude ?? null,
    longitude: hotel.longitude ?? null,
    starRating: hotel.stars && hotel.stars > 0 ? hotel.stars : null,
    images: [hotel.main_photo, ...(hotel.hotelImages ?? []).map((i) => i?.url)].filter(
      (u): u is string => Boolean(u),
    ),
    // Facilities arrive as numeric ids; without the lookup they would be meaningless strings.
    amenities: [],
  };
}

function normalizeRate(
  rate: LiteRate,
  roomType: LiteRoomType,
  ctx: {
    supplierHotelId: string;
    checkIn: string;
    checkOut: string;
    expiresAt?: string;
    /** The offer id is what prebook and book need; the rate id alone cannot be re-priced. */
    offerId: string;
  },
): NormalizedRate {
  const totalMoney = rate.retailRate?.total?.[0];
  const currency = asCurrency(totalMoney?.currency ?? "USD");
  const total = toMinor(totalMoney?.amount);
  const taxes = (rate.retailRate?.taxesAndFees ?? []).reduce(
    (sum, t) => sum + toMinor(t.amount),
    0,
  );
  // Their `total` already includes taxes flagged `included`, so net is the remainder, never negative.
  const net = Math.max(0, total - taxes);
  const { policy, refundable } = policyFromLite(rate.cancellationPolicies, total);
  const payment = (rate.paymentTypes ?? []).map((p) => p.toUpperCase());
  return {
    supplier: "liteapi",
    supplierHotelId: ctx.supplierHotelId,
    // Offer id, not rate id: this is the handle prebook and book actually accept.
    supplierRateId: ctx.offerId,
    roomName: rate.name ?? "Room",
    bedType: normalizeBedType(rate.name ?? undefined),
    occupancy: { adults: rate.adultCount ?? 1, children: rate.childCount ?? 0 },
    checkIn: asIsoDate(ctx.checkIn),
    checkOut: asIsoDate(ctx.checkOut),
    currency,
    netAmount: net,
    taxesAmount: taxes,
    feesAmount: 0,
    totalAmount: total,
    refundable,
    cancellationPolicy: policy,
    breakfastIncluded:
      impliesBreakfast(rate.boardName ?? undefined) || (rate.boardType ?? "").toUpperCase() !== "RO"
        ? impliesBreakfast(rate.boardName ?? rate.boardType ?? undefined)
        : false,
    paymentType: payment.includes("PROPERTY_PAY") ? "pay_at_property" : "pay_now",
    supplierCommissionAmount: rate.commission?.[0] ? toMinor(rate.commission[0].amount) : undefined,
    available: total > 0,
    expiresAt: ctx.expiresAt,
    raw: { offerId: ctx.offerId, rateId: rate.rateId, roomTypeId: roomType.roomTypeId },
  };
}

export interface LiteApiSupplierOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class LiteApiSupplier implements HotelSupplier {
  readonly id = "liteapi" as const;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: LiteApiSupplierOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? BASE;
  }

  private async call<T>(
    path: string,
    init: { method?: string; body?: unknown; query?: Record<string, string | undefined> },
    timeoutMs: number,
  ): Promise<T> {
    return withTimeout(this.id, timeoutMs, async (signal) => {
      const url = new URL(this.baseUrl + path);
      for (const [k, v] of Object.entries(init.query ?? {}))
        if (v != null) url.searchParams.set(k, v);
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: init.method ?? "GET",
          signal,
          headers: {
            "X-API-Key": this.apiKey,
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
          },
          ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        });
      } catch (err) {
        if (signal.aborted) throw err;
        throw new HotelSupplierError(this.id, "unavailable", "LiteAPI is unreachable", {
          retryable: true,
          cause: err,
        });
      }
      if (!res.ok) throw await this.toError(res);
      const json = (await res.json()) as { data?: T };
      return (json.data ?? (json as unknown)) as T;
    });
  }

  private async toError(res: Response): Promise<HotelSupplierError> {
    let message = `LiteAPI responded ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: number } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep the status message */
    }
    if (res.status === 401 || res.status === 403)
      return new HotelSupplierError(this.id, "unauthorized", message, { status: res.status });
    if (res.status === 404)
      return new HotelSupplierError(this.id, "not_found", message, { status: res.status });
    if (res.status === 429)
      return new HotelSupplierError(this.id, "rate_limited", message, {
        status: res.status,
        retryable: true,
      });
    if (res.status >= 500)
      return new HotelSupplierError(this.id, "unavailable", message, {
        status: res.status,
        retryable: true,
      });
    return new HotelSupplierError(this.id, "invalid_request", message, { status: res.status });
  }

  private supplierIds(input: HotelSearchInput, only?: string): string[] {
    if (only) return [only];
    const map = input.supplierHotelIds ?? {};
    return input.hotelIds.map((id) => map[id]).filter((v): v is string => Boolean(v));
  }

  async searchHotels(input: HotelSearchInput): Promise<NormalizedHotel[]> {
    const ids = this.supplierIds(input);
    if (!ids.length) return [];
    const hotels = await this.call<LiteHotel[]>(
      "/data/hotels",
      { query: { hotelIds: ids.join(",") } },
      SUPPLIER_TIMEOUTS.search,
    );
    return (hotels ?? []).map(normalizeHotel);
  }

  /**
   * Candidate properties in a destination, for curation rather than for a customer. This is the one
   * place we look beyond the curated catalog, and staff approve whatever it returns before any of
   * it becomes bookable (ADR-014).
   */
  async discoverHotels(params: {
    countryCode: string;
    cityName: string;
    hotelTypeIds?: readonly number[];
    limit?: number;
  }): Promise<NormalizedHotel[]> {
    const hotels = await this.call<LiteHotel[]>(
      "/data/hotels",
      {
        query: {
          countryCode: params.countryCode,
          cityName: params.cityName,
          hotelTypeIds: params.hotelTypeIds?.length ? params.hotelTypeIds.join(",") : undefined,
          limit: String(params.limit ?? 25),
        },
      },
      SUPPLIER_TIMEOUTS.search,
    );
    return (hotels ?? []).map(normalizeHotel);
  }

  async getRates(input: HotelSearchInput & { supplierHotelId: string }): Promise<NormalizedRate[]> {
    const entries = await this.call<LiteRatesEntry[]>(
      "/hotels/rates",
      {
        method: "POST",
        body: {
          hotelIds: [input.supplierHotelId],
          // LiteAPI's `children` is an array of AGES, not a count. Sending the count made every
          // rate request 400 with "models.Occupancy.Children: []int: decode slice: expect [",
          // which is why this adapter had never successfully fetched a rate in production. Our
          // contract only carries a number, so an unknown age becomes a placeholder; zero children
          // omits the field entirely, which is what LiteAPI expects.
          occupancies: [
            {
              adults: input.adults,
              ...(input.children && input.children > 0
                ? { children: Array.from({ length: input.children }, () => CHILD_AGE_UNKNOWN) }
                : {}),
            },
          ],
          currency: input.currency,
          guestNationality: "US",
          checkin: input.checkIn,
          checkout: input.checkOut,
        },
      },
      SUPPLIER_TIMEOUTS.quote,
    );
    const out: NormalizedRate[] = [];
    for (const entry of entries ?? []) {
      const expiresAt = entry.et ? new Date(Date.now() + entry.et * 1000).toISOString() : undefined;
      for (const roomType of entry.roomTypes ?? []) {
        if (!roomType.offerId) continue;
        for (const rate of roomType.rates ?? []) {
          out.push(
            normalizeRate(rate, roomType, {
              supplierHotelId: entry.hotelId ?? input.supplierHotelId,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              expiresAt,
              offerId: roomType.offerId,
            }),
          );
        }
      }
    }
    return out;
  }

  /**
   * Prebook is the price check. It also reports whether the cancellation terms moved, which our
   * caller cannot act on yet but which is more than any other supplier we looked at offers.
   */
  async recheckRate(supplierRateId: string): Promise<NormalizedRate | null> {
    let pre: LitePrebook;
    try {
      pre = await this.call<LitePrebook>(
        "/rates/prebook",
        { method: "POST", body: { offerId: supplierRateId, usePaymentSdk: false } },
        SUPPLIER_TIMEOUTS.quote,
      );
    } catch (err) {
      // A stale offer is gone, not an outage: the caller must be able to tell those apart.
      if (err instanceof HotelSupplierError && (err.code === "not_found" || err.status === 404))
        return null;
      throw err;
    }
    const roomType = pre.roomTypes?.[0];
    const rate = roomType?.rates?.[0];
    if (!rate || !pre.prebookId) return null;
    const normalized = normalizeRate(rate, roomType!, {
      supplierHotelId: pre.hotelId ?? "",
      checkIn: pre.checkin ?? "",
      checkOut: pre.checkout ?? "",
      offerId: supplierRateId,
    });
    return {
      ...normalized,
      // The prebook id is what book() needs; keep it where the booking step can find it.
      raw: {
        ...(normalized.raw as Record<string, unknown>),
        prebookId: pre.prebookId,
        priceDifferencePercent: pre.priceDifferencePercent ?? 0,
        cancellationChanged: pre.cancellationChanged ?? false,
        boardChanged: pre.boardChanged ?? false,
      },
    };
  }

  async book(input: {
    supplierRateId: string;
    guests: HotelGuest[];
    contact: HotelBookingContact;
  }): Promise<SupplierBookingResult> {
    // Booking always re-prebooks: an offer id alone is not bookable, and the prebook we did during
    // checkout may have expired while the customer was paying.
    const pre = await this.call<LitePrebook>(
      "/rates/prebook",
      { method: "POST", body: { offerId: input.supplierRateId, usePaymentSdk: false } },
      SUPPLIER_TIMEOUTS.quote,
    );
    if (!pre.prebookId)
      throw new HotelSupplierError(this.id, "not_found", "The rate is no longer available");

    const lead = input.guests.find((g) => g.isLead) ?? input.guests[0];
    if (!lead) throw new HotelSupplierError(this.id, "invalid_request", "No guest given");

    const booking = await this.call<LiteBooking>(
      "/rates/book",
      {
        method: "POST",
        body: {
          prebookId: pre.prebookId,
          holder: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: input.contact.email,
            ...(input.contact.phone ? { phone: input.contact.phone } : {}),
          },
          guests: input.guests.map((g, i) => ({
            occupancyNumber: i + 1,
            firstName: g.firstName,
            lastName: g.lastName,
            email: input.contact.email,
            remarks: "",
          })),
          payment: { method: "ACC_CREDIT_CARD" },
        },
      },
      SUPPLIER_TIMEOUTS.book,
    );
    const status = (booking.status ?? "").toUpperCase();
    return {
      supplierBookingId: booking.bookingId ?? "",
      confirmationNumber: booking.hotelConfirmationCode ?? undefined,
      status: status === "CONFIRMED" ? "confirmed" : status === "FAILED" ? "failed" : "booked",
      raw: { supplierBookingId: booking.supplierBookingId, status: booking.status },
    };
  }

  /** Returns what was actually refunded, which is the reason this supplier ranked above Duffel. */
  async cancel(supplierBookingId: string): Promise<SupplierCancelResult> {
    const result = await this.call<LiteCancel>(
      `/bookings/${encodeURIComponent(supplierBookingId)}`,
      { method: "PUT" },
      SUPPLIER_TIMEOUTS.cancel,
    );
    const status = (result.status ?? "").toUpperCase();
    return {
      cancelled: status === "CANCELLED" || status === "CANCELED",
      refundAmount: result.refund_amount != null ? toMinor(result.refund_amount) : undefined,
      raw: { cancellationFee: result.cancellation_fee, status: result.status },
    };
  }
}
