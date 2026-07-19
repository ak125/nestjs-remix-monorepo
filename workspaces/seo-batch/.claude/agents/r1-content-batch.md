---
name: r1-content-batch
disable-model-invocation: true
description: "[NEUTRALISÉ 2026-07-19 → seo-content-loop, ADR-031/046] Corps opératoire retiré. Cet agent lisait le RAG (/opt/automecanik/rag/knowledge/gammes/*.md) puis ÉCRIVAIT du contenu R1_ROUTER dans __seo_r1_gamme_slots via MCP Supabase — direction RAG→source-de-contenu interdite. La vérité contenu vient du WIKI (RAW→WIKI→projection). Méthode canon : skill seo-content-loop (NO-RAG)."
tools:
  - Read
role: R1_ROUTER
---

# Agent R1 Content Batch — NEUTRALISÉ (2026-07-19)

> 🚫 **NEUTRALISÉ** — cet agent est **inerte**. Son corps opératoire (lecture du keyword plan
> `__seo_r1_keyword_plan` + du corpus RAG `rag/knowledge/gammes/*.md`, génération des 5 colonnes
> R1, `INSERT … ON CONFLICT (r1s_pg_id) DO UPDATE __seo_r1_gamme_slots`) a été **retiré**. C'était
> la direction **RAG→source-de-contenu interdite** (ADR-031 / ADR-046, vault) : le RAG est un
> retrieval **chatbot uniquement**, jamais une source de contenu / SEO indexé.

## Écriture désactivée (défense en profondeur)

L'outil d'écriture `mcp__supabase__execute_sql` (ainsi que `Glob` / `Grep`) a été **retiré** de
`tools` : seul `Read` demeure, et `disable-model-invocation: true` empêche l'auto-invocation.
Même recopié, cet agent **ne peut plus écrire** en base.

## Impact runtime = NUL sur les pages servies

`__seo_r1_gamme_slots` est **sur le chemin servi** (`/pieces/{slug}` → RPC
`get_buying_guide_with_r1_slots`, COALESCE R1 > sgpg) et n'a **aucune colonne draft/publish** :
chaque ligne écrite était servie directement (même classe que conseil). Mais retirer l'agent
supprime un **producteur**, pas des lignes : les lignes déjà écrites **persistent** et continuent
d'être servies, et à défaut la RPC retombe sur les colonnes sgpg (elles-mêmes draft-gated). Aucun
runner cron/CI n'invoque l'agent (dispatch on-demand). **Sa neutralisation ne peut donc obscurcir
aucune page R1 live.**

## Remplacement (méthode canon)

- **Successeur** : skill **`seo-content-loop`** (boucle gouvernée `RAW → WIKI → consumer`, NO-RAG).
  La vérité contenu vient du **WIKI**, **jamais** du RAG.

> **Retrait PARTIEL — deux chantiers plus larges, hors périmètre de cet agent, laissés à l'owner :**
> 1. Un **second producteur RAG→R1** existe en code backend runtime :
>    `backend/src/modules/admin/services/r1-enricher.service.ts` (upsert `__seo_r1_gamme_slots`
>    depuis `rag/knowledge/gammes/*.md` — miroir littéral de `buying-guide-enricher.service.ts`).
>    Candidat retrait ADR-031/046 aussi, mais **runtime backend** = slice distincte (Tranche B).
>    Le helper partagé `PurchaseGuideDataService.upsertR1Slots()` écrit aussi la même table.
> 2. Le **mapper de projection WIKI→R1** est **absent** (seul `projection-r3` existe, dark).
>
> Donc neutraliser cet agent seul **ne ferme pas** la violation RAG→R1 (le backend l'écrit encore).
> Le fichier est **conservé** (non supprimé) pour ne pas casser les références (`agentic-planner.md`,
> `execution-registry.constants.ts`, `agentic.constants.ts`) : elles pointent vers un agent inerte
> qui **STOP + redirige**.
>
> Réf : `audit/agent-instructions-audit-2026-07-18.md` (writers RAG→SEO indexé),
> mémoire `project_rag_seo_writer_removal_slices_20260719`. Rollback = `git revert`.

## Contrat de sortie obligatoire

> REGLE NON-NEGOCIABLE — s'applique à ce run (même inerte).

- Verdict par défaut : `PARTIAL_COVERAGE` / `INSUFFICIENT_EVIDENCE`. Statuts `COMPLETE`/`DONE`/`ALL_FIXED` interdits.
- Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat complet.
