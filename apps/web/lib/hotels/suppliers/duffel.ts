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
import {
  asCurrency,
  asIsoDate,
  impliesBreakfast,
  normalizeBedType,
  toMinorUnits,
} from "@/lib/hotels/normalize";
import { HotelSupplierError, SUPPLIER_TIMEOUTS, withTimeout } from "./shared";

/**
 * Duffel Stays adapter (https://duffel.com/docs/api/v2/stays).
 *
 * Flow: search → fetch all rates for a search result → quote (our "recheck") → booking → cancel.
 * Nothing Duffel-shaped leaves this file: every response is normalised into the Guideless rate and
 * hotel models. Kyle has no Duffel account yet, so field names below follow the public docs and are
 * exercised only against fixtures in __fixtures__/duffel-*.json; anything we were unsure about is
 * read defensively and listed in docs/hotels.md.
 *
 * Never log the token, guest names or contact details.
 */

const BASE = "https://api.duffel.com";
const VERSION = "v2";

// ── Duffel wire shapes (subset, optional-heavy on purpose) ───────────────────
interface DuffelAmount {
  total_amount?: string | null;
  total_currency?: string | null;
  base_amount?: string | null;
  base_currency?: string | null;
  tax_amount?: string | null;
  tax_currency?: string | null;
  fee_amount?: string | null;
  fee_currency?: string | null;
  public_amount?: string | null;
  due_at_accommodation_amount?: string | null;
}
interface DuffelCancellationStep {
  before?: string | null;
  refund_amount?: string | null;
  currency?: string | null;
}
interface DuffelRate extends DuffelAmount {
  id: string;
  board_type?: string | null;
  payment_type?: string | null;
  cancellation_timeline?: DuffelCancellationStep[] | null;
  conditions?: Array<{ title?: string | null; description?: string | null }> | null;
  quantity_available?: number | null;
  available_rooms?: number | null;
  source?: string | null;
  expires_at?: string | null;
}
interface DuffelRoom {
  name?: string | null;
  beds?: Array<{ type?: string | null; count?: number | null }> | null;
  photos?: Array<{ url?: string | null }> | null;
  rates?: DuffelRate[] | null;
}
interface DuffelAccommodation {
  id: string;
  name?: string | null;
  description?: string | null;
  rating?: number | null;
  review_score?: number | null;
  photos?: Array<{ url?: string | null }> | null;
  amenities?: Array<{ type?: string | null; description?: string | null }> | null;
  location?: {
    address?: {
      line_one?: string | null;
      city_name?: string | null;
      postal_code?: string | null;
      country_code?: string | null;
      region?: string | null;
    } | null;
    geographic_coordinates?: { latitude?: number | null; longitude?: number | null } | null;
  } | null;
  rooms?: DuffelRoom[] | null;
}
interface DuffelSearchResult extends DuffelAmount {
  id: string;
  check_in_date?: string | null;
  check_out_date?: string | null;
  rooms?: number | null;
  guests?: Array<{ type: string; age?: number }> | null;
  accommodation: DuffelAccommodation;
  cheapest_rate_total_amount?: string | null;
  cheapest_rate_currency?: string | null;
}
interface DuffelQuote extends DuffelAmount {
  id: string;
  check_in_date?: string | null;
  check_out_date?: string | null;
  rooms?: number | null;
  guests?: Array<{ type: string; age?: number }> | null;
  accommodation: DuffelAccommodation;
  cancellation_timeline?: DuffelCancellationStep[] | null;
  expires_at?: string | null;
}
interface DuffelBooking {
  id: string;
  reference?: string | null;
  status?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  accommodation?: DuffelAccommodation | null;
}
interface DuffelError {
  errors?: Array<{ code?: string; title?: string; message?: string }>;
}

export interface DuffelSupplierOptions {
  token: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class DuffelSupplier implements HotelSupplier {
  readonly id = "duffel" as const;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: DuffelSupplierOptions) {
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? BASE;
  }

