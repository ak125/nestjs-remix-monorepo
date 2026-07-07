# B2-R3B1 — R3 canonical section coverage, pilot gamme `filtre-a-air` (READ-ONLY)

Status: **READ_ONLY_AUDIT_SNAPSHOT** · Canonical: NO · Runtime change: NONE · B2 authz: NONE · Schema change: NONE · 2026-07-07

3 read-only agents. RAW read @ `automecanik-raw` origin/main `3815e5e`; WIKI @ origin/main `fafef0f`;
served = LIVE `mcp__supabase__execute_sql` (project cxpojprgwgubzjyqzmoq — read worked despite the auth banner).
NO code / schema / promotion touched. Owner-reviewed; this revision carries the owner's mandated corrections
(§ "Corrected verdict"). Follows `audit/tranche-b2-r3a-canonical-mapping-20260707.md`.

## Owner-mandated corrected verdict (authoritative)

```
EXISTS_IN_RAW_MATERIAL                       = 11/12   (raw material is PRESENT — NOT "ready")
READY_FOR_CANONICAL_PROMOTION                = NOT_YET_PROVEN
CIRCULAR_DERIVATIVE_FOUND                    = conseil_v5  (RAW payload derived FROM the served table)
WIKI_SCHEMA_GAP                              = YES
LEGACY_SECTIONS_REQUIRING_NEW_CANONICAL_SLOTS = S4_DEPOSE, S4_REPOSE, S6   (+ S5 conditional)
SECTIONS_NOT_REQUIRING_EDITORIAL_SLOTS       = S2_DIAG, S7, S_GARAGE
ENTITY_IDENTITY_DRIFT                        = pg_id 510 → 8
```

### Why each correction (vs the naive first pass)

1. **`EXISTS_IN_RAW_MATERIAL` ≠ `READY_FOR_CANONICAL_PROMOTION`.** "The RAW file already contains a
   section-by-section payload" proves *material is available*, NOT that any section is promotable to
   WIKI accepted. Promotion readiness must be proven section-by-section (real source, page-level proof,
   anchor, no circular provenance) — none of that is established here. Default = `NOT_YET_PROVEN`.

