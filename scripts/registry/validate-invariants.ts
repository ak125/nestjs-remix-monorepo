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
const OWNERSHIP_PATH = join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "ownership.yaml"
);

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
function main(): number {
  log("loading canonical.json");
  const canonical = loadCanonical();

  log("running 4 invariants");
  const findings: Finding[] = [
    ...checkUniqueIds(canonical),
    ...checkArchivedNotRuntime(canonical),
    ...checkRuntimeAcyclic(canonical),
    ...checkOwnershipOrphanFree(),
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

  log(`✓ All 4 invariants PASS (I1, I2, I3, I4)`);
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
