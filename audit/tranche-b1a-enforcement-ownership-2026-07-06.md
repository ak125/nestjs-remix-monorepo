# Tranche B — B1a: close the unknowns + enforcement-ownership matrix (read-only)

> **Read-only. Nothing mutated.** No ast-grep rule, no reroute, no `ContentWriteGate` change, no removal, no flag flip.
> Verified against git `origin/main` @ **`38363e9d6`** (2026-07-06). Method: 4 parallel read-only agents
> (provenance-close · served-vs-internal · metadata authz · R8 loop) + B0 forward map.
> Continues [`audit/tranche-b0-served-output-inventory-2026-07-06.md`](tranche-b0-served-output-inventory-2026-07-06.md). **STOP after B1a.**

## 0. Purpose (owner steer)

B0 proved `ContentWriteGate` **cannot** be a universal choke-point (writes happen via app services, DEFINER RPC,
BullMQ/outbox, HTTP endpoints, blog CRUD, offline generators, SQL migrations). B1a therefore (a) promotes **every**
residual `UNKNOWN_PROVENANCE` / served-vs-internal gap to a **proven class**, and (b) derives a **served-path →
enforcement-owner** matrix — *one canonical boundary per mechanism*, not one implementation for all. No enforcement
is built here; that is B1b+.

## 1. Every B0 unknown → proven class

| B0 gap | Resolution (proof) | Reads RAG? | Class |
|---|---|---|---|
| **R2 `__seo_gamme_car.sgc_content`** | **No `backend/src` writer.** Per-gamme **DB template** (`#Vxxx#` tokens) migration-seeded (`20251231_update_alternateur_seo_template.sql:13`, `backend/sql/012:68`), substituted at render via `process_seo_template` (`20260118_rm_get_page_complete_v2.sql:145-162`). R2 enricher reads RAG but writes only internal `__seo_r2_keyword_plan` (`r2-enricher:205`). | No | **SAFE_CANONICAL** (DB template) |
| **`__blog_advice`/`__blog_guide` content** | Content write = admin editorial CRUD `@Patch` (`advice.controller.ts:147` `IsAdminGuard` → `advice.service.ts:710`) + **legacy import** (no seed migration in repo). Blog-module RAG refs are **read-side sanitizers stripping legacy RAG** (`r6-guide.service.ts:251`, `r3-guide.service.ts:428`). `__blog_guide` = **no content writer** (legacy read-only). Create-via-HTTP path **UNPROVEN** (internal callers only, no `@Post`). | No | **DIRECT_WRITE_BYPASS (editorial)** |
| **`__diag_*` content** | Migration-seeded governed canon (`20260308_diagnostic_engine_mvp.sql:101+`, `20260321…:12+`), evidence-modeled (ADR-032/033). Runtime is read-only (`diagnostic-engine.data-service.ts:77-236`); `:285` writes `__diag_session` log only. `RagEnrichmentEngine` = response-only, 0 DB writes. Doc origin = RAG-aligned markdown transcribed **once by a human** into SQL. | No | **SAFE_CANONICAL** (governed canon) |
| **`__blog_seo_marque` (R7)** | B0-assumed `/api/blog/marque/:id` path is **DEAD** (no caller, no controller). Real served path = RPC `get_brand_page_data_optimized` (`20260101_fix_brand_page_urls.sql:156-164`, anon-granted) → `bsm_content` rendered on R7 hub (`constructeurs.$brand[.]html.tsx:960`). **No runtime writer** — legacy-migrated (`bsm_*`). | No | **SERVED, legacy (DB-layer)** |
| **`__seo_entity_facts` / `__seo_content_blocks`** | **INTERNAL-projection, NOT served.** Zero base-table readers; MVs read only by RPC `get_active_seo_projection` (anon-REVOKED) whose only caller is flag-OFF admin brief tooling (`seo-brief.service.ts:213`); read-path dark (`seo_projection_read_v1` OFF). Written by `SeoProjectionWriterService` from **governed WIKI exports** (`content/automecanik-wiki/exports/seo/gamme/*.json`) through `SeoProjectionGate` (ADR-088/089), flag `SEO_PROJECTION_R1_FEED_ENABLED` OFF. | No | **INTERNAL, canonical (projection gate)** |

