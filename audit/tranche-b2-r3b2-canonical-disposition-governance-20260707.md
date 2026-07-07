# B2-R3B2 — canonical disposition + governance closure (READ-ONLY / DESIGN)

Status: **READ_ONLY_DESIGN_SNAPSHOT** · Canonical: NO · Runtime: NONE · Code: NONE · Schema: NONE · Vault commit: NONE · 2026-07-07

Grounded in real vault text @ `origin/main` (freshness-checked): ADR-027, ADR-033, ADR-086 read via
`git show origin/main:…`; status resolved via `ops/moc/MOC-Decisions.md` (the canonical status SoT).
This is a PREPARED SPEC — **not** an ADR, **not** canon, **not** a vault commit. The actual amendments /
corrections / decisions are owner-gated **vault PRs** (G3-signed). "Préparer, sans coder."

---

## PART 1 — Frozen canonical disposition (legacy served R3 section → canonical destination)

Every served `__seo_gamme_conseil` section is assigned to exactly ONE canonical destination + a TYPE.
Owner Turn-9 decisions, cross-checked against ADR-086 §2bis's controlled `role/section` enum.

| Served section | Canonical destination | Type | Anchor / note |
|---|---|---|---|
| **S1** function/intro | `R3_CONSEILS/function` (`entity_data.editorial.function`) | EDITORIAL (exists, tier **M**) | ADR-086 §2bis — schema-OK, re-source + author |
| **S2** symptoms | `R3_CONSEILS/failure_symptoms` | EDITORIAL (exists, **M**) | ADR-086 §2bis — schema-OK |
| **S2_DIAG** | **diag DB** (`__diag_symptom`/`__diag_system`) projection **+ WIKI `diagnostic_relations[]`** typed refs | DETERMINISTIC-PROJECTION + TYPED-RELATION (NOT editorial, NOT RAG, NOT `__seo_observable`) | surface=R3 (ADR-027) · source instrument = ADR-033 · **ownership pinned here** |
| **S3** compat/selection | **SPLIT**: `R6_GUIDE_ACHAT/selection_criteria` (editorial) **+** `R4_REFERENCE/compatibility` (DB) | EDITORIAL + DETERMINISTIC | ADR-086 §2bis — both already in enum |
| **S4_DEPOSE** removal | **NEW** `R3_CONSEILS/removal_procedure` | EDITORIAL, source-gated, **NEW slot** | ADR-086 amendment |
| **S4_REPOSE** refit | **NEW** `R3_CONSEILS/installation_procedure` | EDITORIAL, source-gated, **NEW slot** | ADR-086 amendment |
| **S5** danger | **NEW conditional** `R3_CONSEILS/safety_warnings` — absent if unsourced; **legacy S5 DROP** | CONDITIONAL EDITORIAL, source-gated, **NEW slot** | ADR-086 amendment + ADR-091 safety governance |
| **S6** checklist-after | **NEW** `R3_CONSEILS/post_install_checks` | EDITORIAL, source-gated, **NEW slot** | ADR-086 amendment |
| **S7** related parts | `R4_REFERENCE/related_parts` (DB) | DETERMINISTIC — not authored | ADR-086 §2bis already deterministic; served mis-serves as R4 card → **projection role-fix**, not authoring |
| **S_GARAGE** | deterministic UI composition (difficulty + risk + diagnostic-uncertainty + tooling need) | DETERMINISTIC UI — not authored, **no WIKI slot** | composition-time; no editorial slot |
| **S8** FAQ | `R3_CONSEILS/faq` (`entity_data.editorial.faq`) | EDITORIAL (exists, tier **R**) | ADR-086 §2bis — schema-OK |
| **META** links | export bug (`maintenance.related_pages` UNEXPORTED) | BUGFIX (not content) | ADR-059/086 export — separate |

**Partition check:** 12 served sections → {4 editorial-exists (S1,S2,S3-editorial-half,S8)} + {4 NEW editorial slots (S4_DEPOSE,S4_REPOSE,S5-conditional,S6)} + {4 deterministic/non-authored (S2_DIAG,S3-compat-half,S7,S_GARAGE)} + {1 bugfix (META)}. Every section has exactly one destination; nothing routed to RAG; nothing routed to "author 232×" that is actually deterministic.

