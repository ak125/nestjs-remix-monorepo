// Zod schema for PR-8 controlled cleanup inventory.
// Single SoT for the artifact shape consumed by:
//   - scripts/audit/build-cleanup-candidates.ts (the generator)
//   - PR-8b reviewers (the deletion authority — see audit/cleanup/README.md)
//
// Projection layer over existing canon (registry / contracts / drift observatory / ownership).
// NOT a new policy engine — `cleanupPolicyVersion: "pr8-v1"` is the namespace.
import { z } from "zod";

// Three independent versioning dimensions — never bumped together:
//   - inventoryFormat: the artifact name/identity (kept as literal — drift = wrong artifact)
//   - schemaVersion: the Zod shape (semver; bump on field add/remove/rename — regex avoids friction)
//   - cleanupPolicyVersion: the decision-matrix policy (kept as literal — drift = wrong policy applied)
// Constants are exported so a future bump touches one line, not N occurrences.
export const CLEANUP_INVENTORY_FORMAT = "pr-8-cleanup-inventory" as const;
export const CLEANUP_SCHEMA_VERSION = "1.0.0" as const;
export const CLEANUP_POLICY_VERSION = "pr8-v1" as const;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const DecisionSchema = z.enum(["candidate", "blocked", "excluded"]);

// PR-8a is snapshot-only by design (C8). PR-8b emits records with
// `mode: "active-runtime-check"` after running validate-before-delete.sh per file.
export const ValidationModeSchema = z.enum(["snapshot-only", "active-runtime-check"]);

export const PrecheckVerdictSchema = z.object({
  c0_not_never_auto_delete: z.boolean(),
  c1_zero_static_import: z.boolean(),
  c2_zero_dynamic_import: z.boolean(),
  c3_zero_runtime_use: z.boolean(),
});

