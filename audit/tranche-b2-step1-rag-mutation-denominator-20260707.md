# Tranche B2 · Step-1 — RAG-source → mutation denominator (READ-ONLY audit snapshot)

```
Status:            READ_ONLY_AUDIT_SNAPSHOT
Canonical:         NO
Runtime change:    NONE
B2 authorization:  NONE
Date:              2026-07-07
Method:            5 parallel read-only Explore agents, whole codebase, keyed on RAG SOURCE (not destination)
Scope note:        NOT limited to the 4 historically-known sinks. Evidence = file:line.
```

> Step-1 of **B2 = ELIMINATE RAG AS CONTENT PRODUCER**. Invariant: RAG has zero content-write
> authority; a RAG→content writer is an architectural violation to REMOVE + re-source from WIKI,
> not to gate/secure. Criterion for ILLEGAL: RAG-retrieved data influences a PERSISTED mutation
> toward a table consumed by an R page / a projection / editorial content. LEGAL: RAG→chat,
> RAG→index build, RAG→audit-log, read-time-only.

## Verdict

```
RAG_MUTATING_FLOWS_TOTAL     = 16
  ILLEGAL_CONTENT_PRODUCERS  = 8    (B1..B8 — RAG → served/editorial content table)
  INGESTION_INDEX (legit)    = 4    (RAG/RAW/WIKI → RAG index / corpus / proposals)
  READ_TIME_ONLY             = 1    (diagnostic → __diag_session request log)
  AUDIT_ONLY                 = 3    (phase2a, r4-batch-runs, __rag_content_refresh_log)
CHAT_ONLY (retrieval, no persist) = 1  (rag-chat → /chat/v2)
UNKNOWN_PROVENANCE           = 1    (agentic apply — external MCP agent, RAG-derivation off-repo)
```

### Readiness — TWO distinct notions (do NOT collapse into "READY_TO_REMOVE")

`READY_TO_REMOVE = []` is **rejected as a definitive statement** — it smuggles back "legacy is
necessary today, therefore temporarily legitimate", the exact reasoning the invariant forbids.
Removing a RAG writer does **not** imply `DELETE` of existing content: existing rows can stay
served **static** while new RAG enrichment **stops** — that IS the fail-closed behavior
(`no canonical projection → no NEW content`; never `→ keep producing from RAG`). So readiness
splits into two independent questions, evaluated per flow:

- **(A) Can the writer be removed without breaking the CURRENT render?** (existing content left
  static, served as-is). Blocker here = **operational dependency**, NOT freshness: does a consumer
  depend on synchronous generation? does a job/queue require this writer to proceed? does removal
  break a workflow other than content freshness? — **not yet proven** in Step-1 (Step-1 closed
  provenance, not operational dependency).
- **(B) Can NEW content still be produced after removal?** Blocker = **canonical freshness** (a
  RAW/WIKI→projection→served path). This is what View C measures.

```
READY_TO_CUTOVER_WITH_CANONICAL_FRESHNESS = []      (question B — no live canonical path feeds any served consumer yet)
REMOVAL_RUNTIME_DEPENDENCY_NOT_YET_PROVEN = [B1, B2, B3, B4, B5, B6, B7, B8]   (question A — must be closed before asserting any writer is un-removable)
ILLEGAL_WRITERS_THAT_MUST_LOSE_WRITE_AUTHORITY = [B1, B2, B3, B4, B5, B6, B7, B8]
```

Freshness-replacement buckets (question B, from View C):
```
NEEDS_CANONICAL_REWIRE  = [R3_conseil, R6_purchase_guide, R8_vehicle]   (producer EXISTS but dark/parallel)
NEEDS_CANONICAL_SOURCE  = [R1_sg_content, R1_slots, R2_section, R1_img_prompts, R3_img_prompts]  (no producer)
ALREADY_CLEAN (no RAG writer) = [R4_reference, R7_brand]   (cleanup residual RAG vocab only)
```

---

## View A — Denominator (all RAG entrypoints → mutation reach)

