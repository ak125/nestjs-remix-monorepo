#!/usr/bin/env tsx
/**
 * Contract Drift Observatory V1 — warn-only aggregator (PR-6).
 *
 * Reads already-committed Layer 1 artifacts + curated coverage reports.
 * Emits two ephemeral outputs:
 *   - audit-reports/drift-dashboard.md
 *   - audit-reports/contract-health.json
 *
 * Always exits 0. NEVER regenerates canonical.json or any builder output.
 *
 * See ADR-058 §23 "observe → ratchet → enforce". The script is a pure
 * consumer of Layer 1 (auto) + curated coverage MDs — never a producer.
 *
 * Plan: /home/deploy/.claude/plans/pr-6-est-faisable-maintenant-deep-storm.md
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { load as yamlLoad } from "js-yaml";
import micromatch from "micromatch";
import { z } from "zod";

// Relative-path TS import — dodges the @repo/registry build prerequisite.
// Same pattern as scripts/registry/validate-overlay.ts and validate-zod-schemas.ts.
import {
  FileEntrySchema,
  DbTableEntrySchema,
  RpcEntrySchema,
  DepEntrySchema,
  RuntimeEntrySchema,
} from "../../packages/registry/src/index";

// ── Contracts Table (single source of truth — mirrors plan §"Contracts table") ─
type ContractName = "architecture" | "db" | "runtime" | "deps" | "rpc";

interface ContractMeta {
  name: ContractName;
  file: string; // path relative to repoRoot
  entriesSchema: z.ZodTypeAny; // per-entry schema, applied via z.array(...)
  coverageGlob: RegExp | null; // matches filename only (basename)
}

const CONTRACTS: ContractMeta[] = [
  {
    name: "architecture",
    file: "audit/registry/files.json",
    entriesSchema: FileEntrySchema,
    coverageGlob: null, // architecture has no V1 coverage report (plan)
  },
  {
    name: "db",
    file: "audit/registry/db.json",
    entriesSchema: DbTableEntrySchema,
    coverageGlob:
      /^db-contract-v1-coverage-(\d{4}-\d{2}-\d{2})\.md$/, // none today; plan accepts null fallback
  },
  {
    name: "runtime",
    file: "audit/registry/runtime.json",
    entriesSchema: RuntimeEntrySchema,
    coverageGlob: /^runtime-contract-v1-coverage-(\d{4}-\d{2}-\d{2})\.md$/,
  },
  {
    name: "deps",
    file: "audit/registry/deps.json",
    entriesSchema: DepEntrySchema,
    coverageGlob: /^dep-governance-v1-coverage-(\d{4}-\d{2}-\d{2})\.md$/,
  },
  {
    name: "rpc",
    file: "audit/registry/rpc.json",
    entriesSchema: RpcEntrySchema,
    coverageGlob: /^rpc-contract-v1-coverage-(\d{4}-\d{2}-\d{2})\.md$/,
  },
];

// ── Output JSON shape ─────────────────────────────────────────────────────
type Status = "ok" | "invalid" | "missing";

export interface ContractRow {
  name: ContractName;
  file: string;
  status: Status;
  entries: number;
  sha256: string;
}

export interface DashboardJson {
  generatedAt: string;
  schemaVersion: "v1";
  contracts: ContractRow[];
  fingerprint: {
    canonical: {
      sotFingerprint: string | null;
      generatedAt: string | null; // canonical's epoch-zero placeholder, kept for traceability
      mtimeAgeHours: number | null; // file system mtime — actual freshness signal
      sectionSizes: Record<string, number>;
      stale: boolean;
      staleReason: string | null;
    };
    depCruiserGenerated: { mtime: string | null; ageHours: number | null };
  };
  ownership: { gapCount: number; sample: string[] };
  coverage: Record<string, unknown>;
}

export interface BuildOpts {
  /** Override repo root — used by tests to point at fixtures. */
  repoRoot?: string;
  /** Override "now" — used by tests for deterministic ageHours. */
  nowIso?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function safeStat(p: string): { mtime: Date } | null {
  try {
    return { mtime: statSync(p).mtime };
  } catch {
    return null;
  }
}

