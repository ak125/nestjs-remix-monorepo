// Tests for the PR-8a cleanup candidates generator.
// Uses node:test (project convention — see build-drift-dashboard.test.ts).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import stableStringify from "fast-json-stable-stringify";

import { buildInventory, checkTarget, NEVER_AUTO_DELETE_GLOBS } from "./build-cleanup-candidates.ts";
import { CleanupInventorySchema, type CleanupInventory } from "./cleanup-candidates.schema.ts";
import { mkdtempSync, writeFileSync as fsWriteSync } from "node:fs";
import { tmpdir } from "node:os";
import stableStringify from "fast-json-stable-stringify";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIX = (name: string) => join(HERE, "__fixtures__/cleanup-candidates", name);

const inputs = {
  deadCodePath: FIX("dead-code-candidates.fixture.json"),
  canonicalPath: FIX("canonical.fixture.json"),
  contractHealthPath: FIX("contract-health.fixture.json"),
  ownershipYamlPath: FIX("ownership.fixture.yaml"),
  validateScriptPath: join(HERE, "../cleanup/validate-before-delete.sh"),
  unreachableModulesDir: FIX("unreachable-modules-empty"),
};

// SOURCE_DATE_EPOCH freezes `generatedAt` so determinism is testable directly.
before(() => { process.env.SOURCE_DATE_EPOCH = "1700000000"; });

test("buildInventory: Zod-valid + snapshot-only + decoupled versions", async () => {
  const inv = await buildInventory(inputs);
  const parsed = CleanupInventorySchema.safeParse(inv);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.format(), null, 2));
  assert.equal(inv.meta.validationMode, "snapshot-only");
  assert.equal(inv.meta.inventoryFormat, "pr-8-cleanup-inventory");
  assert.equal(inv.meta.schemaVersion, "1.0.0");
  assert.equal(inv.meta.cleanupPolicyVersion, "pr8-v1");
});

test("PR-8a invariant C8: no record carries an active runtime check", async () => {
  const inv = await buildInventory(inputs);
  for (const c of inv.candidates) {
    assert.equal(c.proof.validation.mode, "snapshot-only", `${c.path} should be snapshot-only`);
    assert.equal(c.proof.validation.activeRuntimeCheck, null, `${c.path} should have activeRuntimeCheck=null`);
  }
});

test("never-auto-delete route is excluded (micromatch glob)", async () => {
  const inv = await buildInventory(inputs);
  const route = inv.candidates.find(c => c.path === "frontend/app/routes/_index.tsx");
  assert.ok(route, "route fixture should be present");
  assert.equal(route!.decision, "excluded");
  assert.equal(route!.proof.neverAutoDelete.protected, true);
  assert.equal(route!.proof.neverAutoDelete.matchedGlob, "frontend/app/routes/**");
});

test("auth filter is blocked (importedByCount > 0)", async () => {
  const inv = await buildInventory(inputs);
  const filter = inv.candidates.find(c => c.path === "backend/src/auth/exception.filter.ts");
  assert.ok(filter);
  assert.equal(filter!.decision, "blocked");
  assert.match(filter!.blockedReason ?? "", /importedBy/i);
});

test("clean frontend util is classified as candidate (in drift orphans)", async () => {
  const inv = await buildInventory(inputs);
  const dead = inv.candidates.find(c => c.path === "frontend/app/utils/dead.ts");
  assert.ok(dead);
  assert.equal(dead!.decision, "candidate");
  assert.equal(dead!.proof.driftOrphan.inOrphansList, true);
});

test("orphan-from-orphan (missing from canonical) is blocked — safety gate", async () => {
  const inv = await buildInventory(inputs);
  const orphan = inv.candidates.find(c => c.path === "frontend/app/utils/orphan-from-orphan.ts");
  assert.ok(orphan);
  assert.equal(orphan!.decision, "blocked");
  assert.equal(orphan!.proof.canonical, null);
  assert.match(orphan!.blockedReason ?? "", /canonical/i);
});

test("byte-for-byte deterministic across two runs (SOURCE_DATE_EPOCH frozen)", async () => {
  const inv1 = await buildInventory(inputs);
  const inv2 = await buildInventory(inputs);
  assert.equal(stableStringify(inv1), stableStringify(inv2));
});

test("toolchain captured in meta (replay safety)", async () => {
  const inv = await buildInventory(inputs);
  assert.equal(inv.meta.toolchain.node, process.version);
  assert.equal(inv.meta.toolchain.platform, process.platform);
  assert.equal(inv.meta.toolchain.arch, process.arch);
});

