import { deepLinkToPath, parseDeepLinkUrl } from "./deep-links";

describe("deep links", () => {
  it("maps shared DeepLink shapes to app routes", () => {
    expect(deepLinkToPath({ kind: "trip", tripId: "t1" })).toBe("/itinerary/t1");
    expect(deepLinkToPath({ kind: "itinerary_item", tripId: "t1", itemId: "i9" })).toBe("/item/i9");
    expect(deepLinkToPath({ kind: "chat_room", roomId: "r2" })).toBe("/chat/r2");
    expect(deepLinkToPath({ kind: "support_thread", threadId: "s3" })).toBe("/support/s3");
    expect(deepLinkToPath({ kind: "live_moment", tripId: "t1", momentId: "m5" })).toBe("/group");
    expect(deepLinkToPath({ kind: "payment", bookingId: "b4" })).toBeNull();
  });

  it("parses guideless:// URLs from the spec", () => {
    expect(parseDeepLinkUrl("guideless://trip/123/itinerary/456")).toEqual({
      kind: "itinerary_item",
      tripId: "123",
      itemId: "456",
    });
    expect(parseDeepLinkUrl("guideless://trip/123")).toEqual({ kind: "trip", tripId: "123" });
    expect(parseDeepLinkUrl("guideless://chat/abc?x=1")).toEqual({
      kind: "chat_room",
      roomId: "abc",
    });
    expect(parseDeepLinkUrl("guideless://support/def")).toEqual({
      kind: "support_thread",
      threadId: "def",
    });
    expect(parseDeepLinkUrl("guideless://booking/b1/payment")).toEqual({
      kind: "payment",
      bookingId: "b1",
    });
    expect(parseDeepLinkUrl("guideless://nonsense")).toBeNull();
  });

  it("round-trips a URL into a route", () => {
    const link = parseDeepLinkUrl("guideless://trip/t1/itinerary/i1")!;
    expect(deepLinkToPath(link)).toBe("/item/i1");
  });
});
