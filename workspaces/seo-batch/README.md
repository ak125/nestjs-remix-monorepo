# SEO Batch Workspace

Claude Code project root pour les campagnes SEO AutoMecanik. Charge uniquement les 39 agents R0-R8 et les 16 skills SEO, sans les charger dans le workspace dev daily.

## Pourquoi ce workspace existe

Le `.claude/` à la racine du monorepo mélangait deux usages très différents :

| Workload | Fréquence | Surface utile |
|---|---|---|
| Dev monorepo daily (backend, frontend, refactor, CI) | tous les jours | 8 skills dev (`code-review`, `frontend-design`, `responsive-audit`, `vehicle-ops`, …) |
| Batchs SEO (KW planning, content gen, RAG enrich) | par campagnes | 39 agents R*-* + 16 skills SEO |

Avant la séparation, **chaque session Claude Code chargeait les 47 agents/skills SEO en system prompt** même pour des fixes backend triviaux. La séparation par workspace utilise le mécanisme natif Claude Code (un `.claude/` lié au cwd) — pas de hook custom, pas d'archivage.

## Usage

```bash
# Session SEO (charge les 39 agents + 16 skills SEO)
cd /opt/automecanik/app/workspaces/seo-batch && claude

# Session dev daily (ne charge AUCUN des agents R*)
cd /opt/automecanik/app && claude
```

## Contenu

- `.claude/agents/` : 39 agents R0-R8 (`r0-home-execution`, `r1-keyword-planner`, `r2-product-validator`, ..., `r8-vehicle-validator`) + `_shared/`
- `.claude/skills/` : 16 skills SEO (voir liste ci-dessous)
- `.claude/rules/` : règles SEO + contrat de sortie agents
- `.claude/settings.json` : hooks PreToolUse / PostToolUse / Stop (mêmes scripts que monorepo, paths absolus)
- `CLAUDE.md` : pointer vers gouvernance + règles SEO spécifiques

### Skills SEO inclus

`content-audit`, `content-gen`, `content-quality-gate`, `keyword-planner`, `kw-classify`, `legacy-recycler`, `pipeline-orchestrator`, `pollution-scanner`, `r8-diversity-check`, `rag-check`, `rag-ops`, `seo-content-architect`, `seo-gamme-audit`, `seo-vault-verify`, `surgical-cleaner`, `v5-guardian`.

### Skills DEV restés en monorepo racine

`code-review`, `db-migration`, `frontend-design`, `governance-vault-ops`, `responsive-audit`, `session-log`, `ui-ux-pro-max`, `vehicle-ops`.

## Quand basculer ?

| Tâche | Workspace |
|---|---|
| KW planning gamme/véhicule | `seo-batch` |
| Génération contenu R1-R8 | `seo-batch` |
| Audit gamme / pollution scan / diversity check | `seo-batch` |
| RAG enrich / refresh | `seo-batch` |
| Fix bug backend / frontend | monorepo racine |
| Refactor, new feature dev, ADR exec | monorepo racine |
| Governance vault, code review, deploy | monorepo racine |
