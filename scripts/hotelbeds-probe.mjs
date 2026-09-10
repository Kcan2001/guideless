// Probe a Hotelbeds (HBX) APItude key and report what the API actually returns.
//
// Same script, same reason, as scripts/liteapi-probe.mjs. The Duffel adapter in this repo was
// written from public documentation and has never met a real account, which is why it is a
// plausible integration rather than a verified one. LiteAPI was done the other way — probe first,
// read the real responses, then write the adapter — and it immediately found something the docs had
// not made obvious (132 of 200 rates carried more than one cancellation window, which changed the
// schema). Do not write apps/web/lib/hotels/suppliers/hotelbeds.ts until this has run.
//
//   node scripts/hotelbeds-probe.mjs --key <apiKey> --secret <secret>
//   HOTELBEDS_API_KEY=... HOTELBEDS_SECRET=... node scripts/hotelbeds-probe.mjs [--city Nice]
//
// Neither the key nor the secret is ever printed. Nothing is written anywhere; this only reads.
//
// GETTING A KEY. developer.hotelbeds.com, self-serve, gives a TEST key immediately. Production
// needs a signed contract and certification (docs/hotel-provider-audit.md), so expect the test
// environment to answer with a fixed sample of hotels rather than real Riviera inventory — the
// point of this run is the SHAPE of the response, not the prices.
//
// Hotelbeds signs every request: X-Signature = sha256(apiKey + secret + unixSecondsUtc).
//
// Questions to answer before writing the adapter, in the order they bite:
//   1. Does `hotels` in a /hotels availability request accept a list of our own supplier hotel
//      codes, or must we search by destination and filter? Our HotelSupplier contract fetches by
//      curated id and never does open destination search.
//   2. Are net, taxes and fees separable? `rates[].net` vs `rates[].sellingRate` vs
//      `taxes.taxes[]` — we store them as separate integers and cannot fudge it.
//   3. Is `cancellationPolicies[]` a ladder with amounts and dates? LiteAPI's was, and that is what
//      forced the ladder into the schema. Confirm Hotelbeds agrees.
//   4. `rateType`: BOOKABLE vs RECHECK. A RECHECK rate must go through /checkrates before booking,
//      which is a step LiteAPI does not have and our recheck.ts would need to learn.
//   5. `rateKey` opacity and lifetime — it is the handle we would carry to booking.
//   6. Does the response say anything about allotment/allocation, i.e. how many rooms are left?

import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY = opt("key", process.env.HOTELBEDS_API_KEY);
const SECRET = opt("secret", process.env.HOTELBEDS_SECRET);
const BASE = (
  opt("base", process.env.HOTELBEDS_BASE) ?? "https://api.test.hotelbeds.com"
).replace(/\/$/, "");
const CITY = opt("city", "Nice");
const CHECKIN = opt("checkin", isoInDays(120));
const CHECKOUT = opt("checkout", isoInDays(125));

if (!KEY || !SECRET) {
  console.error("Need both a key and a secret.");
  console.error("  node scripts/hotelbeds-probe.mjs --key <apiKey> --secret <secret>");
  console.error("Self-serve test credentials: https://developer.hotelbeds.com/");
  process.exit(1);
}

function isoInDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Never log the key, the secret, or the signature they produce. */
function signature() {
  return createHash("sha256")
    .update(KEY + SECRET + Math.floor(Date.now() / 1000))
    .digest("hex");
}

async function call(path, { method = "GET", body } = {}) {
  const started = Date.now();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Api-key": KEY,
        "X-Signature": signature(),
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - started, error: String(err?.message ?? err) };
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, ms: Date.now() - started, json };
}

