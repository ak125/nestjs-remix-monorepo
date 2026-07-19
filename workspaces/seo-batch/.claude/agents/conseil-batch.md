---
name: conseil-batch
disable-model-invocation: true
description: "[NEUTRALISÉ 2026-07-19 → seo-content-loop, ADR-031/046] Corps opératoire retiré. Cet agent lisait le RAG (/opt/automecanik/rag/knowledge/gammes/*.md) puis ÉCRIVAIT des sections R3 Conseils dans __seo_gamme_conseil via MCP Supabase — direction RAG→source-de-contenu interdite. La vérité contenu vient du WIKI (RAW→WIKI→projection). Méthode canon : skill seo-content-loop (NO-RAG)."
tools:
  - Read
role: R3_CONSEILS
---

# Agent Conseil-Batch (R3) — NEUTRALISÉ (2026-07-19)

> 🚫 **NEUTRALISÉ** — cet agent est **inerte**. Son corps opératoire (lecture du corpus RAG
> `rag/knowledge/gammes/*.md` + du keyword plan `__seo_r3_keyword_plan`, génération des sections
> S1-S8/S_GARAGE/S2_DIAG, écriture `INSERT … ON CONFLICT … DO UPDATE __seo_gamme_conseil` via
> MCP Supabase) a été **retiré**. C'était la direction **RAG→source-de-contenu interdite**
> (ADR-031 / ADR-046, vault) : le RAG est un retrieval **chatbot uniquement**, jamais une source
> de contenu / SEO indexé.

## Écriture désactivée (défense en profondeur)

L'outil d'écriture `mcp__supabase__execute_sql` (ainsi que `Glob` / `Grep`) a été **retiré** de
`tools` : seul `Read` demeure, et `disable-model-invocation: true` empêche l'auto-invocation.
Même recopié, cet agent **ne peut plus écrire** en base.

## Impact runtime = NUL sur les pages servies

Cet agent écrivait **directement** dans la table servie `__seo_gamme_conseil` (pas de buffer draft) ;
mais sa neutralisation retire un **producteur**, pas des lignes : les lignes déjà écrites **persistent**
et continuent d'être servies. La page R3 servie (`/blog-pieces-auto/conseils/{pg_alias}` →
`r3-guide.service.ts` → `getGammeConseil`, lecture par `sgc_pg_id` seul, **sans filtre publish**) reste
inchangée. Aucun runner cron/CI n'invoque cet agent (invocation opérateur manuelle uniquement).
**Sa neutralisation ne peut donc obscurcir aucune page R3 live.**

## Autres producteurs de `__seo_gamme_conseil` — NON touchés

`legacy-recycler` (recycle `__blog_advice*`, **non-RAG**) et `surgical-cleaner` (nettoyage sections
polluées, **non-RAG**) restent intacts — ils ne violent pas ADR-031/046. Le skill `content-gen`
(RAG-based) est un **candidat retrait séparé** (déjà stub déprécié). v5-guardian = garde, pas producteur.

## Remplacement (méthode canon)

- **Successeur** : skill **`seo-content-loop`** (boucle gouvernée `RAW → WIKI → consumer`, NO-RAG).
  La vérité contenu vient du **WIKI** (sourcée, lintée, validée humainement), **jamais** du RAG.

> **Le successeur WIKI→R3 existe mais est DARK — travail owner-séquencé :**
> `backend/src/modules/seo-projection/projection-r3.mapper.ts` existe (P2-R3), mais (a) il écrit
> `__seo_content_blocks` / `__seo_entity_facts` — **pas** `__seo_gamme_conseil` ; (b) le chemin servi
> R3 ne lit **pas** la sortie de projection (`servedBodySource` figé `'legacy'`) ; (c) flags de lecture
> OFF (`SEO_PROJECTION_READ_V1=false`, allowlist vide) ; (d) l'étape de rendu md→HTML (P2-R3-E) n'existe
> pas. Donc rien du WIKI ne sert encore une page R3. Brancher la projection R3 = travail gouverné à part.
>
> Le fichier est **conservé** (non supprimé) pour ne pas casser les références (`agentic-planner.md`,
> `AGENTS.md`, procédures) : elles pointent désormais vers un agent inerte qui **STOP + redirige**.
>
> Réf : `audit/agent-instructions-audit-2026-07-18.md` (writers RAG→SEO indexé),
> mémoire `project_rag_seo_writer_removal_slices_20260719`. Rollback = `git revert`.

## Contrat de sortie obligatoire

> REGLE NON-NEGOCIABLE — s'applique à ce run (même inerte).

- Verdict par défaut : `PARTIAL_COVERAGE` / `INSUFFICIENT_EVIDENCE`. Statuts `COMPLETE`/`DONE`/`ALL_FIXED` interdits.
- Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat complet.
