/**
 * check-diagnostic-knowledge-snapshot — vérifie que la knowledge diagnostic LIVE
 * correspond au snapshot de référence (PR-2). Rejouable / idempotent.
 *
 * Usage : npx ts-node scripts/check-diagnostic-knowledge-snapshot.ts
 * Exit 0 = conforme · 1 = divergence · 2 = pas de snapshot de référence.
 * Lecture seule DB. Aucune mutation.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildSnapshot } from "./lib/diagnostic-knowledge-snapshot";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const OUT_DIR = join(__dirname, "..", "..", "audit", "diagnostic-knowledge", "snapshots");
const SHA_PATH = join(OUT_DIR, "diagnostic-knowledge.snapshot.sha256");

async function main(): Promise<void> {
  if (!existsSync(SHA_PATH)) {
    console.error(
      "⚠️ Aucun snapshot de référence. Lancer export-diagnostic-knowledge.ts d'abord.",
    );
    process.exit(2);
  }
  const expected = readFileSync(SHA_PATH, "utf8").trim();
  const { sha256, counts } = await buildSnapshot(supabase);

  if (sha256 === expected) {
    console.log(`✅ Conforme — sha256 ${sha256}`);
    console.log(JSON.stringify(counts, null, 2));
    process.exit(0);
  }
  console.error(`❌ DIVERGENCE\n  attendu : ${expected}\n  obtenu  : ${sha256}`);
  console.error(JSON.stringify(counts, null, 2));
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Check échoué:", err.message);
  process.exit(1);
});
