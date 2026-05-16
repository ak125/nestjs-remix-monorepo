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
2. Verify `proof.validateScriptSha256` still equals `sha256(scripts/cleanup/validate-before-delete.sh)` on `main` (gate unchanged).
3. Verify `meta.inputFingerprint` still matches the current `main` state (inputs not drifted).
4. Run `bash scripts/cleanup/validate-before-delete.sh <file>` — must exit 0 (`SAFE`).
5. Embed the matching `proof.*` block + the `activeRuntimeCheck` result in the PR body.
6. `git rm <file>`.

**No deletion without a matching proof block AND a fresh `activeRuntimeCheck` AND an unchanged input fingerprint.**

## CI ratchet (future PR-8d)

`npm run audit:cleanup-candidates:check` will be wired as a warn-only step in `.github/workflows/registry-build.yml`. It fails if the committed JSON drifts from a fresh generator run. Once 2-3 batches have shipped clean, promote to blocking.

## Input fingerprint contract

Every record carries the sha256 of all inputs (`dead-code-candidates.json`, `canonical.json`, `ownership.yaml`, `contract-health.json`, `validate-before-delete.sh`, `unreachable-modules/`) PLUS the toolchain (`node`, `platform`, `arch`). A deletion PR **must** prove its inventory fingerprint still matches `main` — otherwise the inventory is stale and must be rebuilt.
