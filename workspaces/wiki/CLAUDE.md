# CLAUDE.md — Workspace Wiki (AutoMecanik)

> Workspace dédié au sas wiki documentaire (ADR-031 / ADR-033) : production de proposals frontmatter v2.0.0, validation locale via les quality gates, anti-patterns figés ADR-033 §D3.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/wiki && claude
```

Le [contrat commun](../../CLAUDE.md) s'applique avec les rôles de [AGENTS.md](AGENTS.md).
Héritage des instructions, skills et mémoire : [carte des workspaces](../../.claude/knowledge/workspaces.md).
Avant d'agir, y appliquer **Sélection et application des skills**, même si la session
a démarré à la racine ; lire explicitement le skill WIKI retenu et ses références requises.

## Règles spécifiques wiki

Voir `.claude/rules/wiki-batch.md` pour :
- Sas markdown `automecanik-wiki/proposals/` ≠ sas DB `__rag_proposals` (ADR-022 L1, NE PAS confondre)
- Schema frontmatter v2.0.0 strict (canon `automecanik-wiki/_meta/schema/frontmatter.schema.json`)
- 9 quality gates Python (`_scripts/quality-gates.py` côté wiki repo)
- Anti-patterns figés ADR-033 §D3 (3 interdits absolus)
- Convention slug DB `__diag_symptom.slug` (anglais snake_case `brake_*`)
- Workflow `wiki-protected-paths.yml` (4 markers `metadata-backfill: | template-migration: | promotion-from-proposals: | rollback:`)

Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat de sortie obligatoire (AEC v1.0.0 — coverage manifest, 5 états séparés, statuts autorisés).

## Validation des consommateurs

**Critère go Partie 3 consommateurs** (DB / RAG / SEO / blog / diag / chatbot) : `wiki-readiness-check.py = READY` (PR-F). Tant que ce n'est pas vrai, **aucun branchement consommateur**. Big-bang quand la chaîne est prête (garde-fou utilisateur #12 : pas de bricolage hybride transitoire).

---

## Références

- ADR-031 (vault, accepted 2026-04-28) : 4-layer raw/wiki/exports/consumers
- ADR-032 (vault, accepted 2026-04-29, PR #107) : diagnostic & maintenance unification, bloc `entity_data.maintenance{}` cohabite avec `diagnostic_relations[]`
- ADR-033 (vault, accepted 2026-04-29, PR #108 commit `77085ef`) : wiki gamme `diagnostic_relations[]` contract, anti-patterns §D3
- canon frontmatter wiki : `automecanik-wiki/_meta/schema/frontmatter.schema.json` v2.0.0
- canon source registry : `automecanik-wiki/_meta/source-catalog.yaml` (PR wiki #9)
- contrat data downstream : `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0 (PR-A.rag mergée `224e4c63`)

---

_Workspace créé Phase 2 ADR-033 (PR-B) — voir `README.md` pour usage._
