/**
 * build-dynamic-sample.ts
 *
 * Probe slot : geo-discovery-probe-2026-05 (G10 ADR-081)
 * Checkpoint B1 — Dynamic Weighted Sampling
 *
 * Génère prompts/dynamic-sample-2026-05-24.yaml (sha256-locké, replayable)
 * depuis __seo_keywords + pondérations versionnées dans sampling-weights.yaml.
 *
 * Stratégie effective (v2, post data discovery 2026-05-24) :
 *   - Stratified by gamme (cap 8 per gamme)
 *   - Intra-stratum weighted by sqrt(volume)
 *   - Seeded random tie-breaker (reproducible)
 *   - Total = 100 prompts
 *
 * Signaux N/A documentés dans sampling-weights.yaml :
 *   - funnel conversion (table __funnel_event_v1 non trouvée)
 *   - SAV frequency
 *   - marge by prompt
 *   - R-role classification (97% NULL)
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from monorepo backend/.env
// Worktrees don't have .env (it's gitignored), so always read from main repo path
const ENV_PATH = "/opt/automecanik/app/backend/.env";
loadEnv({ path: ENV_PATH });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans backend/.env");
  process.exit(1);
}

const SAMPLING_WEIGHTS_PATH = resolve(__dirname, "sampling-weights.yaml");
const OUTPUT_PATH = resolve(__dirname, "prompts/dynamic-sample-2026-05-24.yaml");

interface SamplingWeights {
  version: number;
  measured_at: string;
  effective_scoring: {
    cap_per_gamme: number;
    seed: string;
  };
  pool_filter: {
    min_volume: number;
    exclude_null_gamme: boolean;
  };
  sample_size: number;
}

interface KeywordRow {
  id: number;
  keyword: string;
  keyword_normalized: string;
  gamme: string;
  volume: number;
  best_rank: number | null;
  pg_id: number | null;
  type_id: number | null;
  content_type: string | null;
}

interface SampledPrompt {
  rank: number;
  keyword: string;
  keyword_normalized: string;
  gamme: string;
  volume: number;
  best_rank: number | null;
  intra_gamme_weight: number;
  content_type: string | null;
}

// Mulberry32 seeded PRNG — deterministic, fast, sufficient for sampling
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  const hash = createHash("sha256").update(s).digest();
  // First 4 bytes as uint32
  return hash.readUInt32BE(0);
}

async function main() {
  // 1. Load sampling weights
  const weights = parseYaml(readFileSync(SAMPLING_WEIGHTS_PATH, "utf8")) as SamplingWeights;
  console.log(`Loaded sampling-weights.yaml v${weights.version} (measured_at=${weights.measured_at})`);

  const SAMPLE_SIZE = weights.sample_size;
  const CAP_PER_GAMME = weights.effective_scoring.cap_per_gamme;
  const MIN_VOLUME = weights.pool_filter.min_volume;

  // 2. Fetch eligible pool from Supabase (paginate to avoid 1000-row cap per memory rule)
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Fetching pool : volume >= ${MIN_VOLUME}, gamme NOT NULL ...`);
  const allRows: KeywordRow[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("__seo_keywords")
      .select("id, keyword, keyword_normalized, gamme, volume, best_rank, pg_id, type_id, content_type")
      .gte("volume", MIN_VOLUME)
      .not("gamme", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...(data as KeywordRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Pool size : ${allRows.length} prompts`);

  // 3. Group by gamme
  const byGamme = new Map<string, KeywordRow[]>();
  for (const row of allRows) {
    const g = row.gamme.trim();
    if (!byGamme.has(g)) byGamme.set(g, []);
    byGamme.get(g)!.push(row);
  }
  console.log(`Distinct gammes : ${byGamme.size}`);

  // 4. Compute intra-stratum sqrt(volume) weights + seeded sample with cap
  const seed = seedFromString(weights.effective_scoring.seed);
  const rand = mulberry32(seed);

  const stratified: SampledPrompt[] = [];

  for (const [gamme, rows] of byGamme.entries()) {
    // sqrt(volume) weighting + small random jitter to break ties
    const weighted = rows.map((r) => ({
      row: r,
      score: Math.sqrt(r.volume) * (0.95 + rand() * 0.10),
    }));
    weighted.sort((a, b) => b.score - a.score);
    const picked = weighted.slice(0, CAP_PER_GAMME);
    for (const w of picked) {
      stratified.push({
        rank: 0,  // filled later
        keyword: w.row.keyword,
        keyword_normalized: w.row.keyword_normalized,
        gamme: w.row.gamme,
        volume: w.row.volume,
        best_rank: w.row.best_rank,
        intra_gamme_weight: Math.round(w.score * 100) / 100,
        content_type: w.row.content_type,
      });
    }
  }

  // 5. Global rank by intra_gamme_weight desc, truncate to SAMPLE_SIZE
  stratified.sort((a, b) => b.intra_gamme_weight - a.intra_gamme_weight);
  const sampled = stratified.slice(0, SAMPLE_SIZE);
  sampled.forEach((p, i) => (p.rank = i + 1));

  // 6. Coverage stats
  const gammeCoverage = new Set(sampled.map((p) => p.gamme));
  console.log(`Sampled ${sampled.length} prompts, ${gammeCoverage.size} gammes covered.`);

  // 7. Output YAML with sha256 self-lock
  const output = {
    probe_slot: "geo-discovery-probe-2026-05",
    generated_at: new Date().toISOString(),
    sampling_weights_version: weights.version,
    seed_source: weights.effective_scoring.seed,
    pool_size: allRows.length,
    sample_size: sampled.length,
    gamme_coverage: gammeCoverage.size,
    gammes_in_sample: Array.from(gammeCoverage).sort(),
    prompts: sampled,
  };

  const yamlStr = stringifyYaml(output, { lineWidth: 0 });
  const sha = createHash("sha256").update(yamlStr).digest("hex");

  const finalContent = `# sha256: ${sha}\n${yamlStr}`;
  writeFileSync(OUTPUT_PATH, finalContent, "utf8");
  console.log(`Written ${OUTPUT_PATH}`);
  console.log(`SHA-256 : ${sha}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
