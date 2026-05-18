#!/usr/bin/env tsx
/**
 * scripts/registry/validate-overlay.ts — CLI validator for the 4 Layer 2 YAML
 * overlay files in `.spec/00-canon/repository-registry/`.
 *
 * Per ADR-058 invariant V1-4 (schema invariants minimal V1) :
 *   - "Tout glob ownership.yaml résout ≥ 1 fichier existant"
 *
 * Validation steps :
 *   1. Each YAML parses cleanly (no malformed syntax)
 *   2. Each YAML validates against its Zod schema from @repo/registry
 *   3. Each glob in ownership.yaml matches ≥ 1 file in audit/registry/files.json
 *      (fallback : git ls-files if registry not yet generated)
 *   4. domain IDs in ownership.yaml are also declared in domains.yaml
 *      (referential integrity)
 *   5. Coverage report : % of files in files.json matched by ≥ 1 ownership glob
 *
 * Exit codes :
 *   0  : all validations PASS
 *   1  : Zod / YAML parse / glob orphan / referential failure
 *   2  : internal error (registry build missing, etc.)
 *
 * Usage:
 *   tsx scripts/registry/validate-overlay.ts [--quiet] [--strict-coverage]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";
import micromatch from "micromatch";
import {
  OwnershipRegistrySchema,
  DomainsRegistrySchema,
  StatusOverridesSchema,
  DeletePolicyOverlaySchema,
} from "../../packages/registry/src/index";

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_DIR = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
);
const FILES_REGISTRY = path.join(
  MONOREPO_ROOT,
  "audit",
  "registry",
  "files.json",
);
const QUIET = process.argv.includes("--quiet");
const STRICT_COVERAGE = process.argv.includes("--strict-coverage");

type Finding = {
  level: "error" | "warn";
  file: string;
  message: string;
};

function log(msg: string): void {
  if (!QUIET) process.stderr.write(`[validate-overlay] ${msg}\n`);
}

function loadYaml(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`overlay file missing: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return yaml.load(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`YAML parse failure in ${filePath}: ${message}`);
  }
}

function loadFilesRegistry(): { entries: Array<{ path: string }> } | null {
  if (!fs.existsSync(FILES_REGISTRY)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(FILES_REGISTRY, "utf8"));
}

function loadGitFiles(): string[] {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function validate(): 0 | 1 {
  const findings: Finding[] = [];

  // 1. Load + parse each YAML
  const overlays = {
    ownership: loadYaml(path.join(OVERLAY_DIR, "ownership.yaml")),
    domains: loadYaml(path.join(OVERLAY_DIR, "domains.yaml")),
    statusOverrides: loadYaml(path.join(OVERLAY_DIR, "status-overrides.yaml")),
    deletePolicy: loadYaml(path.join(OVERLAY_DIR, "delete-policy.yaml")),
  };

  // 2. Validate each against its Zod schema
  const checks = [
    ["ownership.yaml", overlays.ownership, OwnershipRegistrySchema],
    ["domains.yaml", overlays.domains, DomainsRegistrySchema],
    ["status-overrides.yaml", overlays.statusOverrides, StatusOverridesSchema],
    ["delete-policy.yaml", overlays.deletePolicy, DeletePolicyOverlaySchema],
  ] as const;

  for (const [name, data, schema] of checks) {
    const r = schema.safeParse(data);
    if (!r.success) {
      for (const issue of r.error.errors) {
        findings.push({
          level: "error",
          file: name,
          message: `Zod: ${issue.path.join(".")} — ${issue.message}`,
        });
      }
    } else {
      log(`✓ ${name} Zod-valid`);
    }
  }

  // 3. Glob → files coverage check (invariant V1-4 #4)
  //
  // Two file universes :
  //   - `registryFiles` = subset tracked by Layer 1 builder (code files only,
  //     excludes markdown/yaml/config). Used for COVERAGE STATS.
  //   - `realFiles` = `git ls-files` (everything tracked by git). Used for
  //     ORPHAN CHECK (a glob is valid if it matches ≥ 1 real tracked file,
  //     even if that file isn't in the Layer 1 registry).
  //
  // Rationale : ownership.yaml legitimately maps governance/config paths
  // (.github/, agents/, CLAUDE.md) that aren't code, so the orphan check
  // must use the broader git universe.
  const registry = loadFilesRegistry();
  const registryFiles = registry ? registry.entries.map((e) => e.path) : [];
  const realFiles = loadGitFiles();
  const allRealFiles = realFiles.length > 0 ? realFiles : registryFiles;

  if (allRealFiles.length === 0) {
    findings.push({
      level: "warn",
      file: "files.json",
      message:
        "Aucun fichier source disponible pour la couverture (registry pas généré + git ls-files vide)",
    });
  } else {
    log(`orphan check vs ${allRealFiles.length} git-tracked files`);
    if (registryFiles.length > 0) {
      log(`coverage stats vs ${registryFiles.length} registry-tracked files`);
    }
  }

  const ownership = overlays.ownership as {
    entries?: Array<{ glob: string; domain: string }>;
  };
  const ownershipEntries = ownership.entries ?? [];
  const matchedRegistrySet = new Set<string>();
  for (const entry of ownershipEntries) {
    // Orphan check : does the glob match ANY real file ?
    const realMatched = micromatch(allRealFiles, entry.glob);
    if (realMatched.length === 0) {
      findings.push({
        level: "error",
        file: "ownership.yaml",
        message: `glob "${entry.glob}" resolves to 0 files in git ls-files (invariant V1-4 violé)`,
      });
      continue;
    }
    // Coverage stats : how many registry files it matches
    const registryMatched = micromatch(registryFiles, entry.glob);
    for (const m of registryMatched) matchedRegistrySet.add(m);
    log(
      `  ✓ "${entry.glob}" → ${realMatched.length} real files (${registryMatched.length} registry-tracked)`,
    );
  }

  // 4. Referential integrity : ownership.domain ∈ domains.entries
  const domains = overlays.domains as { entries?: Array<{ id: string }> };
  const declaredDomains = new Set<string>(
    (domains.entries ?? []).map((e) => e.id),
  );
  declaredDomains.add("UNKNOWN");
  for (const entry of ownershipEntries) {
    if (!declaredDomains.has(entry.domain)) {
      findings.push({
        level: "error",
        file: "ownership.yaml",
        message: `domain "${entry.domain}" in glob "${entry.glob}" not declared in domains.yaml`,
      });
    }
  }

  // 5. Coverage stats — against registry-tracked files (Layer 1 universe)
  const coverage =
    registryFiles.length === 0
      ? 0
      : (matchedRegistrySet.size / registryFiles.length) * 100;
  const coverageRound = coverage.toFixed(1);

  log(
    `coverage: ${matchedRegistrySet.size}/${registryFiles.length} registry files (${coverageRound}%)`,
  );

  if (STRICT_COVERAGE && coverage < 80) {
    findings.push({
      level: "error",
      file: "ownership.yaml",
      message: `coverage ${coverageRound}% < 80% (--strict-coverage)`,
    });
  } else if (coverage < 80) {
    findings.push({
      level: "warn",
      file: "ownership.yaml",
      message: `coverage ${coverageRound}% < 80% target (warn-only en PR-D ; bloquant en V2 block-all)`,
    });
  }

  // Summary
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");

  if (!QUIET || errors.length > 0) {
    if (errors.length > 0) {
      process.stderr.write(
        `\n[validate-overlay] ${errors.length} error(s):\n`,
      );
      for (const f of errors) {
        process.stderr.write(`  [ERROR] ${f.file}: ${f.message}\n`);
      }
    }
    if (warnings.length > 0) {
      process.stderr.write(
        `\n[validate-overlay] ${warnings.length} warning(s):\n`,
      );
      for (const f of warnings) {
        process.stderr.write(`  [WARN] ${f.file}: ${f.message}\n`);
      }
    }
  }

  if (errors.length > 0) return 1;
  log(
    `✓ All overlays valid (${ownershipEntries.length} ownership entries, ${declaredDomains.size - 1} domains, ${coverageRound}% file coverage)`,
  );
  return 0;
}

const isMain = process.argv[1]?.endsWith("validate-overlay.ts");
if (isMain) {
  try {
    process.exit(validate());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[validate-overlay] FAILED: ${message}\n`);
    process.exit(2);
  }
}
