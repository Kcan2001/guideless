import { addDays, buildMarkers, filterMarkers, regionFor } from "./markers";

const days = [
  {
    id: "d1",
    date: "2027-05-14",
    items: [
      {
        id: "i1",
        title: "Welcome drinks",
        type: "live_moment" as const,
        latitude: 43.6955,
        longitude: 7.2851,
        start_time: "20:00:00",
        location_name: "Port Lympia",
        is_anchor: true,
        visibility: "trip_member" as const,
      },
      {
        id: "i2",
        title: "Staff briefing",
        type: "custom" as const,
        latitude: 43.7,
        longitude: 7.28,
        start_time: null,
        location_name: null,
        is_anchor: false,
        visibility: "staff_only" as const,
      },
      {
        id: "i3",
        title: "Free morning",
        type: "free_time" as const,
        latitude: null,
        longitude: null,
        start_time: null,
        location_name: null,
        is_anchor: false,
        visibility: "trip_member" as const,
      },
    ],
  },
  { id: "d2", date: "2027-05-15", items: [] },
];

const accommodations = [
  {
    id: "h1",
    name: "Hôtel du Port",
    address: "1 Quai Papacino",
    latitude: 43.6971,
    longitude: 7.2861,
    check_in_date: "2027-05-14",
    check_out_date: "2027-05-17",
  },
];

describe("buildMarkers", () => {
  it("skips items without coordinates and staff-only items, flags the anchor", () => {
    const markers = buildMarkers({ days, accommodations });
    expect(markers.map((m) => m.id)).toEqual(["hotel:h1", "item:i1"]);
    expect(markers[1]).toMatchObject({
      kind: "anchor",
      subtitle: "20:00 · Port Lympia",
      date: "2027-05-14",
    });
  });

  it("dates add-ons from the trip start and keeps undated ones on every day", () => {
    const markers = buildMarkers({
      days,
      accommodations: [],
      tripStartDate: "2027-05-14",
      addOns: [
        {
          id: "a1",
          title: "Boat",
          latitude: 43.69,
          longitude: 7.28,
          day_number: 2,
          location_name: null,
          start_time: "10:00:00",
        },
        {
          id: "a2",
          title: "Transfer",
          latitude: 43.66,
          longitude: 7.21,
          day_number: null,
          location_name: null,
          start_time: null,
        },
      ],
    });
    expect(markers.find((m) => m.id === "addon:a1")?.date).toBe("2027-05-15");
    expect(markers.find((m) => m.id === "addon:a2")?.date).toBeNull();
  });
});

describe("filterMarkers", () => {
  it("keeps undated markers on every day", () => {
    const markers = buildMarkers({ days, accommodations });
    expect(filterMarkers(markers, "2027-05-15").map((m) => m.id)).toEqual(["hotel:h1"]);
    expect(filterMarkers(markers, "2027-05-14")).toHaveLength(2);
    expect(filterMarkers(markers, "all")).toHaveLength(2);
  });
});

describe("regionFor", () => {
  it("centers on the markers with padding and never collapses to a point", () => {
    const region = regionFor(buildMarkers({ days, accommodations }));
    expect(region?.latitude).toBeCloseTo((43.6955 + 43.6971) / 2, 4);
    expect(region?.latitudeDelta).toBeGreaterThanOrEqual(0.02);
  });

  it("falls back to the destination when nothing has coordinates", () => {
    expect(regionFor([], { latitude: 43.71, longitude: 7.26 })).toMatchObject({ latitude: 43.71 });
    expect(regionFor([])).toBeNull();
  });
});

describe("addDays", () => {
  it("adds calendar days without time-zone drift", () => {
    expect(addDays("2027-05-31", 1)).toBe("2027-06-01");
  });
});
