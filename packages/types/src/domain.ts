/**
 * Core domain types. These are application-level shapes, not raw table rows
 * (raw rows live in ./database.ts, generated from Postgres).
 *
 * Hierarchy:  Tour → Tour Version → Departure → Group → Trip → Traveler
 */
import type {
  BookingStatus,
  Currency,
  ItineraryItemStatus,
  ItineraryItemType,
  PaymentStatus,
  Responsibility,
  TripStatus,
  Visibility,
} from "./enums";

/** Money is ALWAYS integer minor units + ISO currency. Never floats. */
export interface Money {
  /** e.g. 349500 = $3,495.00 */
  amount: number;
  currency: Currency;
}

export type UUID = string;
/** ISO 8601 instant in UTC, e.g. "2027-05-14T12:00:00Z". */
export type ISOTimestamp = string;
/** Calendar date, e.g. "2027-05-14". */
export type ISODate = string;
/** IANA time zone, e.g. "Europe/Paris". */
export type TimeZone = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Location extends Partial<GeoPoint> {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone: TimeZone;
}

export interface GroupSize {
  min: number;
  max: number;
}

export interface TourSummary {
  id: UUID;
  slug: string;
  name: string;
  tagline?: string;
  heroImageUrl?: string;
  durationDays: number;
  destinations: string[];
  startingPrice: Money;
  groupSize: GroupSize;
  activityLevel: "relaxed" | "moderate" | "active";
}

export interface DepartureSummary {
  id: UUID;
  tourId: UUID;
  tourVersionId: UUID;
  startDate: ISODate;
  endDate: ISODate;
  price: Money;
  depositAmount?: Money;
  capacity: number;
  confirmed: number;
  held: number;
  bookingDeadline?: ISODate;
}

export interface Availability {
  capacity: number;
  confirmed: number;
  held: number;
  /** capacity - confirmed - held, never negative. Computed in the database. */
  available: number;
}

export interface ItineraryItem {
  id: UUID;
  type: ItineraryItemType;
  title: string;
  description?: string;
  date: ISODate;
  startTime?: string; // "HH:mm" local to `location.timezone`
  endTime?: string;
  location?: Location;
  instructions?: string;
  responsibility: Responsibility;
  optional: boolean;
  status: ItineraryItemStatus;
  visibility: Visibility;
  // Supplier references and costs are NOT on itinerary items; they live in supplier_services,
  // which has no customer-facing RLS policy.
}

export interface ItineraryDay {
  dayNumber: number;
  date: ISODate;
  destination: string;
  timezone: TimeZone;
  items: ItineraryItem[];
}

export interface TripSummary {
  id: UUID;
  departureId: UUID;
  status: TripStatus;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  currentDay?: ItineraryDay;
}

export interface BookingSummary {
  id: UUID;
  confirmationNumber: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  departureId: UUID;
  total: Money;
  amountPaid: Money;
  travelerCount: number;
  createdAt: ISOTimestamp;
}

/** Data-driven cancellation policy tier. Never hardcode these in the frontend. */
export interface CancellationTier {
  /** Inclusive lower bound of days before departure this tier applies to. */
  daysBeforeDeparture: number;
  /** 0–100 */
  refundPercentage: number;
}

export interface PublicTravelerProfile {
  userId: UUID;
  displayName: string;
  avatarUrl?: string;
  homeCountry?: string;
  bio?: string;
}

/** Deep-link targets used by notifications. Web has equivalent routes. */
export type DeepLink =
  | { kind: "trip"; tripId: UUID }
  | { kind: "itinerary_item"; tripId: UUID; itemId: UUID }
  | { kind: "chat_room"; roomId: UUID }
  | { kind: "support_thread"; threadId: UUID }
  | { kind: "live_moment"; tripId: UUID; momentId: UUID }
  | { kind: "payment"; bookingId: UUID };

// ── Pricing quote (public.quote_booking) ─────────────────────────────────────
export type QuoteProblemCode =
  | "traveler_count"
  | "invalid_payment_option"
  | "departure_not_found"
  | "room_index"
  | "room_capacity"
  | "stay_option_unknown"
  | "stay_option_full"
  | "add_on_unknown"
  | "add_on_closed"
  | "add_on_sold_out"
  | "tier_conflict"
  | "code_invalid"
  | "code_own_referral"
  | "code_currency";

export interface QuoteProblem {
  code: QuoteProblemCode;
  addOnId?: UUID;
  roomIndex?: number;
  tierGroup?: string;
  available?: number;
}

export interface QuoteLine {
  kind: "base" | "add_on" | "discount";
  title: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  add_on_id?: UUID;
  pricing_basis?: "per_traveler" | "per_booking";
  traveler_indexes?: number[] | null;
  tier_group?: string | null;
  day_number?: number | null;
  coupon_id?: UUID;
  referrer_id?: UUID;
  referral_code?: string;
  credit_applied?: number;
}

/** Money is integer minor units in `currency`; the database is the only place that computes it. */
export interface BookingQuoteResult {
  departure_id: UUID;
  currency: Currency;
  travelers: number;
  rooms: { index: number; occupancy: number }[];
  stay_option_id: UUID | null;
  stay_option_name: string | null;
  lines: QuoteLine[];
  base_amount: number;
  add_ons_amount: number;
  subtotal_amount: number;
  discount_amount: number;
  discount_kind: "coupon" | "referral" | null;
  credit_amount: number;
  total_amount: number;
  deposit_amount: number;
  due_now_amount: number;
  balance_amount: number;
  payment_option: "deposit" | "full";
  problems: QuoteProblem[];
}