test("renderMarkdown emits a projection with the three top-level decision sections", async () => {
  const { renderMarkdown } = await import("./build-cleanup-candidates-markdown.ts");
  const inv = await buildInventory(inputs);
  const md = renderMarkdown(inv);
  assert.match(md, /^# PR-8 Controlled Cleanup/);
  assert.match(md, /## candidate \(/);
  assert.match(md, /## blocked \(/);
  assert.match(md, /## excluded \(/);
});

// ---------------------------------------------------------------------------
// PR-8d: target-scoped invariance check.
// Tolerates global inventory drift (e.g. ownership.yaml mutations on unrelated paths)
// as long as the target's proof block stays invariant.
// ---------------------------------------------------------------------------

// Helper: write a CleanupInventory to a tmp file, then run checkTarget against it
// using the same fixtures so the fresh re-compute is comparable to the committed one.
async function checkTargetWithCommittedInventory(
  committedInv: CleanupInventory,
  targetPath: string,
): Promise<{ ok: boolean; drifts: string[] }> {
  const dir = mkdtempSync(join(tmpdir(), "pr8d-"));
  const jsonOut = join(dir, "inv.json");
  fsWriteSync(jsonOut, stableStringify(committedInv) + "\n");
  return checkTarget(targetPath, jsonOut, inputs);
}

test("checkTarget: target invariant (same inputs) → authorized", async () => {
  const inv = await buildInventory(inputs);
  const r = await checkTargetWithCommittedInventory(inv, "frontend/app/utils/dead.ts");
  assert.equal(r.ok, true, `Expected authorized, got drifts: ${JSON.stringify(r.drifts)}`);
  assert.deepEqual(r.drifts, []);
});

test("checkTarget: target not in inventory → blocked", async () => {
  const inv = await buildInventory(inputs);
  const r = await checkTargetWithCommittedInventory(inv, "some/unknown/file.ts");
  assert.equal(r.ok, false);
  assert.match(r.drifts[0], /not present/i);
});

test("checkTarget: target decision != candidate → blocked", async () => {
  const inv = await buildInventory(inputs);
  // "frontend/app/routes/_index.tsx" is excluded (NEVER_AUTO_DELETE)
  const r = await checkTargetWithCommittedInventory(inv, "frontend/app/routes/_index.tsx");
  assert.equal(r.ok, false);
  assert.match(r.drifts[0], /decision/i);
});

test("checkTarget: target's canonical record mutated → blocked", async () => {
  const inv = await buildInventory(inputs);
  // Tamper: simulate canonical.owner change for the target.
  const tampered: CleanupInventory = JSON.parse(JSON.stringify(inv));
  const target = tampered.candidates.find(c => c.path === "frontend/app/utils/dead.ts");
  assert.ok(target?.proof.canonical);
  target!.proof.canonical!.owner = "@different-team";
  const r = await checkTargetWithCommittedInventory(tampered, "frontend/app/utils/dead.ts");
  assert.equal(r.ok, false);
  assert.ok(r.drifts.some(d => d.includes("owner")), `Expected owner drift: ${JSON.stringify(r.drifts)}`);
});

test("checkTarget: target's importedByCount mutated → blocked", async () => {
  const inv = await buildInventory(inputs);
  const tampered: CleanupInventory = JSON.parse(JSON.stringify(inv));
  const target = tampered.candidates.find(c => c.path === "frontend/app/utils/dead.ts");
  target!.proof.canonical!.importedByCount = 42;
  target!.proof.canonical!.importedBy = ["fake/importer.ts"];
  const r = await checkTargetWithCommittedInventory(tampered, "frontend/app/utils/dead.ts");
  assert.equal(r.ok, false);
  assert.ok(r.drifts.some(d => d.includes("importedByCount")), `Expected importedByCount drift: ${JSON.stringify(r.drifts)}`);
});

test("checkTarget: validateScriptSha256 mutated → blocked (gate logic changed)", async () => {
  const inv = await buildInventory(inputs);
  const tampered: CleanupInventory = JSON.parse(JSON.stringify(inv));
  const target = tampered.candidates.find(c => c.path === "frontend/app/utils/dead.ts");
  target!.proof.validateScriptSha256 = "0".repeat(64);
  const r = await checkTargetWithCommittedInventory(tampered, "frontend/app/utils/dead.ts");
  assert.equal(r.ok, false);
  assert.ok(r.drifts.some(d => d.includes("validateScriptSha256")), `Expected gate sha drift: ${JSON.stringify(r.drifts)}`);
});

test("checkTarget: cosmetic global drift (different generatedAt or whole-file fingerprints) → still authorized", async () => {
  const inv = await buildInventory(inputs);
  const tampered: CleanupInventory = JSON.parse(JSON.stringify(inv));
  // Mutate global fingerprints + generatedAt, but NOT the target's per-field canonical/proof.
  tampered.meta.inputFingerprint.ownershipYaml = "f".repeat(64);
  tampered.meta.inputFingerprint.contractHealth = "e".repeat(64);
  tampered.meta.generatedAt = "2030-01-01T00:00:00.000Z";
  // The target's per-field canonical proof block stays identical.
  const r = await checkTargetWithCommittedInventory(tampered, "frontend/app/utils/dead.ts");
  assert.equal(r.ok, true, `Expected authorized despite cosmetic drift, got: ${JSON.stringify(r.drifts)}`);
});

// ---------------------------------------------------------------------------
// Drift insurance: NEVER_AUTO_DELETE_GLOBS bash ↔ TS parity.
// Until PR-8d/PR-9 externalize to a shared YAML SoT, this test is the only
// thing preventing the two arrays from drifting silently.
// ---------------------------------------------------------------------------
test("NEVER_AUTO_DELETE_GLOBS parity: bash array equals TS array (set-equality)", () => {
  const sh = readFileSync(join(HERE, "../cleanup/validate-before-delete.sh"), "utf8");
  const m = sh.match(/NEVER_AUTO_DELETE_GLOBS=\(\s*([\s\S]*?)\)/);
  assert.ok(m, "bash NEVER_AUTO_DELETE_GLOBS=(...) block not found");
  const bashGlobs = Array.from(m![1].matchAll(/'([^']+)'/g)).map(x => x[1]);
  assert.deepEqual(
    [...bashGlobs].sort(),
    [...NEVER_AUTO_DELETE_GLOBS].sort(),
    "bash and TS NEVER_AUTO_DELETE_GLOBS arrays diverged — sync both or externalize to YAML (PR-8d/9)",
  );
});
