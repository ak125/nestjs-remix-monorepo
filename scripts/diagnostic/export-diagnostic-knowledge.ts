/**
 * export-diagnostic-knowledge — écrit un snapshot reproductible de la knowledge diagnostic.
 *
 * Usage : npx ts-node scripts/export-diagnostic-knowledge.ts
 * Lecture seule DB. Sorties → audit/diagnostic-knowledge/snapshots/ :
 *   - diagnostic-knowledge.snapshot.json  (forme canonique, octets stables)
 *   - diagnostic-knowledge.snapshot.sha256
 *   - diagnostic-knowledge.counts.json
 *
 * Anti-perte (PR-2) : la base métier diagnostic devient versionnée + checksummée + rejouable.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalize } from "./lib/canonical-json";
import { buildSnapshot } from "./lib/diagnostic-knowledge-snapshot";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// scripts/ → backend/ → racine repo
const OUT_DIR = join(__dirname, "..", "..", "audit", "diagnostic-knowledge", "snapshots");

async function main(): Promise<void> {
  const { canonical, sha256, counts } = await buildSnapshot(supabase);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "diagnostic-knowledge.snapshot.json"), canonical + "\n");
  writeFileSync(join(OUT_DIR, "diagnostic-knowledge.snapshot.sha256"), sha256 + "\n");
  writeFileSync(
    join(OUT_DIR, "diagnostic-knowledge.counts.json"),
    canonicalize(counts) + "\n",
  );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`✅ Snapshot écrit (${total} lignes, sha256 ${sha256})`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("❌ Export échoué:", err.message);
  process.exit(1);
});
