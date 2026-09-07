#!/usr/bin/env node
// Imports photos from guideless_photos/ into the social publishing queue.
//
//   node scripts/social-import.mjs [--dry-run] [--dir guideless_photos]
//
// Layout of guideless_photos/ (git-ignored):
//   nice-old-town.jpg          → one single-image draft post
//   nice-old-town.txt          → optional caption for that image; "#tags" anywhere become hashtags
//   day-3-avignon/             → a folder = one carousel draft (files in name order, 2–10 images)
//   day-3-avignon/caption.txt  → optional caption for the carousel
//   .imported.json             → written by this script; maps source files → post ids (idempotent)
//
// Every image is normalized for Instagram (JPEG, sRGB, EXIF stripped — including GPS — long edge
// ≤ 1440 px, aspect ratio clamped to 4:5 … 1.91:1) and uploaded to the public `social-media`
// bucket. The same URLs can be used on the website. Captions and scheduling are finished in
// /admin/social. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DIR = resolve(
  process.cwd(),
  args[args.indexOf("--dir") + 1] && args.includes("--dir")
    ? args[args.indexOf("--dir") + 1]
    : "guideless_photos",
);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"]);
const MAX_EDGE = 1440;
const MIN_RATIO = 0.8; // 4:5 portrait
const MAX_RATIO = 1.91; // landscape

// ── Env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  for (const file of ["apps/web/.env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).",
  );
  process.exit(1);
}
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// ── Helpers ───────────────────────────────────────────────────────────────────
const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "photo";

function parseCaptionFile(path) {
  if (!existsSync(path)) return { caption: "", hashtags: [] };
  const text = readFileSync(path, "utf8").trim();
  const hashtags = [
    ...new Set([...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase())),
  ];
  // Keep hashtags out of the caption body; the publisher appends them on its own line.
  const caption = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(line))
    .join("\n")
    .trim();
  return { caption, hashtags: hashtags.slice(0, 30) };
}

async function normalize(file) {
  const input = sharp(file, { failOn: "none" }).rotate(); // apply EXIF orientation, then strip EXIF
  const meta = await input.metadata();
  let { width = 0, height = 0 } = meta;
  if (meta.orientation && meta.orientation >= 5) [width, height] = [height, width];
  if (!width || !height) throw new Error("could not read image dimensions");

  let ratio = width / height;
  let cropW = width;
  let cropH = height;
  if (ratio < MIN_RATIO) cropH = Math.round(width / MIN_RATIO);
  if (ratio > MAX_RATIO) cropW = Math.round(height * MAX_RATIO);
  const scale = Math.min(1, MAX_EDGE / Math.max(cropW, cropH));
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const buffer = await input
    .resize({ width: outW, height: outH, fit: "cover", position: sharp.strategy.attention })
    .flatten({ background: "#F5F6F2" })
    .toColorspace("srgb")
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const cropped = cropW !== width || cropH !== height;
  return { buffer, width: outW, height: outH, cropped, original: { width, height } };
}

async function upload(path, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/social-media/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/jpeg", "x-upsert": "true" },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
}

async function insertPost(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert post: ${res.status} ${await res.text()}`);
  const [created] = await res.json();
  return created.id;
}

// ── Discover work ─────────────────────────────────────────────────────────────
if (!existsSync(DIR)) {
  console.error(`No photo folder at ${DIR}`);
  process.exit(1);
}
const statePath = join(DIR, ".imported.json");
const imported = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const entries = readdirSync(DIR).filter((n) => !n.startsWith("."));
const isImage = (n) => IMAGE_EXT.has(extname(n).toLowerCase());

/** @type {Array<{kind: "image"|"carousel", files: string[], captionFile: string, label: string}>} */
const jobs = [];
for (const name of entries.sort()) {
  const full = join(DIR, name);
  if (statSync(full).isDirectory()) {
    const files = readdirSync(full)
      .filter(isImage)
      .sort()
      .map((f) => join(name, f));
    if (files.length === 0) continue;
    jobs.push({
      kind: files.length === 1 ? "image" : "carousel",
      files: files.slice(0, 10),
      captionFile: join(full, "caption.txt"),
      label: name,
    });
  } else if (isImage(name)) {
    const stem = basename(name, extname(name));
    jobs.push({ kind: "image", files: [name], captionFile: join(DIR, `${stem}.txt`), label: stem });
  }
}

const pending = jobs.filter((j) => !j.files.every((f) => imported[f]));
console.log(`${jobs.length} post(s) found, ${pending.length} new${DRY_RUN ? " (dry run)" : ""}.`);

// ── Import ────────────────────────────────────────────────────────────────────
const now = new Date();
const prefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
let created = 0;

for (const job of pending) {
  const { caption, hashtags } = parseCaptionFile(job.captionFile);
  const mediaPaths = [];
  const altTexts = [];
  try {
    for (const rel of job.files) {
      const abs = join(DIR, rel);
      const { buffer, width, height, cropped } = await normalize(abs);
      const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
      const path = `${prefix}/${slug(basename(rel, extname(rel)))}-${hash}.jpg`;
      console.log(
        `  ${rel} → ${path} (${width}×${height}${cropped ? ", cropped to Instagram ratio" : ""})`,
      );
      if (!DRY_RUN) await upload(path, buffer);
      mediaPaths.push(path);
      altTexts.push("");
    }
    if (!DRY_RUN) {
      const id = await insertPost({
        platform: "instagram",
        kind: job.kind,
        caption,
        hashtags,
        media_paths: mediaPaths,
        alt_texts: altTexts,
        source_files: job.files,
        status: "draft",
      });
      for (const f of job.files) imported[f] = id;
      writeFileSync(statePath, JSON.stringify(imported, null, 2));
    }
    created++;
    console.log(`✓ ${job.kind} draft "${job.label}"${caption ? "" : " (no caption yet)"}`);
  } catch (err) {
    console.error(`✗ ${job.label}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(
  `${created} draft(s) ${DRY_RUN ? "would be" : ""} created. Finish captions and schedule them in /admin/social.`,
);