**Net:** no new live RAG-writer of served content beyond the 11 tracked sinks. Two gaps are governed-canon, one is
admin-editorial, one is legacy-served, one is the (dark) canonical WIKI-projection direction. **Denominator complete.**

## 2. Served-path → enforcement-owner matrix (the deliverable)

> Rule: **each write path has exactly ONE canonical enforcement boundary matched to its mechanism.** Not a universal choke-point.

### Owner ① — app write choke-point (`ContentWriteGate` + required provenance + **refuse-RAG**) → Class A, close first
These read the RAG store and write **served** content with no provenance refusal. Target: refuse on RAG provenance (fail-closed, flag-independent).

| Served table | Writer (`file:line`) | Current fail mode | Target |
|---|---|---|---|
| `__seo_gamme.sg_content` (R1) | `admin-keyword-planner.controller:1351,1525` (local `createClient`) | no-gate | route through gate, refuse RAG |
| `__seo_r1_image_prompts` (R1 render) | `r1-image-prompt.service:96` | no-gate | add to `GROUP_TABLE_MAP`, refuse RAG |
| `__seo_gamme_conseil` (R3) | `conseil-enricher.service:2150` (stamps `RAG_LEGACY`) | no-gate | refuse RAG |
| `__seo_r3_image_prompts` (R3 render) | `r3-image-prompt.service:208` | no-gate | refuse RAG |
| `__seo_gamme_purchase_guide` (R6) | `buying-guide-db.service:383` (stamps `RAG_LEGACY`, own CAS) | fail-open after CAS | refuse RAG at its boundary |
| `__seo_r1_gamme_slots` (R6 render) | `r1-enricher:229` else | fail-open | refuse RAG |
| `__seo_r8_pages` (R8, existing-row) | `r8-vehicle-enricher:1369/1397` | fail-open **even flag-ON**; new-page insert bypasses gate | refuse RAG + close insert fall-through |

### Owner ② — app boundary for a **de-RAGged direct writer** (Class B, not RAG)
| `__seo_r7_pages` (R7) | `r7-brand-enricher:883` direct via `R7_TABLES`, **not in `GROUP_TABLE_MAP` → never gated**; DB-sourced (`BrandEditorialService`) | **DIRECT_WRITE_BYPASS** | give R7 a canonical boundary (provenance + gate); content KEEP (not RAG) |

### Owner ③ — DB/RPC publish boundary (Class B legitimate publisher — **KEEP + HARDEN**)
| `__seo_r8_pages.current_snapshot_id` | RPC `__seo_r8_publish_snapshot` (`r8-parent-enrichment:184`), DEFINER, `service_role`-only, DB/deterministic-sig source | served row **idempotent** (0-byte churn) | KEEP; harden the **loop** (see §4) |

### Owner ④ — authz boundary (**separate P0**, see §3)
| `___meta_tags_ariane` | `PUT /api/seo/metadata` + `POST /api/seo/batch-update` (`seo.controller:86,225`) | `AuthenticatedGuard` only (any customer) | swap to `IsAdminGuard`/`AdminSessionGuard` |

### Owner ⑤ — projection gate (already canonical — **KEEP**)
| `__seo_entity_facts`, `__seo_content_blocks` | `SeoProjectionWriterService` ← WIKI exports, via `SeoProjectionGate` (ADR-088/089), read-path dark | INTERNAL | KEEP (this is the intended canonical direction) |

### Owner ⑥ — governed app draft path (already SAFE — **KEEP**)
| `__seo_reference` (R4), `__seo_observable` (diagnostic) | `seo-generator saveR4Draft:236` / `saveR5Draft:278`, DB-sourced, `is_published` gated | published-gated | KEEP |

### Owner ⑦ — DB-layer (out-of-process; closable only by DEFINER-RPC + REVOKE, owner-gated Layer 3)
| `__seo_gamme_car` (R2 template), `__diag_*`, `__blog_seo_marque` (legacy), **20+ manual scripts** | SQL migrations / manual `.sql`/`.js` / legacy import | governed/legacy | KEEP content; out-of-process writes closable only at DB layer (owner GO) |

### Owner ⑧ — editorial/admin CRUD boundary (**KEEP**, verify create path)
| `__blog_advice`/`__blog_guide` | admin `@Patch` (`IsAdminGuard`) + legacy | editorial | KEEP; **B1b: prove the `createArticle`/`createAdvice` HTTP reachability** (currently no `@Post`) |

