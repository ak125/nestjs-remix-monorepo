#!/usr/bin/env tsx
/**
 * scripts/registry/validate-deps-fidelity.ts
 *
 * PROOF A — semantic fidelity of the L1 dependency registry.
 *
 * This is the check that `git diff --exit-code` (PROOF B, freshness) can NOT
 * provide. Freshness proves `committed deps.json == rebuild(manifests)` using
 * the SAME producer — a deterministic-but-wrong producer regenerating a wrong
 * artifact passes it. Fidelity instead builds a tuple set DIRECTLY from the
 * governed `package.json` manifests, with its OWN independent scan, and asserts
 * it equals the tuple set flattened out of `deps.json`'s `occurrences[]`.
 *
 *     sorted(flatten(deps.json occurrences)) === sorted(direct manifest scan)
 *
 * Tuple compared: { name, workspace, declaredIn, bucket, specifier }.
 * Plus four structural invariants (see checkInvariants). It covers EVERY
 * package; NestJS / React Router / Zod are only *diagnostic priorities* — the
 * expected value is always the live manifest, never a hardcoded version.
 *
 * Exit codes:
 *   0 — registry is a faithful projection of the manifests
 *   1 — at least one divergence or invariant violation
 *   2 — input file missing / unreadable
 *
 * Runnable: `npm run registry:validate:deps-fidelity`
 */
import * as fs from "node:fs";
import * as path from "node:path";
// Shared id-format + bucket-set SoT (same module the L1 builder uses) so the
// invariant `entry.id === depId(name, specifier)` and the scanned bucket set
// can never drift. The manifest→tuple SCAN below is deliberately independent.
import {
  DEPENDENCY_BUCKETS,
  depId,
} from "./lib/utils.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEPS_REGISTRY = path.join(REPO_ROOT, "audit", "registry", "deps.json");

// Families whose drift is business-critical — surfaced FIRST in diagnostics.
// This only orders/labels output; it asserts no version (truth = manifests).
const PRIORITY_PATTERNS: RegExp[] = [
  /^@nestjs\//,
  /^react-router$/,
  /^@react-router\//,
  /^zod$/,
];

export function isPriorityName(name: string): boolean {
  return PRIORITY_PATTERNS.some((re) => re.test(name));
}

export interface DepTuple {
  name: string;
  workspace: string;
  declaredIn: string;
  bucket: string;
  specifier: string;
}

export interface Manifest {
  path: string; // repo-relative package.json path
  pkg: Record<string, unknown>; // parsed package.json
}

export function tupleKey(t: DepTuple): string {
  return `${t.name} ${t.workspace} ${t.declaredIn} ${t.bucket} ${t.specifier}`;
}

