import { describe, expect, it } from "vitest";
import {
  addOnDays,
  blockedBy,
  buildDayPlan,
  conflictsWith,
  daysOverlap,
  spansDays,
} from "./add-on-days";

/**
 * The real Monaco weekend, because the bug this replaces was a real one: a three-day grandstand
 * pass that vanished on Saturday and Sunday, and a race group so exclusive that buying Friday's
 * grandstand made Sunday's yacht unselectable.
 */
const boat = {
  id: "boat",
  title: "Friday coast boat",
  day_number: 3,
  end_day_number: null,
  tier_group: null,
  start_time: "10:00:00",
};
const grandstand = {
  id: "gs",
  title: "Grandstand K (three-day pass)",
  day_number: 3,
  end_day_number: 5,
  tier_group: "race_view",
  start_time: "15:00:00",
};
const fridayNight = {
  id: "fri",
  title: "Friday night on the water",
  day_number: 3,
  end_day_number: null,
  tier_group: null,
  start_time: "21:00:00",
};
const yachtSat = {
  id: "ysat",
  title: "Amber Lounge yacht, qualifying day",
  day_number: 4,
  end_day_number: null,
  tier_group: "race_view",
};
const yachtBoth = {
  id: "yboth",
  title: "Amber Lounge yacht, both days",
  day_number: 4,
  end_day_number: 5,
  tier_group: "race_view",
};
const terrace = {
  id: "terr",
  title: "Terrace with lunch (Sat + Sun)",
  day_number: 4,
  end_day_number: 5,
  tier_group: "race_view",
};
const yachtSun = {
  id: "ysun",
  title: "Amber Lounge yacht, race day",
  day_number: 5,
  end_day_number: null,
  tier_group: "race_view",
};
const transfer = {
  id: "tx",
  title: "Private airport transfer",
  day_number: 1,
  end_day_number: null,
  tier_group: null,
};
const insurance = {
  id: "ins",
  title: "Trip insurance",
  day_number: null,
  end_day_number: null,
  tier_group: null,
};

const ALL = [
  transfer,
  boat,
  grandstand,
  fridayNight,
  yachtSat,
  yachtBoth,
  terrace,
  yachtSun,
  insurance,
];

describe("addOnDays", () => {
  it("gives a single-day option one day", () => {
    expect(addOnDays(boat)).toEqual([3]);
  });

  it("expands a span to every day it covers", () => {
    expect(addOnDays(grandstand)).toEqual([3, 4, 5]);
    expect(addOnDays(terrace)).toEqual([4, 5]);
  });

  it("gives an option with no day nothing at all", () => {
    expect(addOnDays(insurance)).toEqual([]);
  });

  it("survives an end day earlier than the start rather than producing a backwards range", () => {
    expect(addOnDays({ day_number: 4, end_day_number: 2 })).toEqual([4]);
  });

  it("knows which options are multi-day", () => {
    expect(spansDays(grandstand)).toBe(true);
    expect(spansDays(boat)).toBe(false);
  });
});

describe("conflictsWith", () => {
  it("blocks two race views on the same day", () => {
    expect(conflictsWith(yachtSat, terrace)).toBe(true);
  });

  it("allows Saturday's yacht and Sunday's yacht — the bug this replaces", () => {
    expect(conflictsWith(yachtSat, yachtSun)).toBe(false);
    expect(daysOverlap(yachtSat, yachtSun)).toBe(false);
  });

  it("blocks a three-day pass against any single day it covers", () => {
    expect(conflictsWith(grandstand, yachtSat)).toBe(true);
    expect(conflictsWith(grandstand, yachtSun)).toBe(true);
  });

  it("blocks two overlapping multi-day options", () => {
    expect(conflictsWith(terrace, yachtBoth)).toBe(true);
  });

  it("never blocks anything outside an exclusive group", () => {
    // Boat at ten, grandstand at three, party at nine: all on day 3, all fine.
    expect(conflictsWith(boat, grandstand)).toBe(false);
    expect(conflictsWith(boat, fridayNight)).toBe(false);
    expect(conflictsWith(fridayNight, grandstand)).toBe(false);
  });

  it("does not conflict with itself", () => {
    expect(conflictsWith(grandstand, grandstand)).toBe(false);
  });

  it("keeps two undated options in one group mutually exclusive", () => {
    const a = { id: "a", day_number: null, end_day_number: null, tier_group: "g" };
    const b = { id: "b", day_number: null, end_day_number: null, tier_group: "g" };
    expect(conflictsWith(a, b)).toBe(true);
  });
});

