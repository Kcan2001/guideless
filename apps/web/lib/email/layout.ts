import { brand, emails } from "@guideless/config";

/**
 * The shell every Guideless email is built in, so writing a new one is a list of blocks rather
 * than forty lines of inline styles copied from the last template.
 *
 * Rules baked in rather than left to each template:
 *
 *   * Inline styles only, tables for anything that has to hold its shape. Email clients have not
 *     moved on and Gmail strips a `<style>` block.
 *   * Every string goes through `esc()`. A tour name with an ampersand in it should not be able
 *     to break the markup, and a traveler's own words end up in these.
 *   * A text version is produced from the same blocks rather than written twice, because the one
 *     that gets forgotten is always the text one and that is the one spam filters read.
 *   * A marketing email cannot be built without an unsubscribe link — `kind: "marketing"` requires
 *     the URL, and the type will not compile without it.
 *
 * Brand colours are literal here rather than imported from the design tokens: an email is rendered
 * by Gmail, not by our CSS, and a token that changes should not silently restyle mail already in
 * somebody's inbox.
 */

const INK = "#0B2025";
const MUTED = "#586266";
const SAND = "#DAD9D0";
const CLOUD = "#F5F6F2";
const CYAN = "#17B1DF";

export function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export type Block =
  | { kind: "text"; value: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "facts"; rows: Array<[string, string]> }
  | { kind: "quote"; value: string; attribution?: string }
  | { kind: "rule" };

/** A paragraph per blank line, which is how a person writes in a textarea. */
export function paragraphs(body: string): Block[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((value) => ({ kind: "text", value }) as Block);
}

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "text":
      return `<p style="margin:0 0 16px;line-height:1.65;font-size:15px">${esc(b.value).replace(/\n/g, "<br>")}</p>`;
    case "bullets":
      return `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.65;font-size:15px">${b.items
        .map((i) => `<li style="margin:0 0 6px">${esc(i)}</li>`)
        .join("")}</ul>`;
    case "facts":
      return `<table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 16px">${b.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:8px 0;color:${MUTED}${i ? `;border-top:1px solid ${SAND}` : ""}">${esc(k)}</td>` +
            `<td style="padding:8px 0;text-align:right;font-weight:600${i ? `;border-top:1px solid ${SAND}` : ""}">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`;
    case "quote":
      return (
        `<blockquote style="margin:0 0 16px;padding:0 0 0 16px;border-left:3px solid ${SAND};font-size:15px;line-height:1.65">` +
        `${esc(b.value)}${b.attribution ? `<br><span style="color:${MUTED};font-size:13px">— ${esc(b.attribution)}</span>` : ""}` +
        `</blockquote>`
      );
    case "rule":
      return `<hr style="border:none;border-top:1px solid ${SAND};margin:24px 0">`;
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "text":
      return b.value;
    case "bullets":
      return b.items.map((i) => `  - ${i}`).join("\n");
    case "facts":
      return b.rows.map(([k, v]) => `  ${k}: ${v}`).join("\n");
    case "quote":
      return `  "${b.value}"${b.attribution ? `\n  — ${b.attribution}` : ""}`;
    case "rule":
      return "---";
  }
}

interface BaseEmail {
  eyebrow?: string;
  heading: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  /** A quieter line under the card — "reply to this and a person reads it", that sort of thing. */
  footNote?: string;
}

/**
 * Transactional mail goes to somebody about something they did. It carries no unsubscribe link,
 * deliberately: you cannot opt out of being told your booking is confirmed.
 */
export type EmailInput =
  | (BaseEmail & { kind: "transactional" })
  | (BaseEmail & { kind: "marketing"; unsubscribeUrl: string; reason: string });

export interface RenderedEmail {
  html: string;
  text: string;
}

export function renderEmail(input: EmailInput): RenderedEmail {
  const marketing = input.kind === "marketing" ? input : null;

  const html = `<!doctype html>
<html><body style="margin:0;background:${CLOUD};font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:${INK}">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-weight:700;font-size:18px;margin:0 0 24px">${esc(brand.name)}</p>
    <div style="background:#FFFFFF;border:1px solid ${SAND};border-radius:16px;padding:28px">
      ${
        input.eyebrow
          ? `<p style="margin:0;color:${MUTED};font-size:12px;letter-spacing:.18em;text-transform:uppercase">${esc(input.eyebrow)}</p>`
          : ""
      }
      <h1 style="margin:${input.eyebrow ? "8px" : "0"} 0 16px;font-size:26px;line-height:1.2">${esc(input.heading)}</h1>
      ${input.blocks.map(blockHtml).join("\n      ")}
      ${
        input.cta
          ? `<p style="margin:24px 0 0"><a href="${esc(input.cta.url)}" style="display:inline-block;background:${INK};color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(input.cta.label)}</a></p>`
          : ""
      }
    </div>
    ${input.footNote ? `<p style="margin:20px 0 0;color:${MUTED};font-size:13px">${esc(input.footNote)}</p>` : ""}
    <p style="margin:20px 0 0;color:${MUTED};font-size:13px">${esc(brand.tagline)} · <a href="mailto:${esc(emails.support)}" style="color:${CYAN}">${esc(emails.support)}</a></p>
    ${
      marketing
        ? `<p style="margin:12px 0 0;color:${MUTED};font-size:12px;line-height:1.5">You're getting this because ${esc(marketing.reason)}. <a href="${esc(marketing.unsubscribeUrl)}" style="color:${MUTED}">Stop these emails</a> — one click, no questions.</p>`
        : ""
    }
  </div>
</body></html>`;

  const text = [
    brand.name,
    "",
    input.heading,
    "",
    ...input.blocks.map(blockText),
    ...(input.cta ? ["", `${input.cta.label}: ${input.cta.url}`] : []),
    ...(input.footNote ? ["", input.footNote] : []),
    "",
    brand.tagline,
    emails.support,
    ...(marketing
      ? [
          "",
          `You're getting this because ${marketing.reason}.`,
          `Stop these emails: ${marketing.unsubscribeUrl}`,
        ]
      : []),
  ].join("\n");

  return { html, text };
}
