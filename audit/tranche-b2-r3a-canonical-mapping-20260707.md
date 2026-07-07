# Tranche B2 · R3A — R3 conseil canonical-path field mapping (READ-ONLY audit snapshot)

```
Status:                          READ_ONLY_AUDIT_SNAPSHOT
Canonical:                       NO
Runtime change:                  NONE
B2 implementation authorization: NONE
Date:                            2026-07-07
Method:                          3 read-only Explore agents. WIKI read at origin/main `fafef0f` (checkout was
                                 on a feature branch → read via `git show origin/main:`). No code touched.
```

> R3-only field mapping BEFORE any writer removal. Chosen first family because it is the strongest PARTIAL
> (WIKI producer ✅ export R3 ✅ projection infra ✅ consumer R3 ✅ RAG writer identified ✅). Reuse-before-create;
> strong proof required before asserting any new component. Follows Step-1 (B6 = the R3 illegal producer
> `conseil-enricher`).

## Conclusion (exact)

```
CANONICAL_PATH_COMPLETE         = NO
DOMINANT_BLOCKER                = CANONICAL_CONTENT_COVERAGE   (WIKI lacks R3's served procedural sections)
R3_SHAPE_TRANSLATION_REQUIRED   = YES                          (slug→pg_id, section→S-code, title/order, provenance reshape)
IMPLEMENTATION_LOCATION         = UNDECIDED                    (could live in existing build_exports_seo.py / seo-projection-writer / another canonical export point)
NEW_READER_REQUIRED             = NO                           (R3 already reads __seo_gamme_conseil)
NEW_GENERIC_OVERLAY_REQUIRED    = NO                           (forbidden AND unnecessary)
NEW_LAYER_REQUIRED              = NOT_PROVEN                   (do NOT commit to a new "R3 adapter" — that could be the compensation layer we avoid)
```

The mapping proves a **shape translation** is needed; it does NOT prove a **new component** is needed. Where
the translation belongs (existing export builder, existing projection writer, or elsewhere on the canonical
path) is deliberately left UNDECIDED — deciding now risks adding the exact compensation layer B2 exists to remove.

## Served contract (CURRENT_LIVE) — `__seo_gamme_conseil`
- Read: `conseils.$pg_alias.tsx:152` → `/api/r3-guide/:alias` → `R3GuideService` → `blog-seo.service.ts:188`
  SELECT `sgc_title, sgc_content, sgc_section_type, sgc_order, sgc_quality_score, sgc_sources` WHERE `sgc_pg_id`.
- **ROW-PER-SECTION**, unique key `(sgc_pg_id INT, sgc_section_type)`, flat, upsert-in-place, no version/hash
  (enricher `onConflict:'sgc_pg_id,sgc_section_type':2152`).
- Rendered S-taxonomy (`ConseilSections.tsx:58-107`): S1, S2, S3, **S4_DEPOSE/S4_REPOSE (steps)**, **S5 (danger)**,
  S6 (checklist), **S7 (parts)**, S8 (faq), S_GARAGE, S2_DIAG, META.
- 6 LEGACY_UNUSED columns (never read at serve): `sgc_constructeur_mentions, sgc_eeat_sources, sgc_enriched_at,
  sgc_enriched_by, sgc_pack_level, sgc_safety_notes`.
- Foreign-sourced R3 page sections (NOT this table): hero/nav = blog `BlogArticle`; images = `__seo_r3_image_prompts`;
  meta = `__seo_r3_keyword_plan`; R6 crosslink = `__seo_gamme_purchase_guide`; R4 card = `__seo_reference` (separate
  deferred fetch). S2_DIAG is a conseil ROW at serve-time (composed from `__seo_observable` at WRITE time).
- RAG producer `conseil-enricher.service.ts:2137-2152` stamps `sgc_sources=[{type:'rag-legacy',ref:'gammes/<alias>.md',field}]`.

## Canonical input (WIKI accepted → export R3 → projection)
- `build_exports_seo.py` gamme→R3_CONSEILS emits blocks keyed by free-string `section` ∈ {`maintenance`
  (from `maintenance.educational_advice`), editorial `function, failure_symptoms, maintenance_interval,
  replacement_guidance, faq`} — zero-filler skip if no content/source. **NOT the served S-taxonomy.**
