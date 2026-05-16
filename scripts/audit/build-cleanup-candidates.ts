#!/usr/bin/env tsx
//
// PR-8a Controlled Cleanup Inventory generator — snapshot-only, deterministic.
//
// INVARIANT C8: This script MUST NOT invoke scripts/cleanup/validate-before-delete.sh.
// Active runtime validation is PR-8b's responsibility. We only fingerprint the script
// here so PR-8b can prove the gate is unchanged at act-time.
//
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import micromatch from "micromatch";
import stableStringify from "fast-json-stable-stringify";
import {
  CleanupInventorySchema,
  CLEANUP_INVENTORY_FORMAT,
  CLEANUP_SCHEMA_VERSION,
  CLEANUP_POLICY_VERSION,
  type CleanupInventory,
  type CandidateRecord,
  type UnreachableModuleVerdict,
} from "./cleanup-candidates.schema.ts";

// NEVER_AUTO_DELETE_GLOBS — MIRROR of scripts/cleanup/validate-before-delete.sh.
// Glob semantics provided by micromatch (de-facto JS standard; wraps picomatch).
// Parity with the bash array is asserted by a node:test (drift insurance until
// PR-8d/9 externalizes to .spec/00-canon/repository-registry/never-auto-delete.yaml
// as a shared SoT).
export const NEVER_AUTO_DELETE_GLOBS: ReadonlyArray<string> = [
  "frontend/app/routes/**",
  "backend/src/workers/**",
  "backend/supabase/migrations/**",
  ".github/workflows/**",
  "docker/**",
  "packages/seo-roles/**",
  "packages/seo-role-contracts/**",
  "backend/src/main.ts",
  "backend/src/main.server.ts",
  "backend/src/app.module.ts",
  "backend/src/workers/worker.module.ts",
  "frontend/app/entry.client.tsx",
  "frontend/app/entry.server.tsx",
  "frontend/app/root.tsx",
];

function matchNeverAutoDelete(path: string): { matchedGlob: string | null; protected: boolean } {
  for (const g of NEVER_AUTO_DELETE_GLOBS) {
    if (micromatch.isMatch(path, g, { dot: true })) {
      return { matchedGlob: g, protected: true };
    }
  }
  return { matchedGlob: null, protected: false };
}

function sha256OfBuffer(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256OfFile(path: string): string {
  return sha256OfBuffer(readFileSync(path));
}

function sha256OfDirSorted(dir: string): string {
  if (!existsSync(dir)) return sha256OfBuffer("");
  const files = readdirSync(dir).filter(f => f.endsWith(".md")).sort();
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f);
    h.update("\0");
    h.update(readFileSync(join(dir, f)));
    h.update("\0");
  }
  return h.digest("hex");
}

function resolveGeneratedAt(overrideIso?: string): string {
  // Priority: explicit override (used by --check mode) > SOURCE_DATE_EPOCH > wall-clock.
  if (overrideIso) return overrideIso;
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) {
    return new Date(Number(epoch) * 1000).toISOString();
  }
  return new Date().toISOString();
}

export interface BuildInputs {
  deadCodePath: string;
  canonicalPath: string;
  contractHealthPath: string | null;
  ownershipYamlPath: string;
  validateScriptPath: string;     // fingerprinted, NEVER executed in PR-8a
  unreachableModulesDir: string;
  generatedAtOverride?: string;   // ISO datetime — used by --check mode to pin time to the committed artifact
}

function findUnreachableVerdict(filePath: string, dir: string): UnreachableModuleVerdict {
  // PR-8a: heuristic-prose-parse only. PR-8f will add structured-frontmatter path with priority.
  // triageDoc is expressed as `<dir>/<file>` (input-relative, cwd-independent) so the fingerprint
  // is deterministic across node:test runs and CLI runs.
  if (!existsSync(dir)) return { triageDoc: null, verdict: "absent", source: "heuristic-prose-parse" };
  for (const f of readdirSync(dir).filter(x => x.endsWith(".md")).sort()) {
    const content = readFileSync(join(dir, f), "utf8");
    const tokens = [filePath, filePath.split("/").slice(-1)[0]];
    if (tokens.some(t => content.includes(t))) {
      const lower = content.toLowerCase();
      let v: "retain" | "partial-retain" | "drop" | "absent" = "absent";
      if (/partial[- ]retention|option b/.test(lower)) v = "partial-retain";
      else if (/\bretain\b|keep\b|preserve\b/.test(lower)) v = "retain";
      else if (/\bdrop\b|delete\b|remove\b/.test(lower)) v = "drop";
      // POSIX-normalized join so the path is byte-stable across OSes and cwds.
      const triageDoc = [dir.replace(/\\/g, "/").replace(/\/$/, ""), f].join("/");
      return { triageDoc, verdict: v, source: "heuristic-prose-parse" };
    }
  }
  return { triageDoc: null, verdict: "absent", source: "heuristic-prose-parse" };
}