function ageHours(from: Date | null, now: Date): number | null {
  return from ? Math.round(((now.getTime() - from.getTime()) / 3_600_000) * 10) / 10 : null;
}

function sha256Of(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function pickLatestCoverage(
  dir: string,
  glob: RegExp,
): { path: string; date: string } | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const matches = entries
    .map((name) => {
      const m = name.match(glob);
      return m ? { name, date: m[1] } : null;
    })
    .filter((x): x is { name: string; date: string } => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  return matches[0]
    ? { path: join(dir, matches[0].name), date: matches[0].date }
    : null;
}

function extractRow(md: string, label: string): string | null {
  // Two-step: capture the entire value cell, then extract the meaningful
  // number from it. Real coverage MDs use formats like:
  //   | V1 canon sample (`x.yaml`) | **28** (≈ 6 % of L1) |
  //   | Domains covered            | 8 of 15 (D1, D3, …)  |
  // so we need the WHOLE cell, then strip bold + return the cell text.
  const rowRx = new RegExp(
    `^\\|\\s*${label}[^|]*\\|\\s*([^|]+?)\\s*\\|`,
    "mi",
  );
  const m = md.match(rowRx);
  if (!m) return null;
  // Strip bold markers (** ... **) but preserve the rest for downstream
  // parsers (parseFraction picks "8 of 15", parseInt10 picks the first digits).
  return m[1].replace(/\*\*/g, "").trim();
}

function parseInt10(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseFraction(
  s: string | null,
): { num: number; denom: number } | null {
  const m = s && s.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  return m ? { num: Number(m[1]), denom: Number(m[2]) } : null;
}

// ── Signal implementations ───────────────────────────────────────────────
function signal1_contracts(repoRoot: string): ContractRow[] {
  return CONTRACTS.map((meta) => {
    const abs = join(repoRoot, meta.file);
    let raw: string;
    try {
      raw = readFileSync(abs, "utf8");
    } catch {
      return {
        name: meta.name,
        file: meta.file,
        status: "missing" as const,
        entries: 0,
        sha256: "",
      };
    }
    const sha256 = sha256Of(raw);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        name: meta.name,
        file: meta.file,
        status: "invalid" as const,
        entries: 0,
        sha256,
      };
    }
    const entriesArray = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const result = z.array(meta.entriesSchema).safeParse(entriesArray);
    return {
      name: meta.name,
      file: meta.file,
      status: (result.success ? "ok" : "invalid") as Status,
      entries: entriesArray.length,
      sha256,
    };
  });
}

function signal2_fingerprint(
  repoRoot: string,
  now: Date,
): DashboardJson["fingerprint"] {
  const canonicalPath = join(repoRoot, "audit/registry/canonical.json");
  const depCruiserPath = join(repoRoot, ".dependency-cruiser.generated.cjs");

  let canonical: any = null;
  try {
    canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  } catch {
    /* canonical absent or malformed */
  }

  const sectionSizes: Record<string, number> = {
    files: canonical?.files?.length ?? 0,
    "db.tables": canonical?.db?.tables?.length ?? 0,
    "db.rpc": canonical?.db?.rpc?.length ?? 0,
    deps: canonical?.deps?.length ?? 0,
    runtime: canonical?.runtime?.length ?? 0,
  };
  const emptySection = Object.entries(sectionSizes).find(([, n]) => n === 0);
  const stale = !canonical || Boolean(emptySection);
  const staleReason = !canonical
    ? "canonical.json missing or malformed"
    : emptySection
      ? `empty section: ${emptySection[0]}`
      : null;

  const canonicalStat = safeStat(canonicalPath);
  const depCruiserStat = safeStat(depCruiserPath);

  return {
    canonical: {
      sotFingerprint: canonical?.meta?.sotFingerprint ?? null,
      generatedAt: canonical?.meta?.generatedAt ?? null,
      mtimeAgeHours: ageHours(canonicalStat?.mtime ?? null, now),
      sectionSizes,
      stale,
      staleReason,
    },
    depCruiserGenerated: {
      mtime: depCruiserStat ? depCruiserStat.mtime.toISOString() : null,
      ageHours: ageHours(depCruiserStat?.mtime ?? null, now),
    },
  };
}