// Enum domains below were verified empirically against audit/registry/canonical.json (2131 files):
//   status:        LIVE (854) | UNKNOWN (1273) | LEGACY (4)            — explicit governance
//   deletePolicy:  FREE (2130) | LOCKED (1)                             — explicit governance
//   risk:          low (1084) | medium (606) | high (413) | critical (28) — explicit governance
//   sourceConfidence: medium | high (observed) — `low` kept for forward-compat
//   kind:          config | controller | route | script | service | test  — left as z.string() to
//     absorb producer evolution (canonical.kind is decided by build-deep-inventory.js, not us).
// The Zod shape MUST stay in sync with the canonical generator output; explicit enums here
// trade strictness for crash-on-parse-drift, which is the right call for governance fields.
export const CanonicalRecordSchema = z.object({
  id: z.string(),
  owner: z.string(),
  domain: z.string(),
  status: z.enum(["LIVE", "UNKNOWN", "LEGACY"]),
  kind: z.string(),
  loc: z.number().int().nonnegative(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  deletePolicy: z.enum(["FREE", "LOCKED"]),
  importedByCount: z.number().int().nonnegative(),
  importedBy: z.array(z.string()),
  importsCount: z.number().int().nonnegative(),
  sourceConfidence: z.enum(["low", "medium", "high"]),
});

export const NeverAutoDeleteCheckSchema = z.object({
  matchedGlob: z.string().nullable(),
  protected: z.boolean(),
});

export const UnreachableModuleVerdictSchema = z.object({
  triageDoc: z.string().nullable(),     // e.g. "audit/unreachable-modules/agentic-engine.md"
  verdict: z.enum(["retain", "partial-retain", "drop", "absent"]),
  // Provenance of the verdict. `heuristic-prose-parse` is fragile (regex against free prose);
  // PR-8f migrates triage docs to structured YAML frontmatter and flips this to `structured-frontmatter`.
  // Marking the source explicitly prevents future agents from treating heuristic output as canonical.
  source: z.enum(["heuristic-prose-parse", "structured-frontmatter"]),
});

export const DriftOrphanSignalSchema = z.object({
  inOrphansList: z.boolean(),
  orphanIndex: z.number().int().nonnegative().nullable(),
});

// Active runtime check is null in PR-8a; populated by PR-8b at act-time.
export const ActiveRuntimeCheckSchema = z.object({
  exitCode: z.literal(0).or(z.literal(1)).or(z.literal(2)),
  verdict: z.enum(["SAFE", "BLOCKED", "ERROR"]),
  stdoutTail: z.string(),
  ranAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

export const ValidationSchema = z.object({
  mode: ValidationModeSchema,
  snapshotPrecheck: PrecheckVerdictSchema,
  activeRuntimeCheck: ActiveRuntimeCheckSchema.nullable(), // ALWAYS null in PR-8a (mode = snapshot-only)
});

export const ProofPackSchema = z.object({
  deadCodeSnapshotSha256: z.string().length(64),
  canonicalSnapshotSha256: z.string().length(64),
  ownershipYamlSha256: z.string().length(64),
  contractHealthSha256: z.string().length(64).nullable(),
  validateScriptSha256: z.string().length(64), // fingerprinted, NOT executed in PR-8a
  canonical: CanonicalRecordSchema.nullable(), // null only if canonical has no record — generator blocks in this case
  neverAutoDelete: NeverAutoDeleteCheckSchema,
  driftOrphan: DriftOrphanSignalSchema,
  unreachableModule: UnreachableModuleVerdictSchema,
  validation: ValidationSchema,
  decisionRationale: z.string().min(8).max(400),
});

export const CandidateRecordSchema = z.object({
  path: z.string(),
  domain: z.string(),
  kind: z.string(),
  confidence: ConfidenceSchema,
  derivedFrom: z.array(z.string()).min(1),
  decision: DecisionSchema,
  blockedReason: z.string().nullable(),
  proof: ProofPackSchema,
});

export const ToolchainSchema = z.object({
  node: z.string(),         // e.g. "v20.18.0"
  platform: z.string(),     // e.g. "linux"
  arch: z.string(),         // e.g. "x64"
});

export const InventoryMetaSchema = z.object({
  inventoryFormat: z.literal(CLEANUP_INVENTORY_FORMAT),
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/), // semver shape; constant is exported above
  cleanupPolicyVersion: z.literal(CLEANUP_POLICY_VERSION), // projection layer, NOT new canon
  validationMode: ValidationModeSchema,                // "snapshot-only" for every PR-8a inventory
  generatedAt: z.string().datetime(),                  // honors SOURCE_DATE_EPOCH when set; --check pins to committed value
  generator: z.literal("scripts/audit/build-cleanup-candidates.ts"),
  toolchain: ToolchainSchema,
  inputFingerprint: z.object({
    deadCodeCandidates: z.string().length(64),
    canonical: z.string().length(64),
    ownershipYaml: z.string().length(64),
    contractHealth: z.string().length(64).nullable(),
    validateScript: z.string().length(64),
    unreachableModules: z.string().length(64), // sha over sorted concat of *.md
  }),
  counts: z.object({
    total: z.number().int(),
    byConfidence: z.object({ high: z.number().int(), medium: z.number().int(), low: z.number().int() }),
    byDecision: z.object({ candidate: z.number().int(), blocked: z.number().int(), excluded: z.number().int() }),
  }),
});

export const CleanupInventorySchema = z.object({
  meta: InventoryMetaSchema,
  candidates: z.array(CandidateRecordSchema),
});

export type CleanupInventory = z.infer<typeof CleanupInventorySchema>;
export type CandidateRecord = z.infer<typeof CandidateRecordSchema>;
export type UnreachableModuleVerdict = z.infer<typeof UnreachableModuleVerdictSchema>;
export type CanonicalRecord = z.infer<typeof CanonicalRecordSchema>;
export type ProofPack = z.infer<typeof ProofPackSchema>;
