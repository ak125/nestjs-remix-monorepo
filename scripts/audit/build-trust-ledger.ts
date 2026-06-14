#!/usr/bin/env tsx
/**
 * Trust Ledger V1 — full-stack confidence map (PR-A, read-only DIAGNOSTIC).
 *
 * Pure consumer / projection. Aggregates ALREADY-PRODUCED evidence across the
 * whole stack into one owner-grouped map. Emits:
 *   - audit-reports/trust-ledger.md   (human, grouped by owner)
 *   - audit-reports/trust-ledger.json (machine, schema-versioned)
 *
 * Always exits 0. NEVER a producer: it does not regenerate canonical.json,
 * run builders, or compute primary truth. Every row traces to a named
 * `source_path`. Missing source ⇒ MISSING; stale source ⇒ STALE + UNKNOWN.
 *
 * Two axes, never conflated:
 *   - coverage_status: does a recurring check exist? (RECURRING|MANUAL|MISSING|STALE)
 *   - health_status:   what is its result?           (PASS|WARN|FAIL|UNKNOWN)
 *   RECURRING ≠ PASS. A recurring check can FAIL.
 *
 * This is a DIAGNOSTIC, not a health proof: it shows where evidence is fresh,
 * stale, manual, or absent — it never reassures artificially.
 *
 * Model: scripts/audit/build-drift-dashboard.ts (pure consumer, exits 0).
 * Plan:  /home/deploy/.claude/plans/ready-for-review-select-swirling-dove.md
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

// ── Output schema (2 axes — see header) ──────────────────────────────────
export type CoverageStatus = "RECURRING" | "MANUAL" | "MISSING" | "STALE";
export type HealthStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";

export interface LedgerRow {
  surface: string;
  domain: string;
  owner: string;
  dimension: string;
  coverage_status: CoverageStatus;
  health_status: HealthStatus;
  producer: string;
  /** Named source this row PROJECTS. null ⇒ no source ⇒ MISSING (never computed). */
  source_path: string | null;
  /** The SOURCE's own timestamp/mtime — NOT the ledger run time. */
  generated_at: string | null;
  freshness: string;
  evidence: { observed: unknown; expected: unknown };
  severity: Severity;
  confidence: Confidence;
  suggested_remediation: string;
  autofixable: false;
}

export interface TrustLedgerJson {
  schema_version: "trust-ledger/v1";
  /** Run timestamp — manifest ONLY, never in the diffed markdown body. */
  generated_at: string;
  manifest: {
    surfaces: string[];
    rows_total: number;
    coverage_counts: Record<CoverageStatus, number>;
    health_counts: Record<HealthStatus, number>;
    db_enrichment: "applied" | "skipped:no-creds" | "skipped:error";
    note: string;
  };
  rows: LedgerRow[];
}

/** Live one-shot read of the SEO/catalog runtime sinks (env-gated). */
export interface SeoRuntimeProbeResult {
  snapshot_newest_iso: string | null;
  findings_rows: number | null;
}
export type DbProbeFn = () => Promise<SeoRuntimeProbeResult | null>;

export interface BuildOpts {
  /** Override repo root — used by tests to point at fixtures. */
  repoRoot?: string;
  /** Override "now" — used by tests for deterministic ageHours. */
  nowIso?: string;
  /** Inject a probe (tests) or null to skip. Default = env-gated live probe. */
  dbProbe?: DbProbeFn | null;
}

// ── Constants ────────────────────────────────────────────────────────────
const CANONICAL_STALE_DAYS = 7; // inventory every other dimension depends on

/** The 6 runtime-truth-audit checks — spec lives in the skill; runner = PR-B0a. */
const RUNTIME_TRUTH_CHECKS: Array<{
  check: string;
  dimension: string;
  severity: Severity;
}> = [
  { check: "pg-stable-write", dimension: "STABLE/IMMUTABLE functions that write", severity: "critical" },
  { check: "partition-cron-gap", dimension: "Partitioned tables without rotation cron", severity: "critical" },
  { check: "rpc-registry-drift", dimension: "RPC registry ↔ pg_proc divergence", severity: "high" },
  { check: "attribution-write-gap", dimension: "Attribution columns never written", severity: "high" },
  { check: "nest-dead-services", dimension: "Dead @Injectable services (DI)", severity: "high" },
  { check: "orphan-runtime-flags", dimension: "Orphan feature flags", severity: "medium" },
];

