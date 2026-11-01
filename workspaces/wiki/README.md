# Wiki Workspace

Workspace pour la production de fiches `automecanik-wiki/proposals/<slug>.md` au format ADR-033 v2.0.0. Les rôles et restrictions sont décrits dans [AGENTS.md](AGENTS.md) ; les règles locales dans [CLAUDE.md](CLAUDE.md).

## Origine du workspace

ADR-033 a redéfini le frontmatter des fiches gamme : retrait de `entity_data.symptoms[]` (anti-pattern, la pièce ne possède pas le symptôme), ajout de `diagnostic_relations[]` top-level (FK strict vers `__diag_symptom.slug`). 5 pilotes G6 + 9 quality gates Python sont déjà mergés côté wiki repo (PR wiki #8 + #9). Le plan initial prévoyait :

1. Propager le canon vers le monorepo (PR-A.rag mergée pour `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0).
2. Outiller la production de proposals — c'est ce workspace.
3. Outiller la validation — c'est PR-C downstream (validateur TS + CI bloquant).
4. Outiller la migration des 500+ fiches gamme legacy — c'est PR-D + PR-E downstream.

## Usage et chargement

```bash
cd /opt/automecanik/app/workspaces/wiki && claude
```

Les instructions et skills parents restent applicables. Voir la
[carte commune des workspaces](../../.claude/knowledge/workspaces.md) pour les autres
points d'entrée et les limites de découverte ; ce dossier ne constitue pas une isolation technique.

## Contenu

- `.claude/skills/wiki-proposal-writer/` : skill principal — produit un fichier `automecanik-wiki/proposals/<slug>.md` avec frontmatter ADR-033 v2.0.0 strict (mode propose-only, 0-LLM pour structure et contrôles, Anthropic seul pour rédactionnel et relecture française de la réponse).
- `.claude/agents/` : définitions locales ; consulter [AGENTS.md](AGENTS.md) pour les rôles et restrictions. Le `pipeline-orchestrator` SEO reste un détecteur de couverture en lecture seule, pas un générateur de contenu.
- `.claude/rules/wiki-batch.md` : règles spécifiques wiki (sas markdown vs sas DB, schema strict, 9 quality gates, 3 anti-patterns figés ADR-033 §D3, convention slug DB).
- `.claude/canon-mirrors/agent-exit-contract.md` : copie canon distribuée depuis vault (hash SHA-256 vérifié CI).
- `.claude/settings.json` : hooks PreToolUse / PostToolUse / Stop (mêmes scripts que monorepo, paths absolus).
- `CLAUDE.md` : pointer vers gouvernance + règles wiki spécifiques.

## Jalons du plan initial — historiques

Ces jalons conservent le plan initial ; ils ne décrivent pas l’état courant du checkout.
Revalider les réalisations et les preuves du lot demandé avant une reprise.

**Phase 1 (closed 2026-04-30)** — scaffold + 5 pilotes G6 + 9 quality gates Python : PR wiki #8 (`989cb0cc`) + raw #6 (`361e9b0b`) + wiki #9 (`ee5ee3c4`) mergées.

**Phase 2 (planifiée J+3 → J+9)** — propagation canon ADR-033 monorepo + skill `wiki-proposal-writer` + validateur TS + CI bloquant. Plan rev 3 (`/home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md`) :
- ✅ PR-A.rag : `GammeContentContract.v1` → `v2.0` mergée commit `224e4c63`
- 🟡 PR-B : ce workspace (cette PR)
- ⏳ PR-C : validateur TS `validate-gamme-diagnostic-relations.ts` + workflow `wiki-validate.yml`

**Phase 3 (J+10 → J+16)** — cron export `diag-canon-slugs.json` (PR-D) + migration progressive 500+ fiches gamme (PR-E batch `--per-system freinage` pilote).

**Phase Maturité G9-B (J+17 → J+30)** — `wiki-readiness-check.py` (PR-F, critère go Partie 3) + cron audit hebdo + rollback drill.

**Critère go Partie 3 consommateurs** (DB `__seo_*`, RAG ingestion, SEO R0-R8, blog, diagnostic, chatbot) : `wiki-readiness-check.py = READY`. Tant que ce n'est pas vrai, aucun branchement consommateur. Big-bang quand la chaîne est prête.

## Références

- ADR-031 vault (4-layer raw/wiki/exports/consumers)
- ADR-032 vault (`entity_data.maintenance{}` cohabite avec `diagnostic_relations[]`)
- ADR-033 vault (`diagnostic_relations[]` canon, anti-patterns §D3)
- Plan rev 3 : `/home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md`
- canon frontmatter : `automecanik-wiki/_meta/schema/frontmatter.schema.json`
- canon source registry : `automecanik-wiki/_meta/source-catalog.yaml`
- canon DB convention : mémoire `diag-symptom-db-convention.md`
