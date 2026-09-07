// Generates the Expo store assets from the brand logo (apps/web/public/brand/guideless-logo.webp).
//
//   node scripts/mobile-assets.mjs
//
// The logo is the globe-and-road emblem above a wordmark on a light ground. We crop the emblem,
// knock out the light background so it can sit on brand colors, and write:
//   icon.png                      1024² emblem on cloud (#F5F6F2) — iOS + fallback
//   android-icon-foreground.png   1024² emblem in the 66% safe zone, transparent
//   android-icon-background.png   1024² solid cloud
//   android-icon-monochrome.png   1024² white silhouette, transparent
//   splash-icon.png               512²  emblem, transparent (splash background is cloud)
//   favicon.png                   48²   emblem on cloud
// Re-run after replacing the logo; commit the results (docs/mobile.md → Store assets).

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = resolve(root, "apps/web/public/brand/guideless-logo.webp");
const OUT = resolve(root, "apps/mobile/assets/images");
const CLOUD = { r: 0xf5, g: 0xf6, b: 0xf2, alpha: 1 };

// Emblem bounds in the 1024² source (globe spans roughly x 240–780, y 150–660).
const EMBLEM = { left: 220, top: 130, width: 584, height: 560 };

/** Turns the light background transparent with a soft edge, trims it away and fits the emblem. */
async function emblemTransparent(size) {
  const { data, info } = await sharp(LOGO)
    .extract(EMBLEM)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (min > 160 && max - min < 34) {
      // Pale, grey-ish → background. Fade over a short ramp so anti-aliased edges stay soft.
      const t = Math.min(1, (min - 160) / 35);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
  }
  const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 8 })
    .toBuffer();
  return sharp(cut)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();
}

async function onCloud(size, inset) {
  const emblem = await (await emblemTransparent(size - inset * 2)).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CLOUD } })
    .composite([{ input: emblem, left: inset, top: inset }])
    .png();
}

async function monochrome(size, inset) {
  const emblem = await (
    await emblemTransparent(size - inset * 2)
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = emblem;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255; // keep alpha, paint white
  }
  const white = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: white, left: inset, top: inset }])
    .png();
}

async function transparentPadded(size, inset) {
  const emblem = await (await emblemTransparent(size - inset * 2)).toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: emblem, left: inset, top: inset }])
    .png();
}

await mkdir(OUT, { recursive: true });
await (await onCloud(1024, 112)).toFile(resolve(OUT, "icon.png"));
await (await transparentPadded(1024, 214)).toFile(resolve(OUT, "android-icon-foreground.png")); // 66% safe zone
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CLOUD } })
  .png()
  .toFile(resolve(OUT, "android-icon-background.png"));
await (await monochrome(1024, 214)).toFile(resolve(OUT, "android-icon-monochrome.png"));
await (await transparentPadded(512, 16)).toFile(resolve(OUT, "splash-icon.png"));
await (await onCloud(48, 4)).toFile(resolve(OUT, "favicon.png"));
console.log(`wrote 6 assets to ${OUT}`);
