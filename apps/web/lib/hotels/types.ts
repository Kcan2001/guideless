import type { Currency, HotelPaymentType, HotelSupplierId, ISODate } from "@guideless/types";

/**
 * Hotel engine contracts (docs/strategy-v3-direction.md §3). Every supplier adapter translates its
 * API into these shapes; nothing downstream (comparison, pricing, admin, booking) knows which
 * supplier produced a rate. Amounts are integer minor units in `currency`. Pure types: no runtime.
 */

export type { HotelPaymentType, HotelSupplierId };

export interface HotelSearchInput {
  destinationId?: string;
  /** Guideless hotel ids to price (curated catalog, never a free search). */
  hotelIds: string[];
  /** Guideless hotel id → supplier hotel id, from hotel_supplier_mappings. */
  supplierHotelIds?: Record<string, string>;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children?: number;
  currency: Currency;
}

export interface NormalizedHotel {
  supplier: HotelSupplierId;
  supplierHotelId: string;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  starRating: number | null;
  images: string[];
  amenities: string[];
}

/**
 * One step of a supplier's cancellation ladder: from `from` onwards, cancelling costs
 * `penaltyAmount`. Before the earliest window, cancellation is free.
 */
export interface CancellationWindow {
  /** ISO timestamp. Cancelling at or after this moment costs `penaltyAmount`. */
  from: string;
  /** Minor units charged when cancelling on or after `from`. */
  penaltyAmount: number;
}

/**
 * Real suppliers return a ladder, not a deadline. Probing one LiteAPI hotel for one date range
 * returned 200 rates, of which 116 carried more than one window and the deepest had five. A
 * single-deadline model silently drops the middle steps, and the loss is money in both directions:
 * believing a rate is free to cancel on a day the supplier already charges for, or holding a
 * traveler to a penalty we were never charged.
 *
 * `windows` is the truth. `deadline` and `penaltyAmount` remain for rates stored before this
 * existed, and every reader should go through the helpers in `cancellation-policy.ts` rather than
 * touching either shape directly.
 */
export interface CancellationPolicy {
  /** The ladder, ascending by `from`. Absent or empty with `refundable: false` means never refundable. */
  windows?: CancellationWindow[];
  /** Legacy single step. Superseded by `windows`; read it through `cancellationWindows()`. */
  deadline?: string;
  /** Legacy single step penalty, in minor units. */
  penaltyAmount?: number;
  description?: string;
}

export interface NormalizedRate {
  supplier: HotelSupplierId;
  supplierHotelId: string;
  supplierRateId: string;
  roomName: string;
  bedType?: string;
  occupancy: { adults: number; children: number };
  checkIn: ISODate;
  checkOut: ISODate;
  currency: Currency;
  /** Room price before taxes and fees. */
  netAmount: number;
  taxesAmount: number;
  feesAmount: number;
  /** What Guideless pays the supplier for the whole stay. */
  totalAmount: number;
  refundable: boolean;
  cancellationPolicy: CancellationPolicy;
  breakfastIncluded: boolean;
  paymentType: HotelPaymentType;
  /** Commission the supplier pays back, when disclosed. Improves margin, never shown. */
  supplierCommissionAmount?: number;
  available: boolean;
  expiresAt?: string;
  /** Supplier payload kept for reconciliation only. */
  raw?: unknown;
}

/** Equivalent-product key: hotel + room + bed + occupancy + refundability + breakfast + payment. */
export type RateFingerprint = string;

export interface PricingRuleLike {
  id?: string;
  destinationId?: string | null;
  hotelId?: string | null;
  minMarkupAmount: number;
  percentageMarkup: number;
  fixedMarkupAmount: number;
  priority: number;
  effectiveFrom?: ISODate | null;
  effectiveTo?: ISODate | null;
  isActive?: boolean;
}

export interface PricedRate extends NormalizedRate {
  markupAmount: number;
  /** totalAmount + markupAmount: the number staff copy into the tier's price. */
  customerAmount: number;
  ruleId?: string;
}

export interface HotelGuest {
  firstName: string;
  lastName: string;
  isLead?: boolean;
}

export interface HotelBookingContact {
  email: string;
  phone?: string;
}

export interface SupplierBookingResult {
  supplierBookingId: string;
  confirmationNumber?: string;
  status: "booked" | "confirmed" | "failed";
  raw?: unknown;
}

export interface SupplierCancelResult {
  cancelled: boolean;
  /** Minor units the supplier refunds, when known. */
  refundAmount?: number;
  raw?: unknown;
}

/** One adapter per supplier. The rest of Guideless only sees this. */
export interface HotelSupplier {
  readonly id: HotelSupplierId;
  searchHotels(input: HotelSearchInput): Promise<NormalizedHotel[]>;
  getRates(input: HotelSearchInput & { supplierHotelId: string }): Promise<NormalizedRate[]>;
  /** Fresh price for a rate the customer is about to pay for; null when it is gone. */
  recheckRate(supplierRateId: string): Promise<NormalizedRate | null>;
  book(input: {
    supplierRateId: string;
    guests: HotelGuest[];
    contact: HotelBookingContact;
  }): Promise<SupplierBookingResult>;
  cancel(supplierBookingId: string): Promise<SupplierCancelResult>;
}
