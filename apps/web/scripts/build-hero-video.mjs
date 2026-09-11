// Builds the home hero loop from a handful of chosen clips.
//
//   node apps/web/scripts/build-hero-video.mjs --src "C:/Users/kylea/Desktop/guideless-hero-clips" \
//        --pick 2026-06-05_monaco_img_0887.mov,2024-05-22_monaco_img_5270.mov,… [--seconds 4]
//
// Or, having put exactly the clips you want in a folder and nothing else:
//
//   node apps/web/scripts/build-hero-video.mjs --src <folder> --all
//
// Needs ffmpeg on PATH, or --ffmpeg <path>.
//
// What it produces: apps/web/public/video/monaco-hero.{webm,mp4} — silent, 1920x1080, a few seconds
// per clip, hard cuts, encoded twice because no single codec is both small and universal.
//
// Why the encode looks the way it does:
//
//   - **No audio track at all.** `muted` on the element is a promise the browser keeps; shipping
//     the audio anyway just makes every viewer download a soundtrack nobody will hear.
//   - **Scaled and cropped to a fixed 1920x1080.** Phone clips arrive in portrait, at 4K, at 60fps
//     and at wildly different bitrates. Concatenating mixed geometry either fails or produces a
//     stream that reframes mid-play; normalising first is what makes the cut invisible.
//   - **30fps.** A background loop gains nothing from 60 and pays double for it.
//   - **faststart.** The moov atom goes at the front, so playback can begin before the file has
//     finished arriving. Without it a hero video waits for the whole download.
//   - **A hard size budget.** This sits behind the first thing anyone sees; it is decoration, and
//     decoration that costs 20MB is a bug. The script prints the result and complains past 6MB.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SRC = opt("src", null);
const PICK = opt("pick", null);
const SECONDS = Number(opt("seconds", 4));
const START = Number(opt("start", 0.5));
const FFMPEG = opt("ffmpeg", "ffmpeg");
const ALL = args.includes("--all");
const OUT_DIR = path.resolve("apps/web/public/video");
const BUDGET_MB = 6;

if (!SRC || (!PICK && !ALL)) {
  console.error(
    "Usage: build-hero-video.mjs --src <folder> (--pick a.mov,b.mov,… | --all) [--seconds 4] [--ffmpeg <path>]",
  );
  process.exit(1);
}

const clips = (PICK ? PICK.split(",").map((s) => s.trim()) : readdirSync(SRC))
  .filter((f) => /\.(mov|mp4)$/i.test(f))
  .map((f) => path.join(SRC, f));

for (const c of clips) {
  if (!existsSync(c)) {
    console.error(`Missing clip: ${c}`);
    process.exit(1);
  }
}
if (clips.length === 0) {
  console.error("No clips to build from.");
  process.exit(1);
}

const ff = (a) => execFileSync(FFMPEG, a, { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1e8 });

const tmp = path.join(OUT_DIR, "_tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Normalising ${clips.length} clips to 1920x1080, ${SECONDS}s each, no audio…`);
const parts = [];
clips.forEach((src, i) => {
  const out = path.join(tmp, `part-${String(i).padStart(2, "0")}.mp4`);
  ff([
    "-y",
    "-ss",
    String(START),
    "-t",
    String(SECONDS),
    "-i",
    src,
    "-an",
    // Cover, not fit: letterboxing a hero is worse than losing the edges of a frame.
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setsar=1",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    out,
  ]);
  parts.push(out);
  console.log(`  ${path.basename(src)} -> ${path.basename(out)}`);
});

const listFile = path.join(tmp, "concat.txt");
writeFileSync(listFile, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));

const mp4 = path.join(OUT_DIR, "monaco-hero.mp4");
const webm = path.join(OUT_DIR, "monaco-hero.webm");

console.log("Encoding MP4 (H.264)…");
ff([
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listFile,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "26",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  mp4,
]);

console.log("Encoding WebM (VP9)…");
ff([
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listFile,
  "-an",
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "36",
  "-b:v",
  "0",
  "-row-mt",
  "1",
  "-pix_fmt",
  "yuv420p",
  webm,
]);

rmSync(tmp, { recursive: true, force: true });

let over = false;
for (const f of [webm, mp4]) {
  const mb = statSync(f).size / 1048576;
  const flag = mb > BUDGET_MB ? "  OVER BUDGET" : "";
  if (mb > BUDGET_MB) over = true;
  console.log(`${path.basename(f).padEnd(20)} ${mb.toFixed(2)} MB${flag}`);
}
if (over) {
  console.log(
    `\nOver ${BUDGET_MB}MB. Use fewer clips, a shorter --seconds, or raise the CRF in this script.`,
  );
  process.exit(2);
}
console.log("\nDone. The page already points at these; no code change needed.");
