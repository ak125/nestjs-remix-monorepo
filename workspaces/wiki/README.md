# Wiki Workspace

Claude Code project root pour la production de fiches `automecanik-wiki/proposals/<slug>.md` au format ADR-033 v2.0.0. Charge uniquement le skill `wiki-proposal-writer` + agents wiki orchestrateurs (Phase 4 future), sans charger les 39 agents R0-R8 SEO, les 8 skills dev daily, ni les 3 agents G1 marketing.

## Pourquoi ce workspace existe

ADR-033 a redéfini le frontmatter des fiches gamme : retrait de `entity_data.symptoms[]` (anti-pattern, la pièce ne possède pas le symptôme), ajout de `diagnostic_relations[]` top-level (FK strict vers `__diag_symptom.slug`). 5 pilotes G6 + 9 quality gates Python sont déjà mergés côté wiki repo (PR wiki #8 + #9). La suite est de :

1. Propager le canon vers le monorepo (PR-A.rag mergée pour `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0).
2. Outiller la production de proposals — c'est ce workspace.
3. Outiller la validation — c'est PR-C downstream (validateur TS + CI bloquant).
4. Outiller la migration des 500+ fiches gamme legacy — c'est PR-D + PR-E downstream.

Mélanger les agents wiki avec les 39 agents R0-R8 SEO (`workspaces/seo-batch/`) ou les 3 agents G1 marketing (`workspaces/marketing/`) diluerait le scope. Le pattern dual-workspace (PR #200) est étendu ici — 4 racines Claude Code distinctes :

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | 8 skills DEV | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | 39 agents R0-R8 + 16 skills SEO | campagnes SEO, KW planning, content gen, RAG enrich |
| `/opt/automecanik/app/workspaces/marketing/` | 3 agents G1 marketing + skills marketing-relevant | briefs marketing, GBP posts, retention campaigns |
| `/opt/automecanik/app/workspaces/wiki/` | skill `wiki-proposal-writer` + agents wiki orchestrateurs | proposals frontmatter ADR-033, migration `entity_data.symptoms[]` → `diagnostic_relations[]` |

## Usage

```bash
# Session wiki (charge uniquement le skill wiki-proposal-writer + agents wiki future)
cd /opt/automecanik/app/workspaces/wiki && claude

# Session marketing (charge les 3 agents G1 marketing)
cd /opt/automecanik/app/workspaces/marketing && claude

# Session SEO (charge les 39 agents R0-R8)
cd /opt/automecanik/app/workspaces/seo-batch && claude

# Session dev daily (ne charge AUCUN agent métier)
cd /opt/automecanik/app && claude
```

## Contenu

- `.claude/skills/wiki-proposal-writer/` : skill principal — produit un fichier `automecanik-wiki/proposals/<slug>.md` avec frontmatter ADR-033 v2.0.0 strict (mode propose-only, 0-LLM pour structure, Anthropic seul pour rédactionnel).
- `.claude/agents/` : agents wiki orchestrateurs (Phase 4 ADR-033, vide aujourd'hui — modèle pattern `pipeline-orchestrator` du seo-batch pour migration progressive `entity_data.symptoms[]` → `diagnostic_relations[]` sur 500+ fiches gamme).
- `.claude/rules/wiki-batch.md` : règles spécifiques wiki (sas markdown vs sas DB, schema strict, 9 quality gates, 3 anti-patterns figés ADR-033 §D3, convention slug DB).
- `.claude/canon-mirrors/agent-exit-contract.md` : copie canon distribuée depuis vault (hash SHA-256 vérifié CI).
- `.claude/settings.json` : hooks PreToolUse / PostToolUse / Stop (mêmes scripts que monorepo, paths absolus).
- `CLAUDE.md` : pointer vers gouvernance + règles wiki spécifiques.

## Phase actuelle

**Phase 1 (closed 2026-04-30)** — scaffold + 5 pilotes G6 + 9 quality gates Python : PR wiki #8 (`989cb0cc`) + raw #6 (`361e9b0b`) + wiki #9 (`ee5ee3c4`) mergées.

**Phase 2 (en cours, J+3 → J+9)** — propagation canon ADR-033 monorepo + skill `wiki-proposal-writer` + validateur TS + CI bloquant. Plan rev 3 (`/home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md`) :
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
