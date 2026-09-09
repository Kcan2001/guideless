import { describe, expect, it } from "vitest";
import { StubReservationProvider, draftMessage } from "@/lib/reservations/stub";
import { ReservationError } from "@/lib/reservations/types";

/**
 * The stub books nothing, so what is being tested is the *contract* — the sequence a real provider
 * will have to honour when item 7 arrives: a hold that expires, a confirm that refuses an expired
 * or unknown hold, and a price that is always zero because the assistant may not spend money.
 *
 * Testing a stub sounds like theatre until you remember that these assertions are the specification
 * the Viator adapter will be written against.
 */

const request = {
  placeRef: "mock:nice-oliviera",
  placeName: "Oliviera",
  partySize: 2,
  date: "2027-05-21",
  time: "20:00",
  timezone: "Europe/Paris",
  notes: undefined,
};

describe("the reservation contract", () => {
  it("quotes at zero — the assistant may never spend money", async () => {
    const provider = new StubReservationProvider();
    const quote = await provider.quote(request);
    expect(quote?.price).toBe(0);
  });

  it("says plainly that we are not holding the table", async () => {
    const provider = new StubReservationProvider();
    const quote = await provider.quote(request);
    expect(quote?.terms).toContain("does not hold");
  });

  it("turns a hold into a draft the traveler sends themselves", async () => {
    const provider = new StubReservationProvider();
    const quote = await provider.quote(request);
    const outcome = await provider.confirm(quote!.holdRef, request);
    expect(outcome.status).toBe("draft");
  });

  it("refuses a hold it never issued", async () => {
    const provider = new StubReservationProvider();
    await expect(provider.confirm("stub:made-up", request)).rejects.toBeInstanceOf(
      ReservationError,
    );
  });

  it("refuses an expired hold rather than quietly re-pricing", async () => {
    let now = Date.parse("2027-05-20T12:00:00Z");
    const provider = new StubReservationProvider(() => now);
    const quote = await provider.quote(request);
    now += 16 * 60 * 1000;
    await expect(provider.confirm(quote!.holdRef, request)).rejects.toMatchObject({
      code: "expired",
    });
  });

  it("cannot be confirmed twice off one hold", async () => {
    const provider = new StubReservationProvider();
    const quote = await provider.quote(request);
    await provider.confirm(quote!.holdRef, request);
    await expect(provider.confirm(quote!.holdRef, request)).rejects.toMatchObject({
      code: "unknown_hold",
    });
  });

  // "Cancelled: yes" for something that was never booked would be a comfortable lie.
  it("does not claim to cancel something it never booked", async () => {
    const provider = new StubReservationProvider();
    const result = await provider.cancel("whatever");
    expect(result.cancelled).toBe(false);
    expect(result.reason).toContain("nothing for us to cancel");
  });
});

describe("the draft message", () => {
  it("is something a person could actually send", () => {
    const text = draftMessage(request);
    expect(text).toContain("Oliviera");
    expect(text).toContain("2 people");
    expect(text).toContain("20:00");
  });

  it("says one person rather than 1 people", () => {
    expect(draftMessage({ ...request, partySize: 1 })).toContain("one person");
  });

  it("carries what they asked for", () => {
    expect(draftMessage({ ...request, notes: "Outside if possible." })).toContain(
      "Outside if possible.",
    );
  });
});
