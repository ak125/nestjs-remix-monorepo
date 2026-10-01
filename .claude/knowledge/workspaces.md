# Workspaces Claude Code — séparation dev / SEO / marketing / wiki

> Relocalisé depuis `CLAUDE.md` (2026-06-16, dégraissage P3). **On-demand** : pertinent
> uniquement au changement de cwd de session. `CLAUDE.md` garde un pointer.

Le monorepo expose **quatre racines de session** Claude Code distinctes :

Les décomptes ne sont pas recopiés ici (ils périment au premier skill ajouté) : le hook
SessionStart (`scripts/claude-hooks/sessionstart-workspace-context.sh`) les compte sur disque à
chaque session ; la liste = `ls <cwd>/.claude/skills/`.

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | skills DEV de `.claude/skills/` — **0 agents** R*, **0 skills SEO** | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | agents R0-R8 (`.claude/agents/`) + skills SEO (`.claude/skills/` : `content-gen`, `kw-classify`, `pollution-scanner`, `seo-gamme-audit`, `r8-diversity-check`, `rag-check`, `v5-guardian`, …) | campagnes SEO, KW planning, content gen R*, RAG enrich |
| `/opt/automecanik/app/workspaces/marketing/` | agents G1 marketing (LEAD/LOCAL/RETENTION en Phase 1-2 ADR-036) + skills marketing (`.claude/skills/`) + canon brand voice + AEC | briefs marketing orientés conversion, posts GBP, retention, plan hebdo cross-units |
| `/opt/automecanik/app/workspaces/wiki/` | skill `wiki-proposal-writer` + canon ADR-033 + AEC | sas wiki documentaire (Phase 2 ADR-033), proposals frontmatter v2.0.0 |

Pour les batchs SEO : `cd workspaces/seo-batch && claude`. Voir `workspaces/seo-batch/README.md`.
Pour les sessions marketing : `cd workspaces/marketing && claude`. Voir `workspaces/marketing/README.md` (ADR-036).
Pour le sas wiki : `cd workspaces/wiki && claude`. Voir `workspaces/wiki/README.md` (ADR-033).
