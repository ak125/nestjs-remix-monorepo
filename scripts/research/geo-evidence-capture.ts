/**
 * geo-evidence-capture.ts
 *
 * Probe slot : geo-discovery-probe-2026-05 (G10 ADR-081)
 * Checkpoint B1 — GEO Evidence capture (3 modes zero-cost)
 *
 * Modes :
 *   - claude-sdk  : @anthropic-ai/claude-agent-sdk, auth subscription Claude Code
 *   - claude-cli  : claude -p "prompt" subprocess, auth subscription Claude Code
 *   - codex-cli   : codex exec "prompt" subprocess, auth subscription ChatGPT user
 *
 * Sequential per prompt (SDK → CLI → Codex) pour éviter contention subscription.
 *
 * Output : .archive/research/geo-probe-2026-05-24/raw/<engine>/<prompt-hash>.json
 *        + MANIFEST.sha256 atomique en fin de run
 *
 * Usage :
 *   npx tsx geo-evidence-capture.ts            # full run 100 prompts × 3 modes
 *   npx tsx geo-evidence-capture.ts --smoke    # smoke 1 prompt × 3 modes
 *   npx tsx geo-evidence-capture.ts --limit=5  # limit 5 prompts × 3 modes
 *   npx tsx geo-evidence-capture.ts --engines=claude-sdk,claude-cli  # subset
 *
 * Anti-creep : no DB write, no service, no admin UI, no migration, no R-role touch.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// Config / paths
// ============================================================
const WORKTREE_ROOT = "/opt/automecanik/app/.claude/worktrees/geo-discovery-probe-2026-05";
const SAMPLE_PATH = resolve(__dirname, "prompts/dynamic-sample-2026-05-24.yaml");
const TRUST_REGISTRY_PATH = resolve(__dirname, "trust-source-registry.yaml");
const ARCHIVE_ROOT = resolve(WORKTREE_ROOT, ".archive/research/geo-probe-2026-05-24");
const RAW_ROOT = resolve(ARCHIVE_ROOT, "raw");
const MANIFEST_PATH = resolve(ARCHIVE_ROOT, "MANIFEST.sha256");

const ALL_ENGINES = ["claude-sdk", "claude-cli", "codex-cli"] as const;
type Engine = (typeof ALL_ENGINES)[number];

// ============================================================
// CLI args
// ============================================================
const args = process.argv.slice(2);
const SMOKE = args.includes("--smoke");
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT = SMOKE ? 1 : LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1] || "0", 10) : 100;
const ENGINES_ARG = args.find((a) => a.startsWith("--engines="));
const ENGINES: Engine[] = ENGINES_ARG
  ? (ENGINES_ARG.split("=")[1]!.split(",").filter((e) => (ALL_ENGINES as readonly string[]).includes(e)) as Engine[])
  : [...ALL_ENGINES];

console.log(`Engines: ${ENGINES.join(", ")} — Limit: ${LIMIT} prompts`);

// ============================================================
// Locate Claude CLI binary dynamically (symlink stale on /usr/local/bin/claude)
// ============================================================
function findClaudeBin(): string {
  const result = spawnSync("find", [
    "/home/deploy/.vscode-server",
    "-name", "claude",
    "-path", "*native-binary*",
    "-type", "f",
  ], { encoding: "utf8" });
  const lines = (result.stdout || "").trim().split("\n").filter(Boolean);
  if (lines.length === 0) throw new Error("Claude CLI binary not found in .vscode-server");
  return lines[0]!;
}

const CLAUDE_BIN = ENGINES.includes("claude-cli") ? findClaudeBin() : "";

// ============================================================
// Prompt template (single source of truth for all 3 engines)
// ============================================================
function buildPromptInstruction(keyword: string): string {
  // ANTI-BIAS : ne jamais nommer aucune marque/site/concurrent dans l'instruction.
  // Le LLM doit citer librement ce qu'il juge pertinent. Toute mention de marque
  // dans l'instruction = contamination upstream du signal de visibility.
  return `Un utilisateur français cherche : "${keyword}".

Réponds comme un assistant automobile compétent : réponse directe (200-400 mots), pas de disclaimer méta, pas d'intro longue. Si la réponse implique naturellement de mentionner des sites web, marchands, forums, marques ou sources, fais-le librement par leur nom — utilise les noms que tu considères pertinents et fiables pour cet utilisateur.`;
}

// ============================================================
// Trust source classifier (lookup pure, registry-driven)
// ============================================================
interface TrustRegistry {
  clusters: Record<
    string,
    { description: string; weight: number; domains?: string[]; patterns?: string[] }
  >;
}

const trustRegistry = parseYaml(readFileSync(TRUST_REGISTRY_PATH, "utf8")) as TrustRegistry;

function classifySource(rawUrl: string): { cluster: string; matchedDomain: string | null } {
  const lower = rawUrl.toLowerCase();
  for (const [clusterName, cfg] of Object.entries(trustRegistry.clusters)) {
    if (clusterName === "inconnu") continue;
    for (const d of cfg.domains || []) {
      if (lower.includes(d.toLowerCase())) {
        return { cluster: clusterName, matchedDomain: d };
      }
    }
    for (const p of cfg.patterns || []) {
      try {
        if (new RegExp(p, "i").test(rawUrl)) {
          return { cluster: clusterName, matchedDomain: p };
        }
      } catch {
        // bad pattern in registry — skip silently
      }
    }
  }
  return { cluster: "inconnu", matchedDomain: null };
}

// ============================================================
// Response analyzer : extract competitors + sources + automecanik mentions
// ============================================================
interface AnalyzedResponse {
  automecanik_mentioned: boolean;
  automecanik_context: string | null;
  competitors_mentioned: string[];
  sources_cited: Array<{ raw: string; cluster: string; matchedDomain: string | null }>;
}

// Use registry's marchand cluster as competitor seed list (excluding automecanik itself)
const MARCHAND_NAMES: string[] = (
  (trustRegistry.clusters["marchand"]?.domains || []) as string[]
).map((d) => d.split(".")[0]!)
  .filter((n) => n && n !== "automecanik")
  .map((n) => n.toLowerCase());

function analyzeResponse(text: string): AnalyzedResponse {
  const lower = text.toLowerCase();
  // automecanik mention
  const amMention = /automecanik/i.exec(text);
  const automecanik_mentioned = amMention !== null;
  let automecanik_context: string | null = null;
  if (amMention) {
    const start = Math.max(0, amMention.index - 80);
    const end = Math.min(text.length, amMention.index + 160);
    automecanik_context = text.slice(start, end).trim();
  }

  // competitors (substring detection — coarse but registry-aligned)
  const seen = new Set<string>();
  for (const name of MARCHAND_NAMES) {
    if (lower.includes(name)) seen.add(name);
  }
  const competitors_mentioned = Array.from(seen).sort();

  // sources : extract URLs + bare domains
  const urlRegex = /\bhttps?:\/\/[^\s)<>\]"']+/g;
  const bareDomainRegex = /\b(?:[a-z0-9-]+\.)+(?:com|fr|be|net|org|io|de|it|es|co\.uk|club)\b/gi;
  const rawSources = new Set<string>();
  for (const m of text.matchAll(urlRegex)) rawSources.add(m[0]);
  for (const m of text.matchAll(bareDomainRegex)) rawSources.add(m[0]);

  const sources_cited = Array.from(rawSources).map((raw) => {
    const cls = classifySource(raw);
    return { raw, cluster: cls.cluster, matchedDomain: cls.matchedDomain };
  });

  return { automecanik_mentioned, automecanik_context, competitors_mentioned, sources_cited };
}

// ============================================================
// Engine adapters
// ============================================================
interface CaptureResult {
  ok: boolean;
  response_raw: string;
  error: string | null;
  model_version: string | null;
  duration_ms: number;
}

async function callClaudeSDK(prompt: string): Promise<CaptureResult> {
  const t0 = Date.now();
  try {
    const messages: string[] = [];
    let modelVersion: string | null = null;
    const stream = query({
      prompt,
      options: {
        allowedTools: [],  // pas d'outils : on veut la réponse LLM pure, pas d'agent loop
        maxTurns: 1,
        permissionMode: "bypassPermissions",
      },
    });
    for await (const msg of stream) {
      if (msg.type === "assistant" && msg.message?.content) {
        for (const c of msg.message.content) {
          if (c.type === "text") messages.push(c.text);
        }
        if (msg.message.model && !modelVersion) modelVersion = msg.message.model;
      } else if (msg.type === "result") {
        if (msg.subtype === "error_max_turns" || msg.subtype === "error_during_execution") {
          throw new Error(`SDK result error: ${msg.subtype}`);
        }
      }
    }
    return {
      ok: messages.length > 0,
      response_raw: messages.join("\n"),
      error: null,
      model_version: modelVersion,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      response_raw: "",
      error: err instanceof Error ? err.message : String(err),
      model_version: null,
      duration_ms: Date.now() - t0,
    };
  }
}

function callClaudeCLI(prompt: string): CaptureResult {
  const t0 = Date.now();
  try {
    const r = spawnSync(CLAUDE_BIN, ["-p", "--permission-mode", "bypassPermissions"], {
      input: prompt,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (r.status !== 0) {
      return {
        ok: false,
        response_raw: r.stdout || "",
        error: `exit ${r.status}: ${(r.stderr || "").slice(0, 500)}`,
        model_version: null,
        duration_ms: Date.now() - t0,
      };
    }
    return {
      ok: true,
      response_raw: r.stdout.trim(),
      error: null,
      model_version: null,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      response_raw: "",
      error: err instanceof Error ? err.message : String(err),
      model_version: null,
      duration_ms: Date.now() - t0,
    };
  }
}

function callCodexCLI(prompt: string): CaptureResult {
  const t0 = Date.now();
  try {
    const r = spawnSync("codex", ["exec", "--skip-git-repo-check", prompt], {
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PATH: `/home/deploy/.npm-global/bin:${process.env.PATH || ""}` },
    });
    if (r.status !== 0) {
      return {
        ok: false,
        response_raw: r.stdout || "",
        error: `exit ${r.status}: ${(r.stderr || "").slice(0, 500)}`,
        model_version: null,
        duration_ms: Date.now() - t0,
      };
    }
    return {
      ok: true,
      response_raw: r.stdout.trim(),
      error: null,
      model_version: null,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      response_raw: "",
      error: err instanceof Error ? err.message : String(err),
      model_version: null,
      duration_ms: Date.now() - t0,
    };
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  // Load sample
  const sampleRaw = readFileSync(SAMPLE_PATH, "utf8");
  const sample = parseYaml(sampleRaw) as {
    probe_slot: string;
    prompts: Array<{ rank: number; keyword: string; keyword_normalized: string; gamme: string; volume: number }>;
  };
  console.log(`Loaded ${sample.prompts.length} prompts from sample (${sample.probe_slot})`);

  const toProcess = sample.prompts.slice(0, LIMIT);
  console.log(`Processing ${toProcess.length} prompts × ${ENGINES.length} engines`);

  // Ensure raw dirs
  for (const eng of ENGINES) {
    mkdirSync(join(RAW_ROOT, eng), { recursive: true });
  }

  let totalCalls = 0;
  let successCalls = 0;
  const perEngineStats: Record<string, { ok: number; ko: number; ms_total: number }> = {};
  for (const e of ENGINES) perEngineStats[e] = { ok: 0, ko: 0, ms_total: 0 };

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]!;
    const promptHash = createHash("sha256").update(p.keyword).digest("hex").slice(0, 16);
    const promptInstruction = buildPromptInstruction(p.keyword);

    console.log(`[${i + 1}/${toProcess.length}] "${p.keyword}" (gamme=${p.gamme}, vol=${p.volume})`);

    for (const engine of ENGINES) {
      const outPath = join(RAW_ROOT, engine, `${promptHash}.json`);

      // Skip if already captured (idempotent retry).
      // Try-read pattern (anti file-system race CodeQL js/file-system-race) :
      // un seul appel readFileSync, throw → not cached, proceed.
      try {
        const existing = JSON.parse(readFileSync(outPath, "utf8"));
        console.log(`  [${engine}] skip (already captured)`);
        const stats = perEngineStats[engine]!;
        if (existing.ok) stats.ok++;
        else stats.ko++;
        totalCalls++;
        if (existing.ok) successCalls++;
        continue;
      } catch (err) {
        // ENOENT or parse error → not cached, proceed with capture
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
          // unexpected error : log + re-capture
          console.log(`  [${engine}] cache read failed (${(err as Error)?.message?.slice(0, 60)}), re-capturing`);
        }
      }

      let result: CaptureResult;
      if (engine === "claude-sdk") result = await callClaudeSDK(promptInstruction);
      else if (engine === "claude-cli") result = callClaudeCLI(promptInstruction);
      else result = callCodexCLI(promptInstruction);

      totalCalls++;
      const stats = perEngineStats[engine]!;
      stats.ms_total += result.duration_ms;
      if (result.ok) {
        successCalls++;
        stats.ok++;
      } else {
        stats.ko++;
      }

      const analysis = result.ok ? analyzeResponse(result.response_raw) : null;

      const record = {
        probe_slot: sample.probe_slot,
        engine,
        prompt: p.keyword,
        prompt_normalized: p.keyword_normalized,
        prompt_hash: promptHash,
        gamme: p.gamme,
        volume: p.volume,
        captured_at: new Date().toISOString(),
        model_version: result.model_version,
        duration_ms: result.duration_ms,
        ok: result.ok,
        error: result.error,
        response_raw: result.response_raw,
        analysis,
      };

      writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
      console.log(`  [${engine}] ${result.ok ? "OK" : "FAIL"} (${result.duration_ms}ms${result.error ? ", err=" + result.error.slice(0, 80) : ""})`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total calls: ${totalCalls}, success: ${successCalls} (${((successCalls / Math.max(totalCalls, 1)) * 100).toFixed(1)}%)`);
  for (const [eng, s] of Object.entries(perEngineStats)) {
    const total = s.ok + s.ko;
    const avgMs = total > 0 ? Math.round(s.ms_total / total) : 0;
    console.log(`  ${eng}: ${s.ok}/${total} OK (avg ${avgMs}ms)`);
  }

  // Generate MANIFEST.sha256 atomique
  console.log("\nGenerating MANIFEST.sha256 ...");
  const manifestLines: string[] = [];
  for (const eng of ENGINES) {
    const dir = join(RAW_ROOT, eng);
    // try-list pattern (anti CodeQL js/file-system-race) : single op, throw OK
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw err;
    }
    for (const f of files) {
      const fp = join(dir, f);
      // try-read pattern : single op, propagate other errors
      try {
        const content = readFileSync(fp);
        const sha = createHash("sha256").update(content).digest("hex");
        manifestLines.push(`${sha}  raw/${eng}/${f}`);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
        throw err;
      }
    }
  }
  writeFileSync(MANIFEST_PATH, manifestLines.join("\n") + "\n", "utf8");
  const manifestSha = createHash("sha256").update(manifestLines.join("\n") + "\n").digest("hex");
  console.log(`MANIFEST.sha256 written (${manifestLines.length} files, manifest sha256=${manifestSha})`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
