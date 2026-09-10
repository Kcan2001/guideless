// Seeds the public catalog (destinations, tours, departures, extras, meetups, photos) into a
// database once. Production starts empty; these files are idempotent (`on conflict do nothing`)
// and contain no users, bookings or payments, so they are safe to run against a live project.
//
//   node scripts/seed-catalog.mjs --db-url "postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
//   DATABASE_URL=... node scripts/seed-catalog.mjs [--dry-run] [--only 020,050]
//
// Uses `psql` when it is on PATH, otherwise the `pg` driver (root devDependency). The connection
// string is never printed.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = join(root, "supabase", "seed");
const CATALOG_PREFIXES = ["010", "020", "030", "040", "050", "060", "070", "080", "081", "082", "083", "084", "085", "086"];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes("--dry-run");
const only = opt("only")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const dbUrl = opt("db-url") ?? process.env.DATABASE_URL;

const files = readdirSync(SEED_DIR)
  .filter((n) => n.endsWith(".sql") && CATALOG_PREFIXES.some((p) => n.startsWith(p)))
  .filter((n) => !only || only.some((p) => n.startsWith(p)))
  .sort()
  .map((n) => join(SEED_DIR, n));

if (files.length === 0) {
  console.error("No catalog seed files matched.");
  process.exit(1);
}
console.log(`${files.length} catalog seed file(s):`);
for (const f of files) console.log(`  ${f.slice(root.length + 1)}`);
if (DRY) {
  console.log("\n(dry run: nothing applied)");
  process.exit(0);
}
if (!dbUrl) {
  console.error(
    "\nProvide --db-url or DATABASE_URL (Supabase → Project → Settings → Database → URI).",
  );
  process.exit(1);
}

function hasPsql() {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["psql"], {
    encoding: "utf8",
  });
  return r.status === 0;
}

async function runWithPsql() {
  for (const f of files) {
    console.log(`\n→ psql ${f.slice(root.length + 1)}`);
    const r = spawnSync(
      "psql",
      [dbUrl, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q", "-f", f],
      {
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    if (r.status !== 0) {
      console.error(`psql exited with ${r.status}; stopping.`);
      process.exit(r.status ?? 1);
    }
  }
}

async function runWithPg() {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error(
      "Neither `psql` on PATH nor the `pg` package is available. Run `pnpm add -w -D pg` or install psql.",
    );
    process.exit(1);
  }
  const { Client } = pg.default ?? pg;
  const client = new Client({
    connectionString: dbUrl,
    ssl:
      dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const f of files) {
      console.log(`\n→ ${f.slice(root.length + 1)}`);
      const sql = readFileSync(f, "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        console.error(`Failed in ${f}: ${err.message}`);
        process.exit(1);
      }
    }
  } finally {
    await client.end();
  }
}

if (hasPsql()) await runWithPsql();
else await runWithPg();
console.log(
  `\nCatalog seeded (${files.length} file(s)). Re-running is safe: keyed rows are skipped on conflict.`,
);
if (existsSync(join(SEED_DIR, "070_photos.sql"))) {
  console.log("Photos seed included; make sure apps/web/public/photos is deployed with the site.");
}
