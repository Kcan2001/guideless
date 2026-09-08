import { momentsForToday, momentsNotShown } from "./today";

const NOW = new Date("2027-06-04T18:00:00Z");
const at = (iso: string, status = "scheduled") => ({ start_at: iso, status });

describe("momentsForToday", () => {
  it("keeps moments starting within the next 18 hours", () => {
    const list = [at("2027-06-04T20:00:00Z"), at("2027-06-05T09:00:00Z")];
    expect(momentsForToday(list, NOW, 5)).toHaveLength(2);
  });

  it("drops moments further out than the horizon", () => {
    expect(momentsForToday([at("2027-06-06T12:00:00Z")], NOW, 5)).toEqual([]);
  });

  it("keeps one that started inside the grace window and drops an older one", () => {
    const recent = at("2027-06-04T16:30:00Z");
    const stale = at("2027-06-04T09:00:00Z");
    expect(momentsForToday([stale, recent], NOW, 5)).toEqual([recent]);
  });

  it("puts a live moment first even when another starts sooner", () => {
    const live = at("2027-06-04T17:30:00Z", "live");
    const sooner = at("2027-06-04T18:30:00Z");
    expect(momentsForToday([sooner, live], NOW, 5)).toEqual([live, sooner]);
  });

  it("orders the rest by start time and respects the limit", () => {
    const later = at("2027-06-04T23:00:00Z");
    const earlier = at("2027-06-04T19:00:00Z");
    expect(momentsForToday([later, earlier], NOW, 1)).toEqual([earlier]);
  });

  it("ignores unparseable timestamps rather than throwing", () => {
    expect(momentsForToday([at("not-a-date")], NOW, 5)).toEqual([]);
  });
});

describe("momentsNotShown", () => {
  it("counts joinable moments the screen left out, including ones past the horizon", () => {
    const list = [
      at("2027-06-04T19:00:00Z"),
      at("2027-06-04T20:00:00Z"),
      at("2027-06-06T12:00:00Z"),
    ];
    expect(momentsNotShown(list, NOW, 2)).toBe(1);
  });

  it("does not count moments that have already been and gone", () => {
    expect(momentsNotShown([at("2027-06-04T09:00:00Z")], NOW, 2)).toBe(0);
  });
});
