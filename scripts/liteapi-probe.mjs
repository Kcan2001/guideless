// Probe a LiteAPI sandbox key and report what the API actually returns.
//
// The Duffel adapter in this repo was written from public documentation and has never run against
// a real account, which is why it is a plausible integration rather than a verified one. This
// script exists so we do not repeat that: run it first, read real responses, then write the
// adapter against what came back.
//
//   node scripts/liteapi-probe.mjs --key sand_xxx
//   LITEAPI_KEY=sand_xxx node scripts/liteapi-probe.mjs [--city Nice] [--country FR] [--base https://api.liteapi.travel/v3.0]
//
// The key is never printed. Nothing is written anywhere; this only reads.
//
// It answers the questions the audit could not (docs/hotel-provider-audit.md):
//   1. What do hotelTypeIds actually mean? Which ids are apartments, aparthotels, villas, B&Bs?
//   2. What does a rate object really contain: net, taxes, fees, cancellation windows, board?
//   3. Is the cancellation policy a ladder or a single deadline? This decides a schema change.

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY = opt("key", process.env.LITEAPI_KEY);
const BASE = (opt("base", process.env.LITEAPI_BASE) ?? "https://api.liteapi.travel/v3.0").replace(
  /\/$/,
  "",
);
const CITY = opt("city", "Nice");
const COUNTRY = opt("country", "FR");

if (!KEY) {
  console.error("No key. Pass --key sand_xxx or set LITEAPI_KEY.");
  console.error(
    "Get a sandbox key (no card needed): https://docs.liteapi.travel/docs/getting-a-sandbox-key",
  );
  process.exit(1);
}

/** Never log the key, the URL with the key, or anything that could carry it. */
async function get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, { headers: { "X-API-Key": KEY, accept: "application/json" } });
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - started, error: String(err?.message ?? err) };
  }
  const ms = Date.now() - started;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }
  return { ok: res.ok, status: res.status, ms, body };
}

const line = (s = "") => console.log(s);
const rule = (t) => line(`\n${"─".repeat(4)} ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);

/** Print the shape of an object rather than its contents: keys, and the type of each. */
function shape(value, depth = 0, seen = new Set()) {
  const pad = "  ".repeat(depth);
  if (value === null) return `${pad}null`;
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[] (empty)`;
    return `${pad}[${value.length}] of:\n${shape(value[0], depth + 1, seen)}`;
  }
  if (typeof value !== "object")
    return `${pad}${typeof value}: ${JSON.stringify(value)?.slice(0, 70)}`;
  if (seen.has(value)) return `${pad}<circular>`;
  seen.add(value);
  return Object.entries(value)
    .slice(0, 40)
    .map(([k, v]) => {
      if (v && typeof v === "object") return `${pad}${k}:\n${shape(v, depth + 1, seen)}`;
      return `${pad}${k}: ${typeof v} = ${JSON.stringify(v)?.slice(0, 60)}`;
    })
    .join("\n");
}

