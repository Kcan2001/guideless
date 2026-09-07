// Sorts a photo library into trip folders by the GPS coordinates in each file's EXIF.
//
//   node scripts/sort-photos-by-location.mjs --src "C:/Users/me/Pictures/iCloud Photos/Photos" \
//        --dest guideless_photos/_library [--dry-run]
//
// With --list, only the listed files are scanned (handy for iCloud libraries where most files are
// cloud placeholders that would download on first read). Reads EXIF through sharp (JPEG, HEIC, PNG, WebP, TIFF), parses the GPS IFD ourselves (no extra
// dependency), and copies matches into <dest>/<trip>/<region>/<date>_<name>.<ext>. Originals are
// never modified. HEIC files are copied as-is; run scripts/convert-heic.ps1 afterwards to produce
// the JPEGs the social import expects. A manifest (index.json) records every copied file with its
// coordinates so a later pass can regroup or caption them.
//
// Regions (rough bounding boxes, good enough to route a personal library):
//   monaco-grand-prix/monaco      Monaco proper
//   southern-france/nice          Riviera from Antibes to Menton (minus Monaco)
//   southern-france/avignon       Avignon, Châteauneuf-du-Pape, Arles, Provence
//   southern-france/paris         Paris and inner suburbs
//   southern-france/other-france  elsewhere in mainland France (may include border towns)

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SRC = opt("src", null);
const LIST = opt("list", null); // text file, one absolute path per line (e.g. only locally available iCloud files)
const DEST = opt("dest", "guideless_photos/_library");
const DRY = args.includes("--dry-run");
if (!SRC && !LIST) {
  console.error(
    "Usage: node scripts/sort-photos-by-location.mjs (--src <dir> | --list <file>) [--dest <dir>] [--dry-run]",
  );
  process.exit(1);
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".heic", ".heif", ".png", ".webp", ".tif", ".tiff"]);

const REGIONS = [
  { trip: "monaco-grand-prix", region: "monaco", lat: [43.715, 43.765], lon: [7.395, 7.445] },
  { trip: "southern-france", region: "nice", lat: [43.45, 43.95], lon: [6.75, 7.6] },
  { trip: "southern-france", region: "avignon", lat: [43.55, 44.35], lon: [4.3, 5.3] },
  { trip: "southern-france", region: "paris", lat: [48.7, 49.05], lon: [2.1, 2.6] },
  { trip: "southern-france", region: "other-france", lat: [42.33, 51.1], lon: [-4.8, 8.25] },
];

function classify(lat, lon) {
  for (const r of REGIONS) {
    if (lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1]) return r;
  }
  return null;
}

// ── Minimal EXIF/TIFF reader: GPS latitude/longitude and the original date ──────
function parseExif(buf) {
  if (!buf || buf.length < 16) return null;
  let start = 0;
  if (buf.slice(0, 4).toString("latin1") === "Exif") start = 6;
  const bo = buf.slice(start, start + 2).toString("latin1");
  const le = bo === "II";
  if (!le && bo !== "MM") return null;
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd0 = start + u32(start + 4);

  const readIfd = (off) => {
    const out = new Map();
    if (off + 2 > buf.length) return out;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > buf.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] ?? 1;
      const total = size * count;
      const valOff = total <= 4 ? e + 8 : start + u32(e + 8);
      out.set(tag, { type, count, off: valOff });
    }
    return out;
  };
  const ascii = (v) => buf.slice(v.off, v.off + v.count).toString("latin1").replace(/\0+$/, "");
  const rationals = (v) => {
    const arr = [];
    for (let i = 0; i < v.count; i++) {
      const o = v.off + i * 8;
      if (o + 8 > buf.length) break;
      const num = u32(o);
      const den = u32(o + 4);
      arr.push(den ? num / den : 0);
    }
    return arr;
  };
  const dms = (a) => (a.length >= 3 ? a[0] + a[1] / 60 + a[2] / 3600 : a[0] ?? NaN);

  const main = readIfd(ifd0);
  let date = null;
  const exifPtr = main.get(0x8769);
  if (exifPtr) {
    const exif = readIfd(start + u32(exifPtr.off));
    const d = exif.get(0x9003);
    if (d) date = ascii(d);
  }
  if (!date && main.get(0x0132)) date = ascii(main.get(0x0132));

  const gpsPtr = main.get(0x8825);
  if (!gpsPtr) return { lat: null, lon: null, date };
  const gps = readIfd(start + u32(gpsPtr.off));
  const latRef = gps.get(0x0001) ? ascii(gps.get(0x0001)) : "N";
  const lonRef = gps.get(0x0003) ? ascii(gps.get(0x0003)) : "E";
  const latV = gps.get(0x0002);
  const lonV = gps.get(0x0004);
  if (!latV || !lonV) return { lat: null, lon: null, date };
  let lat = dms(rationals(latV));
  let lon = dms(rationals(lonV));
  if (latRef.startsWith("S")) lat = -lat;
  if (lonRef.startsWith("W")) lon = -lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return { lat: null, lon: null, date };
  }
  return { lat, lon, date };
}

// ── Scan ────────────────────────────────────────────────────────────────────────
const files = LIST
  ? readFileSync(LIST, "utf8")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\uFEFF/, "").trim())
      .filter((l) => l && IMAGE_EXT.has(extname(l).toLowerCase()))
  : readdirSync(SRC)
      .filter((n) => IMAGE_EXT.has(extname(n).toLowerCase()))
      .map((n) => join(SRC, n));
console.log(`${files.length} image files in ${LIST ?? SRC}`);

const manifest = [];
const counts = {};
let noGps = 0;
let unreadable = 0;
let done = 0;

for (const file of files) {
  done++;
  if (done % 1000 === 0) console.log(`  …${done}/${files.length}`);
  let meta;
  try {
    meta = await sharp(file, { failOn: "none" }).metadata();
  } catch {
    unreadable++;
    continue;
  }
  const ex = parseExif(meta.exif);
  if (!ex || ex.lat == null) {
    noGps++;
    continue;
  }
  const r = classify(ex.lat, ex.lon);
  if (!r) continue;
  const key = `${r.trip}/${r.region}`;
  counts[key] = (counts[key] ?? 0) + 1;

  const dateStr = ex.date ? ex.date.slice(0, 10).replace(/:/g, "-") : "undated";
  const ext = extname(file).toLowerCase() === ".jpeg" ? ".jpg" : extname(file).toLowerCase();
  const name = `${dateStr}_${basename(file, extname(file)).replace(/[^\w()-]+/g, "_")}${ext}`;
  const outDir = join(DEST, r.trip, r.region);
  const out = join(outDir, name);
  manifest.push({ file: `${r.trip}/${r.region}/${name}`, source: basename(file), lat: ex.lat, lon: ex.lon, date: ex.date });
  if (!DRY) {
    mkdirSync(outDir, { recursive: true });
    if (!existsSync(out) || statSync(out).size !== statSync(file).size) copyFileSync(file, out);
  }
}

if (!DRY) {
  mkdirSync(DEST, { recursive: true });
  writeFileSync(join(DEST, "index.json"), JSON.stringify(manifest, null, 2));
}
console.log(`\nunreadable: ${unreadable} · without GPS: ${noGps} · matched: ${manifest.length}`);
for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(34)} ${v}`);
console.log(DRY ? "\n(dry run: nothing copied)" : `\nCopied into ${DEST} (index.json written)`);
