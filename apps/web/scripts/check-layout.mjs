// Catch the obvious layout errors in a rendered page before a person has to.
//
//   node apps/web/scripts/check-layout.mjs <file-or-url> [--widths 1999,1440,1100,390]
//
// It opens the page at each width and fails on the things that are embarrassing to ship and
// tedious to spot by eye:
//
//   1. Siblings in a row that are not the same height — a card ending 18px above its neighbours is
//      the exact defect that shipped in the design-system artifact.
//   2. Anything overflowing its rounded container, which reads as an image bleeding past a border.
//   3. The page scrolling sideways.
//   4. Text below 4.5:1 against what is actually painted behind it, including over photographs,
//      which is where a dark-looking hero quietly fails.
//   5. Images with no alt attribute at all.
//
// Reads only, exits non-zero on a failure so it can gate a publish.

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const widthArg = args.indexOf("--widths");
const themeArg = args.indexOf("--theme");
// "both" runs the whole sweep twice. An artifact renders in the viewer's theme, and a colour that
// only exists inside one media block is the classic unreadable-page bug.
const THEME = themeArg >= 0 && args[themeArg + 1] ? args[themeArg + 1] : "light";
const WIDTHS =
  widthArg >= 0 && args[widthArg + 1]
    ? args[widthArg + 1].split(",").map(Number)
    : [1999, 1440, 1100, 390];

if (!target) {
  console.error("Usage: node apps/web/scripts/check-layout.mjs <file-or-url> [--widths 1440,390]");
  process.exit(1);
}
const url = /^https?:\/\//.test(target) ? target : `file:///${target.replace(/\\/g, "/")}`;

const browser = await chromium.launch();
const problems = [];
const THEMES = THEME === "both" ? ["light", "dark"] : [THEME];

