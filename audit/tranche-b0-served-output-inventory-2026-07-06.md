# Tranche B — B0: served-output-first baseline (read-only)

> **Read-only audit. Nothing mutated in runtime code.** No ast-grep rule, no reroute, no sink removal.
> Verified against git `origin/main` @ **`38363e9d6`** (2026-07-06), branch `audit/tranche-b0-served-output-inventory`.
> Method: 3 parallel read-only agents (served-output forward map · writer/provenance re-verify · non-obvious
> surfaces + reachability) + direct `file:line` verification of the served-vs-draft cache-projection question.
> **Extends / re-verifies:** [`audit/rag-seo-served-write-closure-design-2026-07-04.md`](rag-seo-served-write-closure-design-2026-07-04.md)
> (writer-first, ≥11 RAG sinks) and [`audit/p0-rag-runtime-and-version-truth-2026-07-04.md`](p0-rag-runtime-and-version-truth-2026-07-04.md) (landed SoT).
> **STOP after B0.** No B1–B5 without owner GO.

## 0. Why served-output-first (the denominator)

The prior work is **writer-first** (`RAG-reader → __seo_ table`). B0 inverts it: start from what a **public/indexable
page actually reads at render time**, then trace backward to every writer. This (a) proves which writers feed a
*served* page vs an internal artifact, (b) catches served content **without** the `__seo_` prefix, and (c) resolves
the design doc's open "served-vs-draft" question (its residual risk #5) with evidence instead of a safe over-broad assumption.

## 1. Served-output → read-source → writer matrix (the core deliverable)

Verdict legend: **SAFE_CANONICAL** (governed/derived, provenance OK) · **RAG_BYPASS** (a writer reads RAG and writes
this served table with no provenance refusal) · **DIRECT_WRITE_BYPASS** (served content written via a raw/direct
client or const-target *outside* the choke-point, not necessarily RAG) · **UNKNOWN_PROVENANCE** (served, writer not
proven to stamp/enforce provenance and source not established) · **DEAD** (write path, runtime reachability = 0) ·
**UNPROVEN_REACHABILITY** (served-vs-internal or reachability not established — flagged, not guessed).

