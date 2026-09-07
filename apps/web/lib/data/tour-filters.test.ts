import { describe, expect, it } from "vitest";
import type { Tables } from "@guideless/types";
import {
  availableDestinations,
  availableMonths,
  filterTours,
  hasActiveFilters,
  parseTourFilters,
  tourFromPrice,
  type PublicDeparture,
  type TourListItem,
} from "./tour-filters";

function destination(slug: string): Tables<"destinations"> {
  return {
    id: `dest-${slug}`,
    slug,
    name: slug[0]!.toUpperCase() + slug.slice(1),
    country_code: "FR",
    country_name: "France",
    region: null,
    timezone: "Europe/Paris",
    latitude: null,
    longitude: null,
    summary: null,
    description: null,
    hero_image_url: null,
    emergency_numbers: {},
    seo_title: null,
    seo_description: null,
    is_published: true,
    created_at: "",
    updated_at: "",
  };
}

function departure(tourId: string, startDate: string, priceAmount: number): PublicDeparture {
  return {
    id: `${tourId}-${startDate}`,
    tourId,
    tourVersionId: `${tourId}-v1`,
    status: "open",
    startDate,
    endDate: startDate,
    timezone: "Europe/Paris",
    capacity: 14,
    minimumTravelers: 6,
    priceAmount,
    depositAmount: 75000,
    currency: "USD",
    bookingDeadline: null,
    balanceDueDate: null,
    cancellationPolicy: [],
  };
}

function item(
  id: string,
  opts: {
    days: number;
    level: Tables<"tours">["activity_level"];
    destinations: string[];
    departures: Array<[string, number]>;
    startingPrice?: number;
  },
): TourListItem {
  return {
    tour: {
      id,
      slug: id,
      name: id,
      current_version_id: `${id}-v1`,
      duration_days: opts.days,
      group_size_min: 6,
      group_size_max: 14,
      activity_level: opts.level,
      style: "minimal_intervention",
      is_published: true,
      kind: "route",
      event_name: null,
      event_starts_on: null,
      event_ends_on: null,
      event_location: null,
      created_at: "",
      updated_at: "",
    },
    version: {
      id: `${id}-v1`,
      tour_id: id,
      version_number: 1,
      status: "published",
      tagline: null,
      summary: null,
      description: null,
      why_this_trip: null,
      hero_image_url: null,
      gallery_image_urls: [],
      starting_price_amount: opts.startingPrice ?? null,
      starting_price_currency: opts.startingPrice ? "USD" : null,
      seo_title: null,
      seo_description: null,
      published_at: null,
      created_by: null,
      created_at: "",
      updated_at: "",
    },
    destinations: opts.destinations.map(destination),
    departures: opts.departures.map(([date, price]) => departure(id, date, price)),
  };
}

const france = item("southern-france", {
  days: 9,
  level: "moderate",
  destinations: ["nice", "avignon", "paris"],
  departures: [
    ["2027-05-14", 349500],
    ["2027-06-11", 369500],
  ],
});
const portugal = item("portugal-coast", {
  days: 5,
  level: "active",
  destinations: ["lisbon", "porto"],
  departures: [["2027-09-03", 219900]],
});
const japan = item("japan-slow", {
  days: 12,
  level: "relaxed",
  destinations: ["kyoto"],
  departures: [],
  startingPrice: 620000,
});
const all = [france, portugal, japan];

describe("parseTourFilters", () => {
  it("accepts only well-formed values", () => {
    expect(
      parseTourFilters({
        destination: "nice",
        month: "2027-05",
        duration: "medium",
        activity: "moderate",
        maxPrice: "350000",
      }),
    ).toEqual({
      destination: "nice",
      month: "2027-05",
      duration: "medium",
      activityLevel: "moderate",
      maxPrice: 350000,
    });
  });

  it("drops malformed or unknown values instead of throwing", () => {
    expect(
      parseTourFilters({
        destination: "Nice; drop table",
        month: "2027-13",
        duration: "forever",
        activity: "extreme",
        maxPrice: "cheap",
      }),
    ).toEqual({});
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ month: "2027-05" })).toBe(true);
  });

  it("takes the first value of repeated params", () => {
    expect(parseTourFilters({ destination: ["paris", "nice"] })).toEqual({ destination: "paris" });
  });
});

describe("filterTours", () => {
  it("returns everything with no filters", () => {
    expect(filterTours(all, {})).toHaveLength(3);
  });

  it("filters by destination slug", () => {
    expect(filterTours(all, { destination: "paris" }).map((t) => t.tour.slug)).toEqual([
      "southern-france",
    ]);
  });

  it("filters by month of an upcoming departure", () => {
    expect(filterTours(all, { month: "2027-06" }).map((t) => t.tour.slug)).toEqual([
      "southern-france",
    ]);
    expect(filterTours(all, { month: "2028-01" })).toHaveLength(0);
  });

  it("filters by duration bucket and activity level", () => {
    expect(filterTours(all, { duration: "short" }).map((t) => t.tour.slug)).toEqual([
      "portugal-coast",
    ]);
    expect(filterTours(all, { duration: "long" }).map((t) => t.tour.slug)).toEqual(["japan-slow"]);
    expect(filterTours(all, { activityLevel: "relaxed" }).map((t) => t.tour.slug)).toEqual([
      "japan-slow",
    ]);
  });

  it("filters by price using the cheapest departure, or the marketing price when none", () => {
    expect(filterTours(all, { maxPrice: 350000 }).map((t) => t.tour.slug)).toEqual([
      "southern-france",
      "portugal-coast",
    ]);
    expect(filterTours(all, { maxPrice: 700000 })).toHaveLength(3);
  });

  it("combines filters with AND", () => {
    expect(filterTours(all, { destination: "nice", month: "2027-09" })).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("computes the from-price", () => {
    expect(tourFromPrice(france)).toEqual({ amount: 349500, currency: "USD" });
    expect(tourFromPrice(japan)).toEqual({ amount: 620000, currency: "USD" });
    expect(
      tourFromPrice({ ...japan, version: { ...japan.version, starting_price_amount: null } }),
    ).toBeNull();
  });

  it("lists available months and destinations", () => {
    expect(availableMonths(all)).toEqual(["2027-05", "2027-06", "2027-09"]);
    expect(availableDestinations(all).map((d) => d.slug)).toEqual([
      "avignon",
      "kyoto",
      "lisbon",
      "nice",
      "paris",
      "porto",
    ]);
  });
});
