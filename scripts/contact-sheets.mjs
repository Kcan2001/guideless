// Numbered contact sheets for choosing photos from guideless_photos/_library.
//
//   node scripts/contact-sheets.mjs --dir guideless_photos/_library/southern-france/nice --out <dir> [--per 36] [--cols 6]
//
// Writes <out>/<folder>-<n>.jpg sheets with an index badge on every tile and <out>/<folder>.json
// mapping index → file, so a reviewer can say "nice 12, 27, 40" and a script can resolve them.

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const DIR = opt("dir", null);
const OUT = opt("out", "guideless_photos/_sheets");
const PER = Number(opt("per", 36));
const COLS = Number(opt("cols", 6));
if (!DIR) {
  console.error(
    "Usage: node scripts/contact-sheets.mjs --dir <folder> [--out <dir>] [--per 36] [--cols 6]",
  );
  process.exit(1);
}
const W = 240;
const H = 180;
const files = readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();
mkdirSync(OUT, { recursive: true });
const label = basename(DIR);
const map = files.map((f, i) => ({ index: i + 1, file: join(DIR, f).replace(/\\/g, "/") }));
writeFileSync(join(OUT, `${label}.json`), JSON.stringify(map, null, 2));

for (let s = 0; s * PER < files.length; s++) {
  const slice = files.slice(s * PER, (s + 1) * PER);
  const rows = Math.ceil(slice.length / COLS);
  const comps = [];
  for (let i = 0; i < slice.length; i++) {
    const idx = s * PER + i + 1;
    const tile = await sharp(join(DIR, slice[i]))
      .resize(W, H, { fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    const badge = Buffer.from(
      `<svg width="${W}" height="${H}"><rect x="6" y="6" width="${18 + String(idx).length * 11}" height="24" rx="6" fill="#0B2025" opacity="0.85"/><text x="14" y="24" font-family="Arial" font-size="17" font-weight="700" fill="#60E1BB">${idx}</text></svg>`,
    );
    comps.push({ input: tile, left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
    comps.push({ input: badge, left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
  }
  const out = join(OUT, `${label}-${s + 1}.jpg`);
  await sharp({ create: { width: W * COLS, height: H * rows, channels: 3, background: "#0B2025" } })
    .composite(comps)
    .jpeg({ quality: 78 })
    .toFile(out);
  console.log(out, slice.length);
}
