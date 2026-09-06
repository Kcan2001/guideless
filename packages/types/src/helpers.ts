import type { Database } from "./database";

/**
 * Convenience aliases over the generated Database type.
 *
 *   type Booking = Tables<"bookings">;
 *   type NewBooking = TablesInsert<"bookings">;
 *   type BookingStatusDb = Enums<"booking_status">;
 */
export type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T];
