# Generator determinism cross-audit — 2026-05-14 (W4)

> One-shot empirical audit of canon generator determinism across the Node
> majors each generator claims to support. **Informational only — no CI
> gate, no enforcement, no generator code change.** Follow-up decisions
> (e.g. tightening `SUPPORTED_NODE_MAJORS`) belong in separate PRs.

## Scope

| Generator | Source | Output artifact | Claimed Node majors |
|---|---|---|---|
| `architecture:build` | `packages/registry/src/bin/build-architecture-artifacts.ts` (PR #507) | `.spec/00-canon/_schema/architecture.schema.json` | `22` |
| `db-contract:build` | `packages/registry/src/bin/build-db-contract-artifacts.ts` (PR #511) | `.spec/00-canon/_schema/db.schema.json` | `20`, `22` |

## Host metadata

- Repo HEAD: `e56ebd34` (2026-05-14T15:06:23+02:00)
- Branch: `chore/w4-generator-determinism-audit`
- Docker version: `Docker version 29.1.2, build 890dcca`
- Audit runner Node: `v20.19.6` (host)
- `node:22-slim` digest: `node@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e`
- `node:20-slim` digest: `node@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0`

## Same-Node determinism (double-run SHA compare)

| Generator | Node major | Run 1 SHA-256 (12) | Run 2 SHA-256 (12) | Same-Node determinism |
|---|---|---|---|---|
| architecture | 22 | b2077b43d654… | b2077b43d654… | ✓ deterministic |
| db-contract | 20 | 28bc94dcc246… | 28bc94dcc246… | ✓ deterministic |
| db-contract | 22 | 28bc94dcc246… | 28bc94dcc246… | ✓ deterministic |

## Cross-Node-major byte-equality (per generator)

| Generator | Node A | Node B | SHA-256 A (12) | SHA-256 B (12) | Cross-Node byte-equality |
|---|---|---|---|---|---|
| db-contract | 20 | 22 | 28bc94dcc246… | 28bc94dcc246… | ✓ byte-equal |

## Conclusion

Both generators are byte-deterministic on every Node major they claim to support. `architecture:build` reproduces byte-identical output across two consecutive Node 22 runs. `db-contract:build` reproduces byte-identical output on both Node 20 and Node 22 independently *and* produces the same artifact bytes across the two majors — the `SUPPORTED_NODE_MAJORS = ['20', '22']` claim is empirically validated. No divergence detected at any of the four observed pairs.

## Recommendations (textual — no code change in this PR)

- No generator change required. Leave `SUPPORTED_NODE_MAJORS` arrays as-is in both generators.
- Before PR-3b commits `audit/registry/db-contract.generated.json`, re-run this script from the PR-3b branch and append the resulting SHAs as a new dated report under `audit-reports/`. The freshness gate PR-3b plans to introduce will diff *that* committed artifact against the regenerated one; a re-confirmation guards against silent CI baseline drift.
- For every future canon generator added under `packages/registry/src/bin/` (RPC, runtime, workers, SEO surface, …), append its tuple to the `GENERATORS` array in `scripts/audit/check-generator-determinism.sh` and re-run W4 before merging that contract's PR. The audit script is the canonical "what's covered" registry for determinism evidence.
- No promotion of W4 into a recurring CI gate. The audit is one-shot evidence; an ongoing gate is a different decision (out of W4 scope, would require its own ADR/plan).
- If a future re-run surfaces a divergence (cross-Node ✘ or same-Node ✘), open a defect-fix PR named PR-W4b with the *minimum* fix (typically a 1-line tightening of `SUPPORTED_NODE_MAJORS`) — do not bundle it with anything else.

## Reproduce

```bash
bash scripts/audit/check-generator-determinism.sh
```

The script is idempotent and safe to re-run; it only regenerates the gitignored `_schema/*.schema.json` mirrors on the host filesystem. Cost ~15s on a warm Docker layer cache (node:22-slim + node:20-slim already pulled).
