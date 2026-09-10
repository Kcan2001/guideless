// Candidate properties and their real cost for one city and one set of nights.
//
// This is step 1-3 of docs/tier-classification.md executed against live supplier data: sweep what
// is actually available for the exact dates, price each candidate at one adult and at two sharing,
// and print a table a person can assign to tiers from. It proposes nothing and writes nothing —
// every number here is a supplier's, and the tier bands stay a human decision.
//
//   LITEAPI_KEY=sand_xxx node scripts/tier-candidates.mjs \
//     --city Nice --country FR --lat 43.7102 --lng 7.262 \
//     --in 2027-05-14 --out 2027-05-17 [--limit 60] [--json out.json]
//
// The key is never printed. Only GET /data/hotels and POST /hotels/rates are called, both reads.
//
// Two things learned the hard way and encoded here:
//   * LiteAPI names the Monaco city "Monte Carlo", not "Monaco" — a wrong city name returns an
//     empty list that looks exactly like no availability.
//   * `children` is an array of AGES. Sending a count 400s every request.

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
const CITY = opt("city", "Nice");
const COUNTRY = opt("country", "FR");
const LAT = Number(opt("lat", "NaN"));
const LNG = Number(opt("lng", "NaN"));
const CHECK_IN = opt("in", null);
const CHECK_OUT = opt("out", null);
const LIMIT = Number(opt("limit", "60"));
const CURRENCY = opt("currency", "USD");
const JSON_OUT = opt("json", null);

if (!KEY || !CHECK_IN || !CHECK_OUT) {
  console.error("Usage: --city Nice --country FR --in 2027-05-14 --out 2027-05-17 [--lat --lng]");
  console.error("Needs LITEAPI_KEY (or --key).");
  process.exit(1);
}

/** Never log the key or a URL carrying it. */
async function call(path, { method = "GET", query, body } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      "X-API-Key": KEY,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed.data ?? parsed;
}

const km = (aLat, aLng, bLat, bLng) => {
  if (![aLat, aLng, bLat, bLng].every((n) => Number.isFinite(n))) return null;
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const nights = Math.round(
  (Date.parse(`${CHECK_OUT}T00:00:00Z`) - Date.parse(`${CHECK_IN}T00:00:00Z`)) / 86_400_000,
);
const money = (minor) => (minor / 100).toFixed(0).padStart(6);
const boardOf = (rate) => (rate.boardName ?? rate.boardType ?? "").toString();
const hasBreakfast = (rate) => /breakfast|petit|desayuno/i.test(boardOf(rate));

console.log(
  `${CITY}, ${COUNTRY} · ${CHECK_IN} → ${CHECK_OUT} (${nights} night${nights === 1 ? "" : "s"}) · ${CURRENCY}`,
);

const hotels = await call("/data/hotels", {
  query: { countryCode: COUNTRY, cityName: CITY, limit: String(LIMIT) },
});
if (!hotels?.length) {
  console.error(`No properties listed for "${CITY}". Check the supplier's own city name.`);
  process.exit(2);
}
console.log(`${hotels.length} properties listed; pricing them for these exact nights…\n`);

const byId = new Map(hotels.map((h) => [h.id, h]));

/** One rates call per occupancy, all hotels at once. */
async function ratesFor(adults) {
  const entries = await call("/hotels/rates", {
    method: "POST",
    body: {
      hotelIds: hotels.map((h) => h.id).filter(Boolean),
      occupancies: [{ adults }],
      currency: CURRENCY,
      guestNationality: "US",
      checkin: CHECK_IN,
      checkout: CHECK_OUT,
    },
  });
  const out = new Map();
  // An empty result comes back as {} rather than [] on some windows.
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const roomType of entry.roomTypes ?? []) {
      for (const rate of roomType.rates ?? []) {
        const total = Math.round(Number(rate.retailRate?.total?.[0]?.amount ?? 0) * 100);
        if (!total) continue;
        const key = entry.hotelId;
        const existing = out.get(key);
        const candidate = {
          total,
          room: rate.name ?? "Room",
          board: boardOf(rate),
          breakfast: hasBreakfast(rate),
          refundable: (rate.cancellationPolicies?.refundableTag ?? "") !== "NRFN",
        };
        // Keep the cheapest overall and, separately, the cheapest that includes breakfast: a tier
        // promising breakfast must be costed from a breakfast rate or the promise is a hole.
        if (!existing || candidate.total < existing.cheapest.total) {
          out.set(key, { ...(existing ?? {}), cheapest: candidate, breakfast: existing?.breakfast });
        }
        if (candidate.breakfast) {
          const cur = out.get(key);
          if (!cur.breakfast || candidate.total < cur.breakfast.total) {
            out.set(key, { ...cur, breakfast: candidate });
          }
        }
      }
    }
  }
  return out;
}

const [single, double] = await Promise.all([ratesFor(1), ratesFor(2)]);

const rows = [];
for (const [hotelId, one] of single) {
  const h = byId.get(hotelId);
  if (!h) continue;
  const two = double.get(hotelId);
  rows.push({
    id: hotelId,
    name: h.name ?? "",
    stars: h.stars ?? null,
    address: h.address ?? "",
    lat: h.latitude ?? null,
    lng: h.longitude ?? null,
    distanceKm: km(LAT, LNG, h.latitude, h.longitude),
    photos: (h.hotelImages ?? []).map((i) => i?.url).filter(Boolean).length,
    oneCheapest: one.cheapest?.total ?? null,
    oneBreakfast: one.breakfast?.total ?? null,
    twoCheapest: two?.cheapest?.total ?? null,
    twoBreakfast: two?.breakfast?.total ?? null,
    room: one.breakfast?.room ?? one.cheapest?.room ?? "",
    refundable: one.cheapest?.refundable ?? null,
  });
}
rows.sort((a, b) => (a.oneCheapest ?? Infinity) - (b.oneCheapest ?? Infinity));

console.log(
  ["★", "1 adult", "+bkfst", "2 share", "km", "pics", "hotel"].join("\t") + "\tsupplier id",
);
for (const r of rows) {
  console.log(
    [
      r.stars ?? "-",
      money(r.oneCheapest ?? 0),
      r.oneBreakfast ? money(r.oneBreakfast) : "     -",
      r.twoCheapest ? money(r.twoCheapest) : "     -",
      r.distanceKm == null ? "-" : r.distanceKm.toFixed(1),
      r.photos,
      r.name.slice(0, 44),
      r.id,
    ].join("\t"),
  );
}
console.log(
  `\n${rows.length} of ${hotels.length} had availability. Per-night, one adult, cheapest: ` +
    `${money(Math.min(...rows.map((r) => r.oneCheapest)) / nights).trim()}–` +
    `${money(Math.max(...rows.map((r) => r.oneCheapest)) / nights).trim()} ${CURRENCY}.`,
);

if (JSON_OUT) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    JSON_OUT,
    JSON.stringify({ city: CITY, checkIn: CHECK_IN, checkOut: CHECK_OUT, nights, rows }, null, 2),
  );
  console.log(`Wrote ${JSON_OUT}`);
}
