---
name: r7-brand-rag-generator
disable-model-invocation: true
description: "[NEUTRALISÉ 2026-07-19 → wiki-proposal-writer, ADR-031/046] Corps opératoire retiré. Cet agent lisait la DB + le RAG (/opt/automecanik/rag/knowledge/gammes) puis ÉCRIVAIT des artefacts constructeur (brand.md + role_map.json) dans /opt/automecanik/rag/knowledge/constructeurs/ — direction RAG→source-de-contenu abandonnée. La vérité contenu vient du WIKI (RAW→WIKI→projection). Successeur : wiki-proposal-writer (entity_type=constructeur, ADR-033)."
tools:
  - Read
role: R7_BRAND
---

# Agent R7 Brand RAG Generator — NEUTRALISÉ (2026-07-19)

> 🚫 **NEUTRALISÉ** — cet agent est **inerte**. Son corps opératoire (fetch DB + lecture du
> corpus RAG gammes, génération `brand.md` / `role_map.json`, écriture dans
> `/opt/automecanik/rag/knowledge/constructeurs/`) a été **retiré**. C'était la direction
> **RAG→source-de-contenu abandonnée** (ADR-031 / ADR-046, vault) : le RAG est un retrieval
> **chatbot uniquement**, jamais une source de contenu / SEO. Déjà `[DEPRECATED 2026-06-12]` ;
> son Step 4 était déjà mort (`backend/src/config/brand-role-map.schema.ts` absent du repo).

## Écriture désactivée (défense en profondeur)

Les outils d'écriture (`mcp__supabase__execute_sql`, `Write`, `Glob`, `Grep`) ont été **retirés**
de `tools` : seul `Read` demeure, et `disable-model-invocation: true` empêche l'auto-invocation.
Même recopié, cet agent **ne peut plus écrire** ni en base ni dans le corpus RAG.

## Remplacement (méthode canon)

- **Successeur** : `wiki-proposal-writer` (`entity_type=constructeur`, ADR-033) + `automecanik-wiki/exports`.
  La vérité contenu vient du **WIKI** (sourcée, lintée, validée humainement), **jamais** du RAG.
- **Schéma constructeur** (SoT conservée) : `.spec/00-canon/brand-md-schema.md`.
- **Constants R7** (SoT code) : `backend/src/config/r7-keyword-plan.constants.ts`.

> Le fichier est **conservé** (non supprimé) pour ne pas casser les références des registres
> `.spec/00-canon/**` (`prompt-registry`, `artefact-registry`, `role-implementation-map`,
> `canon-registry`) ni les chaînes d'agents (`r7-brand-execution`, `agentic-planner`) : elles
> pointent désormais vers un agent inerte qui **STOP + redirige**.
>
> Réf : `audit/agent-instructions-audit-2026-07-18.md` (writers RAG→SEO indexé),
> `audit/rag-legacy-inventory-2026-07-02.md`. Rollback = `git revert`.
