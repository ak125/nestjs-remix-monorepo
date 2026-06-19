# Workspaces Claude Code — séparation dev / SEO / marketing / wiki

> Relocalisé depuis `CLAUDE.md` (2026-06-16, dégraissage P3). **On-demand** : pertinent
> uniquement au changement de cwd de session. `CLAUDE.md` garde un pointer.

Le monorepo expose **quatre racines de session** Claude Code distinctes :

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | 8 skills DEV (`code-review`, `db-migration`, `frontend-design`, `governance-vault-ops`, `responsive-audit`, `session-log`, `ui-ux-pro-max`, `vehicle-ops`) — **0 agents** R*, **0 skills SEO** | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | 39 agents R0-R8 + 16 skills SEO (`content-gen`, `kw-classify`, `pollution-scanner`, `seo-gamme-audit`, `r8-diversity-check`, `rag-check`, `v5-guardian`, …) | campagnes SEO, KW planning, content gen R*, RAG enrich |
| `/opt/automecanik/app/workspaces/marketing/` | 3 agents G1 marketing (LEAD/LOCAL/RETENTION en Phase 1-2 ADR-036) + canon brand voice + AEC | briefs marketing orientés conversion, posts GBP, retention, plan hebdo cross-units |
| `/opt/automecanik/app/workspaces/wiki/` | skill `wiki-proposal-writer` + canon ADR-033 + AEC | sas wiki documentaire (Phase 2 ADR-033), proposals frontmatter v2.0.0 |

Pour les batchs SEO : `cd workspaces/seo-batch && claude`. Voir `workspaces/seo-batch/README.md`.
Pour les sessions marketing : `cd workspaces/marketing && claude`. Voir `workspaces/marketing/README.md` (ADR-036).
Pour le sas wiki : `cd workspaces/wiki && claude`. Voir `workspaces/wiki/README.md` (ADR-033).
