// Probe a Viator API key and report what the API actually returns.
//
// The same script, for the same reason, as scripts/liteapi-probe.mjs. The Duffel adapter in this
// repo was written from public documentation and has never run against a real account, which is
// why it is a plausible integration rather than a verified one. LiteAPI was done the other way —
// probe first, read real responses, then write the adapter — and it immediately found something
// the documentation had not made obvious (116 of 200 rates carried more than one cancellation
// window, which changed the schema).
//
// So there is deliberately no Viator adapter in this repo yet. Run this, read the output, capture
// the fixtures, then write it.
//
//   node scripts/viator-probe.mjs --key <key>
//   VIATOR_API_KEY=<key> node scripts/viator-probe.mjs [--dest "Nice"] [--date 2027-05-20]
//
// The key is never printed. Nothing is written anywhere unless you pass --save; this only reads.
//
// Questions to answer before writing the adapter:
//   1. ANSWERED 2026-09-10: /products/search takes a NUMERIC destination id and rejects a name
//      ("Invalid destination: not a number: Nice"). Resolve it from /destinations first. Ids that
//      matter to us: Nice 478, Monaco 948, Monaco-Ville 50270, French Riviera 179, Avignon 483,
//      Provence 184, Villefranche 50322, Cannes 786, Antibes 21941, Aix 5228.
//      Sandbox 500s on some destinations (478 and 179 both did) while others work; retry rather
//      than concluding the id is wrong.
//   2. Does a product carry a price, or only its options ("product options" / "tour grades")?
//      Our schema assumes the second — one product, several bookable options per date.
//   3. Is the price we see the NET price to us, or the retail price with a commission implied?
//      This decides whether `net_amount` in experience_rates is what the API returns or a
//      calculation, and getting it backwards means selling below cost.
//   4. Cancellation: a single deadline or a ladder? experience_rates stores a ladder because the
//      hotel work found single-deadline models lose money. Confirm the shape.
//   5. Availability: is it per date, per date+option, and does it come back with a capacity?
//   6. Booking: is there a hold/reserve step before confirm, and how long does it last? Our
//      contract assumes recheck-then-book with no hold; if a hold exists we should use it.

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const KEY = opt("key", process.env.VIATOR_API_KEY);
// Sandbox by default. The key in supabase/.env is a sandbox key: pointed at the production host it
// returns 401 Invalid API Key, which reads like a bad key rather than the wrong host and cost an
// afternoon once already. Pass --base https://api.viator.com/partner once a production key exists.
const BASE = (
  opt("base", process.env.VIATOR_BASE) ?? "https://api.sandbox.viator.com/partner"
).replace(
  /\/$/,
  "",
);
const DEST = opt("dest", "Nice");
const DATE = opt("date", isoInDays(60));
const SAVE = has("save");

if (!KEY) {
  console.error("No key. Pass --key <key> or set VIATOR_API_KEY.");
  console.error(
    "Viator partner API access: https://partnerresources.viator.com/travel-commerce/affiliate/api/",
  );
  process.exit(1);
}

/** Never log the key, a URL containing it, or a header block. */
function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replaceAll(KEY, "<key>");
}

async function call(path, { method = "GET", body } = {}) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "exp-api-key": KEY,
        Accept: "application/json;version=2.0",
        "Accept-Language": "en-US",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { _unparsed: text.slice(0, 400) };
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      json: { _error: redact(String(err)) },
    };
  }
}

function isoInDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Print the shape of a response rather than the whole thing: keys, types, one example each. */
function shape(value, depth = 0, seen = 0) {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[] (empty)`;
    return `${pad}[${value.length}] of:\n${shape(value[0], depth + 1)}`;
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .slice(0, 24)
      .map(([k, v]) => {
        if (v === null) return `${pad}${k}: null`;
        if (Array.isArray(v)) return `${pad}${k}:\n${shape(v, depth + 1, seen + 1)}`;
        if (typeof v === "object" && seen < 2)
          return `${pad}${k}:\n${shape(v, depth + 1, seen + 1)}`;
        if (typeof v === "object") return `${pad}${k}: {…}`;
        return `${pad}${k}: ${typeof v} = ${redact(String(v)).slice(0, 80)}`;
      })
      .join("\n");
  }
  return `${pad}${typeof value}`;
}

function report(title, result) {
  console.log(`\n${"─".repeat(78)}\n${title}  →  ${result.status} in ${result.ms} ms`);
  console.log(shape(result.json));
  return result;
}

const captured = {};

console.log(`Probing Viator. Destination "${DEST}", date ${DATE}. The key is never printed.`);

// 1. Destinations: does a text search exist, and what identifies a place?
const destinations = report(
  "GET /destinations (is there a list, and what is an id?)",
  await call("/destinations"),
);
captured.destinations = destinations.json;

// 2. Search: free text, or destination id?
const search = report(
  "POST /products/search (free text)",
  await call("/products/search", {
    method: "POST",
    body: { filtering: { destination: DEST }, pagination: { start: 1, count: 5 }, currency: "EUR" },
  }),
);
captured.search = search.json;

// 3. A single product: where do options live, and is there a price on the product itself?
const productCode =
  search.json?.products?.[0]?.productCode ?? search.json?.data?.[0]?.productCode ?? null;
if (productCode) {
  captured.product = report(
    `GET /products/${productCode}`,
    await call(`/products/${productCode}`),
  ).json;

  // 4. Availability and price for a date — the question the whole schema rests on.
  captured.availability = report(
    "POST /availability/check (net or retail? ladder or deadline? capacity?)",
    await call("/availability/check", {
      method: "POST",
      body: {
        productCode,
        travelDate: DATE,
        currency: "EUR",
        paxMix: [{ ageBand: "ADULT", numberOfTravelers: 2 }],
      },
    }),
  ).json;
} else {
  console.log(
    "\nNo productCode in the search response — read the shape above and adjust the query.",
  );
}

console.log(`\n${"─".repeat(78)}`);
console.log("Now answer the six questions at the top of this file from what came back.");
console.log("Then write apps/web/lib/experiences/viator.ts against these responses, not the docs,");
console.log("and capture fixtures under apps/web/lib/experiences/__fixtures__/.");

if (SAVE) {
  const { writeFileSync } = await import("node:fs");
  const out = "viator-probe-output.json";
  writeFileSync(out, redact(JSON.stringify(captured, null, 2)));
  console.log(
    `\nSaved redacted responses to ${out} (git-ignored; do not commit raw supplier data).`,
  );
}