export async function buildInventory(input: BuildInputs): Promise<CleanupInventory> {
  const dead = JSON.parse(readFileSync(input.deadCodePath, "utf8"));
  const canonical = JSON.parse(readFileSync(input.canonicalPath, "utf8"));
  const canonicalByPath = new Map<string, any>();
  for (const f of canonical.files) canonicalByPath.set(f.path, f);

  const orphans: string[] = input.contractHealthPath && existsSync(input.contractHealthPath)
    ? (JSON.parse(readFileSync(input.contractHealthPath, "utf8")).ownership?.orphans ?? [])
    : [];
  const orphanIndex = new Map(orphans.map((p, i) => [p, i]));

  const fingerprint = {
    deadCodeCandidates: sha256OfFile(input.deadCodePath),
    canonical: sha256OfFile(input.canonicalPath),
    ownershipYaml: sha256OfFile(input.ownershipYamlPath),
    contractHealth: input.contractHealthPath && existsSync(input.contractHealthPath)
      ? sha256OfFile(input.contractHealthPath) : null,
    validateScript: sha256OfFile(input.validateScriptPath), // fingerprinted, never invoked here
    unreachableModules: sha256OfDirSorted(input.unreachableModulesDir),
  };

  const candidates: CandidateRecord[] = [];

  for (const c of dead.candidates) {
    const canonicalRec = canonicalByPath.get(c.path) ?? null;
    const nad = matchNeverAutoDelete(c.path);
    const orphan = {
      inOrphansList: orphanIndex.has(c.path),
      orphanIndex: orphanIndex.get(c.path) ?? null,
    };
    const um = findUnreachableVerdict(c.path, input.unreachableModulesDir);

    // Snapshot-only decision matrix (PR-8a). Active runtime check intentionally absent.
    // Status is intentionally NOT a gate (see plan Decision Matrix section). It is carried in the proof
    // so PR-8b reviewers can prioritize LEGACY/UNKNOWN over LIVE when batching.
    let decision: "candidate" | "blocked" | "excluded" = "candidate";
    const reasons: string[] = [];
    if (nad.protected) { decision = "excluded"; reasons.push(`NEVER_AUTO_DELETE glob: ${nad.matchedGlob}`); }
    if (canonicalRec?.deletePolicy === "LOCKED") { decision = "excluded"; reasons.push("deletePolicy=LOCKED"); }

    if (decision !== "excluded") {
      const pv = c.precheck_verdict ?? {};
      if (!pv.c0_not_never_auto_delete) { decision = "blocked"; reasons.push("snapshot c0 failed"); }
      if (!pv.c1_zero_static_import) { decision = "blocked"; reasons.push("snapshot c1 failed (static import)"); }
      if (!pv.c2_zero_dynamic_import) { decision = "blocked"; reasons.push("snapshot c2 failed (dynamic import)"); }
      if (!pv.c3_zero_runtime_use) { decision = "blocked"; reasons.push("snapshot c3 failed (runtime use)"); }
      // Safety gate: a dead-code candidate that the canonical registry doesn't know about cannot be
      // proven dead — block by default. This prevents orphan-from-orphan slip-through.
      if (!canonicalRec) { decision = "blocked"; reasons.push("missing from canonical.json (registry doesn't know this file — cannot prove dead)"); }
      if (canonicalRec && canonicalRec.importedBy?.length > 0) { decision = "blocked"; reasons.push(`canonical.importedBy=${canonicalRec.importedBy.length}`); }
      if (um.verdict === "retain") { decision = "blocked"; reasons.push("unreachable-modules triage: retain"); }
    }

    const rationale = decision === "candidate"
      ? "Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b."
      : reasons.join("; ");

    candidates.push({
      path: c.path,
      domain: c.domain,
      kind: c.kind,
      confidence: c.confidence,
      derivedFrom: c.derived_from,
      decision,
      blockedReason: decision === "candidate" ? null : reasons.join("; "),
      proof: {
        deadCodeSnapshotSha256: fingerprint.deadCodeCandidates,
        canonicalSnapshotSha256: fingerprint.canonical,
        ownershipYamlSha256: fingerprint.ownershipYaml,
        contractHealthSha256: fingerprint.contractHealth,
        validateScriptSha256: fingerprint.validateScript,
        canonical: canonicalRec ? {
          id: canonicalRec.id,
          owner: canonicalRec.owner,
          domain: canonicalRec.domain,
          status: canonicalRec.status,
          kind: canonicalRec.kind,
          loc: canonicalRec.loc,
          risk: canonicalRec.risk,
          deletePolicy: canonicalRec.deletePolicy,
          importedByCount: canonicalRec.importedBy?.length ?? 0,
          importedBy: canonicalRec.importedBy ?? [],
          importsCount: canonicalRec.imports?.length ?? 0,
          sourceConfidence: canonicalRec.sourceConfidence,
        } : null,
        neverAutoDelete: nad,
        driftOrphan: orphan,
        unreachableModule: um,
        validation: {
          mode: "snapshot-only",
          snapshotPrecheck: c.precheck_verdict,
          activeRuntimeCheck: null, // PR-8a invariant C8
        },
        decisionRationale: rationale,
      },
    });
  }

  candidates.sort((a, b) => a.path.localeCompare(b.path));

  const inventory: CleanupInventory = {
    meta: {
      inventoryFormat: CLEANUP_INVENTORY_FORMAT,
      schemaVersion: CLEANUP_SCHEMA_VERSION,
      cleanupPolicyVersion: CLEANUP_POLICY_VERSION,
      validationMode: "snapshot-only",
      generatedAt: resolveGeneratedAt(input.generatedAtOverride),
      generator: "scripts/audit/build-cleanup-candidates.ts",
      toolchain: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      inputFingerprint: fingerprint,
      counts: {
        total: candidates.length,
        byConfidence: {
          high: candidates.filter(c => c.confidence === "high").length,
          medium: candidates.filter(c => c.confidence === "medium").length,
          low: candidates.filter(c => c.confidence === "low").length,
        },
        byDecision: {
          candidate: candidates.filter(c => c.decision === "candidate").length,
          blocked: candidates.filter(c => c.decision === "blocked").length,
          excluded: candidates.filter(c => c.decision === "excluded").length,
        },
      },
    },
    candidates,
  };

  return CleanupInventorySchema.parse(inventory);
}