### Owner ⑨ — offline pipeline (**KEEP**)
| sitemaps (`__sitemap_*`, `__seo_page`, …) | offline `sitemap-v10` generator; request-time = static XML | n/a | KEEP |

## 3. Metadata authz — CONFIRMED real-authz P0 (isolated PR, owner-gated)

`PUT /api/seo/metadata` + `POST /api/seo/batch-update` are guarded by **`AuthenticatedGuard` only** (`authenticated.guard.ts:13`
= `request.isAuthenticated()`, no role/level). **Public self-registration** (`POST /auth/register` → auto-login, level-1
customer) yields a qualifying session → **any outsider** can mutate served metadata of **arbitrary** indexed pages
(`mta_alias` from caller `page_url`; **no `ZodValidationPipe`/`ValidationPipe`**): `meta_title/descrip/h1/breadcrumb`,
and **`rel_follow` (robots → `noindex` sabotage)**. PROD service-role write persists; consumed by R8 vehicle meta,
breadcrumbs, title/desc. **UNPROVEN sub-detail:** `mta_alias` UNIQUE constraint (clean-overwrite vs duplicate-row
denial) — needs DB check; **both branches exploitable**. **Fix (small, isolated):** `IsAdminGuard`/`AdminSessionGuard`
on the mutating routes; reconsider the analytics reads (`:163/:201`). **Do NOT fold into content-governance commits.**

## 4. R8 autonomous loop — reconstructed (KEEP + HARDEN, operational, not content-corruption)

`seed (POST /api/admin/seo/r2/r8-seed/run, IsAdmin, dryRun default **false**) → r8-seed-run → R8SnapshotSeedService
walk → enrichTypeId → RPC __seo_r8_publish_snapshot → INSERT __seo_outbox_event (unconditional, "even on idempotent
re-runs", 20260517_…rpc.sql:101) → seo-outbox-relay (repeatable every **5 s**, registered unconditionally at
onModuleInit, **no enable-flag**) → re-enqueue r8-enrichment → …forever.` Only `READ_ONLY=true` (PREPROD, **not** PROD)
suppresses it. **Served row idempotent** (`current_snapshot_id` `IS DISTINCT FROM` → 0-byte churn after convergence).
**Liability = `__seo_outbox_event` unbounded growth + permanent RPC/write storm** (~≤20 ev/s) once seeded in PROD; a
single `POST {idempotencyKey}` arms it. Two **stale/false comments** (self-loop "reserved" but live; RPC "INSERT if
missing" but UPDATE-only → new type_ids get no pages row). **Harden:** loop-termination / outbox retention+GC / an
enable-flag / fix comments — **DB/RPC + queue owner**, distinct from RAG closure. (Merits P0 operational attention.)

## 5. Residual UNPROVEN (honest — for B1b, small)

1. `__blog_advice`/`__blog_article` **create-via-HTTP** reachability — no `@Post` found; internal callers only. Prove dead or gate.
2. `mta_alias` UNIQUE constraint (metadata P0 persistence branch) — DB check.
3. Cache/homepage DEFINER RPC internal base-table lists (read from callsites/migrations, not each function body).

## 6. Recommended sequencing (NOT started — owner-gated)

Denominator is now complete, so enforcement can be scoped honestly:
- **P0-security (isolated):** metadata authz guard fix (§3).
- **B1b:** mechanical prevention (ast-grep **warn-first** + non-static audit + 0-new-sink) scoped to the **B0+B1a** perimeter, covering *separately* direct-table writes, RPC publishers, dynamic const targets, SQL, helpers, queue processors — no single AST pattern claims to see all.
- **B2 (Class A):** RAG served-write closure — refuse RAG provenance at Owner-① boundaries (R1/R3/R6/R8 enricher), flag-independent.
- **B3 (Class B):** canonicalize direct writers — R7 boundary; R8-snapshot loop harden (§4).
- **B4:** remove fail-open `else` / legacy branches.
- **B5:** retire only **runtime-proven** dead dispatch (R4/R5 generic, `pipeline-chain db_trigger`) — **dead dispatcher ≠ dead table**; never remove a table/surface reachable via another path.

_B1a deliverable = §1 resolved classes + §2 enforcement-owner matrix + §3 P0 + §4 loop. STOP._
