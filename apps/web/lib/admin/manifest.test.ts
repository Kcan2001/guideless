import { describe, expect, it } from "vitest";
import { missingDetails, roomsFor, sharingWith, type ManifestTraveler } from "./manifest";

function traveler(over: Partial<ManifestTraveler> & { travelerId: string }): ManifestTraveler {
  return {
    bookingId: "b1",
    confirmationNumber: "GL-AAAA1111",
    name: "Kyle Cannon",
    preferredName: null,
    email: null,
    phone: null,
    dateOfBirth: "1987-08-23",
    nationality: "US",
    isLead: true,
    roomIndex: 1,
    stayName: "Nice, near the port",
    dietary: null,
    accessibility: null,
    airportTransfer: null,
    addOns: [],
    documentCount: 0,
    ...over,
  };
}

describe("roomsFor", () => {
  it("keeps identical room numbers from different bookings apart", () => {
    const summary = roomsFor([
      traveler({ travelerId: "t1", bookingId: "b1", confirmationNumber: "GL-A", roomIndex: 1 }),
      traveler({ travelerId: "t2", bookingId: "b2", confirmationNumber: "GL-B", roomIndex: 1 }),
    ]);
    expect(summary.rooms).toHaveLength(2);
    expect(summary.ownRoom).toBe(2);
    expect(summary.sharing).toBe(0);
  });

  it("counts a shared room once, not per traveler", () => {
    const summary = roomsFor([
      traveler({ travelerId: "t1", roomIndex: 1, name: "Kyle Cannon" }),
      traveler({ travelerId: "t2", roomIndex: 1, name: "Ana Reyes", isLead: false }),
    ]);
    expect(summary.rooms).toHaveLength(1);
    expect(summary.sharing).toBe(1);
    expect(summary.ownRoom).toBe(0);
  });

  it("flags a room holding more than two travelers, which the booking rules forbid", () => {
    const summary = roomsFor([
      traveler({ travelerId: "t1", roomIndex: 1 }),
      traveler({ travelerId: "t2", roomIndex: 1 }),
      traveler({ travelerId: "t3", roomIndex: 1 }),
    ]);
    expect(summary.overfilled).toHaveLength(1);
    expect(summary.rooms[0].overfilled).toBe(true);
    // Not counted as a normal pair, so the totals stay honest.
    expect(summary.sharing).toBe(0);
    expect(summary.ownRoom).toBe(0);
  });

  it("orders by booking then room so the sheet reads down the page", () => {
    const summary = roomsFor([
      traveler({ travelerId: "t1", bookingId: "b2", confirmationNumber: "GL-B", roomIndex: 2 }),
      traveler({ travelerId: "t2", bookingId: "b1", confirmationNumber: "GL-A", roomIndex: 2 }),
      traveler({ travelerId: "t3", bookingId: "b1", confirmationNumber: "GL-A", roomIndex: 1 }),
    ]);
    expect(summary.rooms.map((r) => `${r.confirmationNumber}#${r.index}`)).toEqual([
      "GL-A#1",
      "GL-A#2",
      "GL-B#2",
    ]);
  });

  it("handles an empty departure", () => {
    expect(roomsFor([])).toEqual({ rooms: [], ownRoom: 0, sharing: 0, overfilled: [] });
  });
});

describe("sharingWith", () => {
  it("names the roommate", () => {
    const a = traveler({ travelerId: "t1", name: "Kyle Cannon" });
    const b = traveler({ travelerId: "t2", name: "Ana Reyes", isLead: false });
    const { rooms } = roomsFor([a, b]);
    expect(sharingWith(a, rooms)).toBe("Ana Reyes");
    expect(sharingWith(b, rooms)).toBe("Kyle Cannon");
  });

  it("is null for a traveler on their own", () => {
    const a = traveler({ travelerId: "t1" });
    expect(sharingWith(a, roomsFor([a]).rooms)).toBeNull();
  });
});

describe("missingDetails", () => {
  it("lists exactly what a supplier would reject", () => {
    expect(missingDetails(traveler({ travelerId: "t1" }))).toEqual([]);
    expect(
      missingDetails(traveler({ travelerId: "t1", dateOfBirth: null, nationality: null })),
    ).toEqual(["date of birth", "nationality"]);
  });
});
