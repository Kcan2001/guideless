import { relativeTime, sortInbox, unreadCount } from "./inbox-helpers";

describe("sortInbox", () => {
  it("puts unread first, newest first within each group", () => {
    const rows = [
      { id: "a", read_at: "2026-09-01T00:00:00Z", created_at: "2026-09-06T10:00:00Z" },
      { id: "b", read_at: null, created_at: "2026-09-05T10:00:00Z" },
      { id: "c", read_at: null, created_at: "2026-09-06T09:00:00Z" },
      { id: "d", read_at: "2026-09-01T00:00:00Z", created_at: "2026-09-04T10:00:00Z" },
    ];
    expect(sortInbox(rows).map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
    expect(unreadCount(rows)).toBe(2);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  it("is short and human", () => {
    expect(relativeTime("2026-09-06T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-09-06T11:35:00Z", now)).toBe("25 min");
    expect(relativeTime("2026-09-06T09:00:00Z", now)).toBe("3 h");
    expect(relativeTime("2026-09-05T11:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-09-03T12:00:00Z", now)).toBe("3 days");
    expect(relativeTime("2026-08-01T12:00:00Z", now)).toMatch(/Aug 1/);
  });
});
