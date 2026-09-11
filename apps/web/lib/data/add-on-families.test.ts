import { describe, expect, it } from "vitest";
import { addOnFamilies, type AddOnLike } from "@/lib/data/extras-shared";

function addOn(over: Partial<AddOnLike> & { id: string; price_amount: number }): AddOnLike {
  return {
    title: over.id,
    description: null,
    family: null,
    family_summary: null,
    ...over,
  };
}

describe("addOnFamilies", () => {
  it("collapses rows that share a family into one entry", () => {
    const families = addOnFamilies([
      addOn({
        id: "qual",
        title: "Amber Lounge yacht, qualifying day",
        family: "Yacht",
        price_amount: 638_000,
      }),
      addOn({
        id: "race",
        title: "Amber Lounge yacht, race day",
        family: "Yacht",
        price_amount: 870_000,
      }),
      addOn({
        id: "both",
        title: "Amber Lounge yacht, both days",
        family: "Yacht",
        price_amount: 1_470_000,
      }),
    ]);

    expect(families).toHaveLength(1);
    expect(families[0]!.title).toBe("Yacht");
    expect(families[0]!.variantCount).toBe(3);
  });

  it("prices a family from its cheapest variant, whatever order they arrive in", () => {
    const families = addOnFamilies([
      addOn({ id: "both", family: "Yacht", price_amount: 1_470_000 }),
      addOn({ id: "qual", family: "Yacht", price_amount: 638_000 }),
      addOn({ id: "race", family: "Yacht", price_amount: 870_000 }),
    ]);

    // The dearest arrived first; quoting it would overstate the entry by more than double.
    expect(families[0]!.fromAmount).toBe(638_000);
    expect(families[0]!.cheapest.id).toBe("qual");
  });

  it("marks a multi-variant family as From, and a lone add-on as exact", () => {
    const families = addOnFamilies([
      addOn({ id: "yacht-a", family: "Yacht", price_amount: 638_000 }),
      addOn({ id: "yacht-b", family: "Yacht", price_amount: 870_000 }),
      addOn({ id: "rocher", title: "Secteur Rocher", price_amount: 39_500 }),
    ]);

    const [yacht, rocher] = families;
    // "From" is a claim about a range. A lone add-on has no range, so stating one would be false.
    expect(yacht!.isFrom).toBe(true);
    expect(rocher!.isFrom).toBe(false);
    expect(rocher!.title).toBe("Secteur Rocher");
  });

  it("treats a null family as the add-on standing alone, never as a group of nulls", () => {
    const families = addOnFamilies([
      addOn({ id: "transfer", title: "Airport transfer", price_amount: 12_000 }),
      addOn({ id: "dinner", title: "Group dinner", price_amount: 9_000 }),
    ]);

    // The bug this guards: keying on `family` alone collapses every unfamilied row into one card.
    expect(families).toHaveLength(2);
    expect(families.map((f) => f.title)).toEqual(["Airport transfer", "Group dinner"]);
  });

  it("prefers family copy over a variant's own description", () => {
    const families = addOnFamilies([
      addOn({
        id: "qual",
        family: "Yacht",
        family_summary: "A day on a boat in Port Hercule. Pick your days when you build.",
        description: "Saturday only, with lunch and an open bar.",
        price_amount: 638_000,
      }),
    ]);

    // The variant description is true of one day and wrong on a card standing for all of them.
    expect(families[0]!.summary).toBe(
      "A day on a boat in Port Hercule. Pick your days when you build.",
    );
  });

  it("falls back to the cheapest variant's description when there is no family copy", () => {
    const families = addOnFamilies([
      addOn({
        id: "rocher",
        title: "Secteur Rocher",
        description: "Standing on the hill.",
        price_amount: 39_500,
      }),
    ]);

    expect(families[0]!.summary).toBe("Standing on the hill.");
  });

  it("keeps the catalogue's own ordering of families", () => {
    const families = addOnFamilies([
      addOn({ id: "rocher", title: "Secteur Rocher", price_amount: 39_500 }),
      addOn({ id: "gk", family: "Grandstand K", price_amount: 219_000 }),
      addOn({ id: "yacht", family: "Yacht", price_amount: 638_000 }),
      addOn({ id: "gk2", family: "Grandstand K", price_amount: 250_000 }),
    ]);

    // Position is curated in the catalogue; a second Grandstand row must not float the family down.
    expect(families.map((f) => f.title)).toEqual(["Secteur Rocher", "Grandstand K", "Yacht"]);
  });

  it("returns nothing for an empty catalogue", () => {
    expect(addOnFamilies([])).toEqual([]);
  });
});