  // ── HTTP ───────────────────────────────────────────────────────────────────
  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    return withTimeout(this.id, timeoutMs, async (signal) => {
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Duffel-Version": VERSION,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip",
          },
          body: JSON.stringify({ data: body }),
        });
      } catch (err) {
        if (signal.aborted) throw err;
        throw new HotelSupplierError(this.id, "unavailable", "Duffel is unreachable", {
          retryable: true,
          cause: err,
        });
      }
      if (!res.ok) throw await this.toError(res);
      const json = (await res.json()) as { data: T };
      return json.data;
    });
  }

  private async toError(res: Response): Promise<HotelSupplierError> {
    let detail: DuffelError | null = null;
    try {
      detail = (await res.json()) as DuffelError;
    } catch {
      detail = null;
    }
    const first = detail?.errors?.[0];
    const message = first?.message ?? first?.title ?? `Duffel responded ${res.status}`;
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

  // ── Requests ───────────────────────────────────────────────────────────────
  /** Duffel accommodation ids for the curated hotels in this search (never a free-text search). */
  private accommodationIds(input: HotelSearchInput, only?: string): string[] {
    if (only) return [only];
    const map = input.supplierHotelIds ?? {};
    return input.hotelIds.map((id) => map[id]).filter((v): v is string => Boolean(v));
  }

  private searchBody(input: HotelSearchInput, accommodationIds: string[]) {
    const guests: Array<{ type: "adult" } | { type: "child"; age: number }> = [];
    for (let i = 0; i < Math.max(1, input.adults); i++) guests.push({ type: "adult" });
    // Duffel wants an age per child; the catalog only knows a count, so assume school age.
    for (let i = 0; i < (input.children ?? 0); i++) guests.push({ type: "child", age: 8 });
    return {
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      rooms: 1,
      guests,
      accommodation: { ids: accommodationIds },
    };
  }

  async searchHotels(input: HotelSearchInput): Promise<NormalizedHotel[]> {
    const ids = this.accommodationIds(input);
    if (ids.length === 0) return [];
    const data = await this.post<{ results?: DuffelSearchResult[] }>(
      "/stays/search",
      this.searchBody(input, ids),
      SUPPLIER_TIMEOUTS.search,
    );
    return (data.results ?? []).map((r) => normalizeHotel(r.accommodation));
  }

  async getRates(input: HotelSearchInput & { supplierHotelId: string }): Promise<NormalizedRate[]> {
    const search = await this.post<{ results?: DuffelSearchResult[] }>(
      "/stays/search",
      this.searchBody(input, [input.supplierHotelId]),
      SUPPLIER_TIMEOUTS.search,
    );
    const result = (search.results ?? []).find(
      (r) => r.accommodation?.id === input.supplierHotelId,
    );
    if (!result) return [];
    const full = await this.post<DuffelSearchResult>(
      `/stays/search_results/${encodeURIComponent(result.id)}/actions/fetch_all_rates`,
      {},
      SUPPLIER_TIMEOUTS.search,
    );
    return normalizeResultRates(full, input);
  }

  /** A Duffel quote re-prices one rate and is the only thing a booking can be created from. */
  async recheckRate(supplierRateId: string): Promise<NormalizedRate | null> {
    let quote: DuffelQuote;
    try {
      quote = await this.post<DuffelQuote>(
        "/stays/quotes",
        { rate_id: supplierRateId },
        SUPPLIER_TIMEOUTS.quote,
      );
    } catch (err) {
      if (err instanceof HotelSupplierError && err.code === "not_found") return null;
      throw err;
    }
    return normalizeQuote(quote, supplierRateId);
  }

  async book(input: {
    supplierRateId: string;
    guests: HotelGuest[];
    contact: HotelBookingContact;
  }): Promise<SupplierBookingResult> {
    const quote = await this.post<DuffelQuote>(
      "/stays/quotes",
      { rate_id: input.supplierRateId },
      SUPPLIER_TIMEOUTS.quote,
    );
    const booking = await this.post<DuffelBooking>(
      "/stays/bookings",
      {
        quote_id: quote.id,
        guests: input.guests.map((g) => ({ given_name: g.firstName, family_name: g.lastName })),
        email: input.contact.email,
        phone_number: input.contact.phone ?? undefined,
      },
      SUPPLIER_TIMEOUTS.book,
    );
    return {
      supplierBookingId: booking.id,
      confirmationNumber: booking.reference ?? undefined,
      status:
        booking.status === "confirmed"
          ? "confirmed"
          : booking.status === "cancelled" || booking.status === "failed"
            ? "failed"
            : "booked",
      raw: booking,
    };
  }

  async cancel(supplierBookingId: string): Promise<SupplierCancelResult> {
    const booking = await this.post<DuffelBooking>(
      `/stays/bookings/${encodeURIComponent(supplierBookingId)}/actions/cancel`,
      {},
      SUPPLIER_TIMEOUTS.cancel,
    );
    return {
      cancelled: booking.status === "cancelled" || Boolean(booking.cancelled_at),
      raw: booking,
    };
  }
}

