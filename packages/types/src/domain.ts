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
