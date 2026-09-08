// Turns chosen library photos into optimized web assets under apps/web/public/photos/.
//
//   node scripts/build-web-photos.mjs [--sheets <dir with <folder>.json maps>] [--width 1600]
//
// The selection below refers to contact-sheet indexes (scripts/contact-sheets.mjs) per library
// folder; the JSON maps resolve them to files. Output: one EXIF-stripped, sRGB, progressive JPEG per
// photo at --width (long edge), named for its content; next/image produces the smaller sizes at
// request time. Re-run after changing the selection; existing files are overwritten.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[opt.args.indexOf(`--${n}`) + 1] : d);
opt.args = args;
const SHEETS = opt(
  "sheets",
  "C:/Users/kylea/AppData/Local/Temp/claude/C--Users-kylea-Desktop-repos-Guideless/3353c7ff-bdbd-46f8-a710-66d7fce4c13a/scratchpad/sheets",
);
const WIDTH = Number(opt("width", 1600));
const OUT = "apps/web/public/photos";

// folder → [index, output-name, alt text, optional focal point (CSS object-position)]
const SELECTION = {
  monaco: [
    [
      44,
      "monaco-hairpin-race",
      "Formula 1 cars through the Monaco hairpin seen from a terrace above the circuit",
      "center 82%",
    ],
    [
      82,
      "monaco-harbour-rock",
      "Port Hercule with superyachts and the Rock of Monaco behind",
      "center 65%",
    ],
    [14, "monaco-casino-square", "Café terraces on Casino Square in Monte Carlo"],
    [91, "monaco-larvotto-beach", "Larvotto beach with clear water on a sunny day"],
    [104, "monaco-casino-night", "The Casino de Monte-Carlo lit up at night"],
    [109, "monaco-harbour-yachts", "Yachts moored side by side in the Monaco harbour on race week"],
    [
      113,
      "monaco-yacht-deck-view",
      "View of the harbour grandstands from a yacht deck",
      "center 55%",
    ],
    [
      114,
      "monaco-trackside-barriers",
      "Trackside at the Monaco circuit with the barriers in place",
      "center 60%",
    ],
    [
      122,
      "monaco-circuit-signage",
      "Circuit signage over the harbour section of the Monaco Grand Prix",
    ],
    [47, "monaco-night-sea", "Lights on the water off Monaco at night"],
  ],
  nice: [
    [
      25,
      "nice-promenade-dusk",
      "The Promenade des Anglais at dusk with striped parasols along the beach",
      "center 55%",
    ],
    [
      27,
      "nice-place-massena",
      "Place Masséna in Nice with its red façades and checkerboard paving",
      "center 60%",
    ],
    [28, "nice-place-massena-wide", "Place Masséna under a soft sky"],
    [33, "nice-cours-saleya-flowers", "Flower stalls at the Cours Saleya market in Nice"],
    [34, "nice-market-soaps", "Soaps and lavender at a market stall in Nice"],
    [37, "nice-beach-castle-hill", "Swimmers below Castle Hill on the Nice beach", "center 60%"],
    [39, "nice-bay-promenade", "The Baie des Anges from the Promenade"],
    [41, "nice-old-town-evening", "An old-town lane in Nice at blue hour"],
    [20, "nice-beach-clouds", "Nice beach with a big afternoon cloud over the bay"],
  ],
  avignon: [
    [
      1,
      "avignon-cloitre-saint-louis",
      "The plane-tree courtyard of the Cloître Saint-Louis in Avignon",
    ],
    [
      3,
      "chateauneuf-vineyard-road",
      "A cypress-lined road through the Châteauneuf-du-Pape vineyards",
    ],
    [4, "chateauneuf-cellar-barrels", "Oak barrels in a stone cellar at Châteauneuf-du-Pape"],
    [
      6,
      "chateauneuf-castle-ruins",
      "The ruins of the papal castle above Châteauneuf-du-Pape",
      "center 40%",
    ],
    [7, "provence-view-vines", "Vines and olive trees under a Provençal sky"],
  ],
  paris: [
    [35, "paris-seine-quay", "Parisians sitting along the Seine quay in the evening", "center 60%"],
    [27, "paris-arcades-street", "Arcaded Haussmann buildings on a quiet Paris street"],
    [29, "paris-covered-passage", "A covered passage with mosaic floor in Paris"],
    [32, "paris-cafe-terrace", "A café terrace in Paris"],
    [36, "paris-seine-night", "The Seine at night with the moon over the rooftops"],
    [37, "paris-metropolitain-sign", "A Métropolitain sign in front of a Haussmann façade"],
  ],
};

mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const [folder, picks] of Object.entries(SELECTION)) {
  const map = JSON.parse(readFileSync(join(SHEETS, `${folder}.json`), "utf8"));
  for (const [index, name, alt, position] of picks) {
    const entry = map.find((m) => m.index === index);
    if (!entry || !existsSync(entry.file)) {
      console.error(`missing ${folder} #${index}`);
      continue;
    }
    const out = join(OUT, `${name}.jpg`);
    const info = await sharp(entry.file)
      .rotate()
      .resize({ width: WIDTH, height: WIDTH, fit: "inside", withoutEnlargement: true })
      .toColorspace("srgb")
      .jpeg({ quality: 78, progressive: true, mozjpeg: true })
      .toFile(out);
    manifest.push({
      src: `/photos/${name}.jpg`,
      alt,
      width: info.width,
      height: info.height,
      position: position ?? null,
      source: entry.file,
    });
    console.log(`${name}.jpg ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  }
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} photos → ${OUT}`);
