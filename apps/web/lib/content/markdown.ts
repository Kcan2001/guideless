/**
 * A deliberately small Markdown subset for staff-written long-form content (journal posts and
 * destination guides).
 *
 * Why a subset rather than a Markdown library: the body is written by us, not by travelers, and the
 * only shapes travel writing needs are headings, paragraphs, lists, quotes, links and emphasis. A
 * parser would add a dependency and a sanitising step for output nobody asked for. This returns a
 * described tree that React renders as elements, so text is escaped by construction and a post can
 * never inject markup — there is no `dangerouslySetInnerHTML` anywhere in the path.
 *
 * Supported, and nothing else:
 *   ## Heading            → h2            ### Heading → h3
 *   - item                → bullet list   1. item     → numbered list
 *   > quote               → blockquote
 *   blank-line separated  → paragraphs
 *   **bold**  *italic*  [text](https://…)
 *
 * Anything unrecognised stays literal text, which is the honest failure: a stray `#` reads as a
 * `#`, it does not silently vanish.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "link"; value: string; href: string };

export type Block =
  | { type: "heading"; level: 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "quote"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

/** http(s) and site-relative links only: a body should never produce `javascript:` or `data:`. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

// Emphasis must hug its text (`*word*`, never `2 * 3 *`), or arithmetic in a body turns italic.
const INLINE = /(\*\*(?!\s)[^*\n]+(?<!\s)\*\*|\*(?!\s)[^*\n]+(?<!\s)\*|\[[^\]\n]+\]\([^)\s]+\))/g;

/** Splits one line into text and the three inline marks. Unmatched syntax stays literal. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index;
    if (start > last) out.push({ type: "text", value: line.slice(last, start) });
    last = start + token.length;

    if (token.startsWith("**")) {
      out.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const text = token.slice(1, split);
      const href = safeHref(token.slice(split + 2, -1));
      // A link we will not follow degrades to its text rather than disappearing.
      out.push(href ? { type: "link", value: text, href } : { type: "text", value: text });
    } else {
      out.push({ type: "italic", value: token.slice(1, -1) });
    }
  }
  if (last < line.length) out.push({ type: "text", value: line.slice(last) });
  return out.length ? out : [{ type: "text", value: "" }];
}

const BULLET = /^[-*]\s+(.*)$/;
const NUMBER = /^\d+[.)]\s+(.*)$/;

/** Markdown subset → blocks. Never throws: unparseable input becomes paragraphs. */
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ").trim()) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: "list",
      ordered: list.ordered,
      items: list.items.map((i) => parseInline(i)),
    });
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push({ type: "quote", content: parseInline(quote.join(" ").trim()) });
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushAll();
      continue;
    }
    if (line.startsWith("### ")) {
      flushAll();
      blocks.push({ type: "heading", level: 3, content: parseInline(line.slice(4).trim()) });
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "heading", level: 2, content: parseInline(line.slice(3).trim()) });
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2).trim());
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBER.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const ordered = Boolean(numbered);
      const text = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      // A switch between bullets and numbers starts a new list rather than mixing them.
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push(text);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}

/** Plain text for meta descriptions and list summaries: marks stripped, whitespace collapsed. */
export function markdownToPlainText(source: string, maxLength = 200): string {
  const text = parseMarkdown(source)
    .map((block) => {
      if (block.type === "list") return block.items.map(inlineText).join(" ");
      return inlineText(block.content);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  // Cut at a word boundary so a description never ends mid-word.
  const cut = text.slice(0, maxLength);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxLength * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function inlineText(content: Inline[]): string {
  return content.map((i) => i.value).join("");
}

/** Rough reading time, rounded up, minimum one minute. 220 words a minute reads as unhurried. */
export function readingMinutes(source: string): number {
  const words = markdownToPlainText(source, Number.MAX_SAFE_INTEGER).split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 220));
}