**Anti-recycle invariant (from B2-R3B1):** none of these destinations may be filled from the circular
`conseil_v5` RAW payload (`_sync_source: __seo_gamme_conseil`, rag-enriched). Editorial slots are filled
from re-sourced curated RAW → WIKI accepted; deterministic slots from DB; never RAG.

---

## PART 2 — Prepared governance closure (3 vault items — NO code, NO vault commit yet)

### G-1 · ADR-086 amendment spec (section taxonomy extension) — ADDITIVE

- **Where:** ADR-086 §2bis "taxonomie de sections + barre tierée" — the controlled `role/section` enum.
- **Add** to the `R3_CONSEILS` role: 3 semantic sections + 1 conditional —
  `removal_procedure`, `installation_procedure`, `post_install_checks`, and conditional `safety_warnings`.
- **Naming is SEMANTIC in WIKI.** WIKI never learns the served S-codes. The **export** (`build_exports_seo.py`)
  translates `removal_procedure → S4_DEPOSE`, `installation_procedure → S4_REPOSE`, `post_install_checks → S6`,
  `safety_warnings → S5`. Knowledge lives in WIKI under semantic names; the S-taxonomy is a consumer-contract
  detail owned by the export.
- **Tier = a NEW non-scoring optional/conditional class (proposed "O"), NOT M and NOT R.** Rationale:
  ADR-086's tier bar is BRONZE = 7/7 **M**, ARGENT = +≥3 **R**, OR = 5/5 **R** + hero + ≥2 sources/≥50% blocks.
  Adding these as **M** would break BRONZE on all 232 gammes; adding as **R** would move the ARGENT/OR bar.
  A non-scoring optional tier keeps **all three tier thresholds unchanged** — the exact precedent already in
  §2bis is the **media couture** (`status ∈ {AVAILABLE, DEFERRED}`, "Aucune image n'est requise pour la
  projection"): declared, source-gated, non-blocking, absent = OK.
- **Constraints (owner):** no threshold change · none mandatory · source-gated (no source ⇒ absent, never
  filler) · `safety_warnings` additionally ADR-091-governed (genuine sourced alert only; DROP the contaminated
  legacy S5). Absent = no block, no duplicate-content amplification.
- **Chain:** ADR-086 already carries `amends:[ADR-083]`, `extends:[ADR-059,ADR-031,ADR-066]`. This is a
  self-amendment of ADR-086 (or a small new ADR that `extends: [ADR-086]`) — owner's call on instrument shape.
- **Doctrine cover:** [[reference_adr_corpus_scaffold_not_straitjacket_content_pipeline]] — ADR content
  schemas MANDATE evolution; an additive, source-gated section extension is in-doctrine, not a violation.

### G-2 · ADR-027 source-authority correction spec

- **The conflict (verified in vault text):** ADR-027 §Décision.4 "Trois sources d'enrichissement S2_DIAG,
  par ordre de priorité" canonizes **`P1 (canon) = RAG primary`**, with deterministic `__diag_*` as
  **`P2 (futur, post-ADR)`** and observable as **`P3 (legacy, déprécié)`**.
- **Why it's now incompatible:** later ACCEPTED canon overrides this — **ADR-080** (accepted 2026-05-23):
  "RAG = chatbot UNIQUEMENT … RagEnrichmentEngine legacy à neutraliser"; **ADR-086** (accepted): RAG is not a
  content source (4 intrants = RAW/WIKI/DB/KW, RAG absent); and the B2 doctrine
  [[feedback_rag_zero_content_write_authority_remove_not_secure]]: RAG has ZERO content-write authority.
  ADR-027's own text already calls the deterministic engine the intended successor ("P2 futur") and already
  demotes observable ("les 1176 lignes `__seo_observable` … ne sont plus la source canonique").
- **The correction (source authority only — surface UNCHANGED):**
  - **Invert the priority:** deterministic `__diag_*` engine **+ typed WIKI `diagnostic_relations[]` (ADR-033)**
    become **P1 canon** for S2_DIAG.
  - **RAG removed entirely from the priority list** (not demoted to P3 — **zero authority**). No `buildS2Diag…`
    RAG path is canonical.
  - `__seo_observable` stays legacy/historical only (already non-canonical per ADR-027).
  - **PRESERVE:** S2_DIAG surface = R3 (ADR-027's consolidation decision is untouched — only the *source
    authority* clause is corrected).
- **Instrument:** amendment to an ACCEPTED ADR → owner-gated vault PR (G3). It is a scoped correction to
  §Décision.4, not a supersede.

### G-3 · ADR-033 decision — ACCEPT / AMEND / SUPERSEDE

- **Status facts (SoT-first):** `ops/moc/MOC-Decisions.md` (canonical status SoT) = **Proposed** (2026-04-29);
  ADR-033 file header = `proposed`, `decision_date: null`. **BUT** the contract is de-facto LIVE: implemented
  across 10 PRs (schema v2.0.0 `diagnostic_relations[]`, validators, cron, `wiki-readiness-check.py` → READY
  2026-05-01); **ADR-039** (accepted) is its child ("PR-C ADR-033"); **ADR-083** (accepted) "**amende ADR-033**".
  The `adr-033-wave-2-closed` knowledge note claims "accepted 2026-04-29" — which **contradicts the MOC SoT**.
- **Anomaly:** a formally `proposed` ADR that is implemented + amended by an accepted ADR + has an accepted
  child = governance debt (status never flipped). Repo-state-prime: the *contract* is real/live; the *formal
  status* lags.
- **Recommendation → ACCEPT (formalize) + reconcile the header/MOC/wave-note.** Rationale:
  - ADR-033 IS the canonical typed-relation instrument for S2_DIAG source (G-2 depends on it); it is already
    implemented and already amended by accepted ADR-083.
  - **AMEND is NOT required for B2-R3B2:** S2_DIAG consumes the *existing* `diagnostic_relations[]` shape
    as-is (symptom/system typed refs) — no shape change. (AMEND would only be needed if S2_DIAG demanded a new
    field, which it does not.)
  - **SUPERSEDE is wrong:** nothing replaces it; it is the instrument we depend on.
- **Caveat that ACCEPT does NOT close:** ADR-033 Phase-4 migration (RAG `symptoms:` → WIKI
  `diagnostic_relations[]`) was **DEFERRED** — the 232 legacy `symptoms:` still live in
  `automecanik-rag/knowledge/gammes/`. So formalizing ADR-033 pins the *contract*, but the S2_DIAG **cutover**
  still depends on that deferred re-source (RAG → typed WIKI relation), which is itself part of the B2
  re-source thread — NOT a RAG content-write, but a curated migration to typed relations.

---

## Verdicts (owner's Turn-9 decision list, restated for the record)

```
Persist B2-R3B1 (corrected)          = DONE (cfc0e9c77)
Amend ADR-086 (scoped, additive)     = YES (G-1)
  add 5 legacy S-code slots          = NO
  add 3 semantic + 1 conditional     = YES
ADR-027 source-authority correction  = YES (G-2) — invert P1: __diag_*/WIKI relations; RAG zero authority
S2_DIAG surface owner                = R3
S2_DIAG source owner                 = diag DB + typed WIKI relations (NOT __seo_observable, NOT RAG)
ADR-033 decision                     = ACCEPT + reconcile status (G-3); AMEND not required; SUPERSEDE wrong
Promote conseil_v5 directly          = INTERDIT (circular)
Fix pg_id 510 → 8 before projection  = REQUIRED
Code / schema change now             = NO GO yet
```

## Hard stops (unchanged — owner GO nominatif)
Vault PR (ADR-086 amend / ADR-027 correction / ADR-033 accept — G3-signed, owner-authored) · any code ·
any schema change · WIKI promotion · writer removal · flag flip · projection build · S2_DIAG cutover ·
the deferred RAG→WIKI diagnostic-relations migration. NEVER a RAG fallback if a later projection fails.