| Served surface (public route) | Runtime read source(s) | Writer(s) → provenance / gate / flag (`file:line`) | Reachability | Verdict |
|---|---|---|---|---|
| **R1** gamme `/pieces/:slug` | `__seo_gamme.sg_content` (primary) · `__seo_r1_image_prompts` (`gamme-response-builder:280`) · `__gamme_page_cache` (proj) · `__blog_advice` | `sg_content` ← `admin-keyword-planner.controller:1351,1525` (reads RAG, **no-gate**, local `createClient`) · `__seo_r1_image_prompts` ← `r1-image-prompt.service:96` (reads RAG, **no-gate**) · cache ← `gamme-rpc.service:451-481` (derived) | live HTTP (generate-from-rag) + render | **RAG_BYPASS** (sg_content, image-prompts); cache = SAFE_CANONICAL (derived from sg_content) |
| **R2** product `/pieces/.../:type.html` | `__seo_gamme_car.sgc_content` · `__seo_gamme_car_switch` · `__seo_keywords` · `__seo_item_switch` · `__blog_advice`/`__blog_guide` | `__seo_gamme_car` writer **NOT traced** by the RAG-scoped pass (only script `clean-seo-database.js:130` seen). `__seo_r2_keyword_plan` (RAG sink 2, `r2-enricher:205`) is **internal**, not read at render. | render live | **UNKNOWN_PROVENANCE** for `__seo_gamme_car.sgc_content` (writer/source gap — B1 must trace) |
| **R3** conseil `/blog-pieces-auto/conseils/:pg_alias` | `__blog_advice` (main body, **non-prefix**) · `__seo_gamme_conseil` (overlay) · `__seo_item_switch` · `__seo_r3_image_prompts` (`blog-seo.service:357`) | `__seo_gamme_conseil` ← `conseil-enricher.service:2150` (reads RAG, **no-gate**, *stamps* `RAG_LEGACY` in `sgc_sources:2126`) · `__seo_r3_image_prompts` ← `r3-image-prompt.service:208` (reads RAG, no-gate) | render live | **RAG_BYPASS** (stamps provenance but writes anyway) |
| **R4** reference (`/api/seo/reference`, embedded R3/R6) | `__seo_reference` | `seo-generator.service:236` `saveR4Draft` (DB-sourced, `is_published:false` draft) + `R4ContentEnricherService` via `source='r4_batch'` (through the gate); r4 RAG-read is **dead for content** (`ragAvailable` flag only) | admin/generator HTTP | **SAFE_CANONICAL** (governed draft, published-gated; RAG read is non-writing) |
| **R6** guide-achat `/blog-pieces-auto/guide-achat/:pg_alias` | `__seo_gamme_purchase_guide` · `__seo_gamme_slots` · `__seo_r1_gamme_slots` (`purchase-guide-data:146,227`) · `__blog_advice` | `__seo_gamme_purchase_guide` ← `buying-guide-db.service:383` (*stamps* `RAG_LEGACY:92`, **local WriteGuard CAS** ≠ ContentWriteGate, fail-open after CAS) · `__seo_r1_gamme_slots` ← `r1-enricher:229` else (reads RAG, **fail-open**) | render live | **RAG_BYPASS** |
| **R7** brand hub `/constructeurs/:brand.html` | `__seo_r7_pages` · `__seo_type_switch` · `__blog_seo_marque` (path ambiguous) | `__seo_r7_pages` ← `r7-brand-enricher.service:883` **direct via `R7_TABLES` const, NOT in `GROUP_TABLE_MAP` → never gated**. R7 is **de-RAGged** (DB-sourced `BrandEditorialService`, p0-rag KEEP+CLEANUP) | admin HTTP + pipeline dispatcher | **DIRECT_WRITE_BYPASS** (outside choke-point; not RAG) |
| **R8** vehicle `/constructeurs/:brand/:model/:type.html` | `__seo_r8_pages.rendered_json` (gated `seo_decision∈{INDEX,REVIEW_REQUIRED}`) · `__vehicle_page_cache` (proj) | (a) `r8-vehicle-enricher.service:1369/1397` (reads RAG, **fail-open even flag ON**, new-page insert bypasses gate) → **RAG_BYPASS**; (b) RPC **`__seo_r8_publish_snapshot`** (`r8-parent-enrichment.service:184`, DEFINER, repoints `current_snapshot_id`, **no RAG**) → **DIRECT_WRITE_BYPASS** | (a) admin/pipeline; (b) BullMQ `r8-seed-run`+`r8-enrichment`+`seo-outbox-relay` self-loop | **RAG_BYPASS** + **DIRECT_WRITE_BYPASS** (two coexisting live R8 write systems) |
| **Blog** article/index/home-carousel (`__blog_*`) | `__blog_advice`, `__blog_guide` (**non-prefix served content**) | `blog-article-data.service:249/297/477`, `advice.service:465/710`, `guide.service:631`, `constructeur/glossary` — all via `TABLES` const, **outside choke-point**; RAG-read **not** flagged; **no provenance** | render live | **DIRECT_WRITE_BYPASS** + **UNKNOWN_PROVENANCE** (source not established) |
| **Diagnostic** `/diagnostic-auto`, `/calendrier-entretien` | `__diag_symptom/cause/system/safety_rule/maintenance_*` (**non-prefix**) · `__seo_observable` (gated `is_published`) | `__diag_*` writers **not traced** (governed canon ADR-032/033, likely wiki-sourced) · `__seo_observable` ← `seo-generator saveR5Draft:278` (DB draft, published-gated) | render live | `__seo_observable` = **SAFE_CANONICAL**; `__diag_*` = **UNKNOWN_PROVENANCE** (governed-canon assumption unverified) |
| **Home** `/` | `__blog_advice` (carousel) · structural via RPC `get_homepage_families` | `__blog_advice` (blog writers, above) | render live | **DIRECT_WRITE_BYPASS** (blog) |
| **Meta** `___meta_tags_ariane` (served SEO meta) | read on SEO surfaces | `seo.service:63` `updateMetadata` via `meta-tags-ariane-data.service` → reachable `PUT /api/seo/metadata` (`seo.controller:85`, **only `AuthenticatedGuard`, not admin**) | authenticated HTTP | **DIRECT_WRITE_BYPASS** (weak-auth, outside gate) |
| **Sitemap** `/sitemaps/*` | **static XML from disk** (no DB read at request) | offline generator `sitemap-v10.service` enumerates `__sitemap_*`,`__seo_page`,`__blog_*`,… | request = file read | **SAFE_CANONICAL** (request-time = static file) |

