// Probe an Expedia Rapid key and report what the API actually returns.
//
// Same script, same reason, as scripts/liteapi-probe.mjs and scripts/hotelbeds-probe.mjs. Do not
// write apps/web/lib/hotels/suppliers/expedia.ts until this has run against a real key: the Duffel
// adapter in this repo was written from documentation, has never met an account, and is the reason
// this convention exists.
//
//   node scripts/expedia-probe.mjs --key <apiKey> --secret <secret>
//   EXPEDIA_API_KEY=... EXPEDIA_SECRET=... node scripts/expedia-probe.mjs [--ids 12345,67890]
//
// Neither the key nor the secret is ever printed. Nothing is written anywhere; this only reads.
//
// GETTING A KEY IS THE HARD PART. Rapid is not self-serve: you apply at
// developers.expediagroup.com/docs/products/rapid and it is reviewed case by case
// (docs/hotel-provider-audit.md). Expect weeks, not an afternoon. This script exists so that the
// day access lands, the integration work is an hour rather than a week.
//
// WHY IT IS STILL WORTH CHASING. Of every provider audited, Rapid has the best cancellation model:
// windows with a start, an end, and one of amount / nights / percent. Our schema stores a ladder
// because LiteAPI forced it; Rapid is the one that would justify it fully.
//
// Rapid signs every request: Authorization: EAN apikey=<key>,signature=<sha512(key+secret+epoch)>,timestamp=<epoch>
//
// Questions to answer before writing the adapter:
//   1. `property_id` fetch: /properties/availability takes up to 250 ids per call. Confirm, and
//      confirm ids are stable across time — our curated mapping depends on it.
//   2. Price decomposition: `totals.inclusive` vs `totals.exclusive` vs `totals.strikethrough`,
//      and where taxes and fees actually live. We store net, taxes, fees and total separately.
//   3. `cancel_penalties[]`: start, end, and amount|nights|percent. This is the shape our ladder
//      was built for — verify it rather than assuming.
//   4. Two-step book: /price-check then the link-driven booking. Rapid returns HATEOAS `links`,
//      which is a different control flow from LiteAPI's recheck-then-book and would change
//      recheck.ts and booking.ts.
//   5. `refundable_damage_deposit` and `fees` that are payable at the property — those are money a
//      traveler pays that never touches us, and the tier copy has to say so.
//   6. Test mode: Rapid has a sandbox that answers on the same host with test property ids. Find
//      out which ids, because production ids will not resolve there.

import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY = opt("key", process.env.EXPEDIA_API_KEY);
const SECRET = opt("secret", process.env.EXPEDIA_SECRET);
const BASE = (opt("base", process.env.EXPEDIA_BASE) ?? "https://api.ean.com/v3").replace(/\/$/, "");
const CHECKIN = opt("checkin", isoInDays(120));
const CHECKOUT = opt("checkout", isoInDays(125));
const IDS = (opt("ids", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!KEY || !SECRET) {
  console.error("Need both a key and a secret.");
  console.error("  node scripts/expedia-probe.mjs --key <apiKey> --secret <secret>");
  console.error("Rapid is application-gated: https://developers.expediagroup.com/docs/products/rapid");
  process.exit(1);
}

function isoInDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Never log the key, the secret, or the header they produce. */
function authHeader() {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash("sha512").update(KEY + SECRET + ts).digest("hex");
  return `EAN apikey=${KEY},signature=${sig},timestamp=${ts}`;
}

async function call(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Customer-Ip": "1.1.1.1",
        "User-Agent": "guideless-probe/1.0",
      },
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

console.log(`Expedia Rapid probe · ${BASE} · ${CHECKIN} → ${CHECKOUT}`);
console.log("Reads only. The key and secret are never printed.\n");

if (!IDS.length) {
  console.log(
    "No --ids given. Rapid has no open destination search in the shape we need, and property ids\n" +
      "come from the /properties/content feed. Pass ids once you have them:\n" +
      "  node scripts/expedia-probe.mjs --ids 12345,67890\n" +
      "Trying the availability endpoint anyway so an auth problem shows up now.\n",
  );
}

console.log("──── GET /properties/availability ──────────────────────────────────────");
const avail = await call("/properties/availability", {
  checkin: CHECKIN,
  checkout: CHECKOUT,
  currency: "USD",
  country_code: "US",
  language: "en-US",
  occupancy: "2",
  property_id: IDS.length ? IDS : ["0"],
  rate_plan_count: 1,
  sales_channel: "website",
  sales_environment: "hotel_only",
});
console.log(`status ${avail.status} in ${avail.ms}ms`);

if (avail.status === 401 || avail.status === 403) {
  console.error(
    "\nRejected. Either the credentials are wrong or the clock is off: the signature is\n" +
      "sha512(apiKey + secret + unix seconds) and Rapid is strict about drift.",
  );
  process.exit(1);
}
if (!avail.ok) {
  console.log(JSON.stringify(avail.json).slice(0, 900));
  console.log(
    "\nA 400 with no property ids is expected — it still proves auth works. Re-run with --ids.",
  );
  process.exit(0);
}

const props = Array.isArray(avail.json) ? avail.json : [];
console.log(`properties returned: ${props.length}`);
if (props[0]) {
  console.log("\nFirst property, shape:");
  console.log(shape(props[0]));

  const rooms = props.flatMap((p) => p.rooms ?? []);
  const rates = rooms.flatMap((r) => r.rates ?? []);
  console.log("\n  The things that decide our adapter:");
  console.log(`    rooms ${rooms.length}, rates ${rates.length}`);
  if (rates.length) {
    const pens = rates.map((r) => (r.cancel_penalties ?? []).length);
    console.log(
      `    cancel_penalties per rate: max ${Math.max(...pens)}, ` +
        `${pens.filter((n) => n > 1).length} with more than one, ${pens.filter((n) => n === 0).length} with none`,
    );
    const kinds = new Set();
    for (const r of rates)
      for (const p of r.cancel_penalties ?? []) {
        if (p.amount != null) kinds.add("amount");
        if (p.nights != null) kinds.add("nights");
        if (p.percent != null) kinds.add("percent");
      }
    console.log(`    penalty units seen: ${[...kinds].join(", ") || "none"}`);
    console.log(`    refundable flag: ${rates.some((r) => r.refundable != null)}`);
    console.log(
      `    totals keys: ${[...new Set(rates.flatMap((r) => Object.keys(r.occupancy_pricing?.["2"]?.totals ?? {})))].join(", ")}`,
    );
    console.log(`    links (HATEOAS) present: ${rates.some((r) => r.links != null)}`);
    console.log("\n  First rate, full shape:");
    console.log(shape(rates[0]));
  }
}

console.log("\n──── Next ──────────────────────────────────────────────────────────────");
console.log("  1. Answer the six questions at the top of this file from what came back.");
console.log("  2. Capture fixtures under apps/web/lib/hotels/__fixtures__/expedia/.");
console.log("  3. `expedia` is already a value in the hotel_supplier enum, so no migration is");
console.log("     needed — only apps/web/lib/hotels/suppliers/expedia.ts and a registry entry.");
console.log("  4. If cancel_penalties really is {start, end, amount|nights|percent}, this is the");
console.log("     richest ladder of any provider we have seen and worth normalising carefully:");
console.log("     nights and percent both have to become an amount before they reach our schema.");
