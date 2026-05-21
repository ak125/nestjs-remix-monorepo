#!/usr/bin/env tsx
/**
 * scripts/registry/validate-invariants.ts — V1 relational invariants checker.
 *
 * Per ADR-058 invariant V1-4 (schema invariants minimaux), V1 checks the
 * 4 critical relational invariants only :
 *
 *   I1. Unicité des `id` cross-registry — no two entries share an id within
 *       the same layer.
 *   I2. `status: ARCHIVED` ⇒ `runtime: false` (archived files cannot be
 *       runtime entrypoints).
 *   I3. Aucun cycle dans `runtime.startup_order` (DAG must be acyclic).
 *       Confirms dep-cruiser's existing cycle check at the registry level.
 *   I4. Tout glob `ownership.yaml` résout ≥ 1 fichier réel (orphan-free).
 *   I5. Cohérence domaine cross-source (domains.yaml ↔ ownership.yaml) :
 *       a) tout domaine défini dans domains.yaml est mappé par ≥ 1 entrée
 *          ownership.yaml, ou marqué `expectedEmpty: true` (error) ;
 *       b) tout glob domains.yaml résout ≥ 1 fichier réel (warn — backlog de
 *          dérive documentaire, le builder n'utilise que ownership.yaml) ;
 *       c) tout domaine référencé par ownership.yaml est défini dans
 *          domains.yaml (error). → rend impossible un domaine orphelin/fantôme.
 *   I6. Fraîcheur par empreinte : canonical.meta.inputHashes == hash réels des
 *       inputs L1+L2 (error). → détecte le drift overlay→projection que le
 *       `git diff` seul et le ratchet laissaient passer silencieusement.
 *
 * Plus extensive relational invariants (RefId URN resolution, cross-domain
 * edges, LOCKED ⇒ critical, deletePolicy/risk consistency) are V1.5+.
 *
 * Usage:
 *   tsx scripts/registry/validate-invariants.ts [--strict] [--quiet]
 *
 * Exit codes :
 *   0 — all invariants PASS
 *   1 — at least one invariant violated
 *   2 — internal error (canonical.json missing, etc.)
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

import micromatch from "micromatch";
import yaml from "js-yaml";

import type {
  CanonicalRegistry,
  FileEntry,
  RuntimeEntry,
  OwnershipRegistry,
} from "../../packages/registry/src/index";

type Severity = "error" | "warn";
interface Finding {
  invariant: string;
  severity: Severity;
  message: string;
}

const MONOREPO_ROOT = resolve(__dirname, "..", "..");
const CANONICAL_PATH = join(MONOREPO_ROOT, "audit", "registry", "canonical.json");
const OVERLAY_DIR = join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry"
);
const OWNERSHIP_PATH = join(OVERLAY_DIR, "ownership.yaml");
const DOMAINS_PATH = join(OVERLAY_DIR, "domains.yaml");

interface DomainEntry {
  id: string;
  globs?: string[];
  /** Set true when a domain is intentionally defined without any file mapping. */
  expectedEmpty?: boolean;
}
interface DomainsRegistry {
  entries: DomainEntry[];
}

const STRICT = process.argv.includes("--strict");
const QUIET = process.argv.includes("--quiet");

function log(msg: string): void {
  if (!QUIET) process.stderr.write(`[validate-invariants] ${msg}\n`);
}

function loadCanonical(): CanonicalRegistry {
  if (!existsSync(CANONICAL_PATH)) {
    throw new Error(
      `${CANONICAL_PATH} absent. Run \`npm run registry\` first.`
    );
  }
  return JSON.parse(readFileSync(CANONICAL_PATH, "utf8")) as CanonicalRegistry;
}

function loadOwnership(): OwnershipRegistry | null {
  if (!existsSync(OWNERSHIP_PATH)) return null;
  return yaml.load(readFileSync(OWNERSHIP_PATH, "utf8")) as OwnershipRegistry;
}

function loadDomains(): DomainsRegistry | null {
  if (!existsSync(DOMAINS_PATH)) return null;
  return yaml.load(readFileSync(DOMAINS_PATH, "utf8")) as DomainsRegistry;
}