/**
 * Known GAP cells from the one-time full-stack map. These have NO recurring
 * producer yet → MISSING. They are projected from a one-time, explicitly-STALE
 * source so the matrix is complete WITHOUT the ledger computing a primary truth.
 */
const KNOWN_GAP_CELLS: Array<{
  surface: string;
  owner: string;
  dimension: string;
  severity: Severity;
  remediation: string;
}> = [
  { surface: "frontend", owner: "frontend", dimension: "Runtime health of auth routes (admin/account/panier)", severity: "high", remediation: "build authenticated route-health adapter (roadmap)" },
  { surface: "frontend", owner: "frontend", dimension: "Loader↔backend-RPC contract drift", severity: "medium", remediation: "cross-layer contract adapter (roadmap)" },
  { surface: "packages", owner: "platform", dimension: "Pre-merge merged-but-unbuilt gate", severity: "high", remediation: "CI workspace-integrity gate before typecheck (roadmap)" },
  { surface: "db", owner: "platform", dimension: "Post-apply schema-state validation", severity: "high", remediation: "capture information_schema baseline post-migration (roadmap)" },
  { surface: "tests", owner: "platform", dimension: "New-code-without-test gate", severity: "medium", remediation: "module↔test mapping gate (roadmap)" },
  { surface: "tests", owner: "platform", dimension: "Backend↔frontend integration tests", severity: "medium", remediation: "integration suite (roadmap)" },
  { surface: "integrations", owner: "platform", dimension: "GA4 ingestion silent-cron heartbeat", severity: "high", remediation: "heartbeat event + freshness alert (roadmap)" },
  { surface: "integrations", owner: "platform", dimension: "Cloudflare WAF rule drift", severity: "medium", remediation: "WAF observability (roadmap)" },
];

const ONE_TIME_MAP_SOURCE = "audit/trust-ledger-fullstack-map (one-time, 2026-06-14)";

// ── Helpers ──────────────────────────────────────────────────────────────
function safeStat(p: string): { mtime: Date } | null {
  try {
    return { mtime: statSync(p).mtime };
  } catch {
    return null;
  }
}

function ageHours(from: Date | null, now: Date): number | null {
  return from
    ? Math.round(((now.getTime() - from.getTime()) / 3_600_000) * 10) / 10
    : null;
}

function freshnessLabel(ageH: number | null): string {
  if (ageH === null) return "unknown";
  if (ageH < 1) return "<1h";
  if (ageH < 48) return `${Math.round(ageH)}h`;
  return `${Math.round(ageH / 24)}d`;
}