// ── Normalisation (exported for tests) ───────────────────────────────────────
export function normalizeHotel(acc: DuffelAccommodation): NormalizedHotel {
  const addr = acc.location?.address ?? null;
  const geo = acc.location?.geographic_coordinates ?? null;
  return {
    supplier: "duffel",
    supplierHotelId: acc.id,
    name: acc.name ?? "Unnamed property",
    address: addr?.line_one ?? null,
    city: addr?.city_name ?? null,
    countryCode: addr?.country_code ? addr.country_code.toUpperCase() : null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    starRating: acc.rating ?? null,
    images: (acc.photos ?? []).map((p) => p.url).filter((u): u is string => Boolean(u)),
    amenities: (acc.amenities ?? [])
      .map((a) => a.description ?? a.type)
      .filter((v): v is string => Boolean(v)),
  };
}

function bedType(room: DuffelRoom): string | undefined {
  const beds = room.beds ?? [];
  if (beds.length === 0) return undefined;
  return normalizeBedType(
    beds.map((b) => `${b.count && b.count > 1 ? `${b.count}× ` : ""}${b.type ?? "bed"}`).join(", "),
  );
}

/**
 * Duffel's cancellation_timeline lists the refund still available *before* each instant. Our ladder
 * states the penalty charged *from* each instant, so a step's window opens where that step's refund
 * stops applying and carries the next step's refund — or nothing at all after the last one.
 *
 * This used to collapse the timeline to a single deadline, which threw away every middle rung. A
 * LiteAPI probe found 116 of 200 real rates carrying more than one window, so the middle rungs are
 * the common case rather than an edge one, and dropping them costs real money in both directions.
 */
export function policyFromTimeline(
  steps: DuffelCancellationStep[] | null | undefined,
  total: number,
  currency: ReturnType<typeof asCurrency>,
): { policy: CancellationPolicy; refundable: boolean } {
  const parsed = (steps ?? [])
    .filter((s) => s.before)
    .map((s) => ({
      before: s.before as string,
      refund: toMinorUnits(s.refund_amount ?? "0", currency),
    }))
    .sort((a, b) => a.before.localeCompare(b.before));
  if (parsed.length === 0) return { policy: { description: "Non-refundable" }, refundable: false };

  const windows: CancellationWindow[] = parsed.map((s, i) => ({
    from: s.before,
    penaltyAmount: Math.max(0, total - (parsed[i + 1]?.refund ?? 0)),
  }));

  // When even the earliest step refunds less than the total, the rate was never free to cancel, so
  // the ladder has to start before its first step rather than implying a free period that does not
  // exist. A window opening at the epoch says "this has always cost something", which is the truth.
  if (parsed[0]!.refund < total) {
    windows.unshift({
      from: new Date(0).toISOString(),
      penaltyAmount: Math.max(0, total - parsed[0]!.refund),
    });
  }

  const fullSteps = parsed.filter((s) => s.refund >= total);
  const free = fullSteps.length ? fullSteps[fullSteps.length - 1]! : null;
  const refundable = Boolean(free && new Date(free.before).getTime() > Date.now());

  // The legacy pair keeps its original meaning for anything not yet reading the ladder: the last
  // moment the best refund still applies, and what cancelling up to then costs.
  const last = parsed[parsed.length - 1]!;
  const afterFree = free ? parsed.find((s) => s.before > free.before) : null;
  return {
    policy: {
      windows,
      deadline: free ? free.before : last.before,
      penaltyAmount: free
        ? afterFree
          ? Math.max(0, total - afterFree.refund)
          : total
        : Math.max(0, total - last.refund),
      description: free
        ? `Free cancellation until ${free.before}`
        : `Partial refund until ${last.before}`,
    },
    refundable,
  };
}

