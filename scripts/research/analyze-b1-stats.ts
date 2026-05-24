/**
 * analyze-b1-stats.ts
 *
 * Probe slot : geo-discovery-probe-2026-05 (G10 ADR-081)
 * Checkpoint B1 — Stats brutes pour la section "Evidence" du rapport final.
 *
 * Lit tous les .archive/research/geo-probe-2026-05-24/raw/<engine>/*.json
 * et produit un markdown table-orienté :
 *   - per-engine : success rate, avg duration, mentions automecanik, top concurrents
 *   - cross-engine : convergence (overlap), divergence (différence)
 *   - top sources par cluster autorité (forum/marchand/media_spe/etc.)
 *
 * Pas de Decision matrix ici (= B2). Stats brutes uniquement.
 *
 * Usage :
 *   npx tsx analyze-b1-stats.ts
 *   npx tsx analyze-b1-stats.ts > b1-stats.md
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKTREE_ROOT = "/opt/automecanik/app/.claude/worktrees/geo-discovery-probe-2026-05";
const RAW_ROOT = resolve(WORKTREE_ROOT, ".archive/research/geo-probe-2026-05-24/raw");
const ENGINES = ["claude-sdk", "claude-cli", "codex-cli"] as const;
type Engine = (typeof ENGINES)[number];

interface Capture {
  probe_slot: string;
  engine: Engine;
  prompt: string;
  prompt_hash: string;
  gamme: string;
  volume: number;
  captured_at: string;
  duration_ms: number;
  ok: boolean;
  error: string | null;
  response_raw: string;
  analysis: {
    automecanik_mentioned: boolean;
    automecanik_context: string | null;
    competitors_mentioned: string[];
    sources_cited: Array<{ raw: string; cluster: string; matchedDomain: string | null }>;
  } | null;
}

function loadCaptures(engine: Engine): Capture[] {
  const dir = join(RAW_ROOT, engine);
  // try-list pattern (anti CodeQL js/file-system-race) : single op, ENOENT = empty
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Capture);
}

function pct(n: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((n / total) * 100).toFixed(1) + "%";
}

function fmt(ms: number): string {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}

interface EngineStats {
  engine: Engine;
  total: number;
  ok: number;
  ko: number;
  avg_duration_ms: number;
  median_duration_ms: number;
  automecanik_mentioned: number;
  competitors_freq: Map<string, number>;
  sources_by_cluster: Map<string, number>;
  prompts_with_zero_sources: number;
  prompts_with_zero_competitors: number;
}

function statsForEngine(captures: Capture[]): EngineStats {
  const ok = captures.filter((c) => c.ok);
  const ko = captures.filter((c) => !c.ok);
  const durations = captures.map((c) => c.duration_ms).sort((a, b) => a - b);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const median = durations.length ? durations[Math.floor(durations.length / 2)]! : 0;

  const automecanik = ok.filter((c) => c.analysis?.automecanik_mentioned).length;

  const competitorsFreq = new Map<string, number>();
  const sourcesByCluster = new Map<string, number>();
  let zeroSources = 0;
  let zeroCompetitors = 0;

  for (const c of ok) {
    if (!c.analysis) continue;
    for (const comp of c.analysis.competitors_mentioned) {
      competitorsFreq.set(comp, (competitorsFreq.get(comp) || 0) + 1);
    }
    for (const src of c.analysis.sources_cited) {
      sourcesByCluster.set(src.cluster, (sourcesByCluster.get(src.cluster) || 0) + 1);
    }
    if (c.analysis.sources_cited.length === 0) zeroSources++;
    if (c.analysis.competitors_mentioned.length === 0) zeroCompetitors++;
  }

  return {
    engine: captures[0]?.engine || ("unknown" as Engine),
    total: captures.length,
    ok: ok.length,
    ko: ko.length,
    avg_duration_ms: avg,
    median_duration_ms: median,
    automecanik_mentioned: automecanik,
    competitors_freq: competitorsFreq,
    sources_by_cluster: sourcesByCluster,
    prompts_with_zero_sources: zeroSources,
    prompts_with_zero_competitors: zeroCompetitors,
  };
}

function topN(map: Map<string, number>, n: number): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = new Set<string>();
  for (const x of a) if (b.has(x)) inter.add(x);
  const union = new Set([...a, ...b]);
  return inter.size / union.size;
}

function computeConvergence(byEngine: Map<Engine, Capture[]>): {
  pairs: Array<{
    pair: string;
    automecanik_agreement: number;  // % de prompts où les 2 engines sont d'accord (both true OR both false)
    competitor_jaccard_avg: number; // moyenne du jaccard sur les listes concurrents par prompt
    sample_size: number;
  }>;
} {
  const pairs = [
    ["claude-sdk", "claude-cli"],
    ["claude-sdk", "codex-cli"],
    ["claude-cli", "codex-cli"],
  ] as const;
  const result: Array<{
    pair: string;
    automecanik_agreement: number;
    competitor_jaccard_avg: number;
    sample_size: number;
  }> = [];

  for (const [eA, eB] of pairs) {
    const aCaps = (byEngine.get(eA as Engine) || []).filter((c) => c.ok);
    const bCaps = (byEngine.get(eB as Engine) || []).filter((c) => c.ok);
    // index by prompt_hash
    const aMap = new Map(aCaps.map((c) => [c.prompt_hash, c]));
    const bMap = new Map(bCaps.map((c) => [c.prompt_hash, c]));
    const commonHashes = Array.from(aMap.keys()).filter((h) => bMap.has(h));

    let agreed = 0;
    const jaccards: number[] = [];
    for (const h of commonHashes) {
      const a = aMap.get(h)!;
      const b = bMap.get(h)!;
      if (!a.analysis || !b.analysis) continue;
      if (a.analysis.automecanik_mentioned === b.analysis.automecanik_mentioned) agreed++;
      jaccards.push(jaccard(new Set(a.analysis.competitors_mentioned), new Set(b.analysis.competitors_mentioned)));
    }
    result.push({
      pair: `${eA} ↔ ${eB}`,
      automecanik_agreement: commonHashes.length ? agreed / commonHashes.length : 0,
      competitor_jaccard_avg: jaccards.length ? jaccards.reduce((a, b) => a + b, 0) / jaccards.length : 0,
      sample_size: commonHashes.length,
    });
  }

  return { pairs: result };
}

function main() {
  console.log("# Section B1 — GEO Evidence (stats brutes)\n");
  console.log("_Probe slot : `geo-discovery-probe-2026-05` (G10 ADR-081)._\n");
  console.log(`_Généré : ${new Date().toISOString()}_\n`);

  // Load all captures
  const byEngine = new Map<Engine, Capture[]>();
  for (const eng of ENGINES) {
    byEngine.set(eng, loadCaptures(eng));
  }

  const totalCaptures = Array.from(byEngine.values()).reduce((acc, arr) => acc + arr.length, 0);
  console.log(`Captures totales : **${totalCaptures}** (${ENGINES.map((e) => `${e}=${byEngine.get(e)?.length || 0}`).join(", ")})\n`);

  if (totalCaptures === 0) {
    console.log("⚠️  Aucune capture trouvée. Lancer `npx tsx geo-evidence-capture.ts` d'abord.");
    return;
  }

  // Per-engine stats
  console.log("## Per-engine\n");
  console.log("| Engine | Total | OK | KO | Success% | Avg duration | Med duration | AutoMecanik mention% | Prompts 0 sources | Prompts 0 concurrents |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  const allStats: EngineStats[] = [];
  for (const eng of ENGINES) {
    const caps = byEngine.get(eng) || [];
    if (caps.length === 0) continue;
    const s = statsForEngine(caps);
    allStats.push(s);
    console.log(
      `| ${s.engine} | ${s.total} | ${s.ok} | ${s.ko} | ${pct(s.ok, s.total)} | ${fmt(s.avg_duration_ms)} | ${fmt(s.median_duration_ms)} | ${pct(s.automecanik_mentioned, s.ok)} | ${pct(s.prompts_with_zero_sources, s.ok)} | ${pct(s.prompts_with_zero_competitors, s.ok)} |`,
    );
  }
  console.log("");

  // Top concurrents par engine
  console.log("## Top 10 concurrents cités (par engine)\n");
  for (const s of allStats) {
    console.log(`### ${s.engine} (sur ${s.ok} captures OK)\n`);
    console.log("| Concurrent | Fréquence | % captures |");
    console.log("|---|---|---|");
    for (const [comp, n] of topN(s.competitors_freq, 10)) {
      console.log(`| ${comp} | ${n} | ${pct(n, s.ok)} |`);
    }
    console.log("");
  }

  // Sources par cluster autorité
  console.log("## Sources citées par cluster autorité (par engine)\n");
  for (const s of allStats) {
    console.log(`### ${s.engine}\n`);
    const totalSources = Array.from(s.sources_by_cluster.values()).reduce((a, b) => a + b, 0);
    console.log(`Total sources citées : ${totalSources}\n`);
    console.log("| Cluster | Sources |");
    console.log("|---|---|");
    for (const [cluster, n] of topN(s.sources_by_cluster, 10)) {
      console.log(`| ${cluster} | ${n} (${pct(n, totalSources)}) |`);
    }
    console.log("");
  }

  // Cross-engine convergence
  console.log("## Cross-engine convergence\n");
  const conv = computeConvergence(byEngine);
  console.log("| Pair | Common prompts | AutoMecanik agreement | Competitor list Jaccard avg |");
  console.log("|---|---|---|---|");
  for (const p of conv.pairs) {
    console.log(
      `| ${p.pair} | ${p.sample_size} | ${(p.automecanik_agreement * 100).toFixed(1)}% | ${p.competitor_jaccard_avg.toFixed(2)} |`,
    );
  }
  console.log("");

  console.log("### Lecture\n");
  console.log("- **AutoMecanik agreement** : % de prompts où les 2 engines donnent le même verdict (cité OUI/NON).");
  console.log("  - claude-sdk ↔ claude-cli : check de stabilité de mesure du même modèle (devrait être ≥ 80%).");
  console.log("  - claude-* ↔ codex-cli : cross-LLM convergence (interprétation : signal robuste si convergent).");
  console.log("- **Competitor list Jaccard avg** : 0 = listes disjointes, 1 = listes identiques.");
  console.log("");

  console.log("## Caveat méthodologique (single-LLM ↔ 2-LLM-families)\n");
  console.log("Engines mesurés = Claude (Anthropic family) + Codex (OpenAI/GPT family). Couvre les 2 familles LLM frontier dominantes 2026.");
  console.log("");
  console.log("**Non mesuré en V1** (Phase C escalation conditionnelle si signal fort) :");
  console.log("- ChatGPT direct (web app, gating différent du Codex CLI)");
  console.log("- Gemini (Google)");
  console.log("- Perplexity AI");
  console.log("- Google AI Overviews");
  console.log("");

  console.log("## Décision matrix\n");
  console.log("**Section B2 (Operational Fulfillment Overlay) requise pour décision GO/STOP.** Cette section B1 = stats brutes uniquement.");
  console.log("");

  // MANIFEST verification (try-read pattern, anti CodeQL js/file-system-race)
  const manifestPath = resolve(RAW_ROOT, "../MANIFEST.sha256");
  try {
    const manifestContent = readFileSync(manifestPath, "utf8");
    const manifestSha = createHash("sha256").update(manifestContent).digest("hex");
    const lines = manifestContent.trim().split("\n").length;
    console.log("## MANIFEST integrity\n");
    console.log(`- Path : \`.archive/research/geo-probe-2026-05-24/MANIFEST.sha256\``);
    console.log(`- Fichiers indexés : ${lines}`);
    console.log(`- SHA-256 du manifest : \`${manifestSha}\``);
    console.log("");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
    // MANIFEST not yet generated (capture still running) — skip silently
  }
}

main();