function signal3_ownership(
  repoRoot: string,
): { gapCount: number; sample: string[] } {
  const ownershipPath = join(
    repoRoot,
    ".spec/00-canon/repository-registry/ownership.yaml",
  );
  const filesPath = join(repoRoot, "audit/registry/files.json");

  let yamlText: string;
  try {
    yamlText = readFileSync(ownershipPath, "utf8");
  } catch {
    return { gapCount: 0, sample: [] };
  }
  const overlay: any = yamlLoad(yamlText);
  const entries: any[] = Array.isArray(overlay?.entries) ? overlay.entries : [];
  const globs = entries.map((e) => String(e.glob));

  let filesParsed: any;
  try {
    filesParsed = JSON.parse(readFileSync(filesPath, "utf8"));
  } catch {
    return { gapCount: 0, sample: [] };
  }
  const fileEntries: any[] = Array.isArray(filesParsed?.entries)
    ? filesParsed.entries
    : [];

  const orphans: string[] = [];
  for (const fe of fileEntries) {
    const p = String(fe.path ?? fe.id ?? "");
    if (!p) continue;
    const matched = micromatch.isMatch(p, globs, { dot: true });
    if (!matched) orphans.push(p);
  }
  return { gapCount: orphans.length, sample: orphans.slice(0, 10) };
}

function signal4to6_coverage(
  repoRoot: string,
  contractRows: ContractRow[],
): Record<string, unknown> {
  const reportsDir = join(repoRoot, "audit-reports");
  const out: Record<string, any> = {};

  for (const meta of CONTRACTS) {
    if (meta.coverageGlob === null) continue;

    const row = contractRows.find((r) => r.name === meta.name);
    const l1FromRegistry = row?.entries ?? 0;

    const latest = pickLatestCoverage(reportsDir, meta.coverageGlob);
    if (!latest) {
      out[meta.name] = {
        l1: l1FromRegistry,
        v1Sample: null,
        note: "no V1 coverage report yet",
        source: null,
      };
      continue;
    }

    let md: string;
    try {
      md = readFileSync(latest.path, "utf8");
    } catch {
      out[meta.name] = {
        l1: l1FromRegistry,
        v1Sample: null,
        note: "coverage report unreadable",
        source: latest.path,
      };
      continue;
    }

    const l1Raw = extractRow(md, "L1 entries");
    const v1Raw = extractRow(md, "V1 canon sample");
    const familiesRaw = extractRow(md, "Families covered");
    const domainsRaw = extractRow(md, "Domains covered");

    const families = parseFraction(familiesRaw);
    const domains = parseFraction(domainsRaw);

    out[meta.name] = {
      l1: parseInt10(l1Raw) ?? l1FromRegistry,
      v1Sample: parseInt10(v1Raw),
      ...(families
        ? { familiesCovered: families.num, familiesTotal: families.denom }
        : {}),
      ...(domains
        ? { domainsCovered: domains.num, domainsTotal: domains.denom }
        : {}),
      source: `audit-reports/${latest.path.split("/").pop()}`,
    };
  }
  return out;
}

// ── Markdown renderer ────────────────────────────────────────────────────
function statusGlyph(s: Status): string {
  return s === "ok" ? "✅" : s === "invalid" ? "⚠️" : "❌";
}

