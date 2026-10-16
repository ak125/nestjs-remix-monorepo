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
  La vérité contenu vient du **WIKI** (sourcée, lintée, promotion décidée par
  `_scripts/promotion_decision.py`, ADR-114), **jamais** du RAG. La relecture humaine porte
  sur les cas renvoyés par le décideur ; une fiche déjà promue qui change de forme exige
  la validation owner (ADR-107 D5).

> **Le successeur WIKI→R3 est câblé — activation owner-séquencée :**
> `R3ProjectionDecisionService` sélectionne la projection si `SEO_PROJECTION_READ_V1` est vrai,
> si `SEO_PROJECTION_READ_CANARY` contient `R3_CONSEILS@gamme:<alias>` et si le reader et le
> mapper la déclarent prête. `R3GuideService` rend alors les sections projetées (Markdown→HTML),
> avec `servedBodySource: 'projection'`. Sinon, il sert le legacy avec une `fallbackReason`
> typée (`MASTER_OFF`, `NOT_ALLOWLISTED`, projection absente/invalide ou erreur du reader).
> Le mapper transforme les blocs lus ; il n'écrit pas dans `__seo_gamme_conseil`.
> Au 2026-10-15, la configuration de déploiement indique `MASTER_OFF` en PROD ; les éventuels
> overrides runtime n'ont pas été vérifiés. L'activation de `filtre-a-huile` reste conditionnée
> par ADR-107 D4/D5, puis ADR-111 : la présence du lecteur n'autorise pas le canary.
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
