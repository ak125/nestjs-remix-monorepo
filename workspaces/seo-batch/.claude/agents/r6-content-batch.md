---
name: r6-content-batch
disable-model-invocation: true
description: "[NEUTRALISÉ 2026-07-19 → seo-content-loop, ADR-031/046] Corps opératoire retiré. Cet agent lisait le RAG (/opt/automecanik/rag/knowledge/gammes/*.md) puis ÉCRIVAIT du contenu R6 Guide d'Achat (draft) dans __seo_gamme_purchase_guide via MCP Supabase — direction RAG→source-de-contenu interdite. La vérité contenu vient du WIKI (RAW→WIKI→projection). Méthode canon : skill seo-content-loop (NO-RAG)."
tools:
  - Read
role: R6_GUIDE_ACHAT
---

# Agent R6 Content Batch — NEUTRALISÉ (2026-07-19)

> 🚫 **NEUTRALISÉ** — cet agent est **inerte**. Son corps opératoire (lecture du keyword
> plan `__seo_r6_keyword_plan` + du corpus RAG `rag/knowledge/gammes/*.md`, pipeline 7 prompts,
> écriture `UPDATE __seo_gamme_purchase_guide` via MCP Supabase) a été **retiré**. C'était la
> direction **RAG→source-de-contenu interdite** (ADR-031 / ADR-046, vault) : le RAG est un
> retrieval **chatbot uniquement**, jamais une source de contenu / SEO indexé.

## Écriture désactivée (défense en profondeur)

L'outil d'écriture `mcp__supabase__execute_sql` (ainsi que `Glob` / `Grep`) a été **retiré** de
`tools` : seul `Read` demeure, et `disable-model-invocation: true` empêche l'auto-invocation.
Même recopié, cet agent **ne peut plus écrire** en base.

## Impact runtime = NUL sur les pages servies

Cet agent écrivait **uniquement des drafts** (`sgpg_is_draft = true`) et n'avait **aucune autorité
de publication** (rien dans le code ne bascule `sgpg_is_draft = false`). La page R6 servie
(`/blog-pieces-auto/guide-achat/{pg_alias}` → `r6-guide.service.ts`, filtre `sgpg_is_draft = false`)
ne lit **que** les lignes publiées. Sa neutralisation **ne peut donc obscurcir aucune page R6 live** ;
les lignes déjà publiées restent intactes.

## Remplacement (méthode canon)

- **Successeur** : skill **`seo-content-loop`** (boucle gouvernée `RAW → WIKI → consumer`, NO-RAG).
  La vérité contenu vient du **WIKI** (sourcée, lintée, validée humainement), **jamais** du RAG.
- **Contrat WIKI R6 déjà modélisé** : `automecanik-wiki-wt-export-contract/_meta/schema/`
  (`exports-seo.schema.json` rôle `R6_GUIDE_ACHAT` ; `entity-data/gamme.schema.json` cluster
  éditorial R1/R3/R4/R6, ADR-086). **Le mapper de projection R6 → surface servie reste à construire**
  (seul le mapper R3 existe, encore dark) : c'est le vrai travail successeur, owner-séquencé.

> **Deux chantiers plus larges — hors périmètre de cet agent, laissés à l'owner :**
> 1. Un **second producteur RAG→R6** existe en code backend runtime :
>    `backend/src/modules/admin/services/buying-guide-enricher.service.ts` (`SOURCE_TIER.RAG_LEGACY`,
>    même source `rag/knowledge/gammes/*.md`). Aussi un candidat retrait ADR-031/046, mais
>    **runtime backend** (blast radius supérieur) = slice distincte (Tranche B backend).
> 2. Le **mapper de projection WIKI→R6** (miroir de `projection-r3.mapper.ts`) est **non construit**.
>
> Le fichier est **conservé** (non supprimé) pour ne pas casser les références
> (`agentic-planner.md`, `scripts/seo/inject-agent-role.ts`) : elles pointent désormais vers un
> agent inerte qui **STOP + redirige**.
>
> Réf : `audit/agent-instructions-audit-2026-07-18.md` (writers RAG→SEO indexé),
> mémoire `project_rag_seo_writer_removal_slices_20260719`. Rollback = `git revert`.

## Contrat de sortie obligatoire

> REGLE NON-NEGOCIABLE — s'applique à ce run (même inerte).

- Verdict par défaut : `PARTIAL_COVERAGE` / `INSUFFICIENT_EVIDENCE`. Statuts `COMPLETE`/`DONE`/`ALL_FIXED` interdits.
- Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat complet.