/** Print a value's shape rather than its whole body: types, one example per array. */
function shape(value, indent = 2, depth = 0) {
  const pad = " ".repeat(indent);
  if (depth > 5) return `${pad}…`;
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[] (empty)`;
    return `${pad}[${value.length}] of:\n${shape(value[0], indent + 2, depth + 1)}`;
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) =>
        v && typeof v === "object"
          ? `${pad}${k}:\n${shape(v, indent + 2, depth + 1)}`
          : `${pad}${k}: ${typeof v} = ${JSON.stringify(v)}`,
      )
      .join("\n");
  }
  return `${pad}${typeof value} = ${JSON.stringify(value)}`;
}

console.log(`Hotelbeds probe · ${BASE} · ${CITY} · ${CHECKIN} → ${CHECKOUT}`);
console.log("Reads only. The key and secret are never printed.\n");

// ── 1. Status, so a signature problem is obvious before anything else ────────
console.log("──── GET /hotel-api/1.0/status ─────────────────────────────────────────");
const status = await call("/hotel-api/1.0/status");
console.log(`status ${status.status} in ${status.ms}ms`);
if (status.status === 403 || status.status === 401) {
  console.error(
    "\nRejected. Either the credentials are wrong or the clock is off: the signature is\n" +
      "sha256(apiKey + secret + unix seconds), so more than a few seconds of drift fails.",
  );
  process.exit(1);
}
console.log(shape(status.json));

// ── 2. Availability by hotel code, which is how we actually buy ──────────────
// Our HotelSupplier contract fetches rates for a curated list of supplier ids and never does open
// destination search, so this is the call that decides whether Hotelbeds fits without a rewrite.
const CODES = (opt("codes", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

console.log("\n──── POST /hotel-api/1.0/hotels (availability) ─────────────────────────");
const availabilityBody = {
  stay: { checkIn: CHECKIN, checkOut: CHECKOUT },
  occupancies: [{ rooms: 1, adults: 2, children: 0 }],
  ...(CODES.length
    ? { hotels: { hotel: CODES } }
    : { destination: { code: opt("destination", "NCE") } }),
};
const avail = await call("/hotel-api/1.0/hotels", { method: "POST", body: availabilityBody });
console.log(`status ${avail.status} in ${avail.ms}ms`);
if (!avail.ok) {
  console.log(JSON.stringify(avail.json).slice(0, 800));
  console.log(
    "\nIf this is a destination-code problem, pass one: --destination NCE, or give explicit\n" +
      "hotel codes with --codes 12345,67890 to test the fetch-by-id path we actually need.",
  );
  process.exit(0);
}

const hotels = avail.json?.hotels?.hotels ?? [];
console.log(`hotels returned: ${hotels.length} (total ${avail.json?.hotels?.total ?? "?"})`);
if (hotels[0]) {
  console.log("\nFirst hotel, shape:");
  console.log(shape(hotels[0]));
}

// ── 3. The three answers that decide the schema ──────────────────────────────
const rates = hotels.flatMap((h) => (h.rooms ?? []).flatMap((r) => r.rates ?? []));
console.log("\n  The things that decide our adapter:");
console.log(`    rates inspected: ${rates.length}`);
if (rates.length) {
  const windows = rates.map((r) => (r.cancellationPolicies ?? []).length);
  const ladders = windows.filter((n) => n > 1).length;
  const none = windows.filter((n) => n === 0).length;
  console.log(
    `    cancellation windows per rate: max ${Math.max(...windows)}, ` +
      `${ladders} with more than one, ${none} with none`,
  );
  console.log(
    ladders > 0
      ? "    → A LADDER EXISTS, same as LiteAPI. Store the array, not one deadline."
      : "    → No ladder in this sample. Do not conclude there is never one; the test environment\n" +
          "      is a fixed dataset. Re-run against production credentials before deciding.",
  );
  console.log(`    rateType values: ${[...new Set(rates.map((r) => r.rateType))].join(", ")}`);
  console.log(
    `    net present: ${rates.some((r) => r.net != null)}  ` +
      `sellingRate present: ${rates.some((r) => r.sellingRate != null)}`,
  );
  console.log(`    taxes itemised: ${rates.some((r) => r.taxes?.taxes?.length)}`);
  console.log(`    board (meal plan): ${[...new Set(rates.map((r) => r.boardName))].slice(0, 6).join(", ")}`);
  console.log(`    allotment reported: ${rates.some((r) => r.allotment != null)}`);
  console.log("\n  First rate, full shape:");
  console.log(shape(rates[0]));

  if (rates.some((r) => r.rateType === "RECHECK")) {
    console.log(
      "\n  ⚠ RECHECK rates present. Those must go through POST /hotel-api/1.0/checkrates before\n" +
        "    booking. LiteAPI has no equivalent step, so recheck.ts would need a Hotelbeds branch.",
    );
  }
}

console.log("\n──── Next ──────────────────────────────────────────────────────────────");
console.log("  1. Answer the six questions at the top of this file from what came back.");
console.log("  2. Capture fixtures under apps/web/lib/hotels/__fixtures__/hotelbeds/.");
console.log("  3. `hotelbeds` is already a value in the hotel_supplier enum, so the adapter needs");
console.log("     no migration — only apps/web/lib/hotels/suppliers/hotelbeds.ts and a registry entry.");
console.log("  4. Ask Hotelbeds in writing what look-to-book ratio they expect. Ours will be poor:");
console.log("     we refresh on a schedule and on builder page views, and sell few rooms.");
