import { addOnState, participantsLabel, purchaseUrl } from "./helpers";

describe("addOnState", () => {
  const base = { mine: false, bookableUntil: "2027-05-15", capacity: 12, going: 6 };
  it("orders mine > closed > full > open", () => {
    expect(addOnState({ ...base, mine: true }, "2027-05-01")).toBe("mine");
    expect(addOnState(base, "2027-05-16")).toBe("closed");
    expect(addOnState({ ...base, going: 12 }, "2027-05-01")).toBe("full");
    expect(addOnState({ ...base, capacity: null, going: 99 }, "2027-05-01")).toBe("open");
    expect(addOnState(base, "2027-05-15")).toBe("open");
  });
});

describe("participantsLabel", () => {
  const people = [
    { add_on_id: "a", user_id: "u1", display_name: "Maya Chen", first_name: "Maya" },
    { add_on_id: "a", user_id: "u2", display_name: null, first_name: "Tom" },
    { add_on_id: "a", user_id: "u3", display_name: "Ines", first_name: "Ines" },
    { add_on_id: "a", user_id: "u4", display_name: "Ravi", first_name: "Ravi" },
  ];
  it("names two people and counts the rest", () => {
    expect(participantsLabel(people, null)).toBe("Maya, Tom and 2 others");
    expect(participantsLabel(people.slice(0, 2), null)).toBe("Maya and Tom");
    expect(participantsLabel(people.slice(0, 3), null)).toBe("Maya, Tom and 1 other");
  });
  it("puts you first and never lists yourself", () => {
    expect(participantsLabel(people, "u1")).toBe("You, Tom, Ines and 1 other");
    expect(participantsLabel(people.slice(0, 1), "u1")).toBe("You're in");
    expect(participantsLabel([], "u1")).toBeNull();
  });
});

describe("purchaseUrl", () => {
  it("points at the web add-on page for the booking", () => {
    expect(purchaseUrl("b1", "a1", "https://example.com/")).toMatch(
      /\/account\/bookings\/b1\/add-ons\?add=a1$/,
    );
  });
});
