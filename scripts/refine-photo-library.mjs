// Second pass over guideless_photos/_library: gives the catch-all "other-france" folder named
// sub-folders by place, and moves anything outside France (bounding-box leaks) to _library/not-france.
// Works from index.json written by sort-photos-by-location.mjs and rewrites it.
//
//   node scripts/refine-photo-library.mjs [--dest guideless_photos/_library]

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  rmdirSync,
  readdirSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const args = process.argv.slice(2);
const i = args.indexOf("--dest");
const DEST = i >= 0 ? args[i + 1] : "guideless_photos/_library";
const indexPath = join(DEST, "index.json");
const index = JSON.parse(readFileSync(indexPath, "utf8"));

// Places inside "other-france", checked in order; anything unmatched stays in other-france/.
const PLACES = [
  { name: "saint-tropez", lat: [43.15, 43.45], lon: [6.45, 6.85] },
  { name: "burgundy", lat: [46.7, 47.45], lon: [4.5, 5.2] },
  { name: "strasbourg", lat: [48.45, 48.75], lon: [7.55, 7.9] },
  { name: "valence", lat: [44.8, 45.05], lon: [4.75, 5.05] },
  { name: "reims", lat: [49.1, 49.35], lon: [3.9, 4.25] },
  { name: "lyon", lat: [45.65, 45.85], lon: [4.75, 4.95] },
  { name: "marseille", lat: [43.2, 43.4], lon: [5.3, 5.5] },
];
const NOT_FRANCE = (lat, lon) =>
  lat > 50.5 || lon < -1.6 || (lat > 46.0 && lat < 47.9 && lon > 6.05 && lon < 6.2 && false);

function placeFor(lat, lon) {
  if (NOT_FRANCE(lat, lon)) return { trip: "not-france", region: lon < 0 ? "spain" : "belgium" };
  for (const p of PLACES) {
    if (lat >= p.lat[0] && lat <= p.lat[1] && lon >= p.lon[0] && lon <= p.lon[1]) {
      return { trip: "southern-france", region: `other-france/${p.name}` };
    }
  }
  return null;
}

let moved = 0;
for (const entry of index) {
  if (!entry.file.startsWith("southern-france/other-france/")) continue;
  const target = placeFor(entry.lat, entry.lon);
  if (!target) continue;
  const oldRel = entry.file;
  const name = basename(oldRel);
  const stem = name.slice(0, -extname(name).length);
  // The converter may already have turned .heic into .jpg; move whichever exists.
  const candidates = [name, `${stem}.jpg`, `${stem}.heic`];
  const fromDir = join(DEST, dirname(oldRel));
  const toDir = join(DEST, target.trip, target.region);
  mkdirSync(toDir, { recursive: true });
  for (const c of candidates) {
    const from = join(fromDir, c);
    if (existsSync(from)) {
      renameSync(from, join(toDir, c));
      entry.file = `${target.trip}/${target.region}/${c}`;
      moved++;
      break;
    }
  }
}
// Drop the folder if it emptied out.
const otherDir = join(DEST, "southern-france", "other-france");
if (existsSync(otherDir) && readdirSync(otherDir).length === 0) rmdirSync(otherDir);
writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`moved ${moved} files; index.json updated`);