async function main() {
  line(`LiteAPI probe · base ${BASE} · ${CITY}, ${COUNTRY}`);
  line("Reads only. The key is never printed.");

  // ── 1. Property types: the question the audit could not answer ──────────────
  rule("GET /data/hotelTypes");
  const types = await get("/data/hotelTypes");
  line(`status ${types.status} in ${types.ms}ms`);
  if (types.ok) {
    const rows = types.body?.data ?? types.body;
    if (Array.isArray(rows)) {
      for (const t of rows) line(`  ${String(t.id ?? t.hotelTypeId).padStart(5)}  ${t.name ?? ""}`);
      const apartmentish = rows.filter((t) =>
        /apart|villa|b&b|bed and breakfast|guest|hostel|residence|condo|home|chalet/i.test(
          t.name ?? "",
        ),
      );
      line(`\n  Non-hotel types found: ${apartmentish.length}`);
      for (const t of apartmentish) line(`    ${t.id} = ${t.name}`);
      line("\n  → These ids are what a curation step filters on. Record them in docs/hotels.md.");
    } else {
      line(shape(types.body, 1));
    }
  } else {
    line(`  failed: ${JSON.stringify(types.body)?.slice(0, 300)}`);
  }

  // ── 2. Properties in a city we actually sell ────────────────────────────────
  rule(`GET /data/hotels (${CITY})`);
  const hotels = await get("/data/hotels", {
    countryCode: COUNTRY,
    cityName: CITY,
    limit: 5,
  });
  line(`status ${hotels.status} in ${hotels.ms}ms`);
  let sampleHotelId = null;
  if (hotels.ok) {
    const rows = hotels.body?.data ?? hotels.body;
    if (Array.isArray(rows) && rows.length) {
      sampleHotelId = rows[0].id ?? rows[0].hotelId;
      for (const h of rows.slice(0, 5))
        line(`  ${h.id ?? h.hotelId} · type ${h.hotelTypeId ?? "?"} · ${h.name ?? ""}`);
      line("\n  Shape of one property:");
      line(shape(rows[0], 2));
    } else line(shape(hotels.body, 1));
  } else {
    line(`  failed: ${JSON.stringify(hotels.body)?.slice(0, 300)}`);
  }

  // ── 3. A rate, which is what the whole adapter is built around ──────────────
  if (sampleHotelId) {
    const checkIn = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 63 * 86_400_000).toISOString().slice(0, 10);
    rule(`POST /hotels/rates (${checkIn} → ${checkOut}, 1 adult)`);
    let rates;
    try {
      const res = await fetch(`${BASE}/hotels/rates`, {
        method: "POST",
        headers: {
          "X-API-Key": KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          hotelIds: [sampleHotelId],
          occupancies: [{ adults: 1 }],
          currency: "USD",
          guestNationality: "US",
          checkin: checkIn,
          checkout: checkOut,
        }),
      });
      rates = { status: res.status, body: await res.json().catch(() => null) };
    } catch (err) {
      rates = { status: 0, body: { error: String(err?.message ?? err) } };
    }
    line(`status ${rates.status}`);
    const first = rates.body?.data?.[0];
    if (first) {
      line("  Shape of one hotel's rates:");
      line(shape(first, 2));
      line("\n  The three things that decide our schema:");
      const s = JSON.stringify(first);
      line(`    cancellation policy present: ${/cancelPolicyInfos|cancellationPolic/i.test(s)}`);

      // Count windows PER RATE. Matching on the whole response counts every room type at once and
      // produces a number that means nothing: 200 room types with one window each is not a ladder.
      const perRate = [];
      for (const rt of first.roomTypes ?? []) {
        for (const r of rt.rates ?? []) {
          const infos = r?.cancellationPolicies?.cancelPolicyInfos;
          perRate.push({
            n: Array.isArray(infos) ? infos.length : 0,
            tag: r?.cancellationPolicies?.refundableTag ?? "?",
            types: Array.isArray(infos) ? [...new Set(infos.map((i) => i.type))] : [],
          });
        }
      }
      const maxWindows = perRate.reduce((m, r) => Math.max(m, r.n), 0);
      const laddered = perRate.filter((r) => r.n > 1).length;
      line(`    rates inspected: ${perRate.length}`);
      line(
        `    windows per rate: max ${maxWindows}, ${laddered} rate(s) with more than one, ${perRate.filter((r) => r.n === 0).length} with none`,
      );
      line(`    refundableTag values: ${[...new Set(perRate.map((r) => r.tag))].join(", ")}`);
      line(
        `    penalty types: ${[...new Set(perRate.flatMap((r) => r.types))].join(", ") || "none"}`,
      );
      line(
        maxWindows > 1
          ? "    → A LADDER EXISTS. Our single-deadline model loses the middle step, and the loss is money."
          : "    → One window on every rate here, but the field is an ARRAY, so a ladder is representable and we must handle N.",
      );
      line(`    taxes/fees itemised: ${/taxesAndFees|taxes/i.test(s)}`);
      line(`    commission disclosed: ${/commission/i.test(s)}`);
      line(`    board type present: ${/boardType|boardName/i.test(s)}`);
      line(`    rate expiry present: ${/expire|expiry|ttl/i.test(s)}`);
    } else {
      line(`  no rates returned: ${JSON.stringify(rates.body)?.slice(0, 400)}`);
      line("  (sandbox inventory is limited; try another city with --city)");
    }
  }

  rule("Next");
  line("  1. Record the hotelTypeIds that mean apartment / aparthotel / villa in docs/hotels.md.");
  line("  2. If cancellation came back as a ladder, that schema change lands before the adapter.");
  line("  3. Ask LiteAPI in writing: how many bedbanks, and what look-to-book ratio is acceptable");
  line("     for a scheduled daily refresh. Neither is published.");
}

main().catch((err) => {
  console.error("probe failed:", err?.message ?? err);
  process.exit(1);
});