## 2. Served-vs-draft resolved (design-doc residual risk #5, closed with evidence)

- **SERVED (RAG content reaches an indexed page):** `__seo_gamme.sg_content` (R1), `__seo_r1_gamme_slots` (R6 via `purchase-guide-data:146`), `__seo_r1_image_prompts` (R1 render `:280`), `__seo_r3_image_prompts` (R3 render `:357`), `__seo_gamme_conseil` (R3), `__seo_gamme_purchase_guide` (R6), `__seo_r8_pages.rendered_json` (R8). → the design doc's "treat image-prompts as served" assumption is **confirmed correct** (they are read at render).
- **INTERNAL (RAG-written but NOT read by any public render):** `__seo_r2_keyword_plan` (sink 2), `__seo_r1_keyword_plan` (sink 11) — read only by their own enrichers + admin. RAG contaminates served content *indirectly* (they drive generation of `sgc_content`/`sg_content`), not by being served themselves.
- **DRAFT column, not served:** `__seo_gamme.sg_descrip_draft` (conseil sink 4) — R1 serves the published `sg_content`, admin edits the draft column.

## 3. Corrections & extensions vs the 2026-07-04 design doc

- **`r4-content-enricher` REMOVED from the sink list** (verified): RAG read is live but sets only `ragAvailable`; the sole write is a run-log `__seo_r4_batch_runs`; content is delegated to `skill:content-gen`. Not a served-write sink.
- **The 11 RAG sinks all still live** on current main (line numbers drifted; structure intact). No new RAG sinks found (3 candidates cleared: `seo-generator saveR4/R5Draft` = governed DB drafts; `execution-router` RAG-gen removed; `media-factory` reads).
- **The writer surface is bigger than "RAG sinks"** — B0 adds non-RAG **DIRECT_WRITE_BYPASS** writers the writer-first RAG grep never targeted: the **`__seo_r8_publish_snapshot` DEFINER RPC** (repoints served R8), **R7 fully un-gated** (`R7_TABLES`, not in `GROUP_TABLE_MAP`), **R8 satellite tables** (versions/fingerprints/similarity/queue/qa via `R8_TABLES`), **all `__blog_*` writers** (via `TABLES` const), **`___meta_tags_ariane`** (weak-auth `PUT /api/seo/metadata`), and the **BullMQ projection/outbox/seed loops**.
- **`ContentWriteGateService` "the ONLY entry point" is aspirational** — R7, R8 satellites, blog, meta, buying-guide all write outside it. It enforces ownership/CAS/regression only; **zero provenance awareness** (confirms it is the wrong lever for RAG closure).
- **`execute_sql` REMOVED** (good); `exec_sql` is read-only-gated (`validateReadOnlyQuery`). No arbitrary-SQL write surface against served tables in `backend/src`.

## 4. Reachability proofs (DEAD vs reachable — zero static callers is NOT enough)

