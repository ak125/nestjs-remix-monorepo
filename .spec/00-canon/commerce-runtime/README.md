# Commerce Runtime Authority canon (L2 overlay)

This folder is the **L2 manual overlay** that declares the commerce runtime's
authority structure: which handler is the SoT for each write, which reads are
canonical, what to do when truth degrades, and which RPCs are governed.

It is the **cousin** of the Repository Control Plane L2 overlay
(`.spec/00-canon/repository-registry/`) — same pattern, different domain.

## Files

| File | Role |
|---|---|
| `authority-graph.yaml` | L2 canon (writes, reads, degraded_modes, rpc_authority). **Edit here.** |
| `authority-graph.schema.json` | JSON Schema enforced by validator. |

## Validation

- Local: `node scripts/governance/validate-authority-graph.js`
- JSON report: `node scripts/governance/validate-authority-graph.js --json`
- CI: `.github/workflows/commerce-runtime-canon-gate.yml`

Exit codes: `0` = pass, `1` = errors found, `2` = internal error.

## Scope V1

Vault #301 résidus only. Hard caps (governance section in YAML):

- `max_lines: 250` (current size targets ~210)
- `max_domains: 8`
- `review_cadence: quarterly`
- `prose_max_lines_per_field: 3`

If the graph grows beyond ≥5 distinct runtime domains, split into sub-overlays
(`commerce-runtime/`, `supplier-runtime/`, `payment-runtime/`,
`vehicle-runtime/`). Not for V1; documented to avoid reinventing later.

## ast-grep mechanical guards (8 rules, `[V1]`)

All in `.ast-grep/rules/commerce-*.yml`:

| Rule | Severity (PR-A) | Promoted to `error` in |
|---|---|---|
| `commerce-no-direct-order-status-write` | `error` | (already error) |
| `commerce-no-direct-line-status-write` | `error` | (already error) |
| `commerce-no-direct-supplier-read` | `off` | PR-D |
| `commerce-no-fictional-supplier-cols` | `off` | PR-D |
| `commerce-no-hardcoded-status-99` | `off` | PR-C |
| `commerce-no-server-cart-read-in-createorder` | `error` | (already error) |
| `commerce-no-rpc-without-authority` | `error` | (already error) |
| `commerce-correlation-id-required-on-mutations` | `warning` | PR-C (once RPC plumbing exists) |

The 3 sentinel rules are intentionally `severity: off` in PR-A: they detect
legacy bugs that will be removed in PR-C (status 99) and PR-D (fictional supplier
cols, direct supplier reads). Going `warning → error` directly (skipping `warning`)
respects the deterministic-gates baseline threshold (ast_grep.warnings delta ≤ +5).
Promotion happens in the same commit that removes the violating code, in a single
atomic transition.

## Anti-bricolage invariants surfaced here

- **No silent fallback** — every read domain declares `degraded_modes.action`
- **No shadow business logic** — `rpc_authority` charts who owns each RPC, and
  `commerce-no-rpc-without-authority` enforces it mechanically
- **No microservice sprawl of intents** — bound to V1.7+ Decision Engine, not V1
- **No score manipulation** — `confidence_inputs` invariant carried in V1.5+
  via a separate ast-grep rule (`commerce-no-confidence-score-without-inputs`,
  not in V1)

## ADR vault

Companion ADR to be filed in `ak125/governance-vault` (separate PR) once V1 lands:
**ADR-079 — Commerce Runtime Authority canon (L2 overlay)**. The ADR will
ratify the canon, link this folder, and document the cascade (V1 → V1.5 → V1.7
→ V1.8 → V2) decided in the originating plan.

## Originating plan

`/home/deploy/.claude/plans/utiliser-superpower-p0-modular-brooks.md`
(decision log + 4 PRs découpe + cascade architectural).

## Out of scope (here)

- Implementation of any V1.5+ component (Runtime Drift Dashboard, Decision Engine,
  Effectiveness Review, Health Engine) — only the **canon + invariants** that make
  them possible later live in V1.
- Authority overlays for non-commerce domains (SEO, vehicle, blog) — handled by
  their own future L2 overlays, never inflate this one.
