// Fetch the public profile of specific properties: address, coordinates, stars, description,
// photographs and amenities — the fields `public.hotels` stores and the tier cards show.
//
//   LITEAPI_KEY=sand_xxx node scripts/hotel-details.mjs --ids lp30008,lp467aa --json out.json
//   LITEAPI_KEY=sand_xxx node scripts/hotel-details.mjs --plan plan.json --json out.json
//
// Reads only; writes nothing to the database and never prints the key. The output is meant to be
// pasted into a seed after a person has read it — hotel descriptions are supplier marketing copy
// and usually need trimming before they go on a page.

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY = opt("key", process.env.LITEAPI_KEY ?? process.env.LITEAPI_SANDBOX_KEY);
const BASE = (opt("base", process.env.LITEAPI_BASE) ?? "https://api.liteapi.travel/v3.0").replace(
  /\/$/,
  "",
);
const PLAN = opt("plan", null);
const IDS = opt("ids", null);
const JSON_OUT = opt("json", null);
const MAX_PHOTOS = Number(opt("photos", "8"));

if (!KEY || (!PLAN && !IDS)) {
  console.error("Usage: --ids lp1,lp2 | --plan plan.json   (needs LITEAPI_KEY)");
  process.exit(1);
}

const { readFile, writeFile } = await import("node:fs/promises");
let wanted;
if (PLAN) {
  const plan = JSON.parse(await readFile(PLAN, "utf8"));
  wanted = plan.hotels.map((h) => ({ id: h.id, city: h.city, tier: h.tier }));
} else {
  wanted = IDS.split(",").map((id) => ({ id: id.trim() }));
}

async function call(path, query) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "X-API-Key": KEY, accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text).data ?? JSON.parse(text);
}

/** Supplier copy arrives as HTML with headings and marketing filler. Keep the prose. */
function plain(html) {
  if (!html) return null;
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const out = [];
for (const w of wanted) {
  const h = await call("/data/hotel", { hotelId: w.id });
  const images = (h.hotelImages ?? [])
    .map((i) => i?.urlHd || i?.url)
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
  const amenities = (h.hotelFacilities ?? h.facilities ?? [])
    .map((f) => (typeof f === "string" ? f : f?.name))
    .filter(Boolean)
    .slice(0, 24);
  out.push({
    tier: w.tier ?? null,
    city: w.city ?? h.city ?? null,
    supplierHotelId: w.id,
    name: h.name ?? null,
    address: h.address ?? null,
    hotelCity: h.city ?? null,
    countryCode: (h.country ?? "").toUpperCase() || null,
    latitude: h.location?.latitude ?? h.latitude ?? null,
    longitude: h.location?.longitude ?? h.longitude ?? null,
    starRating: h.starRating ?? h.stars ?? null,
    description: plain(h.hotelDescription ?? h.description),
    images,
    amenities,
  });
  console.log(
    `${(w.tier ?? "").padEnd(9)} ${w.id.padEnd(10)} ${String(h.starRating ?? h.stars ?? "-")}*  ` +
      `${images.length} photos, ${amenities.length} amenities  ${h.name}`,
  );
  console.log(`           ${h.address ?? "(no address)"}`);
}

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${JSON_OUT}`);
}
