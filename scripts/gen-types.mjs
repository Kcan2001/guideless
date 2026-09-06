#!/usr/bin/env node
// Regenerates packages/types/src/database.ts from the LOCAL Supabase schema.
// A script (rather than a shell redirect) so Windows PowerShell does not write a UTF-16/BOM file.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.cwd(), "packages/types/src/database.ts");
const localCli = resolve(process.cwd(), "node_modules/supabase/dist/supabase.js");

// Prefer the workspace-installed CLI (no shell needed); fall back to a global `supabase`.
const [cmd, args] = existsSync(localCli)
  ? [process.execPath, [localCli, "gen", "types", "typescript", "--local"]]
  : ["supabase", ["gen", "types", "typescript", "--local"]];

const types = execFileSync(cmd, args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 64 * 1024 * 1024,
});

const header = `// GENERATED FILE -- do not edit. Regenerate with \`pnpm db:types\` after every migration.\n\n`;
writeFileSync(out, header + types, "utf8");
console.log(`Wrote ${out} (${types.length.toLocaleString()} chars)`);