describe("buildDayPlan", () => {
  const plan = buildDayPlan({
    addOns: ALL,
    tripDays: [
      { day_number: 1, title: "Arrive on the Riviera", destination: "Nice" },
      { day_number: 2, title: "A day before it starts", destination: "Nice" },
      { day_number: 3, title: "Practice day", destination: "Monaco" },
      { day_number: 4, title: "Qualifying", destination: "Monaco" },
      { day_number: 5, title: "Race day", destination: "Monaco" },
      { day_number: 6, title: "Home", destination: "Nice" },
    ],
    startDate: "2027-06-02",
  });

  it("covers every day of the trip, including ones with nothing to sell", () => {
    expect(plan.days.map((d) => d.dayNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.days[1]!.entries).toHaveLength(0);
  });

  it("dates each day from the departure's start", () => {
    expect(plan.days[0]!.date).toBe("2027-06-02");
    expect(plan.days[4]!.date).toBe("2027-06-06");
  });

  it("shows a three-day pass on all three days, choosable only on the first", () => {
    const on = (day: number) => plan.days[day - 1]!.entries.find((e) => e.addOn.id === "gs");
    expect(on(3)?.isFirstDay).toBe(true);
    expect(on(4)?.carriedOver).toBe(true);
    expect(on(5)?.carriedOver).toBe(true);
  });

  it("puts Friday's three options together, in the order the day happens", () => {
    // Boat at ten, grandstand at three, party at nine — not catalog order.
    const ids = plan.days[2]!.entries.map((e) => e.addOn.id);
    expect(ids).toEqual(["boat", "gs", "fri"]);
  });

  it("sinks an untimed option below the timed ones rather than interrupting them", () => {
    const untimed = {
      id: "u",
      title: "Bag storage",
      day_number: 3,
      end_day_number: null,
      tier_group: null,
    };
    const p2 = buildDayPlan({ addOns: [untimed, grandstand, boat], dayCount: 5 });
    expect(p2.days[2]!.entries.map((e) => e.addOn.id)).toEqual(["boat", "gs", "u"]);
  });

  it("keeps the airport transfer on arrival day", () => {
    expect(plan.days[0]!.entries.map((e) => e.addOn.id)).toEqual(["tx"]);
  });

  it("holds trip-wide options apart from the diary", () => {
    expect(plan.anytime.map((a) => a.id)).toEqual(["ins"]);
  });

  it("still produces days when there is no itinerary to name them", () => {
    const bare = buildDayPlan({ addOns: [yachtSun], dayCount: 5 });
    expect(bare.days).toHaveLength(5);
    expect(bare.days[4]!.entries.map((e) => e.addOn.id)).toEqual(["ysun"]);
    expect(bare.days[0]!.title).toBeNull();
  });
});

describe("blockedBy", () => {
  it("names what is blocking an option rather than just disabling it", () => {
    const blocked = blockedBy(ALL, ["gs"]);
    expect(blocked.get("ysat")).toBe("Grandstand K (three-day pass)");
    expect(blocked.get("ysun")).toBe("Grandstand K (three-day pass)");
    expect(blocked.get("terr")).toBe("Grandstand K (three-day pass)");
  });

  it("leaves everything outside the group alone", () => {
    const blocked = blockedBy(ALL, ["gs"]);
    expect(blocked.has("boat")).toBe(false);
    expect(blocked.has("fri")).toBe(false);
    expect(blocked.has("tx")).toBe(false);
  });

  it("lets a traveler hold both race days at once", () => {
    const blocked = blockedBy(ALL, ["ysat"]);
    expect(blocked.has("ysun")).toBe(false);
    expect(blocked.get("terr")).toBe("Amber Lounge yacht, qualifying day");
  });
});