function normalizeRate(
  rate: DuffelRate,
  ctx: {
    supplierHotelId: string;
    roomName: string | null;
    bedType: string | undefined;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    fallbackTimeline?: DuffelCancellationStep[] | null;
    quoteId?: string;
    expiresAt?: string | null;
  },
): NormalizedRate {
  const currency = asCurrency(rate.total_currency ?? rate.base_currency ?? "EUR");
  const total = toMinorUnits(rate.total_amount ?? "0", currency);
  const net = toMinorUnits(rate.base_amount ?? rate.total_amount ?? "0", currency);
  const taxes = toMinorUnits(rate.tax_amount ?? "0", currency);
  const fees = toMinorUnits(rate.fee_amount ?? "0", currency);
  const timeline = rate.cancellation_timeline ?? ctx.fallbackTimeline ?? null;
  const { policy, refundable } = policyFromTimeline(timeline, total, currency);
  const qty = rate.quantity_available ?? rate.available_rooms ?? null;
  const expiresAt = rate.expires_at ?? ctx.expiresAt ?? undefined;
  return {
    supplier: "duffel",
    supplierHotelId: ctx.supplierHotelId,
    supplierRateId: rate.id,
    roomName: ctx.roomName ?? "Room",
    bedType: ctx.bedType,
    occupancy: { adults: ctx.adults, children: ctx.children },
    checkIn: asIsoDate(ctx.checkIn),
    checkOut: asIsoDate(ctx.checkOut),
    currency,
    netAmount: net,
    taxesAmount: taxes,
    feesAmount: fees,
    totalAmount: total,
    refundable,
    cancellationPolicy: policy,
    // Duffel board types are snake_case (half_board, all_inclusive); the shared matcher wants words.
    breakfastIncluded: impliesBreakfast(
      rate.board_type?.replace(/_/g, " "),
      (rate.board_type ?? "").toLowerCase() === "all_inclusive",
    ),
    paymentType:
      (rate.payment_type ?? "").toLowerCase() === "pay_now" ? "pay_now" : "pay_at_property",
    available: qty === null ? true : qty > 0,
    ...(expiresAt ? { expiresAt } : {}),
    raw: {
      boardType: rate.board_type ?? null,
      paymentType: rate.payment_type ?? null,
      source: rate.source ?? null,
      conditions: rate.conditions ?? [],
      ...(ctx.quoteId ? { quoteId: ctx.quoteId } : {}),
    },
  };
}

function guestCounts(guests: Array<{ type: string }> | null | undefined, fallbackAdults: number) {
  if (!guests?.length) return { adults: fallbackAdults, children: 0 };
  return {
    adults: guests.filter((g) => g.type === "adult").length || fallbackAdults,
    children: guests.filter((g) => g.type === "child").length,
  };
}

export function normalizeResultRates(
  result: DuffelSearchResult,
  input: Pick<HotelSearchInput, "checkIn" | "checkOut" | "adults">,
): NormalizedRate[] {
  const { adults, children } = guestCounts(result.guests, input.adults);
  const out: NormalizedRate[] = [];
  for (const room of result.accommodation.rooms ?? []) {
    for (const rate of room.rates ?? []) {
      out.push(
        normalizeRate(rate, {
          supplierHotelId: result.accommodation.id,
          roomName: room.name ?? null,
          bedType: bedType(room),
          checkIn: result.check_in_date ?? input.checkIn,
          checkOut: result.check_out_date ?? input.checkOut,
          adults,
          children,
        }),
      );
    }
  }
  return out;
}

export function normalizeQuote(quote: DuffelQuote, supplierRateId: string): NormalizedRate {
  const { adults, children } = guestCounts(quote.guests, 2);
  // The quoted rate sits inside accommodation.rooms[].rates[]; fall back to quote-level amounts.
  let room: DuffelRoom | null = null;
  let rate: DuffelRate | null = null;
  for (const r of quote.accommodation?.rooms ?? []) {
    const hit = (r.rates ?? []).find((x) => x.id === supplierRateId) ?? (r.rates ?? [])[0];
    if (hit) {
      room = r;
      rate = hit;
      break;
    }
  }
  const merged: DuffelRate = {
    ...(rate ?? {}),
    id: supplierRateId,
    total_amount: quote.total_amount ?? rate?.total_amount ?? null,
    total_currency: quote.total_currency ?? rate?.total_currency ?? null,
    base_amount: quote.base_amount ?? rate?.base_amount ?? null,
    tax_amount: quote.tax_amount ?? rate?.tax_amount ?? null,
    fee_amount: quote.fee_amount ?? rate?.fee_amount ?? null,
    cancellation_timeline: quote.cancellation_timeline ?? rate?.cancellation_timeline ?? null,
  };
  return normalizeRate(merged, {
    supplierHotelId: quote.accommodation?.id ?? "",
    roomName: room?.name ?? null,
    bedType: room ? bedType(room) : undefined,
    checkIn: quote.check_in_date ?? "",
    checkOut: quote.check_out_date ?? "",
    adults,
    children,
    quoteId: quote.id,
    expiresAt: quote.expires_at ?? null,
  });
}
