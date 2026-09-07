import { describe, expect, it } from "vitest";
import {
  defaultRooms,
  fitRooms,
  fitSelection,
  ownRoom,
  problemMessage,
  setQuantity,
  shareRoom,
  sharedTravelers,
  toggleTraveler,
} from "./add-on-selection";

const catalog = [
  { id: "boat", pricing_basis: "per_traveler" as const, tier_group: null },
  { id: "transfer", pricing_basis: "per_booking" as const, tier_group: null },
  { id: "grandstand", pricing_basis: "per_traveler" as const, tier_group: "view" },
  { id: "yacht", pricing_basis: "per_traveler" as const, tier_group: "view" },
];

describe("rooms", () => {
  it("defaults to one room per traveler", () => {
    expect(defaultRooms(3)).toEqual([1, 2, 3]);
  });
  it("lets two travelers share and never three", () => {
    const shared = shareRoom([1, 2, 3], 1, 0);
    expect(shared).toEqual([1, 1, 2]);
    expect(shareRoom(shared, 2, 0)).toEqual(shared);
    expect([...sharedTravelers(shared)]).toEqual([0, 1]);
  });
  it("gives a traveler their own room again and renumbers", () => {
    expect(ownRoom([1, 1, 2], 1)).toEqual([1, 2, 3]);
  });
  it("fits the layout when travelers are added or removed", () => {
    expect(fitRooms([1, 1], 3)).toEqual([1, 1, 2]);
    expect(fitRooms([1, 1, 2], 1)).toEqual([1]);
  });
});

describe("add-on selection", () => {
  it("toggles a traveler on and off a per-traveler add-on", () => {
    const on = toggleTraveler([], catalog, "boat", 2);
    expect(on).toEqual([{ addOnId: "boat", travelerIndexes: [2] }]);
    expect(toggleTraveler(on, catalog, "boat", 2)).toEqual([]);
  });
  it("keeps one option per traveler within a tier group", () => {
    const a = toggleTraveler([], catalog, "grandstand", 1);
    const b = toggleTraveler(a, catalog, "yacht", 1);
    expect(b).toEqual([{ addOnId: "yacht", travelerIndexes: [1] }]);
    const c = toggleTraveler(b, catalog, "grandstand", 2);
    expect(c).toEqual([
      { addOnId: "yacht", travelerIndexes: [1] },
      { addOnId: "grandstand", travelerIndexes: [2] },
    ]);
  });
  it("sets and clears per-booking quantities", () => {
    expect(setQuantity([], catalog, "transfer", 1)).toEqual([{ addOnId: "transfer", quantity: 1 }]);
    expect(setQuantity([{ addOnId: "transfer", quantity: 1 }], catalog, "transfer", 0)).toEqual([]);
    expect(setQuantity([], catalog, "boat", 1)).toEqual([]);
  });
  it("drops travelers who left and add-ons no longer offered", () => {
    expect(
      fitSelection(
        [
          { addOnId: "boat", travelerIndexes: [1, 3] },
          { addOnId: "gone", quantity: 1 },
        ],
        catalog,
        2,
      ),
    ).toEqual([{ addOnId: "boat", travelerIndexes: [1] }]);
  });
});

describe("problem copy", () => {
  it("explains availability with the number left", () => {
    expect(problemMessage({ code: "add_on_sold_out", available: 1 })).toContain("Only 1 left");
    expect(problemMessage({ code: "code_invalid" })).toMatch(/recognise/);
  });
});