function byTupleKey(a: DepTuple, b: DepTuple): number {
  const ka = tupleKey(a);
  const kb = tupleKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * INDEPENDENT manifest scan. A dead-simple nested loop that emits one tuple per
 * declaration — no aggregation into parallel arrays, so nothing can be
 * mis-paired. This is the authoritative "manifests" side of PROOF A.
 */
export function tuplesFromManifests(manifests: Manifest[]): DepTuple[] {
  const out: DepTuple[] = [];
  for (const { path: declaredIn, pkg } of manifests) {
    const workspace = (typeof pkg.name === "string" && pkg.name) || declaredIn;
    for (const bucket of DEPENDENCY_BUCKETS) {
      const deps = (pkg[bucket] as Record<string, string> | undefined) ?? {};
      for (const [name, specifier] of Object.entries(deps)) {
        out.push({ name, workspace, declaredIn, bucket, specifier });
      }
    }
  }
  return out;
}

/** The "registry" side of PROOF A: flatten deps.json entries → occurrence tuples. */
export function flattenRegistryTuples(
  entries: Array<{ name: string; occurrences: Array<Omit<DepTuple, "name">> }>,
): DepTuple[] {
  const out: DepTuple[] = [];
  for (const e of entries) {
    for (const o of e.occurrences ?? []) {
      out.push({
        name: e.name,
        workspace: o.workspace,
        declaredIn: o.declaredIn,
        bucket: o.bucket,
        specifier: o.specifier,
      });
    }
  }
  return out;
}

export interface FidelityDiff {
  missingInRegistry: DepTuple[]; // declared in a manifest, absent from deps.json
  extraInRegistry: DepTuple[]; // present in deps.json, not backed by a manifest
}

/** Set-difference of the two independently-built tuple sets. */
export function diffTuples(
  manifestTuples: DepTuple[],
  registryTuples: DepTuple[],
): FidelityDiff {
  const manifestKeys = new Set(manifestTuples.map(tupleKey));
  const registryKeys = new Set(registryTuples.map(tupleKey));
  return {
    missingInRegistry: manifestTuples
      .filter((t) => !registryKeys.has(tupleKey(t)))
      .sort(byTupleKey),
    extraInRegistry: registryTuples
      .filter((t) => !manifestKeys.has(tupleKey(t)))
      .sort(byTupleKey),
  };
}

export interface InvariantViolation {
  invariant: string;
  detail: string;
  name: string;
}

/**
 * Four structural invariants on the registry entries (owner spec):
 *   1. no duplicate occurrence (full tuple unique within an entry)
 *   2. occurrence.specifier === entry.version
 *   3. entry.id === depId(entry.name, occurrence.specifier)
 *   4. declaredIn exists AND manifest.name === workspace AND
 *      manifest[bucket][name] === specifier
 * Invariant #4 is the one that would have caught the false pairings directly.
 */
export function checkInvariants(
  entries: Array<{
    id: string;
    name: string;
    version: string;
    occurrences: Array<Omit<DepTuple, "name">>;
  }>,
  manifests: Manifest[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  // Index manifests by declaredIn for invariant #4.
  const manifestByPath = new Map<string, Manifest>();
  for (const m of manifests) manifestByPath.set(m.path, m);

  for (const e of entries) {
    const seen = new Set<string>();
    for (const o of e.occurrences ?? []) {
      const key = `${o.workspace} ${o.declaredIn} ${o.bucket} ${o.specifier}`;
      // (1) no duplicate occurrence
      if (seen.has(key)) {
        violations.push({
          invariant: "no-duplicate-occurrence",
          name: e.name,
          detail: `${e.id} has a duplicate occurrence ${JSON.stringify(o)}`,
        });
      }
      seen.add(key);

      // (2) occurrence.specifier === entry.version
      if (o.specifier !== e.version) {
        violations.push({
          invariant: "specifier-equals-version",
          name: e.name,
          detail: `${e.id}: occurrence.specifier=${o.specifier} ≠ entry.version=${e.version} (${o.workspace} ${o.declaredIn})`,
        });
      }

      // (3) entry.id === depId(name, occurrence.specifier)
      const expectedId = depId(e.name, o.specifier);
      if (e.id !== expectedId) {
        violations.push({
          invariant: "id-equals-depId",
          name: e.name,
          detail: `${e.id}: expected id ${expectedId} from (${e.name}, ${o.specifier})`,
        });
      }

      // (4) declaredIn exists AND manifest.name === workspace AND manifest[bucket][name] === specifier
      const m = manifestByPath.get(o.declaredIn);
      if (!m) {
        violations.push({
          invariant: "declaredIn-exists",
          name: e.name,
          detail: `${e.id}: declaredIn '${o.declaredIn}' is not a governed manifest`,
        });
        continue;
      }
      const mName = (typeof m.pkg.name === "string" && m.pkg.name) || m.path;
      if (mName !== o.workspace) {
        violations.push({
          invariant: "manifest-name-equals-workspace",
          name: e.name,
          detail: `${e.id}: manifest '${o.declaredIn}' name=${mName} ≠ occurrence.workspace=${o.workspace}`,
        });
      }
      const bucketObj = (m.pkg[o.bucket] as Record<string, string> | undefined) ?? {};
      if (bucketObj[e.name] !== o.specifier) {
        violations.push({
          invariant: "manifest-declares-specifier",
          name: e.name,
          detail: `${e.id}: manifest '${o.declaredIn}' ${o.bucket}['${e.name}']=${bucketObj[e.name] ?? "<absent>"} ≠ occurrence.specifier=${o.specifier}`,
        });
      }
    }
  }
  return violations;
}

// ---------------- Disk IO + CLI ----------------

/** Independent manifest discovery (root + workspace globs). */
export function loadManifests(root: string): Manifest[] {
  const rootPkg = readJson(path.join(root, "package.json"));
  if (!rootPkg) return [];
  const patterns: string[] = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
  const relPaths: string[] = ["package.json"];
  for (const pat of patterns) {
    if (pat.endsWith("/*")) {
      const dir = pat.slice(0, -2);
      try {
        for (const entry of fs.readdirSync(path.join(root, dir))) {
          const rel = path.join(dir, entry, "package.json");
          if (fs.existsSync(path.join(root, rel))) relPaths.push(rel);
        }
      } catch {
        // missing dir — ignore
      }
    } else {
      const rel = path.join(pat, "package.json");
      if (fs.existsSync(path.join(root, rel))) relPaths.push(rel);
    }
  }
  const manifests: Manifest[] = [];
  for (const rel of relPaths) {
    const pkg = readJson(path.join(root, rel));
    if (pkg) manifests.push({ path: rel, pkg });
  }
  return manifests;
}

function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function formatTuple(t: DepTuple): string {
  const tag = isPriorityName(t.name) ? " [CRITICAL FAMILY]" : "";
  return `  - ${t.name} @ ${t.specifier} | ${t.workspace} | ${t.declaredIn} | ${t.bucket}${tag}`;
}

/** Priority families first, then alphabetical — for legible diagnostics. */
function prioritize<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = isPriorityName(a.name) ? 0 : 1;
    const pb = isPriorityName(b.name) ? 0 : 1;
    return pa - pb || a.name.localeCompare(b.name);
  });
}