| RAG entrypoint | what it does | persists? | verdict |
|---|---|---|---|
| `rag-chat.service` /chat/v2 | chatbot answer | no | CHAT_ONLY |
| `rag-knowledge`(`.search`/`append_gamme_alias`), `rag-cleanup`, `rag-normalization`, `rag-admissibility-gate`, `rag-gamme-detection`, `rag-webhook-completion` | build/maintain RAG index | `__rag_knowledge` (+jobs/audit) | INGESTION_INDEX |
| `rag-md-merger` (+ `pdf-rag-classifier` LLM) | merge patch into RAG corpus | `gammes/{alias}.md` corpus file | INGESTION_INDEX |
| `vehicle-rag-generator.generateForModel` | synthesize vehicle RAG .md **from DB** | `vehicles/{slug}.md` + `__rag_proposals` | INGESTION_INDEX (output read-back by B8 → laundered) |
| `rag-proposal.propose` | RAG-repo proposal store | `__rag_proposals` | INGESTION_INDEX |
| diagnostic `rag-enrichment.engine.search` | R5 evidence facts | `__diag_session.result` (request log) | READ_TIME_ONLY |
| `rag-phase2a-shadow-audit` | shadow audit | `__phase2a_audit_reports` | AUDIT_ONLY |
| `r4-content-enricher.loadRagFile` | boolean ragAvailable only | `__seo_r4_batch_runs` (audit) | AUDIT_ONLY / DELEGATED |
| conseil `__rag_content_refresh_log` | change-detection log | audit table | AUDIT_ONLY |
| **8 enrichers/readers (B1–B8)** | RAG text → served content | served `__seo_*` | **ILLEGAL (§B)** |
| `agentic` apply | external Claude-Code agent "fetches RAG…writes via MCP" | `human_approval`/evidence only (backend) | UNKNOWN_PROVENANCE |
| non-violations: `r7-brand-enricher` (de-RAGged ADR-031/046), `page-brief`, `brand-editorial`, `seo-projection-writer` (wiki-fed), `r8-parent-enrichment` (structural), `rag-image-management` (admin URL) | persist but **no RAG read** | served/index | NO_RAG_READ / NOT_RAG_FED |
| dead/unwired: `rag-ingestion`, `rag-web-ingest-db`, `rag-pipeline` (removed from DI); `section-compiler` (0 consumers) | — | — | DEAD |

## View B — Illegal flows (RAG read → persisted served-content mutation)

Shared boundaries: **(a)** `ContentWriteGate.writeToTarget → ContentWriteExecutor.execute`
(`content-write-executor.service.ts:197/220`, UPDATE-then-INSERT, target-agnostic via
`GROUP_TABLE_MAP`, **NO provenance check** — persists whatever the enricher composed); **(b)**
direct Supabase `.upsert` in controller/service (bypasses the gate). Indirection spine:
`admin-pipeline`/`internal-pipeline` controller → `pipeline-chain` BullMQ processor **or** sync →
`ExecutionRouterService.dispatchSingle` → enricher.

| # | FLOW_ID | rag_source (file:line) | mutation boundary (file:line) | target | consumer | View-C |
|---|---|---|---|---|---|---|
| B1 | RAG_WRITE_R1_SG | `r1-content-from-rag.service.ts:43-45` (via rag-gamme-reader) | **direct upsert, bypasses gate** `admin-keyword-planner.controller.ts:1351-1360` (single, dry_run=false default → writes) & `:1525-1532` | `__seo_gamme.sg_content` | R1 | NEEDS_CANONICAL_SOURCE |
| B2 | RAG_WRITE_R1_SLOTS | `r1-enricher.service.ts:80-88` | `.upsert :229-231` OR `writeGate :211-217` | `__seo_r1_gamme_slots` | R1 | NEEDS_CANONICAL_SOURCE |
| B3 | RAG_WRITE_R2_KP | `r2-enricher.service.ts:93-100` | `writeGate :186` OR `.upsert :204-206` | `__seo_r2_keyword_plan.r2kp_section_content` | R2 | NEEDS_CANONICAL_SOURCE |
| B4 | RAG_WRITE_R1_IMG | `r1-image-prompt.service.ts:53-54` | `.upsert :95-97` | `__seo_r1_image_prompts` | R1 | NEEDS_CANONICAL_SOURCE |
| B5 | RAG_WRITE_R3_IMG | `r3-image-prompt.service.ts:442-450` | `.upsert :207-209` | `__seo_r3_image_prompts` | R3 | NEEDS_CANONICAL_SOURCE |
| B6 | RAG_WRITE_CONSEIL_R3 | `conseil-enricher.service.ts:348` `getKnowledgeDoc` + disk `:823` + `rag-md-merger:478` | `.upsert :2150-2152`; `writeGate :2680`; `update __seo_gamme :2698`; `upsert __seo_r3_keyword_plan:507` | `__seo_gamme_conseil` (+`sg_descrip_draft`) | R3 | **NEEDS_CANONICAL_REWIRE (first slice)** |
| B7 | RAG_WRITE_PURCHASE_GUIDE | `buying-guide-rag-fetcher.service.ts:73,105` + disk `:712-720` | `.update buying-guide-db.service.ts:381-384` | `__seo_gamme_purchase_guide` | R6 + R1 + R8 | NEEDS_CANONICAL_REWIRE |
| B8 | RAG_WRITE_R8_VEHICLE | `r8-vehicle-enricher.service.ts:554,574-582` (.md synth from DB by vehicle-rag-generator:190 then read back) | `.upsert R8_TABLES.pages :1396-1398` OR `writeGate :1379`; `+versions:1427` | `__seo_r8_pages.content_main` | R8 | NEEDS_CANONICAL_REWIRE (partly DB-laundered) |

