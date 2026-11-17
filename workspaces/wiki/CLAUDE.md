# CLAUDE.md — Workspace Wiki (AutoMecanik)

> Workspace dédié au sas wiki documentaire (ADR-031 / ADR-033) : production de proposals frontmatter v2.0.0, validation locale via les quality gates, anti-patterns figés ADR-033 §D3.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/wiki && claude
```

Le [contrat commun](../../CLAUDE.md) s'applique avec les rôles de [AGENTS.md](AGENTS.md).
Héritage des instructions, skills et mémoire : [carte des workspaces](../../.claude/knowledge/workspaces.md).

## Règles spécifiques wiki

Voir `.claude/rules/wiki-batch.md` pour :
- Sas markdown `automecanik-wiki/proposals/` ≠ sas DB `__rag_proposals` (ADR-022 L1, NE PAS confondre)
- Schema frontmatter v2.0.0 strict (canon `automecanik-wiki/_meta/schema/frontmatter.schema.json`)
- 9 quality gates Python (`_scripts/quality-gates.py` côté wiki repo)
- Anti-patterns figés ADR-033 §D3 (3 interdits absolus)
- Convention slug DB `__diag_symptom.slug` (anglais snake_case `brake_*`)
- Workflow `wiki-protected-paths.yml` (4 markers `metadata-backfill: | template-migration: | promotion-from-proposals: | rollback:`)

Voir `.claude/canon-mirrors/agent-exit-contract.md` à la racine du monorepo pour le contrat de sortie obligatoire (AEC : coverage manifest, 5 états séparés, statuts autorisés ; version dans son en-tête). C'est la copie déclarée, générée depuis sa source et contrôlée par hash. La copie locale `.claude/canon-mirrors/agent-exit-contract.md` du workspace (v1.0.0) est périmée et ne fait pas foi ; son retrait attend l'étape 2 du plan de sortie du vault (contradiction D16, mandat AR-4).

## Validation des consommateurs

**Critère go Partie 3 consommateurs** (DB / RAG / SEO / blog / diag / chatbot) : `wiki-readiness-check.py = READY` (PR-F). Tant que ce n'est pas vrai, **aucun branchement consommateur**. Big-bang quand la chaîne est prête (garde-fou utilisateur #12 : pas de bricolage hybride transitoire).

---

## Références

- Règles en vigueur : P10 et P19 du journal des principes (`.claude/governance/journal-des-principes.md`, racine du monorepo). Les ADR ci-dessous en sont l'origine, dans l'archive du vault.
- ADR-031 (archive du vault, accepted 2026-04-28) : 4-layer raw/wiki/exports/consumers
- ADR-032 (archive du vault, accepted 2026-04-29, PR #107) : diagnostic & maintenance unification, bloc `entity_data.maintenance{}` cohabite avec `diagnostic_relations[]`
- ADR-033 (archive du vault, accepted 2026-04-29, PR #108 commit `77085ef`) : wiki gamme `diagnostic_relations[]` contract, anti-patterns §D3
- canon frontmatter wiki : `automecanik-wiki/_meta/schema/frontmatter.schema.json` v2.0.0
- canon source registry : `automecanik-wiki/_meta/source-catalog.yaml` (PR wiki #9)
- contrat data downstream : `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0 (PR-A.rag mergée `224e4c63`)

---

_Workspace créé Phase 2 ADR-033 (PR-B) — voir `README.md` pour usage._
