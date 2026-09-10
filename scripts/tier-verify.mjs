// Price a chosen shortlist of properties across every date window of a trip.
//
// `tier-candidates.mjs` finds candidates for one window. Before a tier is written into a seed the
// same properties have to be available and sanely priced on EVERY departure, or the trip sells a
// tier that exists in May and does not exist in September. This prints one row per property per
// window, at one adult and at two sharing, with the cheapest rate and the cheapest that includes
// breakfast.
//
//   LITEAPI_KEY=sand_xxx node scripts/tier-verify.mjs --plan plan.json
//
// plan.json:
//   {
//     "currency": "USD",
//     "windows": [ { "label": "May", "legs": [ { "city": "Nice", "in": "2027-05-14", "out": "2027-05-17" } ] } ],
//     "hotels": [ { "city": "Nice", "tier": "explorer", "id": "lp30008", "name": "Hôtel Vendôme" } ]
//   }
//
// Reads only. The key is never printed.

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
const JSON_OUT = opt("json", null);
if (!KEY || !PLAN) {
  console.error("Usage: --plan plan.json  (needs LITEAPI_KEY)");
  process.exit(1);
}

const { readFile, writeFile } = await import("node:fs/promises");
const plan = JSON.parse(await readFile(PLAN, "utf8"));
const CURRENCY = plan.currency ?? "USD";

async function call(path, { method = "GET", query, body } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v != null) url.searchParams.set(k, String(v));
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
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return parsed.data ?? parsed;
}

const board = (r) => (r.boardName ?? r.boardType ?? "").toString();
const hasBreakfast = (r) => /breakfast|petit|desayuno/i.test(board(r));

async function priceLeg(hotelIds, checkIn, checkOut, adults) {
  const entries = await call("/hotels/rates", {
    method: "POST",
    body: {
      hotelIds,
      occupancies: [{ adults }],
      currency: CURRENCY,
      guestNationality: "US",
      checkin: checkIn,
      checkout: checkOut,
    },
  });
  const out = new Map();
  // An empty result comes back as {} rather than [] on some windows.
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const roomType of entry.roomTypes ?? []) {
      for (const rate of roomType.rates ?? []) {
        const total = Math.round(Number(rate.retailRate?.total?.[0]?.amount ?? 0) * 100);
        if (!total) continue;
        const cur = out.get(entry.hotelId) ?? { cheapest: null, breakfast: null };
        if (!cur.cheapest || total < cur.cheapest.total)
          cur.cheapest = { total, room: rate.name ?? "Room" };
        if (hasBreakfast(rate) && (!cur.breakfast || total < cur.breakfast.total))
          cur.breakfast = { total, room: rate.name ?? "Room" };
        out.set(entry.hotelId, cur);
      }
    }
  }
  return out;
}

const results = [];
for (const w of plan.windows) {
  console.log(`\n=== ${w.label}`);
  for (const leg of w.legs) {
    const wanted = plan.hotels.filter((h) => h.city === leg.city);
    if (!wanted.length) continue;
    const nights = Math.round(
      (Date.parse(`${leg.out}T00:00:00Z`) - Date.parse(`${leg.in}T00:00:00Z`)) / 86_400_000,
    );
    const ids = wanted.map((h) => h.id);
    const [one, two] = await Promise.all([
      priceLeg(ids, leg.in, leg.out, 1),
      priceLeg(ids, leg.in, leg.out, 2),
    ]);
    console.log(`  ${leg.city} ${leg.in} → ${leg.out} (${nights}n)`);
    for (const h of wanted) {
      const a = one.get(h.id);
      const b = two.get(h.id);
      const row = {
        window: w.label,
        city: leg.city,
        tier: h.tier,
        id: h.id,
        name: h.name,
        nights,
        checkIn: leg.in,
        checkOut: leg.out,
        oneCheapest: a?.cheapest?.total ?? null,
        oneBreakfast: a?.breakfast?.total ?? null,
        twoCheapest: b?.cheapest?.total ?? null,
        twoBreakfast: b?.breakfast?.total ?? null,
      };
      results.push(row);
      const m = (v) => (v == null ? "   —  " : (v / 100).toFixed(0).padStart(6));
      const perNight = row.oneBreakfast ?? row.oneCheapest;
      console.log(
        `    ${String(h.tier).padEnd(9)} ${m(row.oneCheapest)} ${m(row.oneBreakfast)} ${m(row.twoCheapest)}` +
          `  ${perNight ? (perNight / 100 / nights).toFixed(0).padStart(4) : "   —"}/n  ${h.name}` +
          `${row.oneCheapest == null ? "   *** NO AVAILABILITY ***" : ""}`,
      );
    }
  }
}

const gone = results.filter((r) => r.oneCheapest == null);
console.log(
  gone.length
    ? `\n${gone.length} property/window combinations have NO availability — pick another before seeding.`
    : "\nEvery property is available in every window.",
);
if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify(results, null, 2));
  console.log(`Wrote ${JSON_OUT}`);
}