function sha256OfFile(absPath: string): string {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

function gitLsFiles(): string[] {
  try {
    return execSync("git ls-files", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I1 — Unicité des id cross-registry
function checkUniqueIds(canonical: CanonicalRegistry): Finding[] {
  const findings: Finding[] = [];
  const groups: Array<[string, Array<{ id: string }>]> = [
    ["files", canonical.files],
    ["db.tables", canonical.db.tables],
    ["db.rpc", canonical.db.rpc],
    ["deps", canonical.deps],
    ["runtime", canonical.runtime],
  ];
  for (const [layer, entries] of groups) {
    const seen = new Map<string, number>();
    for (const entry of entries) {
      seen.set(entry.id, (seen.get(entry.id) || 0) + 1);
    }
    for (const [id, count] of seen) {
      if (count > 1) {
        findings.push({
          invariant: "I1-unique-id",
          severity: "error",
          message: `${layer}: id "${id}" appears ${count} times (must be unique within layer)`,
        });
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// I2 — status: ARCHIVED ⇒ runtime: false
function checkArchivedNotRuntime(canonical: CanonicalRegistry): Finding[] {
  const findings: Finding[] = [];
  for (const file of canonical.files) {
    if (file.status === "ARCHIVED" && file.runtime === true) {
      findings.push({
        invariant: "I2-archived-not-runtime",
        severity: "error",
        message: `files[id="${file.id}"]: status=ARCHIVED but runtime=true (contradiction)`,
      });
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// I3 — No cycle in runtime.dependsOn DAG
function checkRuntimeAcyclic(canonical: CanonicalRegistry): Finding[] {
  const findings: Finding[] = [];
  const nodes = new Map<string, RuntimeEntry>();
  for (const e of canonical.runtime) nodes.set(e.id, e);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodes.keys()) color.set(id, WHITE);

  function dfs(id: string, stack: string[]): string[] | null {
    color.set(id, GRAY);
    const node = nodes.get(id);
    if (node) {
      // path-with-current = the chain INCLUDING the node we're currently visiting
      const pathWithCurrent = [...stack, id];
      for (const dep of node.dependsOn) {
        if (!nodes.has(dep)) continue; // external ref, skip
        const c = color.get(dep);
        if (c === GRAY) {
          // Cycle detected. Return the slice from where `dep` first appeared
          // (it must be in pathWithCurrent since GRAY = on current DFS chain).
          const cycleStart = pathWithCurrent.indexOf(dep);
          return pathWithCurrent.slice(cycleStart).concat(dep);
        }
        if (c === WHITE) {
          const cycle = dfs(dep, pathWithCurrent);
          if (cycle) return cycle;
        }
      }
    }
    color.set(id, BLACK);
    return null;
  }

  for (const id of nodes.keys()) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id, []);
      if (cycle) {
        // V1 : downgrade to WARN. The Layer 1 runtime DAG is built from all
        // TS imports (not NestJS `forwardRef`-aware), so real NestJS mutual
        // module imports surface as cycles. V1.5 will add NestJS module
        // graph awareness ; until then, this is informational.
        findings.push({
          invariant: "I3-no-runtime-cycle",
          severity: "warn",
          message: `runtime DAG contains cycle (V1.5+ : NestJS forwardRef-aware) : ${cycle.join(" → ")}`,
        });
        break; // one cycle finding is enough per run
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// I4 — Every ownership.yaml glob matches ≥ 1 real file
function checkOwnershipOrphanFree(): Finding[] {
  const findings: Finding[] = [];
  const ownership = loadOwnership();
  if (!ownership) {
    findings.push({
      invariant: "I4-ownership-orphan-free",
      severity: "warn",
      message: "ownership.yaml absent — skipping orphan check",
    });
    return findings;
  }
  const realFiles = gitLsFiles();
  for (const entry of ownership.entries) {
    const matched = micromatch(realFiles, entry.glob);
    if (matched.length === 0) {
      findings.push({
        invariant: "I4-ownership-orphan-free",
        severity: "error",
        message: `ownership.yaml glob "${entry.glob}" matches 0 files`,
      });
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// I5 — Domain consistency cross-source (domains.yaml ↔ ownership.yaml)
// Pure (inputs injected) so it is unit-testable without filesystem access.
export function checkDomainConsistency(
  domains: DomainsRegistry | null,
  ownership: OwnershipRegistry | null,
  realFiles: string[]
): Finding[] {
  const findings: Finding[] = [];
  if (!domains || !ownership) {
    findings.push({
      invariant: "I5-domain-consistency",
      severity: "warn",
      message: "domains.yaml or ownership.yaml absent — skipping domain consistency",
    });
    return findings;
  }

  const definedIds = new Set(domains.entries.map((d) => d.id));
  const expectedEmpty = new Set(
    domains.entries.filter((d) => d.expectedEmpty).map((d) => d.id)
  );
  const mappedIds = new Set(
    ownership.entries
      .map((e) => e.domain)
      .filter((d): d is string => Boolean(d) && d !== "UNKNOWN")
  );

  // I5a — every defined domain is mapped by ownership.yaml, or expectedEmpty.
  for (const id of definedIds) {
    if (!mappedIds.has(id) && !expectedEmpty.has(id)) {
      findings.push({
        invariant: "I5a-domain-mapped",
        severity: "error",
        message: `domain ${id} defined in domains.yaml but no ownership.yaml entry maps to it (add a glob, or set expectedEmpty: true if intentional)`,
      });
    }
  }

  // I5c — every domain referenced by ownership.yaml is defined in domains.yaml.
  for (const id of mappedIds) {
    if (!definedIds.has(id)) {
      findings.push({
        invariant: "I5c-domain-defined",
        severity: "error",
        message: `ownership.yaml references domain ${id} not defined in domains.yaml`,
      });
    }
  }

  // I5b — every domains.yaml glob resolves ≥ 1 file. WARN: the builder uses
  // ownership.yaml only, so domains.yaml ghost globs are documentation drift
  // (backlog), not a functional defect. Surfaced for cleanup, not blocking.
  for (const d of domains.entries) {
    for (const glob of d.globs ?? []) {
      if (micromatch(realFiles, glob).length === 0) {
        findings.push({
          invariant: "I5b-domain-glob-resolves",
          severity: "warn",
          message: `domains.yaml ${d.id} glob "${glob}" matches 0 files (ghost/doc-drift)`,
        });
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// I6 — canonical.json fresh vs its declared inputs (fingerprint integrity)
// Pure : `resolveHash(rel)` returns the input's actual sha256, or null if the
// declared input no longer exists. Injected so it is unit-testable.
export function checkCanonicalFresh(
  inputHashes: Record<string, string> | undefined,
  resolveHash: (rel: string) => string | null
): Finding[] {
  const findings: Finding[] = [];
  if (!inputHashes || Object.keys(inputHashes).length === 0) {
    findings.push({
      invariant: "I6-canonical-fresh",
      severity: "warn",
      message: "canonical.meta.inputHashes absent — cannot verify freshness",
    });
    return findings;
  }
  for (const [rel, expected] of Object.entries(inputHashes)) {
    const actual = resolveHash(rel);
    if (actual === null) {
      findings.push({
        invariant: "I6-canonical-fresh",
        severity: "error",
        message: `declared input "${rel}" missing — canonical.json references a nonexistent source`,
      });
      continue;
    }
    if (actual !== expected) {
      findings.push({
        invariant: "I6-canonical-fresh",
        severity: "error",
        message: `canonical.json STALE vs ${rel} (declared ${expected.slice(0, 12)}…, actual ${actual.slice(0, 12)}…). Run \`npm run registry\` and commit the result.`,
      });
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
function main(): number {
  log("loading canonical.json");
  const canonical = loadCanonical();

  log("running 6 invariants");
  const realFiles = gitLsFiles();
  const inputHashes = (canonical as { meta?: { inputHashes?: Record<string, string> } })
    .meta?.inputHashes;
  const resolveHash = (rel: string): string | null => {
    const abs = join(MONOREPO_ROOT, rel);
    return existsSync(abs) ? sha256OfFile(abs) : null;
  };
  const findings: Finding[] = [
    ...checkUniqueIds(canonical),
    ...checkArchivedNotRuntime(canonical),
    ...checkRuntimeAcyclic(canonical),
    ...checkOwnershipOrphanFree(),
    ...checkDomainConsistency(loadDomains(), loadOwnership(), realFiles),
    ...checkCanonicalFresh(inputHashes, resolveHash),
  ];

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warn");

  if (errors.length > 0) {
    process.stderr.write(
      `\n[validate-invariants] ${errors.length} error(s) :\n`
    );
    for (const f of errors) {
      process.stderr.write(`  [ERROR] ${f.invariant}: ${f.message}\n`);
    }
  }
  if (warnings.length > 0) {
    process.stderr.write(
      `\n[validate-invariants] ${warnings.length} warning(s) :\n`
    );
    for (const f of warnings) {
      process.stderr.write(`  [WARN] ${f.invariant}: ${f.message}\n`);
    }
  }

  if (errors.length > 0) return 1;
  if (STRICT && warnings.length > 0) return 1;

  log(`✓ All 6 invariants PASS (I1, I2, I3, I4, I5, I6)`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(
      `[validate-invariants] FAILED: ${(err as Error).message}\n`
    );
    process.exit(2);
  }
}
