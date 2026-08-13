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
| **Global strict** | `npm run audit:cleanup-candidates:check` | No — exits 1 on ANY input fingerprint change. **Toolchain excluded** (see below) | PR-8c-N inventory regen ritual; CI step in `registry-fresh.yml` (warn-only → blocking) |
| **Target-scoped** | `npm run audit:cleanup-candidates:check -- --target <path>` | Yes — only checks the target's per-field proof invariance | PR-8b-N deletion batches (each file in the batch authorizes itself) |

**Canonical rule**: *"Global inventory drift may exist. Deletion is allowed only if target-scoped proof remains invariant."*

## CI ratchet

Wired in [`.github/workflows/registry-fresh.yml`](../../.github/workflows/registry-fresh.yml) as two steps, both **before** `audit:inventory` and `npm run registry`:

| Step | Runs | Proves |
|------|------|--------|
| `PR-8 cleanup guard — unit tests` | `npm run audit:cleanup-candidates:test` | the generator's own design decisions still hold (19 tests on fixtures) |
| `PR-8 inventory freshness` | `npm run audit:cleanup-candidates:check` | the **committed** inventory matches the **committed** inputs |

Order matters. Placed after the rebuilds, the freshness step would compare against freshly regenerated inputs and report a PR-8 drift *caused by* an upstream drift — conflating two signals the `Deep-inventory freshness` step deliberately keeps apart. Non-blocking today via the job's `continue-on-error` (Phase 1); promote alongside the Deep-inventory step.

Until 2026-08-13 neither existed: the 19 tests were referenced by no npm script, no workflow and no hook, and the check could not be wired at all (see below).

## Input fingerprint contract

Every record carries the sha256 of all inputs (`dead-code-candidates.json`, `canonical.json`, `ownership.yaml`, `contract-health.json`, `validate-before-delete.sh`, `unreachable-modules/`). A deletion PR **must** prove its inventory fingerprint still matches `main` — otherwise the inventory is stale and must be rebuilt.

`meta.toolchain` (`node`, `platform`, `arch`) is **recorded but not compared** — by both check modes.

- **Why recorded**: replay safety — knowing what produced an artifact. Locked by the test `toolchain captured in meta`.
- **Why not compared**: it made the artifact incomparable across machines. The committed artifact carried `linux / v20.19.6`, CI runs `ubuntu / node 24`, an operator box `win32 / v24.x` — so the global check failed *everywhere except its machine of origin*, for a purely declarative reason. That is why it was never wired, and why the inventory drifted 508 commits unnoticed. Note the repo pins node at the **major** (`.nvmrc: 24`); fingerprinting the **patch** meant any runner bump turned the guard red.
- **Why this is not a loophole**: the generator's output was measured platform-independent before the exclusion was made. `.gitattributes` enforces `* text=auto eol=lf` so input sha256s are identical; the builders normalise `path.sep → '/'`; `sha256OfDirSorted` sorts by codepoint; and `candidates` are now sorted by **codepoint instead of `localeCompare()`**, which had resolved the process ICU locale (`fr-FR` on an operator box, `en-US`/`C` on CI). The real variance was removed at the source, not masked. Locked by `sort order is locale-independent` and `global --check ignores meta.toolchain but NOT a real input drift`.

**Regeneration is therefore machine-independent** — but do not run `npm run audit:drift-dashboard` before regenerating: `audit-reports/` is gitignored, so `contractHealth` is `null` in CI and must stay `null` in the committed artifact.