// CLI entrypoint
async function main() {
  const args = new Set(process.argv.slice(2));
  const checkMode = args.has("--check");
  const jsonOut = "audit/cleanup/pr-8-controlled-cleanup-candidates.json";

  // In --check mode, pin `generatedAt` to whatever the committed artifact carries — so the
  // comparison is purely structural and never flaps because of HEAD-timestamp drift.
  let generatedAtOverride: string | undefined;
  if (checkMode) {
    if (!existsSync(jsonOut)) {
      console.error(`--check requires ${jsonOut} to exist; run \`npm run audit:cleanup-candidates\` first.`);
      process.exit(1);
    }
    const committedParsed = JSON.parse(readFileSync(jsonOut, "utf8"));
    generatedAtOverride = committedParsed?.meta?.generatedAt;
    if (typeof generatedAtOverride !== "string") {
      console.error("Committed artifact is missing meta.generatedAt; cannot run --check.");
      process.exit(1);
    }
  }

  const inv = await buildInventory({
    deadCodePath: "audit/dead-code-candidates.json",
    canonicalPath: "audit/registry/canonical.json",
    contractHealthPath: "audit-reports/contract-health.json",
    ownershipYamlPath: ".spec/00-canon/repository-registry/ownership.yaml",
    validateScriptPath: "scripts/cleanup/validate-before-delete.sh",
    unreachableModulesDir: "audit/unreachable-modules",
    generatedAtOverride,
  });

  const json = stableStringify(inv) + "\n";

  if (checkMode) {
    const committed = readFileSync(jsonOut, "utf8");
    if (committed === json) { process.exit(0); }
    console.error(`Inventory drift: ${jsonOut} does not match a fresh generator run.`);
    console.error("Possible causes: inputs changed without regeneration, or toolchain (node/platform/arch) differs from the run that produced the committed artifact.");
    console.error("To regenerate locally: `npm run audit:cleanup-candidates` (sets a fresh generatedAt; commit the result).");
    process.exit(1);
  }

  writeFileSync(jsonOut, json);
  const { renderMarkdown } = await import("./build-cleanup-candidates-markdown.ts");
  writeFileSync("audit/cleanup/pr-8-deletion-proof.md", renderMarkdown(inv));
  console.log(`Wrote ${jsonOut} (${inv.candidates.length} candidates, mode=${inv.meta.validationMode})`);
}

// Run main() only when invoked as the entrypoint (not when imported by tests).
const invokedAsScript = (() => {
  try {
    const argv1 = process.argv[1] ?? "";
    return argv1.endsWith("build-cleanup-candidates.ts") || argv1.endsWith("build-cleanup-candidates.mjs");
  } catch { return false; }
})();
if (invokedAsScript) {
  main().catch(e => { console.error(e); process.exit(2); });
}