for (const theme of THEMES)
  for (const width of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      colorScheme: theme === "dark" ? "dark" : "light",
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);

    const found = await page.evaluate(() => {
      const out = [];
      const round = (n) => Math.round(n);
      const label = (el) =>
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;

      // ── 1. Rows of siblings that should line up ──────────────────────────
      for (const parent of document.querySelectorAll("*")) {
        const kids = [...parent.children].filter((k) => {
          const r = k.getBoundingClientRect();
          return r.width > 40 && r.height > 40;
        });
        if (kids.length < 2) continue;
        const tops = kids.map((k) => round(k.getBoundingClientRect().top));
        // Only a genuine row: every child shares a top edge.
        if (new Set(tops).size !== 1) continue;
        // And only genuine PEERS. A desktop frame beside a phone frame is a row whose items are
        // meant to differ; three cards in a grid are not. Peers share a tag and a first class.
        const kinds = new Set(
          kids.map((k) => {
            const cls = typeof k.className === "string" ? k.className.trim().split(/\s+/)[0] : "";
            return `${k.tagName}.${cls}`;
          }),
        );
        if (kinds.size !== 1) continue;
        if ([...kinds][0].endsWith(".")) continue; // no class at all: not a component row
        const heights = kids.map((k) => round(k.getBoundingClientRect().height));
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread > 2) {
          out.push({
            kind: "uneven-row",
            where: label(parent),
            detail: `${kids.length} items in a row differ by ${spread}px: ${heights.join(", ")}`,
          });
        }
      }

      // ── 2. Children escaping a clipped, rounded container ────────────────
      for (const box of document.querySelectorAll("*")) {
        const cs = getComputedStyle(box);
        if (cs.overflow === "visible") continue;
        if (parseFloat(cs.borderTopLeftRadius) < 2) continue;
        const br = box.getBoundingClientRect();
        if (br.width < 40) continue;
        for (const kid of box.querySelectorAll("img, video")) {
          const kr = kid.getBoundingClientRect();
          const over = Math.max(kr.right - br.right, br.left - kr.left, kr.bottom - br.bottom);
          if (over > 1.5) {
            out.push({
              kind: "overflow",
              where: label(box),
              detail: `${label(kid)} escapes by ${round(over)}px`,
            });
          }
        }
      }

      // ── 3. Sideways scroll ───────────────────────────────────────────────
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        out.push({
          kind: "h-scroll",
          where: "document",
          detail: `${document.documentElement.scrollWidth}px content in a ${window.innerWidth}px viewport`,
        });
      }

      // ── 4. Alt text ──────────────────────────────────────────────────────
      for (const img of document.querySelectorAll("img")) {
        if (!img.hasAttribute("alt")) {
          out.push({ kind: "no-alt", where: label(img), detail: img.currentSrc.slice(0, 60) });
        }
      }
      return out;
    });

    // ── 5. Contrast, sampled from what is actually painted ─────────────────
    const textNodes = await page.evaluate(() => {
      const picks = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (t.length < 4) continue;
        const el = n.parentElement;
        if (!el) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0" || cs.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.top > window.innerHeight * 6) continue;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        picks.push({
          text: t.slice(0, 40),
          color: cs.color,
          size: Math.round(size),
          large,
          x: Math.round(r.left + Math.min(r.width / 2, 30)),
          y: Math.round(r.top + r.height / 2),
          sel:
            el.tagName.toLowerCase() +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/)[0]
              : ""),
        });
      }
      // One sample per distinct colour/selector pair keeps this fast.
      const seen = new Set();
      return picks.filter((p) => {
        const k = p.sel + p.color + p.large;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });

    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    for (const t of textNodes) {
      // The ground is the element's own ancestry composited down, not the first background found.
      // A button paints its own fill, so hiding it and sampling underneath reports cloud-on-white for
      // a perfectly readable ink button; and a 6%-alpha inline code fill is not an opaque ground, it
      // is a tint over the page. Both were false positives before this walked and blended.
      const behind = await page.evaluate(
        ({ x, y }) => {
          const layers = [];
          let node = document.elementFromPoint(x, y);
          while (node) {
            const cs = getComputedStyle(node);
            if (cs.backgroundImage !== "none" || node.tagName === "IMG") return "IMAGE";
            const m = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
            if (m.length >= 3) {
              const a = m.length > 3 ? m[3] : 1;
              if (a > 0) {
                layers.push([m[0], m[1], m[2], a]);
                if (a >= 0.999) break;
              }
            }
            node = node.parentElement;
          }
          if (!layers.length) return null;
          // Composite from the bottom up.
          let [r, g, b] = layers[layers.length - 1];
          for (let i = layers.length - 2; i >= 0; i--) {
            const [sr, sg, sb, sa] = layers[i];
            r = sr * sa + r * (1 - sa);
            g = sg * sa + g * (1 - sa);
            b = sb * sa + b * (1 - sa);
          }
          return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        },
        { x: t.x, y: t.y },
      );
      if (!behind || behind === "IMAGE") continue; // Photographs need a human eye, not a sample.
      const r = ratio(parse(t.color), parse(behind));
      const need = t.large ? 3 : 4.5;
      if (r < need) {
        found.push({
          kind: "contrast",
          where: t.sel,
          detail: `${r.toFixed(2)}:1 needs ${need} — "${t.text}" ${t.color} on ${behind}`,
        });
      }
    }

    for (const f of found) problems.push({ width, theme, ...f });
    await page.close();
  }
await browser.close();

if (problems.length === 0) {
  console.log(`No layout problems at ${WIDTHS.join(", ")}px in ${THEMES.join(" and ")}.`);
  process.exit(0);
}
const byKind = {};
for (const p of problems) (byKind[p.kind] ??= []).push(p);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind.toUpperCase()} — ${list.length}`);
  const seen = new Set();
  for (const p of list) {
    const k = p.where + p.detail + p.theme;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  @${p.width} ${p.theme}  ${p.where}  ${p.detail}`);
  }
}
console.log(`\n${problems.length} problem(s).`);
process.exit(1);
