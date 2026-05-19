#!/usr/bin/env tsx
//
// sync-codeowners-from-gates.ts
//
// Auto-generate the "EVIDENCE GATES" section of .github/CODEOWNERS from the
// canonical evidence-gates.yaml overlay (ADR-077 / ADR-058 pattern).
//
// Modes :
//   --check     : exit 1 if CODEOWNERS section is out of sync (CI + pre-commit)
//   --write     : rewrite CODEOWNERS in place to match overlay (manual)
//   --dry-run   : print expected section to stdout, exit 0
//
// Meta-discipline : this script produces NO new file outside .github/CODEOWNERS
// and reads only from the canon overlay. Zero new infra. The CODEOWNERS section
// it manages is delimited by sentinels so the rest of the file stays untouched.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
// Import the TS source directly (per @repo/registry doctrine — tsx scripts use
// relative paths to avoid the build prerequisite).
import {
  EvidenceGatesRegistrySchema,
  type EvidenceGatesRegistry,
} from "../../packages/registry/src/overlay/evidence-gates.ts";

const REPO_ROOT = resolve(__dirname, "../..");
const OVERLAY_PATH = resolve(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/evidence-gates.yaml",
);
const CODEOWNERS_PATH = resolve(REPO_ROOT, ".github/CODEOWNERS");
const SECTION_OWNER = "@ak125";
const BEGIN_SENTINEL =
  "# === EVIDENCE GATES — AUTO-MANAGED (do not edit; run scripts/audit/sync-codeowners-from-gates.ts --write) ===";
const END_SENTINEL = "# === END EVIDENCE GATES ===";

function loadOverlay(): EvidenceGatesRegistry {
  const raw = readFileSync(OVERLAY_PATH, "utf-8");
  return EvidenceGatesRegistrySchema.parse(yaml.load(raw));
}

function renderSection(registry: EvidenceGatesRegistry): string {
  const lines: string[] = [BEGIN_SENTINEL, ""];
  lines.push(`# Source : ${OVERLAY_PATH.replace(REPO_ROOT + "/", "")}`);
  lines.push(`# Canon  : ${registry.source_adr_url}`);
  lines.push(
    `# Frozen : ${registry.canon_freeze_date} (parent plan: ${registry.parent_plan})`,
  );
  lines.push("#");
  lines.push(
    "# Each path below is blocked behind an evidence gate. Merge to these",
  );
  lines.push(
    `# paths requires ${SECTION_OWNER} approval AND a referenced ADR-077 promotion`,
  );
  lines.push("# (gate trigger fired -> ADR L4 vault -> plan -> PR).");
  lines.push("");

  for (const gate of registry.entries) {
    if (gate.blocked_paths.length === 0) continue;
    lines.push(
      `# Gate ${gate.id} - ${gate.item} (deferred per ${gate.source_adr})`,
    );
    // GitHub CODEOWNERS resolves the last matching rule, so order matters
    // mainly for readability. Per-file rules win over globs above.
    const longest = Math.max(...gate.blocked_paths.map((p) => p.length));
    const pad = Math.min(longest + 2, 100);
    for (const path of gate.blocked_paths) {
      lines.push(`/${path.padEnd(pad)} ${SECTION_OWNER}`);
    }
    lines.push("");
  }

  lines.push(END_SENTINEL);
  lines.push("");
  return lines.join("\n");
}

function replaceSection(existing: string, newSection: string): string {
  const beginIdx = existing.indexOf(BEGIN_SENTINEL);
  const endIdx = existing.indexOf(END_SENTINEL);

  if (beginIdx === -1 || endIdx === -1) {
    // First-time install: append at end with a leading blank line.
    const trimmed = existing.endsWith("\n") ? existing : existing + "\n";
    return `${trimmed}\n${newSection}`;
  }

  const before = existing.slice(0, beginIdx);
  const afterEnd = endIdx + END_SENTINEL.length;
  const after = existing.slice(afterEnd);
  // Drop leading newline from `after` to avoid double blanks.
  const afterTrimmed = after.startsWith("\n") ? after.slice(1) : after;
  return `${before}${newSection}${afterTrimmed}`;
}

function main(): number {
  const mode =
    process.argv.find((a) => ["--check", "--write", "--dry-run"].includes(a)) ??
    "--check";

  const registry = loadOverlay();
  const newSection = renderSection(registry);

  if (mode === "--dry-run") {
    process.stdout.write(newSection);
    return 0;
  }

  const current = readFileSync(CODEOWNERS_PATH, "utf-8");
  const next = replaceSection(current, newSection);

  if (mode === "--write") {
    if (current === next) {
      console.log("CODEOWNERS already in sync with evidence-gates.yaml");
      return 0;
    }
    writeFileSync(CODEOWNERS_PATH, next, "utf-8");
    console.log(`CODEOWNERS updated from evidence-gates.yaml (${registry.entries.length} gates)`);
    return 0;
  }

  // --check mode (default, CI + pre-commit)
  if (current === next) {
    console.log("CODEOWNERS in sync with evidence-gates.yaml");
    return 0;
  }
  console.error(
    "CODEOWNERS out of sync with evidence-gates.yaml.\n" +
      "Run: npx tsx scripts/audit/sync-codeowners-from-gates.ts --write",
  );
  return 1;
}

process.exit(main());
