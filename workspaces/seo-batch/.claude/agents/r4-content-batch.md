---
name: r4-content-batch
disable-model-invocation: true
description: "[NEUTRALISÉ 2026-07-19 → seo-content-loop, ADR-031/046] Corps opératoire retiré. Cet agent lisait le RAG (/opt/automecanik/rag/knowledge/) puis ÉDITAIT EN PLACE des fiches R4 Reference déjà servies (__seo_reference, is_published=true) via MCP Supabase — direction RAG→source-de-contenu interdite. La vérité contenu vient du WIKI (RAW→WIKI→projection). Méthode canon : skill seo-content-loop (NO-RAG)."
tools:
  - Read
role: R4_REFERENCE
---

# Agent R4 Content Batch — NEUTRALISÉ (2026-07-19)

> 🚫 **NEUTRALISÉ** — cet agent est **inerte**. Son corps opératoire (audit-first, lecture du
> keyword plan `__seo_r4_keyword_plan` + du corpus RAG `rag/knowledge/`, pipeline 6 étapes,
> `UPDATE __seo_reference` sur les sections « IMPROVED ») a été **retiré**. C'était la direction
> **RAG→source-de-contenu interdite** (ADR-031 / ADR-046, vault) : le RAG est un retrieval
> **chatbot uniquement**, jamais une source de contenu / SEO indexé.

## Écriture désactivée (défense en profondeur)

L'outil d'écriture `mcp__supabase__execute_sql` (ainsi que `Glob` / `Grep`) a été **retiré** de
`tools` : seul `Read` demeure, et `disable-model-invocation: true` empêche l'auto-invocation.
Même recopié, cet agent **ne peut plus écrire** en base.

## Impact runtime — ne peut PAS obscurcir de page (mais gèle le contenu)

> ⚠️ **Cas `LIVE_RISK` — plus sensible que r6/conseil.** Contrairement à un producteur de drafts,
> cet agent **éditait EN PLACE des fiches déjà publiées et servies** (Étape 0 ciblait
> `ref.is_published = true`, Étape 6 les `UPDATE`). C'était donc de la **contamination RAG de
> contenu servi live** — exactement le pattern que retire cette neutralisation.

Mais retirer l'agent supprime un **producteur**, pas des lignes : il n'a **aucune autorité
publish/unpublish**. Les ~239 fiches R4 publiées **persistent** et continuent d'être servies
(`/reference-auto/:slug` → `reference.service.ts` → RPC `get_seo_reference_by_slug`, filtre
`is_published = true`). **Sa neutralisation ne peut donc obscurcir aucune page R4 live.**

**Coût honnête** : les ~239 fiches servies **figent** (plus de refresh par cet agent). La CRUD
gouvernée `ReferenceService.update()/publish()` reste disponible pour maintenance manuelle. Le
producteur draft-only `SeoGeneratorService.saveR4Draft()` (dont la génération RAG a **déjà** été
retirée, rag-purge) reste intact.

## Remplacement (méthode canon)

- **Successeur** : skill **`seo-content-loop`** (boucle gouvernée `RAW → WIKI → consumer`, NO-RAG).
  La vérité contenu vient du **WIKI**, **jamais** du RAG.

> **Successeur WIKI→R4 = ABSENT (à construire, owner-séquencé) :** le contrat WIKI modélise R4
> (`exports-seo.schema.json` rôle `R4_REFERENCE` ; `gamme.schema.json` cluster éditorial
> R1/R3/R4/R6, ADR-086), **mais aucun `projection-r4.mapper.ts` n'existe** (seul `projection-r3`
> existe, et dark). Brancher WIKI→R4 dans la surface servie `__seo_reference` = travail gouverné
> à part. Jusque-là, tout nouveau contenu R4 passe par `seo-content-loop`, pas par le RAG.
>
> Le fichier est **conservé** (non supprimé) pour ne pas casser les références
> (`agentic-planner.md`, `execution-registry.constants.ts`, `agentic.constants.ts`) : elles
> pointent désormais vers un agent inerte qui **STOP + redirige**.
>
> Réf : `audit/agent-instructions-audit-2026-07-18.md` (writers RAG→SEO indexé),
> mémoire `project_rag_seo_writer_removal_slices_20260719`. Rollback = `git revert`.

## Contrat de sortie obligatoire

> REGLE NON-NEGOCIABLE — s'applique à ce run (même inerte).

- Verdict par défaut : `PARTIAL_COVERAGE` / `INSUFFICIENT_EVIDENCE`. Statuts `COMPLETE`/`DONE`/`ALL_FIXED` interdits.
- Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat complet.