2. **`CIRCULAR_DERIVATIVE_FOUND = conseil_v5` — the decisive finding.** The RAW `conseil_v5:` block that
   made coverage look "already built" is **itself derived from the served table**: its RAW metadata carries
   `_sync_source: __seo_gamme_conseil` and it was produced/enriched by `script:rag-enrich-from-web-corpus`.
   So "promote conseil_v5 → WIKI → projection → R3" would **launder RAG + legacy-DB content back into the
   canonical axis** and close the loop on itself. This is exactly the fake RAG-exit the B2 doctrine forbids
   (`RAG has zero content-write authority`; canonical axis = *proven sources → RAW → WIKI proposal → accepted
   → projection → R*`). **Promoting `conseil_v5` directly is INTERDIT.** It is usable only as a *coverage
   inventory / index of what to re-source*, never as promotable evidence. The real material to promote is the
   underlying **curated RAW evidence** (e.g. the ~44-clip evidence yml with genuine provenance), section by
   section, through the normal loop — not the recycled projection.

3. **`WIKI_SCHEMA_GAP = YES`, but the fix is 3 semantic slots + 1 conditional — NOT 5 mechanical S-codes.**
   The gamme entity-data schema (`_meta/schema/entity-data/gamme.schema.json`, ADR-086 §2bis) has no slot for
   procedural / final-check / danger knowledge. The additive schema extension carries **knowledge in semantic
   names**, and the *export* translates to the consumer S-taxonomy — WIKI never learns "S4_DEPOSE":
   `removal_procedure` (→ export S4_DEPOSE), `installation_procedure` (→ S4_REPOSE), `post_install_checks`
   (→ S6), and **conditional** `safety_warnings` (→ S5, *source-gated, absent when there is no genuine alert*).

4. **`SECTIONS_NOT_REQUIRING_EDITORIAL_SLOTS = S2_DIAG, S7, S_GARAGE` — these are NOT authored 232×.**
   - **S7** (related parts) = deterministic from DB `related_parts` / catalogue truth (already an ADR-086
     deterministic projection). Not an editorial slot. (Served today mis-exported as R4_REFERENCE — a role
     mismatch to fix in projection, not by authoring.)
   - **S_GARAGE** = deterministic UI composed from difficulty + risk + diagnostic-uncertainty + tooling need.
     Not authored content; no WIKI slot.
   - **S2_DIAG** = an R3 *surface* whose source is the **diagnostic DB** (`__diag_symptom` / `__diag_system`)
     + **typed WIKI relations**, projected/composed at build — NOT `__seo_observable` (legacy, no longer the
     canonical owner per ADR-027 fold), NOT RAG. So it needs an ownership pin + a typed relation, not a new
     free-text editorial slot.

5. **`S5` (danger) legacy is contaminated** (guardrail/external leak, 108 c). Preferred disposition = **DROP**
   the legacy S5 rather than invent/fill it; `safety_warnings` returns only when a genuinely sourced alert
   exists (conditional slot, absent = no block, no filler).

6. **`ENTITY_IDENTITY_DRIFT = pg_id 510 → 8` is a stale FK on ONE canonical fiche — not a canon-vs-proposal
   arbitration.** The thin `wiki/gamme/filtre-a-air.md` (pg_id 510) and the richer `proposals/filtre-a-air.md`
   (pg_id 8) are the *same* canonical entity with a stale foreign key; 8 is the proven current catalogue
   identity (DB), 510 is stale. **Fix the identity to 8 before any projection/cutover.** Entity identity and
   content richness are separate problems and must not be conflated.

## Coverage matrix (12 served sections — corrected reading)

| Section | served (len/score) | RAW material | WIKI + export | Corrected verdict |
|---|---|---|---|---|
| S1 function/intro | 845/100 | present | `editorial.function` empty (schema-OK) | material present → **re-source + author** (not "promote conseil_v5") |
| S2 symptoms | 321/85 | present | `editorial.failure_symptoms` empty (schema-OK) | material present → re-source + author |
| S2_DIAG | 1128/85 | present (causes thin) | not a free-text slot | **OWNERSHIP-PIN** — R3 surface, source = diag DB + typed WIKI relation |
| S3 compat/selection | 617/100 | present | `dimensions` empty (schema-OK) + compat = DB | material present → re-source + author; compat from DB |
| S4_DEPOSE removal | 542/85 | present (6 steps + clips) | **no schema slot** | **WIKI_SCHEMA_GAP** → new `removal_procedure` |
| S4_REPOSE refit | 1668/76 | present (thinner) | **no schema slot** | **WIKI_SCHEMA_GAP** → new `installation_procedure` |
| S5 danger | 108/85 | PARTIAL (contaminated) | **no schema slot** | **DROP legacy**; conditional `safety_warnings` only if sourced |
| S6 checklist-after | 2363/100 | present (strong) | **no schema slot** | **WIKI_SCHEMA_GAP** → new `post_install_checks` |
| S_GARAGE | 374/70 | present | not a slot | **DETERMINISTIC_UI** — not authored |
| S7 related parts | 2031/100 | present | exported as R4_REFERENCE (role mismatch) | **DETERMINISTIC** from DB related_parts — not authored |
| S8 FAQ | 1114/100 | present (5 Q&A; <6) | `editorial.faq` empty (schema-OK) | material present → re-source + author |
| META links | 282/80 | present (contaminated) | `related_parts` exported; `maintenance.related_pages` UNEXPORTED | export bug (separate) |

Counts: **EXISTS_IN_RAW_MATERIAL = 11/12** (S5 = PARTIAL/contaminated). **TRULY_MISSING = 0** material —
but material ≠ promotable, and the "already built" `conseil_v5` payload is **circular** and non-promotable.

## Decisive conclusion (corrected)

The naive assumption ("content is basically already there, just promote it") is **doubly wrong**:

- What made it *look* built (`conseil_v5`) is a **circular derivative of the served table** → INTERDIT to promote.
- Even setting that aside, `EXISTS_IN_RAW_MATERIAL` is not `READY_FOR_CANONICAL_PROMOTION`; readiness is
  `NOT_YET_PROVEN` and must be proven per section against genuine provenance.

So the real, governed prerequisites before any R3 cutover are:
1. **`WIKI_SCHEMA_GAP`** — additive ADR-086 schema extension: 3 semantic slots (`removal_procedure`,
   `installation_procedure`, `post_install_checks`) + 1 conditional (`safety_warnings`). No threshold change,
   none mandatory, source-gated, absent = no block.
2. **`S2_DIAG` ownership pin** — R3 surface / diag-DB + typed WIKI relation source (not `__seo_observable`,
   not RAG).
3. **`ENTITY_IDENTITY_DRIFT`** — fix pg_id 510 → 8 before projection.
4. **Re-source, don't recycle** — the underlying curated RAW evidence goes through the normal loop; the
   `conseil_v5` recycled payload is an index only.

Deterministic (non-authored) sections — **S7, S_GARAGE** (and S3-compat, S2_DIAG's diag half) — are handled by
projection/composition, not by editorial authoring.

## NEXT (owner-gated) → B2-R3B2

Canonical disposition + governance closure (read-only / design only): freeze the legacy-section → canonical-
destination table, then PREPARE (without coding) ADR-086 amendment (the 3+1 slots), ADR-027 source-authority
correction, ADR-033 decision (ACCEPT / AMEND / SUPERSEDE). **No code / schema / promotion / writer-removal /
ADR mutation without a new owner GO.** NEVER a RAG fallback if a later projection fails.
