# audit/cleanup/ — PR-8 series controlled cleanup

This directory holds the **machine-checkable inventory** + **human projection** that downstream cleanup batches consume.

> **What this is**: a **projection layer** over existing canon (registry / contracts / drift observatory / ownership). It is **not** a new policy engine and does not introduce new doctrine.
> **What this is not**: an active runtime gate. PR-8a is **snapshot-only**. The bash gate `scripts/cleanup/validate-before-delete.sh` runs at *act-time* in PR-8b — never from this generator (see C8 in the plan).
>
> **Three decoupled versioning dimensions** (never bumped together):
> - `inventoryFormat: "pr-8-cleanup-inventory"` — artifact identity (rarely changes).
> - `schemaVersion: "1.0.0"` — Zod shape (bump on field add/remove/rename).
> - `cleanupPolicyVersion: "pr8-v1"` — decision-matrix policy (bump on gate/threshold change).

| File | Role |
|------|------|
| `pr-8-controlled-cleanup-candidates.json` | Source of truth. Deterministic JSON emitted by `scripts/audit/build-cleanup-candidates.ts`. **Do not edit by hand.** |
| `pr-8-deletion-proof.md` | Human projection (tables, grouped by decision × confidence). Regenerated alongside the JSON. |

## Regenerate

```bash
# Optional: refresh the Drift Observatory artifact (gitignored, used as corroborating signal).
test -f audit-reports/contract-health.json || npm run audit:drift-dashboard

# Generate (stamps generatedAt at wall-clock time).
npm run audit:cleanup-candidates

# Verify the committed artifact still reproduces from current inputs.
#  - `:check` auto-pins generatedAt to the committed value, so this never flaps because of timestamps.
#  - Exit 1 means an input or the toolchain (node/platform/arch) has drifted — read the hint.
npm run audit:cleanup-candidates:check
```

## Downstream consumption (PR-8b protocol)

At PR-8b creation time, for each file in the batch:

1. Find the matching record in `pr-8-controlled-cleanup-candidates.json` — must have `decision === "candidate"` and `confidence === "high"`.
2. **Target-scoped invariance check** (PR-8d): `npm run audit:cleanup-candidates:check -- --target <path>` — exits 0 iff the target's proof block is invariant (`canonical.owner/domain/status/deletePolicy/importedByCount/importedBy[]` unchanged, `validateScriptSha256` unchanged, snapshot precheck c0-c3 unchanged, `neverAutoDelete.{protected,matchedGlob}` unchanged, `unreachableModule.verdict` unchanged). Cosmetic global drift (e.g., `ownership.yaml` mutated on UNRELATED paths by concurrent PRs) is tolerated by design.
3. Run `bash scripts/cleanup/validate-before-delete.sh <file>` — must exit 0 (`SAFE`).
4. Embed the matching `proof.*` block + the `activeRuntimeCheck` result in the PR body.
5. `git rm <file>`.

**No deletion without a passing target-scoped check AND a fresh `activeRuntimeCheck` SAFE.**

### Two check modes

| Mode | Command | Tolerates global drift? | Used by |
|------|---------|------------------------|---------|
| **Global strict** | `npm run audit:cleanup-candidates:check` | No — exits 1 on ANY input fingerprint or toolchain change | PR-8c-N inventory regen ritual; future CI ratchet (warn-only → blocking) |
| **Target-scoped** | `npm run audit:cleanup-candidates:check -- --target <path>` | Yes — only checks the target's per-field proof invariance | PR-8b-N deletion batches (each file in the batch authorizes itself) |

**Canonical rule**: *"Global inventory drift may exist. Deletion is allowed only if target-scoped proof remains invariant."*

## CI ratchet (future PR-8e+)

`npm run audit:cleanup-candidates:check` will be wired as a warn-only step in `.github/workflows/registry-build.yml`. It fails if the committed JSON drifts from a fresh generator run. Once 2-3 batches have shipped clean, promote to blocking.

## Input fingerprint contract

Every record carries the sha256 of all inputs (`dead-code-candidates.json`, `canonical.json`, `ownership.yaml`, `contract-health.json`, `validate-before-delete.sh`, `unreachable-modules/`) PLUS the toolchain (`node`, `platform`, `arch`). A deletion PR **must** prove its inventory fingerprint still matches `main` — otherwise the inventory is stale and must be rebuilt.