export function runFidelity(root: string): {
  ok: boolean;
  diff: FidelityDiff;
  violations: InvariantViolation[];
  manifestCount: number;
  tupleCount: number;
} {
  const manifests = loadManifests(root);
  const doc = readJson(DEPS_REGISTRY);
  if (!doc || !Array.isArray((doc as any).entries)) {
    throw new Error(`unreadable deps.json at ${DEPS_REGISTRY}`);
  }
  const entries = (doc as any).entries as Array<{
    id: string;
    name: string;
    version: string;
    occurrences: Array<Omit<DepTuple, "name">>;
  }>;
  const manifestTuples = tuplesFromManifests(manifests);
  const registryTuples = flattenRegistryTuples(entries);
  const diff = diffTuples(manifestTuples, registryTuples);
  const violations = checkInvariants(entries, manifests);
  const ok =
    diff.missingInRegistry.length === 0 &&
    diff.extraInRegistry.length === 0 &&
    violations.length === 0;
  return {
    ok,
    diff,
    violations,
    manifestCount: manifests.length,
    tupleCount: manifestTuples.length,
  };
}

function main(): void {
  if (!fs.existsSync(DEPS_REGISTRY)) {
    console.error(`MISSING: ${DEPS_REGISTRY}`);
    process.exit(2);
  }
  const { ok, diff, violations, manifestCount, tupleCount } = runFidelity(REPO_ROOT);

  if (ok) {
    console.log(
      `✓ PROOF A (fidelity): deps.json faithfully projects ${tupleCount} declarations across ${manifestCount} manifests`,
    );
    return;
  }

  console.error("✘ PROOF A (fidelity) FAILED — deps.json diverges from the live manifests\n");
  if (diff.missingInRegistry.length) {
    console.error(`Declared in a manifest but MISSING from deps.json (${diff.missingInRegistry.length}):`);
    for (const t of prioritize(diff.missingInRegistry)) console.error(formatTuple(t));
    console.error("");
  }
  if (diff.extraInRegistry.length) {
    console.error(`Present in deps.json but NOT backed by a manifest (${diff.extraInRegistry.length}):`);
    for (const t of prioritize(diff.extraInRegistry)) console.error(formatTuple(t));
    console.error("");
  }
  if (violations.length) {
    console.error(`Invariant violations (${violations.length}):`);
    for (const v of prioritize(violations)) {
      const tag = isPriorityName(v.name) ? " [CRITICAL FAMILY]" : "";
      console.error(`  - [${v.invariant}]${tag} ${v.detail}`);
    }
    console.error("");
  }
  console.error("Fix the PRODUCER (build-deps-registry.js) or the manifest, then rebuild — never hand-edit deps.json.");
  process.exit(1);
}

if (require.main === module) {
  main();
}