- **R5_DIAGNOSTIC generic write dispatch** (`execution-router:421`) = **DEAD** (returns `status:'failed'`, 0 rows) across HTTP dispatcher, pipeline `/enqueue`, BullMQ, dynamic registry, CLI. *But* `__seo_observable` remains reachable-via `seo-generator saveR5Draft` HTTP → table reachable, router-path DEAD.
- **R4 generic dispatch** (`:381`) = DEAD, but reachable-via `source='r4_batch'` + `saveR4Draft`.
- **`pipeline-chain` `db_trigger` branch** (`pipeline-chain.processor:62`) = **dead code branch** (poller `PipelineChainPollerService` deleted, no producer); the queue itself is reachable-via the two `/enqueue` controllers.
- **Enricher direct-write ELSE fallbacks** (`r1-enricher:229`, `conseil-enricher:2700`) = **NOT dead** — reachable-via env flag `WRITE_GUARD_ENABLED=false` (default `true`, so normally dormant, not statically dead).
- **`SeoProjectionWriterService`** (writes `__seo_entity_facts`/`__seo_content_blocks`) = **NOT dead** — nightly feeder flag OFF but reachable-via admin HTTP `POST /api/admin/seo-projection/feed/trigger` (bypasses flag) → BullMQ `projection-write`.
- **`seo-outbox-relay`** registers a repeatable BullMQ job **unconditionally** at `onModuleInit` (no enable-flag) → self-drives the R8 snapshot write loop in PROD once seeded (READ_ONLY-gated at processor).
- **`@Cron` inert monorepo-wide** (`@nestjs/schedule` disabled); all scheduling via BullMQ.
- **dryRun default is load-bearing safety** (Zod `default(true)` at both pipeline controllers + router `?? true`), **except** the BullMQ processor `dryRun ?? false` (`pipeline-chain.processor:89`) — reachable to WRITE only if a producer explicitly sets `dryRun:false`.
- **20+ manual scripts** write served `__seo_*` tables (CLI-only; **none** wired to `package.json`/CI/cron/SKILL.md; several psycopg2/PostgREST/`.sql` are dry-run gated). Out-of-process → closable only by a DB-layer REVOKE (design-doc Layer 3, owner-gated).

## 5. Honest gaps (UNPROVEN — for B1 to close, not guessed here)

1. **`__seo_gamme_car.sgc_content` (R2 served content) writer + provenance NOT traced** — the RAG-scoped pass only mapped `__seo_r2_keyword_plan`. B1 must trace who writes R2's served content and its source.
2. **`__blog_*` provenance/source** — writers found (direct, outside gate) but whether their content is editorial/wiki/RAG is **not established**. Non-prefix served content is a first-class part of the denominator.
3. **`__diag_*`** content writers not traced (assumed governed canon ADR-032/033 — unverified).
4. **`__blog_seo_marque`** served path on R7 (`/api/blog/marque/:id`) is **inferred, not line-verified**.
5. **`__seo_entity_facts` / `__seo_content_blocks`** (projection-write loop) — **served-vs-internal UNPROVEN**: no public render read was found, but they are called "served projection" tables; classify before acting.
6. Internal base-table lists of SECURITY-DEFINER cache/homepage RPCs (`get_gamme_page_data_cached`, `rm_get_page_complete_v2`, `get_homepage_families`) read from callsites/migrations, not each function body.

## 6. What B0 establishes (and what it does NOT do)

**Establishes:** the real served denominator (11 public surfaces incl. 3 non-`__seo_` content families: `__blog_*`,
`__diag_*`, + cache projections), each served table's writer(s), and a verdict per path. **RAG_BYPASS confirmed on
R1/R3/R6/R8 served content** (7 served tables); **DIRECT_WRITE_BYPASS** on R7, R8-snapshot, blog, meta; **provenance
gaps** on R2 content, blog, diag.

**Does NOT do (owner-gated, B1+):** no ast-grep rule, no writer reroute, no `ContentWriteGate` change, no sink
removal, no flag flip, no DB migration. Those are B1–B5, each their own owner-GO'd PR.

_Deliverable of B0 = this matrix + gaps. STOP._
