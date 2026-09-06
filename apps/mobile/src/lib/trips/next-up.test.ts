import { currentDay, greeting, minutesUntil, nextUp, pickCurrentTrip, tripPhase } from "./next-up";

const trip = (
  id: string,
  status: "upcoming" | "active" | "completed" | "cancelled",
  start: string,
  end: string,
) => ({
  id,
  status,
  start_date: start,
  end_date: end,
});

describe("pickCurrentTrip", () => {
  it("prefers a trip happening today, then the soonest upcoming, then the latest past", () => {
    const trips = [
      trip("past", "completed", "2027-01-01", "2027-01-09"),
      trip("soon", "upcoming", "2027-06-11", "2027-06-19"),
      trip("later", "upcoming", "2027-09-17", "2027-09-25"),
    ];
    expect(pickCurrentTrip(trips, "2027-03-01")?.id).toBe("soon");
    expect(
      pickCurrentTrip([...trips, trip("now", "upcoming", "2027-02-27", "2027-03-05")], "2027-03-01")
        ?.id,
    ).toBe("now");
    expect(pickCurrentTrip([trips[0]!], "2027-03-01")?.id).toBe("past");
    expect(
      pickCurrentTrip([trip("x", "cancelled", "2027-06-11", "2027-06-19")], "2027-03-01"),
    ).toBeNull();
  });

  it("classifies the phase", () => {
    const t = trip("t", "upcoming", "2027-05-14", "2027-05-22");
    expect(tripPhase(t, "2027-05-01")).toBe("before");
    expect(tripPhase(t, "2027-05-14")).toBe("during");
    expect(tripPhase(t, "2027-05-22")).toBe("during");
    expect(tripPhase(t, "2027-05-23")).toBe("after");
  });
});

describe("currentDay", () => {
  const days = [
    { id: "d1", day_number: 1, date: "2027-05-14", timezone: "Europe/Paris" },
    { id: "d2", day_number: 2, date: "2027-05-15", timezone: "Europe/Paris" },
    { id: "d3", day_number: 3, date: "2027-05-16", timezone: "Europe/Paris" },
  ];

  it("uses the day's own zone: 23:30 UTC on the 14th is already the 15th in Paris", () => {
    expect(currentDay(days, new Date("2027-05-14T23:30:00Z"))?.id).toBe("d2");
    expect(currentDay(days, new Date("2027-05-14T12:00:00Z"))?.id).toBe("d1");
  });

  it("shows day 1 before the trip and the last day after it", () => {
    expect(currentDay(days, new Date("2027-05-01T12:00:00Z"))?.id).toBe("d1");
    expect(currentDay(days, new Date("2027-06-01T12:00:00Z"))?.id).toBe("d3");
    expect(currentDay([], new Date())).toBeNull();
  });
});

describe("nextUp", () => {
  const items = [
    {
      id: "a",
      type: "meal" as const,
      start_time: "07:30:00",
      end_time: "10:00:00",
      is_optional: false,
      status: "planned" as const,
    },
    {
      id: "b",
      type: "free_time" as const,
      start_time: "10:00:00",
      end_time: "13:00:00",
      is_optional: false,
      status: "planned" as const,
    },
    {
      id: "c",
      type: "recommendation" as const,
      start_time: "13:00:00",
      end_time: null,
      is_optional: true,
      status: "planned" as const,
    },
    {
      id: "d",
      type: "live_moment" as const,
      start_time: "19:00:00",
      end_time: "20:30:00",
      is_optional: true,
      status: "planned" as const,
    },
    {
      id: "x",
      type: "activity" as const,
      start_time: "15:00:00",
      end_time: null,
      is_optional: true,
      status: "cancelled" as const,
    },
  ];

  it("finds the current and next items and tonight's optional moments", () => {
    const r = nextUp(items, "11:15");
    expect(r.current?.id).toBe("b");
    expect(r.next?.id).toBe("c");
    expect(r.optionalLater.map((i) => i.id)).toEqual(["d"]); // cancelled item excluded, next not repeated
  });

  it("handles before-first and after-last", () => {
    expect(nextUp(items, "06:00").current).toBeNull();
    expect(nextUp(items, "06:00").next?.id).toBe("a");
    expect(nextUp(items, "22:00").next).toBeNull();
  });

  it("computes minutes until and greetings", () => {
    expect(minutesUntil("10:52:00", "10:07")).toBe(45);
    expect(greeting("08:00")).toBe("Good morning");
    expect(greeting("14:00")).toBe("Good afternoon");
    expect(greeting("21:00")).toBe("Good evening");
  });
});