- Real sample `exports/seo/gamme/filtre-a-air.json` @origin/main = **ONE** R3 block, `section:"maintenance"`,
  one sentence, `source_ids:["raw:recycled"]`, `truth_level:"editorial"`.
- Projection `seo-projection-writer` → `__seo_content_blocks`(+versions): 2-tier versioned, PK
  `block_id=entity_id#role#block_kind` (entity_id = wiki SLUG), `content` **jsonb** {content_md, source_ids,
  truth_level, section, usefulness_target}, `block_kind=slug(section)`; INSERT-new-version + flip; no title,
  no int order, no S-code.
- GAP-1: diagnostic S2_DIAG has NO structured WIKI mapper (stub); 0 diagnostic exports at origin/main.
  GAP-2: block `source_ids` never written to `__seo_entity_sources` (only kept inside jsonb).

## Field mapping (served field ← canonical chain)
| served field (consumer) | WIKI_SOURCE | EXPORT_FIELD | PROJECTION_FIELD | verdict |
|---|---|---|---|---|
| `sgc_content` (body of every section) | `editorial.<sec>.content_md` / `maintenance.educational_advice` | `blocks[].content_md` | `content.content_md` (jsonb) | **DIRECT_MAP** (modulo md→html transforms) |
| `sgc_sources` (provenance footer) | `<sec>.source_ids` | `blocks[].source_ids` | `content.source_ids` (jsonb) | **TRANSFORM_EXISTING** (reshape; also fixes `rag-legacy`→real WIKI provenance = the goal) |
| `sgc_section_type` (dispatcher S-code) | editorial key (free string) | `blocks[].section` | `block_kind=slug(section)` | **TRANSFORM_EXISTING** for {faq→S8, failure_symptoms→S2, maintenance→?}; **MISSING_CANONICAL_SOURCE** for S4_DEPOSE, S4_REPOSE, S5, S6, S7, S_GARAGE, S2_DIAG |
| `sgc_title` (headers/TOC) | — | — | — | **MISSING_CANONICAL_SOURCE** (export has no title) |
| `sgc_order` (render order) | — | — | — | TRANSFORM_EXISTING (served CANONICAL_ORDER by sectionType already derives it) |
| `sgc_quality_score` (read gate drop=0) | — | — | `confidence_base` (versions) | TRANSFORM_EXISTING (map) |
| `sgc_pg_id` (INT filter key) | `entity_id` (wiki slug) | `entity_id` | `entity_id` (string) | **MISSING** (needs slug→pg_id resolver; export has no pg_id) |

## Shape-translation gaps (to be solved at an UNDECIDED, preferably EXISTING location — NOT proof of a new layer)
1. identity: served keys numeric `pg_id`; export identity = wiki slug → a slug→pg_id resolution is needed somewhere on the path.
2. required served cols with no canonical field: `sgc_section_type` (S-taxonomy), `sgc_title`, int `sgc_order`.
3. entity-level `facts` (`__seo_entity_facts`) have no home in a section-only served table.
4. version model: served is flat upsert-in-place vs projection's versioned INSERT+flip.
5. gate↔table asymmetry: gate metadata (content_hash/roles_allowed/consumers_allowed/facts) has no served column; served needs title/order/score the export never produces.
These are shape-translation facts. Whether they are solved inside `build_exports_seo.py`, `seo-projection-writer`,
or a thin mapping on an existing seam is a LATER decision (B2-R3C), gated, not decided here.

## Honest conclusion
R3 was the strongest PARTIAL, yet its canonical path is NOT complete — and the dominant gap is **content, not
plumbing**: the WIKI accepted corpus does not yet hold the procedural R3 sections the page serves (depose/repose
steps, danger, parts, checklist, S2_DIAG). The RAG writer therefore stays **ILLEGAL + removal BLOCKED by
"canonical source not yet authored"** — NOT "temporarily legitimate". Real prerequisite = the RAW→WIKI content
loop authoring R3 coverage, verified section-by-section FIRST (B2-R3B1). No cutover / no shape-translation code /
no WIKI authoring / no writer removal without a new owner GO.

Companion audits on this branch: `tranche-b0-served-output-inventory-2026-07-06.md`,
`tranche-b1a-enforcement-ownership-2026-07-06.md`, `tranche-b2-step1-rag-mutation-denominator-20260707.md`.
