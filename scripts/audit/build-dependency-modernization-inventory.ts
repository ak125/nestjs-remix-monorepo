#!/usr/bin/env tsx
// scripts/audit/build-dependency-modernization-inventory.ts
//
// PR-9a — Dependency Modernization Inventory generator.
//
// Pure static. No network. No install. Idempotent + deterministic.
//
// Inputs:
//   - audit/registry/deps.json                       (L1 raw, ADR-058)
//   - audit/dependencies/family-overlay.yaml         (L2 human overlay)
//   - package-lock.json                              (L1' resolved versions)
//
// Output:
//   - audit/dependencies/dependency-modernization-inventory.json  (L3 projection)
//
// Usage:
//   tsx scripts/audit/build-dependency-modernization-inventory.ts
//   tsx scripts/audit/build-dependency-modernization-inventory.ts --check

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as yaml from "js-yaml";
import {
  FamilyOverlaySchema,
  InventoryArtifactSchema,
  INVENTORY_FORMAT,
  SCHEMA_VERSION,
  MATRIX_VERSION,
  type FamilyOverlay,
  type InventoryArtifact,
} from "./dependency-modernization.schema";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEPS_REGISTRY = path.join(REPO_ROOT, "audit", "registry", "deps.json");
const OVERLAY = path.join(REPO_ROOT, "audit", "dependencies", "family-overlay.yaml");
const LOCKFILE = path.join(REPO_ROOT, "package-lock.json");
const OUTPUT = path.join(
  REPO_ROOT,
  "audit",
  "dependencies",
  "dependency-modernization-inventory.json",
);

// --- File hashing helpers (central rule #32) ---

export function fileSha(filePath: string): string {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return `sha256:${hash}`;
}

export function computeImmutabilityHash(depsSha: string, overlaySha: string, lockfileSha: string): string {
  const concat = `${depsSha}\n${overlaySha}\n${lockfileSha}\n`;
  const hash = crypto.createHash("sha256").update(concat).digest("hex");
  return `sha256:${hash}`;
}

// --- Peer cluster wildcard freeze (central rule #24) ---
//
// Expand overlay peer_dependency_cluster patterns into explicit names against
// the full set of declared dep names. Wildcards never reach the artifact.
// Supports two forms:
//   - "@scope/*" prefix glob (most common: @nestjs/*, @remix-run/*)
//   - "any-prefix-*" / "*-suffix" generic glob via simple regex
// Exact (no `*`) patterns pass through.
export function expandCluster(patterns: string[], allDepNames: Set<string>): string[] {
  const out = new Set<string>();
  for (const p of patterns) {
    if (!p.includes("*")) {
      out.add(p);
      continue;
    }
    if (p.endsWith("/*") && !p.slice(0, -2).includes("*")) {
      const prefix = p.slice(0, -2) + "/";
      for (const name of allDepNames) {
        if (name.startsWith(prefix)) out.add(name);
      }
      continue;
    }
    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
    const regex = new RegExp("^" + escaped + "$");
    for (const name of allDepNames) {
      if (regex.test(name)) out.add(name);
    }
  }
  return Array.from(out).sort();
}

// --- L1 raw input ---

interface RawDepEntry {
  name: string;
  version: string;
  workspaces: string[];
  declaredIn: string[];
}

function readDepsRegistry(): RawDepEntry[] {
  const raw = JSON.parse(fs.readFileSync(DEPS_REGISTRY, "utf8"));
  return raw.entries.map((e: any) => ({
    name: e.name,
    version: e.version,
    workspaces: e.workspaces,
    declaredIn: e.declaredIn,
  }));
}

function readOverlay(): FamilyOverlay {
  const parsed = yaml.load(fs.readFileSync(OVERLAY, "utf8"));
  return FamilyOverlaySchema.parse(parsed);
}

// npm v7+ lockfile shape: `packages: { "node_modules/foo": { version: "1.2.3" } }`.
function readLockfileResolved(): Map<string, Set<string>> {
  const lock = JSON.parse(fs.readFileSync(LOCKFILE, "utf8"));
  const out = new Map<string, Set<string>>();
  for (const [key, pkg] of Object.entries<any>(lock.packages || {})) {
    if (!key.includes("node_modules/")) continue;
    const name = pkg.name || key.split("node_modules/").pop();
    if (!name || !pkg.version) continue;
    if (!out.has(name)) out.set(name, new Set());
    out.get(name)!.add(pkg.version);
  }
  return out;
}

// --- Deterministic serialization ---

export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeysDeep) as unknown as T;
  if (value && typeof value === "object" && (value as any).constructor === Object) {
    const sorted: any = {};
    for (const k of Object.keys(value as any).sort()) {
      sorted[k] = sortKeysDeep((value as any)[k]);
    }
    return sorted;
  }
  return value;
}

function writeDeterministic(filePath: string, data: unknown): void {
  const body = JSON.stringify(sortKeysDeep(data), null, 2) + "\n";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, "utf8");
}

function sha256OfFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// --- Build ---

