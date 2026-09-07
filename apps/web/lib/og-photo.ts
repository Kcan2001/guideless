import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Loads a hero photo for an Open Graph card as a data URL sized for the 1200×630 canvas.
 * Local library photos are read from /public; admin uploads are fetched. Returns null on any
 * failure so the card falls back to the brand artwork instead of erroring.
 */
export async function ogPhotoDataUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    const input = src.startsWith("/")
      ? await readFile(join(process.cwd(), "public", src))
      : Buffer.from(await (await fetch(src, { cache: "force-cache" })).arrayBuffer());
    const out = await sharp(input)
      .rotate()
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 72, progressive: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}