Gating weaknesses (runtime truth): `READ_ONLY=false` (default) is the ONLY hard block on B1–B8.
`WRITE_GUARD_ENABLED` (default true) only routes/CAS. `RAG_MERGE_DRY_RUN` default true is an
**ORPHAN** (consumed nowhere). `ragMergeAllowedRoles` filters only `source==='db_trigger'` →
`api`/`manual` pipeline jobs bypass the scope filter. B1 single endpoint writes by default.

## View C — Canonical replacement state (does a RAW/WIKI→projection producer already exist?)

Canonical machinery EXISTS but is DARK/parallel: WIKI `build_exports_seo.py` emits
`exports/seo/<entity>/<slug>.json` (roles: gamme→R3/R4/R6, vehicle→R8, constructeur→R7,
diagnostic→R3 — **no R1_ROUTER, no R2_PRODUCT, no image-prompt block**); `seo-projection-writer`
projects them through `SeoProjectionGate` into **NEW versioned `__seo_entity_facts`/
`__seo_content_blocks`** (NOT the served `__seo_*` tables); feeder `seo-projection-feeder`
discovers **only gamme exports**, flag `SEO_PROJECTION_R1_FEED_ENABLED` OFF; read overlay (PR-7b)
unbuilt, read flag `seo_projection_read_v1` OFF; only in-code reader = OFF admin `seo-brief.service.ts:213`.

| content_type | served_table | producer? | blocker for question B (freshness) |
|---|---|---|---|
| R1 sg_content + section-pack | `__seo_gamme` | MISSING (no R1_ROUTER emit) | need R1 block emission + read repoint |
| R1 slots | `__seo_r1_gamme_slots` | MISSING | idem |
| R2 section content | `__seo_r2_keyword_plan` | MISSING (no R2_PRODUCT emit) | idem |
| R1/R3 image prompts | `__seo_r{1,3}_image_prompts` | MISSING (0 coverage in export schema) | entire pipeline absent |
| R3 conseil | `__seo_gamme_conseil` | **PARTIAL (strongest)** — R3 emitted + reader exists (dark) | projection→parallel table; flags OFF; repoint served table |
| R6 purchase_guide | `__seo_gamme_purchase_guide` | PARTIAL — R6 emitted | lands in `__seo_content_blocks`; no reader repoint |
| R8 vehicle | `__seo_r8_pages` | PARTIAL — vehicle→R8 emitted but feeder gamme-only | feed vehicle exports + build read overlay |
| R4 reference | `__seo_reference` | EXISTING (non-RAG, RPC-driven) | none — verify residual RAG import |
| R7 brand | `__seo_r7_pages` | EXISTING (non-RAG, `__seo_brand_editorial`) | none — rename stale BrandRag vocab |
| diagnostic | `__seo_observable`/`__diag_*` | engine-owned, retrieval-only | not a RAG content writer |

## Coverage / honesty
- CONFIRMED (chain traced): B1–B8; B1/B2/B3/B6/B7/B8 cross-confirmed by 2 agents.
- `conseil-enricher.service.ts` (93 KB) not fully line-read; both write boundaries + RAG read confirmed.
- R8 "RAG" content is partly **DB-laundered** (vehicle .md synthesized from DB then read back).
- UNKNOWN: agentic apply — external MCP agent RAG-provenance not confirmable from backend (gated OFF + human-approval).
- Companion audits on this branch: `tranche-b0-served-output-inventory-2026-07-06.md`, `tranche-b1a-enforcement-ownership-2026-07-06.md`.
- NO file edited outside this audit doc. No writer/gate/flag/projection/baseline/RAW/WIKI touched. B2 not authorized.

## NEXT (owner-gated)
First canonical cutover = **R3 conseil** (best complete structural closure: WIKI producer ✅ export R3 ✅
projection infra ✅ consumer R3 ✅ RAG writer identified ✅ replacement ⚠️ dark). Next work = **B2-R3A**,
strictly read-only, R3-only field mapping (`WIKI accepted → export R3 → projection → current served
`__seo_gamme_conseil` contract → rendered sections`), verdict per field
`DIRECT_MAP | TRANSFORM_EXISTING | MISSING_CANONICAL_SOURCE | LEGACY_UNUSED`, result
`CANONICAL_PATH_COMPLETE=y/n`, `NEW_LAYER_REQUIRED=y/n` (yes needs STRONG proof — reuse the existing
served table as the projection sink before inventing any overlay/reader/second table). **No generic
Step-4a platform.** Writer deletion = separate owner GO.
