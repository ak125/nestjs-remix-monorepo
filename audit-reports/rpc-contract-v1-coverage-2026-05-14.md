# RPC Contract V1 — Coverage Report (PR-R)

> Generated 2026-05-14 during PR-R implementation.
> Mirror of `dep-governance-v1-coverage-2026-05-14.md` (PR-D #523) evidence pattern.

## Summary

| Metric | Value |
|---|---|
| L1 entries (`audit/registry/rpc.json`) | **180** RPCs |
| V1 canon sample (`rpc.yaml`) | **18** RPCs (10 % of L1) |
| Soft threshold (test §4.6) | < 100 |
| Schema sanity cap (Zod `.max()`) | 2000 |
| Cross-contract tests passing | 7/7 (20/20 test cases) |
| Determinism (test §4.7) | byte-identical across runs |
| Domains covered | 8 of 15 (D1, D3, D4, D6, D7, D10, D11, D15) |
| Access surfaces used | 2 of 8 (backend + service_role; 6 RESERVED V1) |
| L1 governance gap CONFIRMED | 100 % (all 180 L1 RPCs have domain=UNKNOWN, status=UNKNOWN) |

## Critical L1 finding

**All 180 L1 RPCs currently have `domain=UNKNOWN, status=UNKNOWN`** in `audit/registry/rpc.json`. This is exactly the gap PR-R V1 fills via L2 governance attribution. Cross-contract test §4.2 verifies that L2 entries reference real L1 ids (subset relationship), but the inverse — L1→L2 coverage — is intentionally low (10 % V1) and grows over time.

## Domain coverage (V1 — 18 entries)

| Domain | Count V1 | Sample RPCs |
|---|---|---|
| D1 Catalog Core | 3 | get_piece_detail, get_pieces_for_type_gamme_{v3,v4} |
| D3 SEO & Sitemap | 3 | __seo_brand_editorial_set_updated_at, __seo_observable_updated_at, backfill_seo_keywords_type_ids |
| D4 Vehicle / Compatibility | 3 | build_vehicle_page_payload, extract_vehicle_keywords, get_alternative_gammes_for_vehicle |
| D6 RAG & AI Engine | 3 | kg_rag_{file_needs_sync, get_node_id, record_sync} |
| D7 Knowledge Graph | 1 | kg_generate_explainable_diagnostic |
| D10 Quality / Observability | 1 | get_cwv_summary_by_role |
| D11 Commerce & Users | 1 | mark_order_paid_atomic (SECURITY DEFINER critical path) |
| D15 Security & Governance | 3 | __gov_m1_table_sizes, __gov_m2_index_sizes, __gov_m3_stale_stats |

V1 GAPS (domains intentionally not covered V1, no V1 RPC) :
- D2 Legacy/XTR — migration domain, may have RPCs but not in V1 sample
- D5 Blog/Content
- D8 Read Model / Serving
- D9 Import/ETL
- D12 Marketing / Video
- D13 Config & System
- D14 Gamme Aggregates (cross-cutting, may reuse other domains' RPCs)

V2 candidate enrichments : extend coverage to all 15 domains via explicit per-domain audit.

## Access surfaces (V1 — 2 used / 8 declared)

| Surface | Used V1 | Status |
|---|---|---|
| backend | ✅ all 18 RPCs | universal |
| service_role | ✅ 9 RPCs (governance + RAG + SEO bypass RLS) | active |
| rpc | ❌ | RESERVED V1 (RPC-to-RPC graph = V2) |
| anon | ❌ | RESERVED V1 (anonymous client — discouraged) |
| edge_function | ❌ | RESERVED V1 (Edge Functions runtime — limited V1 use) |
| worker | ❌ | RESERVED V1 (BullMQ worker RPCs = V2) |
| frontend | ❌ | RESERVED V1 (direct frontend RPC discouraged, prefer backend) |
| authenticated | ❌ | RESERVED V1 (direct authenticated client discouraged, prefer backend) |

Test §4.5 RESERVED_V1 array enforces this — adding a `frontend` or `worker` access surface V1.5 requires updating both YAML + RESERVED_V1.

## SECURITY DEFINER expectations (V1 — 8 of 18 expected SD)

| RPC | securityDefinerExpected | Justification |
|---|---|---|
| __gov_m1_table_sizes | true | governance bypass RLS for pg_catalog access |
| __gov_m2_index_sizes | true | idem |
| __gov_m3_stale_stats | true | idem |
| build_vehicle_page_payload | true | cross-table join optimisation |
| get_piece_detail | true | catalog hot path |
| get_pieces_for_type_gamme_v3 | true | catalog hot path |
| get_pieces_for_type_gamme_v4 | true | catalog hot path |
| mark_order_paid_atomic | true | atomic payment (cross-table state mutation) |

V1 = boolean expectation only. **Deep security analysis** (does the RPC body actually need DEFINER? Are RLS bypasses intentional?) = V2 separate audit.

## V1 selection methodology

Heuristic regex-based dispatch from RPC name → domain + access surfaces :

```
^__gov_                  → D15 / [backend, service_role]
^__seo_|seo_             → D3  / [backend, service_role]
^__pg_gammes             → D14 / [backend, service_role]
^__cwv_|cwv_             → D10 / [backend, service_role]
^__rag_|rag_             → D6  / [backend, service_role]
piece|catalog            → D1  / [backend]
vehicle|compatibil       → D4  / [backend]
commerce|cart|order      → D11 / [backend]
blog|content             → D5  / [backend]
diagnostic|knowledge     → D7  / [backend]
import|etl               → D9  / [backend, service_role]
serving|view_            → D8  / [backend]
```

Each rule picks up to 3 RPCs per domain. `securityDefinerExpected` = exact L1 `securityDefiner` field (extracted from migration `CREATE FUNCTION ... SECURITY DEFINER`). Owner = `@ak125` universal default.

## Cross-contract test summary (20 cases passing)

| Test | Status | What it enforces |
|---|---|---|
| §4.1 schema integrity (13 sub-tests) | ✅ | Zod parse OK + 11 negatives (extra fields, UNKNOWN domain, malformed owner/id, id-name mismatch, empty/duplicate accessSurface, invalid enum, dup id, fixture positive) |
| §4.2 cross-contract L1 | ✅ | Every contract `id` exists in `audit/registry/rpc.json` (with `#sig:` suffix stripped for overloaded fns) |
| §4.3 cross-contract domains.yaml | ✅ | Every `domain` declared in domains.yaml |
| §4.4 cross-contract ownership.yaml | ✅ | Every `owner` appears as `owner:` in ownership.yaml |
| §4.5 accessSurface coverage | ✅ | Every non-reserved AccessSurfaceSchema value used by ≥ 1 RPC (2 used / 6 RESERVED V1) |
| §4.6 size warning | ✅ | `rpcs.length=18` < 100 soft threshold |
| §4.7 determinism | ✅ | Two consecutive `npm run rpc-contract:build` produce byte-identical schema.json |

## Anti-parallel-truth checklist (canon §46 Loi B)

- ✅ `DomainIdSchema` REUSED from `shared/domain.ts` + `.refine()` (UNKNOWN forbidden)
- ✅ `StatusSchema` REUSED from `shared/status.ts` (5 values)
- ✅ `OwnerIdSchema` REUSED from `shared/owner.ts` (PR-5 #519)
- ✅ `AccessSurfaceSchema` REUSED from `shared/access-surface.ts` (**PROMOTED to shared in PR-R prep commit e55ddfbf** — was previously private in db-contract.ts:35)
- ✅ L1 `RpcEntrySchema` shape consulted to align id format (`schema.name`)
- ✅ 13 L1 fields explicitly omitted: args, returnType, language, securityDefiner (raw L1 vs L2 expectation), searchPath, definedInMigrations, usedBy, parseMode, parseWarnings, parseError, schema (encoded in id), sourceConfidence, per-entry schemaVersion (V2 concerns)
- ✅ 0 inline enums for domain/status/owner/accessSurface

## Scope discipline (PR-R V1 explicitly OUT)

- SQL signature args / returnType → V2 (data exists in L1, but PR-R V1 = classification not signature)
- SECURITY DEFINER deep security analysis → V2 (boolean `securityDefinerExpected` only V1)
- RPC→RPC dependency graph → V2 cross-contract
- usedBy callsite cross-check → V2 cross-contract with runtime-topology.yaml
- RLS interaction analysis → V2 / db.yaml extension
- HTTP route auth gates → `capabilities.yaml` (canon roadmap)
- License / version policy → see dep-governance.yaml + future contracts
- Per-team owners → V2 (V1 uses `@ak125` universal default)

## Files shipped in PR-R

| Path | LOC | Role |
|---|---|---|
| `packages/registry/src/shared/access-surface.ts` | 45 | NEW shared (PROMOTED from db-contract.ts) |
| `packages/registry/src/canonical/rpc-contract.ts` | 130 | L3 Zod schema |
| `packages/registry/src/__tests__/rpc-contract.test.ts` | 280 | 20 test cases |
| `packages/registry/src/bin/build-rpc-contract-artifacts.ts` | 110 | L3 generator |
| `.spec/00-canon/repository-registry/rpc.yaml` | 195 | L2 canon YAML |
| `audit-reports/rpc-contract-v1-coverage-2026-05-14.md` | 130 | This file |
| `.github/workflows/audit.yml` (+1 step) | +11 | CI hookup |
| `.gitignore` (+1 line) | +1 | rpc.schema.json gitignored |
| `packages/registry/package.json` (+1 script) | +1 | build:rpc-contract |
| `package.json` (+1 script) | +1 | rpc-contract:build delegation |
| `packages/registry/src/index.ts` (+1 export, -1 dup) | +1/-1 | AccessSurfaceSchema shared export |
| `packages/registry/src/canonical/db-contract.ts` (refactor) | +3 -10 | AccessSurfaceSchema → alias of shared |

## V2 roadmap

Preconditions (mirror PR-3b §52-57 / PR-5b in canon):
1. PR-R merged + ≥ 3 green `audit.yml` runs on main with `rpc-contract:build` step.
2. No flaky test on `rpc-contract.test.ts`.
3. ≥ 1 contributor PR has touched `rpc.yaml` correctly.
4. Explicit V2 cadrage + new ADR if scope changes.

V2 candidate enrichments :
- Extend V1 sample from 18 → ~50 RPCs (still well under 100 soft threshold).
- Cover all 15 domains (V1 covers 8).
- Add SQL signature contract (args/returnType) — separate canon roadmap item.
- Deep SECURITY DEFINER audit (does RPC body justify DEFINER?).
- RPC→RPC dependency graph cross-contract.
- usedBy callsite cross-check with runtime-topology.yaml.
- Per-team owners (replace universal `@ak125`).

## Refs

- PR-R plan : in-chat (post PR-D analysis 2026-05-14)
- Canon series : `repository-contract-series-canon-20260514.md` §63 (RPC contract = 1st in roadmap)
- PR-2 #507 (architecture V1) + PR-3a #511 (db V1) + PR-5 #519 (runtime V1) + PR-D #523 (dep-governance V1)
- PR-W3 #512 (registry tests warn-only) + PR-W4 #513 (generator determinism evidence)
- ADR-058 (Repository Contract System)
