# CLAUDE.md — Workspace Wiki (AutoMecanik)

> Workspace dédié au sas wiki documentaire (ADR-031 / ADR-033) : production de proposals frontmatter v2.0.0, validation locale via les quality gates, anti-patterns figés ADR-033 §D3.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/wiki && claude
```

Cette racine charge **uniquement** :
- skill `wiki-proposal-writer` (Phase 5 ADR-033)
- agents wiki orchestrateurs (Phase 4 future, pour la migration `entity_data.symptoms[]` → `diagnostic_relations[]`)
- canon `agent-exit-contract.md` distribué depuis vault (hash SHA-256 vérifié CI)
- règles spécifiques wiki (`wiki-batch.md`)

Pour le dev quotidien (backend NestJS, frontend Remix, hooks, refactor, CI, governance vault), utilise plutôt la racine monorepo `/opt/automecanik/app/`. Pour les campagnes SEO R0-R8, utilise `workspaces/seo-batch/`. Pour les briefs marketing G1, utilise `workspaces/marketing/`.

## Règles génériques (héritées du monorepo)

Les règles globales suivantes s'appliquent même en wiki workspace — voir `/opt/automecanik/app/CLAUDE.md` pour le détail :

- **Source de vérité gouvernance** : `/opt/automecanik/governance-vault/` (jamais écrire dans `app/.local/`)
- **Vérifier l'existant AVANT d'inventer** : grep `automecanik-wiki/_meta/`, lire `_meta/source-catalog.yaml` et `_meta/templates/gamme.md` v2.0.0 (canon vivant côté wiki repo). Le validateur Python `_scripts/quality-gates.py` côté wiki implemente déjà 9 gates ADR-033/032 — JAMAIS dupliquer la logique.
- **3-VPS Architecture** : DEV `46.224.118.55` = SoT, PROD `49.12.233.2` = read-only mirror, AI-COS `178.104.1.118` = agents IA
- **Démarrage de session** : lire `/opt/automecanik/app/log.md` pour le contexte récent

## Règles spécifiques wiki

Voir `.claude/rules/wiki-batch.md` pour :
- Sas markdown `automecanik-wiki/proposals/` ≠ sas DB `__rag_proposals` (ADR-022 L1, NE PAS confondre)
- Schema frontmatter v2.0.0 strict (canon `automecanik-wiki/_meta/schema/frontmatter.schema.json`)
- 9 quality gates Python (`_scripts/quality-gates.py` côté wiki repo)
- Anti-patterns figés ADR-033 §D3 (3 interdits absolus)
- Convention slug DB `__diag_symptom.slug` (anglais snake_case `brake_*`)
- Workflow `wiki-protected-paths.yml` (4 markers `metadata-backfill: | template-migration: | promotion-from-proposals: | rollback:`)

Voir `.claude/rules/agent-exit-contract.md` pour le contrat de sortie obligatoire (AEC v1.0.0 — coverage manifest, 5 états séparés, statuts autorisés).

## Mémoire & contexte

L'auto-memory Claude Code utilise un store distinct par workspace : ce workspace écrit dans `~/.claude/projects/-opt-automecanik-app-workspaces-wiki/memory/`. Le contexte wiki ne pollue donc pas la mémoire dev daily ni SEO ni marketing.

L'index `MEMORY.md` du monorepo (`-opt-automecanik-app/memory/`) reste consultable manuellement pour les faits cross-workload (notamment `mvp-g6-adr033-handoff.md`, `diag-symptom-db-convention.md`, `feedback_wiki_scope_discipline.md`).

## Phase actuelle

**Phase 1 (closed)** — scaffold wiki/raw + 5 pilotes G6 + 9 quality gates Python (PR wiki #8 + raw #6 + wiki #9 mergées 2026-04-30).

**Phase 2 (en cours)** — propagation canon ADR-033 monorepo + skill `wiki-proposal-writer` (cette PR-B) + validateur TS + CI bloquant (PR-C).

**Phase 3 (à venir)** — cron export `diag-canon-slugs.json` + migration progressive `entity_data.symptoms[]` → `diagnostic_relations[]` sur 500+ fiches gamme.

**Critère go Partie 3 consommateurs** (DB / RAG / SEO / blog / diag / chatbot) : `wiki-readiness-check.py = READY` (PR-F). Tant que ce n'est pas vrai, **aucun branchement consommateur**. Big-bang quand la chaîne est prête (garde-fou utilisateur #12 : pas de bricolage hybride transitoire).

---

## Références

- ADR-031 (vault, accepted 2026-04-28) : 4-layer raw/wiki/exports/consumers
- ADR-032 (vault, accepted 2026-04-29, PR #107) : diagnostic & maintenance unification, bloc `entity_data.maintenance{}` cohabite avec `diagnostic_relations[]`
- ADR-033 (vault, accepted 2026-04-29, PR #108 commit `77085ef`) : wiki gamme `diagnostic_relations[]` contract, anti-patterns §D3
- canon frontmatter wiki : `automecanik-wiki/_meta/schema/frontmatter.schema.json` v2.0.0
- canon source registry : `automecanik-wiki/_meta/source-catalog.yaml` (PR wiki #9)
- contrat data downstream : `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0 (PR-A.rag mergée `224e4c63`)
- Plan rev 3 : `/home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md`

---

_Workspace créé Phase 2 ADR-033 (PR-B) — voir `README.md` pour usage._
