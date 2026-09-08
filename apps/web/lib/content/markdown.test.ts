import { describe, expect, it } from "vitest";
import { markdownToPlainText, parseInline, parseMarkdown, readingMinutes } from "./markdown";

describe("parseInline", () => {
  it("keeps plain text whole", () => {
    expect(parseInline("Nice in May")).toEqual([{ type: "text", value: "Nice in May" }]);
  });

  it("reads bold, italic and links", () => {
    expect(parseInline("**Race week** is *busy*; see [the trip](/tours/monaco)")).toEqual([
      { type: "bold", value: "Race week" },
      { type: "text", value: " is " },
      { type: "italic", value: "busy" },
      { type: "text", value: "; see " },
      { type: "link", value: "the trip", href: "/tours/monaco" },
    ]);
  });

  it("allows absolute http links", () => {
    expect(parseInline("[Duffel](https://duffel.com)")).toEqual([
      { type: "link", value: "Duffel", href: "https://duffel.com" },
    ]);
  });

  it("degrades an unsafe link to its text rather than dropping it", () => {
    // The body is staff-written, but a script URL must never survive into an href.
    const script = parseInline("[click](javascript:alert(1))");
    expect(script.some((i) => i.type === "link")).toBe(false);
    expect(script.map((i) => i.value).join("")).toContain("click");
    expect(parseInline("[x](//evil.example)")).toEqual([{ type: "text", value: "x" }]);
  });

  it("leaves unmatched syntax literal", () => {
    expect(parseInline("2 * 3 * 4 = 24")).toEqual([{ type: "text", value: "2 * 3 * 4 = 24" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits paragraphs on blank lines and joins wrapped lines", () => {
    const blocks = parseMarkdown("One line\nstill one.\n\nSecond.");
    expect(blocks).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "One line still one." }] },
      { type: "paragraph", content: [{ type: "text", value: "Second." }] },
    ]);
  });

  it("reads headings at two levels", () => {
    const blocks = parseMarkdown("## Where to stay\n### The port");
    expect(blocks.map((b) => b.type === "heading" && b.level)).toEqual([2, 3]);
  });

  it("groups bullets into one list and numbers into another", () => {
    const blocks = parseMarkdown("- one\n- two\n\n1. first\n2. second");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true });
    expect(blocks[0].type === "list" && blocks[0].items).toHaveLength(2);
  });

  it("starts a new list when the marker changes without a blank line", () => {
    const blocks = parseMarkdown("- bullet\n1. number");
    expect(blocks.map((b) => b.type === "list" && b.ordered)).toEqual([false, true]);
  });

  it("collects a quote", () => {
    expect(parseMarkdown("> Nobody wanted a guide.")).toEqual([
      { type: "quote", content: [{ type: "text", value: "Nobody wanted a guide." }] },
    ]);
  });

  it("closes an open list before a heading", () => {
    const blocks = parseMarkdown("- one\n## After");
    expect(blocks.map((b) => b.type)).toEqual(["list", "heading"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
  });

  it("handles Windows line endings", () => {
    expect(parseMarkdown("One.\r\n\r\nTwo.")).toHaveLength(2);
  });
});

describe("markdownToPlainText", () => {
  it("strips marks and collapses whitespace", () => {
    expect(markdownToPlainText("## Title\n\n**Bold** and [link](/x).")).toBe(
      "Title Bold and link.",
    );
  });

  it("truncates on a word boundary", () => {
    const source = "The quick brown fox jumps over the lazy dog";
    const text = markdownToPlainText(source, 20);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(21);
    // The kept part is a whole-word prefix: the source continues with a space, not more letters.
    const kept = text.slice(0, -1);
    expect(source.startsWith(kept)).toBe(true);
    expect(source[kept.length]).toBe(" ");
  });

  it("leaves short text untouched", () => {
    expect(markdownToPlainText("Short.", 100)).toBe("Short.");
  });
});

describe("readingMinutes", () => {
  it("is at least a minute", () => {
    expect(readingMinutes("Three words here")).toBe(1);
  });

  it("scales with length", () => {
    expect(readingMinutes(Array(440).fill("word").join(" "))).toBe(2);
    expect(readingMinutes(Array(441).fill("word").join(" "))).toBe(3);
  });
});