function renderMarkdown(json: DashboardJson): string {
  const lines: string[] = [];
  lines.push(`# Contract Drift Observatory V1`);
  lines.push("");
  lines.push(
    `_Warn-only observer (PR-6). Generated ${json.generatedAt}. Read-only consumer of \`audit/registry/*.json\` + \`audit-reports/*-coverage-*.md\`._`,
  );
  lines.push("");

  // Signal 1
  lines.push(`## Contracts build status`);
  lines.push("");
  lines.push("| Contract | File | Status | L1 entries | sha256 |");
  lines.push("|---|---|---|---:|---|");
  for (const c of json.contracts) {
    lines.push(
      `| \`${c.name}\` | \`${c.file}\` | ${statusGlyph(c.status)} ${c.status} | ${c.entries} | \`${c.sha256}\` |`,
    );
  }
  lines.push("");

  // Signal 2
  lines.push(`## Canonical fingerprint consistency`);
  lines.push("");
  const f = json.fingerprint.canonical;
  lines.push(
    `- **sotFingerprint**: \`${f.sotFingerprint ?? "(none)"}\` (computed by \`scripts/registry/build-canonical-registry.js\` from input hashes)`,
  );
  lines.push(
    `- **canonical.meta.generatedAt**: \`${f.generatedAt ?? "(none)"}\` (V1-2 epoch-zero placeholder — informational only)`,
  );
  lines.push(
    `- **file mtime age**: ${f.mtimeAgeHours === null ? "n/a" : `${f.mtimeAgeHours}h`}`,
  );
  lines.push(`- **stale**: ${f.stale ? "⚠️ yes" : "✅ no"}`);
  if (f.staleReason) lines.push(`- **staleReason**: ${f.staleReason}`);
  lines.push("");
  lines.push("| Section | Entries |");
  lines.push("|---|---:|");
  for (const [k, n] of Object.entries(f.sectionSizes)) {
    lines.push(`| \`${k}\` | ${n} |`);
  }
  lines.push("");
  const dcg = json.fingerprint.depCruiserGenerated;
  lines.push(
    `- **.dependency-cruiser.generated.cjs** mtime: ${dcg.mtime ?? "n/a"} (${dcg.ageHours === null ? "n/a" : `${dcg.ageHours}h ago`})`,
  );
  lines.push("");

  // Signal 3
  lines.push(`## Ownership gaps`);
  lines.push("");
  lines.push(
    `Unmatched file paths (not covered by any glob in \`.spec/00-canon/repository-registry/ownership.yaml\`).`,
  );
  lines.push("");
  lines.push(
    `- **gapCount**: ${json.ownership.gapCount}${json.ownership.gapCount === 0 ? " ✅" : " ⚠️"}`,
  );
  if (json.ownership.sample.length > 0) {
    lines.push("");
    lines.push("First 10 orphans:");
    for (const p of json.ownership.sample) lines.push(`- \`${p}\``);
  }
  lines.push("");

  // Signal 4 / 5 / 6
  const cov: any = json.coverage;
  const renderCov = (key: string, heading: string, hint: string) => {
    lines.push(`## ${heading}`);
    lines.push("");
    lines.push(`_${hint}_`);
    lines.push("");
    if (!cov[key]) {
      lines.push("- (no coverage report parsed)");
      lines.push("");
      return;
    }
    const c = cov[key];
    lines.push(`- **L1 entries**: ${c.l1 ?? "n/a"}`);
    lines.push(`- **V1 canon sample**: ${c.v1Sample ?? "n/a"}`);
    if (typeof c.familiesCovered === "number")
      lines.push(
        `- **Families covered**: ${c.familiesCovered} of ${c.familiesTotal}`,
      );
    if (typeof c.domainsCovered === "number")
      lines.push(
        `- **Domains covered**: ${c.domainsCovered} of ${c.domainsTotal}`,
      );
    if (c.note) lines.push(`- **note**: ${c.note}`);
    if (c.source) lines.push(`- **source**: \`${c.source}\``);
    lines.push("");
  };

  renderCov(
    "runtime",
    "Runtime contract coverage",
    "Source: latest `audit-reports/runtime-contract-v1-coverage-*.md`",
  );
  renderCov(
    "deps",
    "Dep governance coverage",
    "Source: latest `audit-reports/dep-governance-v1-coverage-*.md`",
  );
  // Signal 6 = RPC + DB combined
  lines.push(`## RPC + DB contract coverage`);
  lines.push("");
  lines.push(`### RPC`);
  if (cov.rpc) {
    lines.push(`- **L1 entries**: ${cov.rpc.l1 ?? "n/a"}`);
    lines.push(`- **V1 canon sample**: ${cov.rpc.v1Sample ?? "n/a"}`);
    if (typeof cov.rpc.domainsCovered === "number")
      lines.push(
        `- **Domains covered**: ${cov.rpc.domainsCovered} of ${cov.rpc.domainsTotal}`,
      );
    if (cov.rpc.source) lines.push(`- **source**: \`${cov.rpc.source}\``);
  } else {
    lines.push("- (no coverage report parsed)");
  }
  lines.push("");
  lines.push(`### DB`);
  if (cov.db) {
    lines.push(`- **L1 entries**: ${cov.db.l1 ?? "n/a"}`);
    lines.push(`- **V1 canon sample**: ${cov.db.v1Sample ?? "n/a"}`);
    if (cov.db.note) lines.push(`- **note**: ${cov.db.note}`);
  } else {
    const dbRow = json.contracts.find((c) => c.name === "db");
    lines.push(`- **L1 entries**: ${dbRow?.entries ?? "n/a"}`);
    lines.push(`- **V1 canon sample**: n/a`);
    lines.push(
      `- **note**: no \`db-contract-v1-coverage-*.md\` yet — fallback to L1 registry count`,
    );
  }
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(
    `_PR-6 Contract Drift Observatory V1 · warn-only · ADR-058 §23 observe phase · never blocks CI_`,
  );

  return lines.join("\n") + "\n";
}