function readJson(abs: string): unknown | null {
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

/** Read a committed audit/*.json count artifact → one RECURRING row. */
function countArtifactRow(
  repoRoot: string,
  now: Date,
  opts: {
    file: string;
    surface: string;
    owner: string;
    dimension: string;
    countKey: string;
    severity: Severity;
    remediation: string;
  },
): LedgerRow {
  const rel = opts.file;
  const abs = join(repoRoot, rel);
  const json = readJson(abs) as Record<string, unknown> | null;
  const st = safeStat(abs);
  const generated_at = st ? st.mtime.toISOString() : null;
  const freshness = freshnessLabel(ageHours(st?.mtime ?? null, now));

  if (json === null) {
    return {
      surface: opts.surface,
      domain: "archi",
      owner: opts.owner,
      dimension: opts.dimension,
      coverage_status: "MISSING",
      health_status: "UNKNOWN",
      producer: "scripts/audit/build-deep-inventory.js (audit.yml)",
      source_path: null,
      generated_at: null,
      freshness: "MISSING",
      evidence: { observed: null, expected: 0 },
      severity: opts.severity,
      confidence: "high",
      suggested_remediation: opts.remediation,
      autofixable: false,
    };
  }
  const count = Number(json[opts.countKey] ?? 0);
  return {
    surface: opts.surface,
    domain: "archi",
    owner: opts.owner,
    dimension: opts.dimension,
    coverage_status: "RECURRING",
    health_status: count > 0 ? "WARN" : "PASS",
    producer: "scripts/audit/build-deep-inventory.js (audit.yml + baseline-ratchet)",
    source_path: rel,
    generated_at,
    freshness,
    evidence: { observed: count, expected: 0 },
    severity: opts.severity,
    confidence: "high",
    suggested_remediation: opts.remediation,
    autofixable: false,
  };
}

// ── Source readers ─────────────────────────────────────────────────────────
function archiRows(repoRoot: string, now: Date): LedgerRow[] {
  const rows: LedgerRow[] = [
    countArtifactRow(repoRoot, now, {
      file: "audit/dead-code-candidates.json",
      surface: "static/archi",
      owner: "platform",
      dimension: "Dead-code candidates",
      countKey: "count",
      severity: "low",
      remediation: "execute cleanup-plan-by-domain (PR-2→PR-6)",
    }),
    countArtifactRow(repoRoot, now, {
      file: "audit/duplicate-map.json",
      surface: "static/archi",
      owner: "platform",
      dimension: "Duplicate exports",
      countKey: "count",
      severity: "low",
      remediation: "dedupe exports per duplicate-map",
    }),
    countArtifactRow(repoRoot, now, {
      file: "audit/cycle-map.json",
      surface: "static/archi",
      owner: "platform",
      dimension: "Dependency cycles",
      countKey: "count",
      severity: "medium",
      remediation: "break cycles per cycle-map (PR-5)",
    }),
  ];

  // module-boundaries: deep_access_violations array length
  {
    const rel = "audit/module-boundaries.json";
    const abs = join(repoRoot, rel);
    const json = readJson(abs) as { deep_access_violations?: unknown[] } | null;
    const st = safeStat(abs);
    const viol = Array.isArray(json?.deep_access_violations)
      ? json!.deep_access_violations!.length
      : null;
    rows.push({
      surface: "static/archi",
      domain: "archi",
      owner: "platform",
      dimension: "Module-boundary violations (deep access)",
      coverage_status: json === null ? "MISSING" : "RECURRING",
      health_status: json === null ? "UNKNOWN" : viol! > 0 ? "WARN" : "PASS",
      producer: "scripts/audit/build-deep-inventory.js (audit.yml)",
      source_path: json === null ? null : rel,
      generated_at: st ? st.mtime.toISOString() : null,
      freshness: json === null ? "MISSING" : freshnessLabel(ageHours(st?.mtime ?? null, now)),
      evidence: { observed: viol, expected: 0 },
      severity: "medium",
      confidence: "high",
      suggested_remediation: "resolve no-deep-module-access violations (PR-6)",
      autofixable: false,
    });
  }

  // canonical UNKNOWN-domain coverage gap
  {
    const rel = "audit/registry/canonical.json";
    const abs = join(repoRoot, rel);
    const json = readJson(abs) as { files?: Array<{ domain?: string | null }> } | null;
    const st = safeStat(abs);
    const files = Array.isArray(json?.files) ? json!.files! : null;
    const unknown =
      files === null
        ? null
        : files.filter((f) => f.domain == null || f.domain === "UNKNOWN").length;
    rows.push({
      surface: "static/archi",
      domain: "archi",
      owner: "platform",
      dimension: "Ownership coverage (UNKNOWN-domain files)",
      coverage_status: json === null ? "MISSING" : "RECURRING",
      health_status: json === null ? "UNKNOWN" : unknown! > 0 ? "WARN" : "PASS",
      producer: "scripts/audit/build-deep-inventory.js + ownership.yaml",
      source_path: json === null ? null : rel,
      generated_at: st ? st.mtime.toISOString() : null,
      freshness: json === null ? "MISSING" : freshnessLabel(ageHours(st?.mtime ?? null, now)),
      evidence: { observed: unknown, expected: 0 },
      severity: "low",
      confidence: "high",
      suggested_remediation: "map UNKNOWN files to their real domain in ownership.yaml",
      autofixable: false,
    });
  }
  return rows;
}

/** canonical.json freshness — the inventory every other dimension depends on. */
function canonicalFreshnessRow(repoRoot: string, now: Date): LedgerRow {
  const rel = "audit/registry/canonical.json";
  const abs = join(repoRoot, rel);
  const st = safeStat(abs);
  const ageH = ageHours(st?.mtime ?? null, now);
  const stale = ageH === null ? true : ageH > CANONICAL_STALE_DAYS * 24;
  return {
    surface: "build/ci",
    domain: "platform",
    owner: "platform",
    dimension: "Inventory freshness (canonical.json regenerated)",
    coverage_status: st === null ? "MISSING" : stale ? "STALE" : "RECURRING",
    health_status: stale ? "UNKNOWN" : "PASS",
    producer: "npm run audit:inventory (manual today — see PR-B0b)",
    source_path: st === null ? null : rel,
    generated_at: st ? st.mtime.toISOString() : null,
    freshness: st === null ? "MISSING" : freshnessLabel(ageH),
    evidence: {
      observed: { mtime_age: freshnessLabel(ageH) },
      expected: `< ${CANONICAL_STALE_DAYS}d`,
    },
    severity: "high",
    confidence: "high",
    suggested_remediation:
      "make audit:inventory recurrent (PR-B0b); regenerate via human PR (PR-B0c)",
    autofixable: false,
  };
}

/** The 6 runtime-truth checks — RECURRING once PR-B0a emits their JSON; else MANUAL. */
function runtimeTruthRows(repoRoot: string, now: Date): LedgerRow[] {
  return RUNTIME_TRUTH_CHECKS.map(({ check, dimension, severity }) => {
    const rel = `audit-reports/runtime-truth/${check}.json`;
    const abs = join(repoRoot, rel);
    const json = readJson(abs) as
      | { health_status?: HealthStatus; generated_at?: string; freshness?: string }
      | null;
    if (json === null) {
      // No recurring runner yet — skill is on-demand only.
      return {
        surface: "backend/db",
        domain: "platform",
        owner: "platform",
        dimension,
        coverage_status: "MANUAL" as const,
        health_status: "UNKNOWN" as const,
        producer: `.claude/skills/runtime-truth-audit/checks/${check}.md (on-demand)`,
        source_path: null,
        generated_at: null,
        freshness: "MISSING",
        evidence: { observed: "no recurring runner", expected: rel },
        severity,
        confidence: "high",
        suggested_remediation: "build deterministic runner (PR-B0a)",
        autofixable: false,
      };
    }
    const st = safeStat(abs);
    return {
      surface: "backend/db",
      domain: "platform",
      owner: "platform",
      dimension,
      coverage_status: "RECURRING" as const,
      health_status: (json.health_status ?? "UNKNOWN") as HealthStatus,
      producer: `scripts/audit/runtime-truth/${check}.ts (PR-B0a)`,
      source_path: rel,
      generated_at: json.generated_at ?? (st ? st.mtime.toISOString() : null),
      freshness: json.freshness ?? freshnessLabel(ageHours(st?.mtime ?? null, now)),
      evidence: { observed: json.health_status, expected: "PASS" },
      severity,
      confidence: "high",
      suggested_remediation: "address findings in the check JSON",
      autofixable: false,
    };
  });
}

/** SEO/catalog runtime cell — env-gated live probe of the existing sinks. */
function seoRuntimeRows(
  probe: SeoRuntimeProbeResult | null,
  now: Date,
): { rows: LedgerRow[]; db_enrichment: TrustLedgerJson["manifest"]["db_enrichment"] } {
  if (probe === null) {
    return {
      db_enrichment: "skipped:no-creds",
      rows: [
        {
          surface: "seo/catalog",
          domain: "seo",
          owner: "seo",
          dimension: "Synthetic crawler → findings consumer",
          coverage_status: "MANUAL",
          health_status: "UNKNOWN",
          producer: "seo-control-plane synthetic-crawler (q15min) + __seo_audit_findings",
          source_path: null,
          generated_at: null,
          freshness: "unknown",
          evidence: { observed: "DB enrichment skipped (no creds)", expected: "live read" },
          severity: "high",
          confidence: "low",
          suggested_remediation: "run with SUPABASE creds, or wire reconciler (PR-B2)",
          autofixable: false,
        },
      ],
    };
  }

  const rows: LedgerRow[] = [];

  // (1) collector liveness — is the crawler producing fresh snapshots?
  const newest = probe.snapshot_newest_iso ? new Date(probe.snapshot_newest_iso) : null;
  const ageH = ageHours(newest, now);
  const crawlerStale = ageH === null ? true : ageH > 0.5; // > 30 min
  rows.push({
    surface: "seo/catalog",
    domain: "seo",
    owner: "seo",
    dimension: "Synthetic crawler liveness (__seo_snapshot_synthetic)",
    coverage_status: "RECURRING",
    health_status: crawlerStale ? "FAIL" : "PASS",
    producer: "seo-control-plane synthetic-crawler (cron */15)",
    source_path: "db://__seo_snapshot_synthetic",
    generated_at: probe.snapshot_newest_iso,
    freshness: freshnessLabel(ageH),
    evidence: { observed: { newest: probe.snapshot_newest_iso }, expected: "< 30m" },
    severity: "high",
    confidence: "high",
    suggested_remediation: crawlerStale ? "crawler stale — investigate scheduler" : "—",
    autofixable: false,
  });

  // (2) THE GAP — findings sink consumer. Empty ⇒ collected-then-discarded.
  const findings = probe.findings_rows;
  rows.push({
    surface: "seo/catalog",
    domain: "seo",
    owner: "seo",
    dimension: "Runtime findings consumer (__seo_audit_findings)",
    coverage_status: findings && findings > 0 ? "RECURRING" : "MISSING",
    health_status: findings && findings > 0 ? "PASS" : "UNKNOWN",
    producer: "runtime-reconciler (PR-B2 — not built)",
    source_path: "db://__seo_audit_findings",
    generated_at: null,
    freshness: "live",
    evidence: { observed: { findings_rows: findings }, expected: "> 0 (consumer wired)" },
    severity: "high",
    confidence: "high",
    suggested_remediation:
      findings === 0
        ? "snapshot collected but no consumer — wire reconciler (PR-B2)"
        : "—",
    autofixable: false,
  });

  return { db_enrichment: "applied", rows };
}

/** Tests-coverage trend — no committed/recurring producer today. */
function testsTrendRow(): LedgerRow {
  return {
    surface: "tests",
    domain: "platform",
    owner: "platform",
    dimension: "Test-coverage trend (persistent)",
    coverage_status: "MISSING",
    health_status: "UNKNOWN",
    producer: "none (coverage-summary.json is transient CI artifact)",
    source_path: null,
    generated_at: null,
    freshness: "MISSING",
    evidence: { observed: "no persistent coverage artifact", expected: "trended coverage" },
    severity: "medium",
    confidence: "high",
    suggested_remediation: "persist + trend coverage-summary.json (roadmap)",
    autofixable: false,
  };
}

function knownGapRows(): LedgerRow[] {
  return KNOWN_GAP_CELLS.map((c) => ({
    surface: c.surface,
    domain: c.surface,
    owner: c.owner,
    dimension: c.dimension,
    coverage_status: "MISSING" as const,
    health_status: "UNKNOWN" as const,
    producer: "none (named GAP cell)",
    source_path: ONE_TIME_MAP_SOURCE,
    generated_at: null,
    freshness: "one-time (not recurring)",
    evidence: { observed: "no recurring producer", expected: "recurring evidence" },
    severity: c.severity,
    confidence: "medium",
    suggested_remediation: c.remediation,
    autofixable: false,
  }));
}

// ── Live DB probe (env-gated, lazy) ──────────────────────────────────────
async function liveDbProbe(): Promise<SeoRuntimeProbeResult | null> {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const newestRes = await sb
      .from("__seo_snapshot_synthetic")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const findingsRes = await sb
      .from("__seo_audit_findings")
      .select("*", { count: "exact", head: true });
    return {
      snapshot_newest_iso:
        (newestRes.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
      findings_rows: findingsRes.count ?? null,
    };
  } catch {
    return null;
  }
}

// ── Determinism: stable sort owner → surface → dimension ──────────────────
function sortRows(rows: LedgerRow[]): LedgerRow[] {
  return rows.slice().sort((a, b) => {
    const k = (r: LedgerRow) => `${r.owner} ${r.surface} ${r.dimension}`;
    return k(a).localeCompare(k(b));
  });
}

function tally<T extends string>(rows: LedgerRow[], key: keyof LedgerRow, keys: T[]): Record<T, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const r of rows) out[r[key] as T] += 1;
  return out;
}

