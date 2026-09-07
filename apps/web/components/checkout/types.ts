import type { CancellationTier, Currency } from "@guideless/types";
import type { AddOnWithCounts, StayOption } from "@/lib/data/extras";

/** Serializable departure summary passed from the server page into the client wizard. */
export interface CheckoutDeparture {
  id: string;
  tourSlug: string;
  tourName: string;
  routeNames: string[];
  startDate: string;
  endDate: string;
  timezone: string;
  /** Per traveler in their own room (minor units). */
  priceAmount: number;
  depositAmount: number;
  /** Per traveler saving when two share a room (minor units). */
  sharedRoomDiscountAmount: number;
  currency: Currency;
  capacity: number;
  available: number;
  bookingDeadline: string | null;
  balanceDueDate: string | null;
  cancellationPolicy: CancellationTier[];
  stayOptions: StayOption[];
  addOns: AddOnWithCounts[];
}

export interface CheckoutUser {
  id: string;
  email: string | null;
}
