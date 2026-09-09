import { describe, expect, it } from "vitest";
import {
  VIATOR_PARTNER_ID,
  attributeViatorUrl,
  operatorNotice,
} from "@/lib/experiences/attribution";

/**
 * An unattributed outbound link earns nothing and looks exactly like one that works. The failure is
 * invisible until a commission statement comes back empty, which is precisely why this is tested.
 */

const PRODUCT = "https://www.viator.com/tours/Nice/Old-Town-Food-Walk/d5265-12345P1";

describe("attribution", () => {
  it("puts our partner id on the link", () => {
    const url = new URL(attributeViatorUrl(PRODUCT)!);
    expect(url.searchParams.get("pid")).toBe(VIATOR_PARTNER_ID);
    expect(url.searchParams.get("medium")).toBe("api");
  });

  it("keeps the path and any parameters the supplier already had", () => {
    const url = new URL(attributeViatorUrl(`${PRODUCT}?ref=abc`)!);
    expect(url.pathname).toContain("Old-Town-Food-Walk");
    expect(url.searchParams.get("ref")).toBe("abc");
  });

  // A supplier URL carrying somebody else's pid would otherwise credit them for our traveler.
  it("overwrites a partner id that is not ours", () => {
    const url = new URL(attributeViatorUrl(`${PRODUCT}?pid=P00000001`)!);
    expect(url.searchParams.get("pid")).toBe(VIATOR_PARTNER_ID);
  });

  it("tags the campaign when told where the click came from", () => {
    const url = new URL(attributeViatorUrl(PRODUCT, { campaign: "explore-tab" })!);
    expect(url.searchParams.get("campaign")).toBe("explore-tab");
  });

  it("leaves the campaign off when there isn't one, rather than sending an empty string", () => {
    expect(new URL(attributeViatorUrl(PRODUCT)!).searchParams.has("campaign")).toBe(false);
  });

  it("works on their regional and shop hosts", () => {
    for (const host of [
      "https://www.viator.com/x",
      "https://viator.com/x",
      "https://shop.viator.com/x",
    ]) {
      expect(attributeViatorUrl(host)).not.toBeNull();
    }
  });

  // Refusing is the right answer: rewriting an arbitrary URL would be a redirect we do not control.
  it("refuses a URL that is not theirs", () => {
    expect(attributeViatorUrl("https://example.com/tours/1")).toBeNull();
    expect(attributeViatorUrl("https://notviator.com/x")).toBeNull();
    expect(attributeViatorUrl("https://viator.com.evil.test/x")).toBeNull();
  });

  it("drops a malformed URL rather than rendering a broken link", () => {
    expect(attributeViatorUrl("not a url")).toBeNull();
    expect(attributeViatorUrl("")).toBeNull();
  });
});

describe("what the traveler is told", () => {
  it("names the operator instead of hiding behind 'our partner'", () => {
    const notice = operatorNotice("Viator");
    expect(notice).toContain("Operated by Viator");
    expect(notice).not.toContain("our partner");
  });

  it("says both that we book it and whose terms it runs under", () => {
    const notice = operatorNotice("Viator");
    expect(notice).toContain("We book it for you");
    expect(notice).toContain("terms");
  });
});
