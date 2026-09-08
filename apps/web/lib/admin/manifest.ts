/**
 * Departure manifest: the sheet an operator takes to a hotel.
 *
 * Shaping lives here as pure functions so the page, the print view and the CSV all agree, and so
 * the rooming arithmetic can be tested without a database.
 */

export interface ManifestTraveler {
  travelerId: string;
  bookingId: string;
  confirmationNumber: string;
  name: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  isLead: boolean;
  roomIndex: number;
  stayName: string | null;
  dietary: string | null;
  accessibility: string | null;
  airportTransfer: string | null;
  addOns: string[];
  /** Documents addressed to this traveler, plus anything shared with the whole group. */
  documentCount: number;
}

export interface Room {
  /** Room numbers restart per booking, so a room is only unique with its booking. */
  bookingId: string;
  confirmationNumber: string;
  index: number;
  stayName: string | null;
  travelers: ManifestTraveler[];
  /** Two travelers to a room is the maximum the booking rules allow. */
  overfilled: boolean;
}

export interface RoomingSummary {
  rooms: Room[];
  ownRoom: number;
  sharing: number;
  /** Rooms holding more than two travelers. Should always be empty; if not, the data is wrong. */
  overfilled: Room[];
}

/**
 * Groups travelers into rooms. Room numbers are per booking, so two bookings both having a
 * "room 1" are two different rooms — keying on the booking is what keeps them apart.
 */
export function roomsFor(travelers: ManifestTraveler[]): RoomingSummary {
  const byRoom = new Map<string, Room>();
  for (const t of travelers) {
    const key = `${t.bookingId}:${t.roomIndex}`;
    const room = byRoom.get(key);
    if (room) {
      room.travelers.push(t);
    } else {
      byRoom.set(key, {
        bookingId: t.bookingId,
        confirmationNumber: t.confirmationNumber,
        index: t.roomIndex,
        stayName: t.stayName,
        travelers: [t],
        overfilled: false,
      });
    }
  }
  const rooms = [...byRoom.values()]
    .map((r) => ({ ...r, overfilled: r.travelers.length > 2 }))
    .sort((a, b) => a.confirmationNumber.localeCompare(b.confirmationNumber) || a.index - b.index);
  return {
    rooms,
    ownRoom: rooms.filter((r) => r.travelers.length === 1).length,
    sharing: rooms.filter((r) => r.travelers.length === 2).length,
    overfilled: rooms.filter((r) => r.overfilled),
  };
}

/** "Sharing with Ana Reyes", or null when they have the room to themselves. */
export function sharingWith(traveler: ManifestTraveler, rooms: Room[]): string | null {
  const room = rooms.find(
    (r) => r.bookingId === traveler.bookingId && r.index === traveler.roomIndex,
  );
  if (!room) return null;
  const others = room.travelers.filter((t) => t.travelerId !== traveler.travelerId);
  return others.length ? others.map((t) => t.name).join(", ") : null;
}

/** What is missing before this traveler can be handed to a supplier. */
export function missingDetails(t: ManifestTraveler): string[] {
  const missing: string[] = [];
  if (!t.dateOfBirth) missing.push("date of birth");
  if (!t.nationality) missing.push("nationality");
  return missing;
}