// ── Public API ───────────────────────────────────────────────────────────
export async function buildDashboard(
  opts: BuildOpts = {},
): Promise<{ json: DashboardJson; markdown: string; exitCode: 0 }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const now = opts.nowIso ? new Date(opts.nowIso) : new Date();

  // Signal 1 first — gives the entries[] count used by coverage fallback.
  const contracts = signal1_contracts(repoRoot);
  const fingerprint = signal2_fingerprint(repoRoot, now);
  const ownership = signal3_ownership(repoRoot);
  const coverage = signal4to6_coverage(repoRoot, contracts);

  const json: DashboardJson = {
    generatedAt: now.toISOString(),
    schemaVersion: "v1",
    contracts,
    fingerprint,
    ownership,
    coverage,
  };
  const markdown = renderMarkdown(json);

  return { json, markdown, exitCode: 0 };
}

// ── CLI entry ────────────────────────────────────────────────────────────
const isMainModule =
  typeof process.argv[1] === "string" &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  buildDashboard()
    .then((r) => {
      const outDir = join(process.cwd(), "audit-reports");
      if (!existsSync(outDir)) {
        console.error(
          `::warning::audit-reports/ does not exist at ${outDir} — script bailing out gracefully`,
        );
        process.exit(0);
      }
      writeFileSync(join(outDir, "drift-dashboard.md"), r.markdown);
      writeFileSync(
        join(outDir, "contract-health.json"),
        JSON.stringify(r.json, null, 2) + "\n",
      );
      console.log(
        `✓ wrote ${join(outDir, "drift-dashboard.md")} (${r.markdown.length} chars)`,
      );
      console.log(
        `✓ wrote ${join(outDir, "contract-health.json")} (${r.json.contracts.length} contracts)`,
      );
      process.exit(r.exitCode);
    })
    .catch((err) => {
      console.error(
        `::warning::drift-dashboard aggregator caught: ${err.message}`,
      );
      process.exit(0); // never block CI
    });
}
