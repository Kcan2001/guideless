import type { CancellationTier, Currency } from "@guideless/types";

/** Serializable departure summary passed from the server page into the client wizard. */
export interface CheckoutDeparture {
  id: string;
  tourSlug: string;
  tourName: string;
  routeNames: string[];
  startDate: string;
  endDate: string;
  timezone: string;
  priceAmount: number;
  depositAmount: number;
  currency: Currency;
  capacity: number;
  available: number;
  bookingDeadline: string | null;
  balanceDueDate: string | null;
  cancellationPolicy: CancellationTier[];
}

export interface CheckoutUser {
  id: string;
  email: string | null;
}
