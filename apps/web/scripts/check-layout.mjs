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
    // Overlays come out BEFORE anything is collected. The consent banner is `fixed`, so in a
    // full-page capture it lies across whatever content sits at that scroll offset. Removing it
    // after collection was worse than not removing it at all: the banner's own text stayed in the
    // node list with coordinates now pointing at unrelated content, so "Privacy policy" was
    // reported against a different ground on every page.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
        if (getComputedStyle(el).position === "fixed") el.remove();
      }
    });
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
        // The TEXT NODE's own rect, not its parent's box. `<h1>Group trips, <span>built your
        // way.</span></h1>` has one box covering both colours, and the aqua span filled enough of
        // it that the dominant-colour sampler nominated aqua as the ground for the cloud words —
        // reporting 1.49:1 for type that is nowhere near the aqua.
        const range = document.createRange();
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.top > window.innerHeight * 6) continue;
        const x = Math.round(r.left + Math.min(r.width / 2, 30));
        const y = Math.round(r.top + r.height / 2);
        // Is this text actually painted at that point, or is something on top of it?
        // A closed <details> menu still computes `display: block` with a real rect, so the visibility
        // checks above pass and the gate happily measured ink-on-ink for a menu nobody can see.
        // Hit-testing is the only honest answer to "is this on screen".
        const top = document.elementFromPoint(x, y);
        if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        picks.push({
          text: t.slice(0, 40),
          color: cs.color,
          size: Math.round(size),
          large,
          x,
          y,
          // The text's box, for sampling the painted ground beside it.
          left: Math.round(r.left),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          width: Math.round(r.width),
          height: Math.round(r.height),
          // An element that paints its own opaque fill IS its own ground. Sampling pixels beside
          // an aqua button reads the dark hero underneath and reports ink-on-ink at 1.00:1 for a
          // button that is actually 10.4:1 — the single loudest false positive in this check.
          // An element that paints its own opaque fill IS its own ground: sampling pixels beside an
          // aqua button reads the dark hero underneath and reports ink-on-ink at 1.00:1 for a
          // button that is really 10.4:1.
          //
          // Deliberately shallow — the element and two ancestors, and only while the box stays
          // close to the size of the text. Walking further reached `body` and returned its cloud
          // for a wordmark sitting on a transparent header over a photograph, which is the same
          // false positive in the other direction. Past that point the painted pixels are the
          // better answer, so we stop and let them speak.
          ownBg: (() => {
            let node = el;
            for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
              const cs = getComputedStyle(node);
              if (node.getBoundingClientRect().height > r.height * 4) return null;
              if (cs.backgroundImage !== "none") return null;
              const m = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
              if (m.length >= 3 && (m.length < 4 || m[3] >= 0.999)) return cs.backgroundColor;
            }
            return null;
          })(),
          sel:
            el.tagName.toLowerCase() +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/)[0]
              : ""),
        });
      }
      // Every node, not one per selector/colour pair.
      //
      // The old dedupe hid a real bug: `p.font-semibold` in cloud appears both on an ink band
      // (fine) and inside a white card sitting on that band (1.03:1, invisible). Sampling the first
      // and skipping the rest reported the page clean. The same class on a different ground is a
      // different question, and the ground is not known until after measuring — so measure them
      // all. It costs one screenshot and one batched evaluate, which is what it cost before.
      return picks;
    });

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

    // ── The ground comes from the pixels, not from the DOM ────────────────
    //
    // Compositing background-colours up the ancestor chain gets the common case right and the
    // interesting cases wrong, because what is painted behind a pixel is not always an ancestor.
    // The site header is transparent and overlays the hero photograph — a *sibling* pulled up under
    // it — so the DOM walk found `body`'s cloud and reported cloud-on-cloud at 1.00:1 for nav links
    // that actually sit at 14:1 over a dark photo. Seven false failures on every page with a hero.
    //
    // So: screenshot once per width, then sample the real painted pixels in a band beside each run
    // of text. Both tails are checked — the brightest pixels are the worst case for light text and
    // the darkest are the worst case for dark text — and the lower ratio is the one reported.
    // Full page, not the viewport. Text below the fold has a bounding box past the viewport edge,
    // and clamping its sample band to that edge measured whatever happened to be sitting there —
    // the cookie banner, in practice, which is white and reported cloud-on-white for a heading on
    // an ink band. Nothing is ever scrolled here, so client coordinates are document coordinates.
    const shot = (await page.screenshot({ type: "png", fullPage: true })).toString("base64");
    const measured = await page.evaluate(
      async ({ b64, nodes }) => {
        const img = new Image();
        await new Promise((r) => {
          img.onload = r;
          img.src = "data:image/png;base64," + b64;
        });
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const probe = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true,
        });
        const resolve = (c) => {
          // clearRect matters: the probe canvas is reused for every node, and fillRect composites
          // onto whatever is already there. Without it a translucent colour painted over the last
          // one saturates towards opaque, so `text-ink/55` measured as full-strength ink and the
          // gate stopped reporting exactly the failures it exists to catch.
          probe.clearRect(0, 0, 1, 1);
          probe.fillStyle = "#000";
          probe.fillStyle = c;
          probe.fillRect(0, 0, 1, 1);
          const d = probe.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        return nodes.map((n) => {
          // The ground is sampled INSIDE the text's own box, not in a band beneath it.
          //
          // A band below crosses boundaries: under a `dt` near the bottom of a card it landed on
          // the next card's photograph and reported muted-grey on sky blue. Inside the box there
          // is nowhere else to land. Glyphs cover a minority of the pixels, so the most common
          // colour in the box IS the background — and pixels close to the text colour are dropped
          // so dense type cannot nominate itself as its own ground.
          const x = Math.min(Math.max(n.left, 0), img.width - 2);
          const y = Math.min(Math.max(n.top, 0), img.height - 2);
          const w = Math.max(2, Math.min(n.width, img.width - x));
          const h = Math.max(2, Math.min(n.height, img.height - y));
          const box = ctx.getImageData(x, y, w, h).data;
          const fgProbe = resolve(n.color);
          const near = (p) =>
            Math.abs(p[0] - fgProbe[0]) +
              Math.abs(p[1] - fgProbe[1]) +
              Math.abs(p[2] - fgProbe[2]) <
            60;
          const counts = new Map();
          for (let i = 0; i < box.length; i += 4) {
            const px = [box[i], box[i + 1], box[i + 2]];
            if (fgProbe[3] > 0.9 && near(px)) continue;
            // Quantise so anti-aliasing does not shatter the background into a thousand buckets.
            const k = (px[0] >> 3) * 4096 + (px[1] >> 3) * 64 + (px[2] >> 3);
            const e = counts.get(k);
            if (e) e.n++;
            else counts.set(k, { n: 1, px });
          }
          if (!counts.size) return null;
          let best = null;
          for (const e of counts.values()) if (!best || e.n > best.n) best = e;
          const dark = best.px;
          const light = best.px;
          const fg = resolve(n.color);
          // Translucent text is blended onto whichever ground it is being measured against.
          const on = (g) => [0, 1, 2].map((i) => fg[i] * fg[3] + g[i] * (1 - fg[3]));
          if (n.ownBg) {
            const own = resolve(n.ownBg).slice(0, 3);
            return { dark: own, light: own, fgOnDark: on(own), fgOnLight: on(own) };
          }
          return { dark, light, fgOnDark: on(dark), fgOnLight: on(light) };
        });
      },
      { b64: shot, nodes: textNodes },
    );

    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i];
      const m = measured[i];
      if (!m) continue;
      const need = t.large ? 3 : 4.5;
      // The worse of the two tails. A gradient or a photograph gives a range, and text has to hold
      // across it, not merely at the average.
      const onDark = ratio(m.fgOnDark, m.dark);
      const onLight = ratio(m.fgOnLight, m.light);
      const r = Math.min(onDark, onLight);
      const ground = onDark < onLight ? m.dark : m.light;
      if (r < need) {
        // Deduped on the way out instead: identical selector, colour and ground is one finding.
        found.push({
          kind: "contrast",
          where: t.sel,
          detail: `${r.toFixed(2)}:1 needs ${need} — "${t.text}" ${t.color} on rgb(${ground.join(", ")})`,
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