// ── Markdown renderer (deterministic — NO run timestamp in body) ──────────
function healthGlyph(h: HealthStatus): string {
  return h === "PASS" ? "✅" : h === "WARN" ? "⚠️" : h === "FAIL" ? "❌" : "❔";
}

function renderMarkdown(json: TrustLedgerJson): string {
  const L: string[] = [];
  L.push("# Trust Ledger — full-stack confidence map");
  L.push("");
  L.push(
    "_Read-only DIAGNOSTIC (PR-A). Pure consumer of named sources — computes no primary truth._",
  );
  L.push(
    "_**Coverage** = does a recurring check exist; **Health** = its result. `RECURRING` ≠ `PASS`._",
  );
  L.push("");

  // Coverage manifest
  const m = json.manifest;
  L.push("## Coverage manifest");
  L.push("");
  L.push(`- **surfaces**: ${m.surfaces.join(", ")}`);
  L.push(`- **rows**: ${m.rows_total}`);
  L.push(
    `- **coverage**: ${(Object.entries(m.coverage_counts) as [string, number][])
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}`,
  );
  L.push(
    `- **health**: ${(Object.entries(m.health_counts) as [string, number][])
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}`,
  );
  L.push(`- **db enrichment**: ${m.db_enrichment}`);
  L.push(`- _${m.note}_`);
  L.push("");

  // Headlines: most severe non-PASS rows (FAIL/STALE/MISSING-critical-high)
  const sevRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const headlines = json.rows
    .filter((r) => r.health_status !== "PASS" || r.coverage_status !== "RECURRING")
    .filter((r) => r.severity === "critical" || r.severity === "high")
    .slice()
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  if (headlines.length) {
    L.push("## Headlines (severity-ranked — source · freshness · confidence)");
    L.push("");
    for (const r of headlines) {
      L.push(
        `- **[${r.severity}]** ${r.surface} — ${r.dimension} · coverage=\`${r.coverage_status}\` health=\`${r.health_status}\` · source: \`${r.source_path ?? "(none → MISSING)"}\` · freshness: ${r.freshness} · confidence: ${r.confidence}`,
      );
    }
    L.push("");
  }

  // Full map, grouped by owner
  const owners = Array.from(new Set(json.rows.map((r) => r.owner)));
  for (const owner of owners) {
    L.push(`## Owner: ${owner}`);
    L.push("");
    L.push("| Surface | Dimension | Coverage | Health | Sev | Freshness | Source |");
    L.push("|---|---|---|---|---|---|---|");
    for (const r of json.rows.filter((x) => x.owner === owner)) {
      L.push(
        `| ${r.surface} | ${r.dimension} | \`${r.coverage_status}\` | ${healthGlyph(r.health_status)} \`${r.health_status}\` | ${r.severity} | ${r.freshness} | \`${r.source_path ?? "—"}\` |`,
      );
    }
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push(
    "_Trust Ledger V1 · diagnostic, not a health proof · read-only · exits 0 · see audit-reports/trust-ledger.json for the machine record (run timestamp lives there)._",
  );
  return L.join("\n") + "\n";
}

// ── Public API ────────────────────────────────────────────────────────────
export async function buildTrustLedger(
  opts: BuildOpts = {},
): Promise<{ json: TrustLedgerJson; markdown: string; exitCode: 0 }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const now = opts.nowIso ? new Date(opts.nowIso) : new Date();
  const probeFn = opts.dbProbe === undefined ? liveDbProbe : opts.dbProbe;

  const probe = probeFn ? await probeFn() : null;
  const seo = seoRuntimeRows(probe, now);

  const rows = sortRows([
    ...archiRows(repoRoot, now),
    canonicalFreshnessRow(repoRoot, now),
    ...runtimeTruthRows(repoRoot, now),
    ...seo.rows,
    testsTrendRow(),
    ...knownGapRows(),
  ]);

  const surfaces = Array.from(new Set(rows.map((r) => r.surface))).sort();
  const json: TrustLedgerJson = {
    schema_version: "trust-ledger/v1",
    generated_at: now.toISOString(),
    manifest: {
      surfaces,
      rows_total: rows.length,
      coverage_counts: tally(rows, "coverage_status", [
        "RECURRING",
        "MANUAL",
        "MISSING",
        "STALE",
      ]),
      health_counts: tally(rows, "health_status", ["PASS", "WARN", "FAIL", "UNKNOWN"]),
      db_enrichment: seo.db_enrichment,
      note: "Diagnostic only. Coverage ≠ health. Every row traces to a named source_path; MISSING/STALE are facts, not failures.",
    },
    rows,
  };

  return { json, markdown: renderMarkdown(json), exitCode: 0 };
}

// ── CLI entry ──────────────────────────────────────────────────────────────
const isMainModule =
  typeof process.argv[1] === "string" &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  buildTrustLedger()
    .then((r) => {
      const outDir = join(process.cwd(), "audit-reports");
      if (!existsSync(outDir)) {
        console.error(
          `::warning::audit-reports/ does not exist at ${outDir} — bailing out gracefully`,
        );
        process.exit(0);
      }
      writeFileSync(join(outDir, "trust-ledger.md"), r.markdown);
      writeFileSync(
        join(outDir, "trust-ledger.json"),
        JSON.stringify(r.json, null, 2) + "\n",
      );
      console.log(
        `✓ wrote audit-reports/trust-ledger.md (${r.markdown.length} chars) + trust-ledger.json (${r.json.rows.length} rows, db=${r.json.manifest.db_enrichment})`,
      );
      process.exit(r.exitCode);
    })
    .catch((err) => {
      console.error(`::warning::trust-ledger aggregator caught: ${err?.message}`);
      process.exit(0); // never block
    });
}