export function build(): InventoryArtifact {
  const deps = readDepsRegistry();
  const overlay = readOverlay();
  const lockResolved = readLockfileResolved();

  // Group declared deps by name.
  const byName = new Map<
    string,
    Array<{ workspace: string; declaredIn: string; specifier: string }>
  >();
  for (const d of deps) {
    for (let i = 0; i < d.workspaces.length; i++) {
      const occ = {
        workspace: d.workspaces[i],
        declaredIn: d.declaredIn[i] ?? d.declaredIn[0],
        specifier: d.version,
      };
      if (!byName.has(d.name)) byName.set(d.name, []);
      byName.get(d.name)!.push(occ);
    }
  }

  const packageEntry = (name: string) => {
    const occurrences = (byName.get(name) ?? []).sort((a, b) =>
      a.workspace.localeCompare(b.workspace),
    );
    const resolved = Array.from(lockResolved.get(name) ?? []).sort();
    const distinctSpecifiers = new Set(occurrences.map((o) => o.specifier));
    return {
      name,
      occurrences,
      resolved_versions: resolved.length ? resolved : ["<unresolved>"],
      divergent_specifiers: distinctSpecifiers.size > 1,
      divergent_resolved: resolved.length > 1,
    };
  };

  const allDepNames = new Set(byName.keys());
  const claimedNames = new Set<string>();
  const families = overlay.families
    .map((f) => {
      const packages = f.members
        .filter((name) => byName.has(name))
        .map((name) => {
          claimedNames.add(name);
          return packageEntry(name);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      // Central rule #24 — freeze peer cluster wildcards into explicit, sorted names.
      const resolved = f.peer_dependency_cluster
        ? expandCluster(f.peer_dependency_cluster, allDepNames)
        : [];
      return {
        ...f,
        members: [...f.members].sort(),
        packages,
        total_occurrences: packages.reduce((a, p) => a + p.occurrences.length, 0),
        peer_dependency_cluster_resolved: resolved,
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family));

  const unassigned_packages = Array.from(byName.keys())
    .filter((n) => !claimedNames.has(n))
    .sort()
    .map(packageEntry);

  const allPackages = [...families.flatMap((f) => f.packages), ...unassigned_packages];
  const divergences = allPackages
    .filter((p) => p.divergent_specifiers || p.divergent_resolved)
    .map((p) => ({
      name: p.name,
      kind: (p.divergent_specifiers ? "specifier" : "resolved") as "specifier" | "resolved",
      occurrences: p.occurrences,
      resolved_versions: p.resolved_versions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const by_blast_radius: Record<string, number> = {};
  const by_pr_assignment: Record<string, number> = {};
  for (const f of families) {
    by_blast_radius[f.blast_radius] = (by_blast_radius[f.blast_radius] || 0) + f.packages.length;
    by_pr_assignment[f.pr_assignment] = (by_pr_assignment[f.pr_assignment] || 0) + f.packages.length;
  }
  by_blast_radius["unassigned"] = (by_blast_radius["unassigned"] || 0) + unassigned_packages.length;

  const depsSha = fileSha(DEPS_REGISTRY);
  const overlaySha = fileSha(OVERLAY);
  const lockfileSha = fileSha(LOCKFILE);
  const immutabilityHash = computeImmutabilityHash(depsSha, overlaySha, lockfileSha);

  const artifact: InventoryArtifact = {
    inventoryFormat: INVENTORY_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    matrixVersion: MATRIX_VERSION,
    artifact_immutability_hash: immutabilityHash,
    generatedFrom: {
      deps_registry: "audit/registry/deps.json",
      deps_registry_sha: depsSha,
      overlay: "audit/dependencies/family-overlay.yaml",
      overlay_sha: overlaySha,
      lockfile: "package-lock.json",
      lockfile_sha: lockfileSha,
    },
    summary: {
      total_packages: allPackages.length,
      total_occurrences: allPackages.reduce((a, p) => a + p.occurrences.length, 0),
      families_count: families.length,
      unassigned_count: unassigned_packages.length,
      divergent_packages_count: divergences.length,
      by_blast_radius: by_blast_radius as any,
      by_pr_assignment: by_pr_assignment as any,
    },
    families,
    unassigned_packages,
    divergences,
  };

  return InventoryArtifactSchema.parse(sortKeysDeep(artifact));
}

function main() {
  const checkMode = process.argv.includes("--check");
  const artifact = build();

  if (checkMode) {
    const tmp = OUTPUT + ".tmp";
    writeDeterministic(tmp, artifact);
    const before = fs.existsSync(OUTPUT) ? sha256OfFile(OUTPUT) : "<missing>";
    const after = sha256OfFile(tmp);
    fs.unlinkSync(tmp);
    if (before !== after) {
      console.error(`✘ inventory drift: committed=${before.slice(0, 12)} regenerated=${after.slice(0, 12)}`);
      console.error(`   re-run: tsx scripts/audit/build-dependency-modernization-inventory.ts`);
      process.exit(1);
    }
    console.log(`✓ inventory deterministic (sha256: ${after.slice(0, 12)})`);
    return;
  }

  writeDeterministic(OUTPUT, artifact);
  console.log(
    `✓ wrote ${path.relative(REPO_ROOT, OUTPUT)} — ${artifact.summary.total_packages} packages, ${artifact.families.length} families, ${artifact.summary.divergent_packages_count} divergent`,
  );
}

// Only run main() when invoked directly (not when imported by tests).
if (require.main === module) {
  main();
}
