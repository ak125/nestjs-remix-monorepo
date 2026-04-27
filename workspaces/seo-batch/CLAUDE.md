# CLAUDE.md — Workspace SEO Batch (AutoMecanik)

> Workspace dédié aux campagnes SEO : keyword planning R0-R8, content generation, RAG enrichment, audits gammes et véhicules.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/seo-batch && claude
```

Cette racine charge **uniquement** :
- 39 agents R0-R8 (`*-keyword-planner`, `*-content-batch`, `*-validator`, `*-execution`)
- 16 skills SEO (`content-gen`, `kw-classify`, `pollution-scanner`, `seo-gamme-audit`, `r8-diversity-check`, `rag-check`, `v5-guardian`, etc.)
- Règles SEO + contrat de sortie agents

Pour le dev quotidien (backend NestJS, frontend Remix, hooks, refactor, CI, governance vault), utilise plutôt la racine monorepo `/opt/automecanik/app/` qui ne charge **pas** ces 39 agents.

## Règles génériques (héritées du monorepo)

Les règles globales suivantes s'appliquent même en SEO workspace — voir `/opt/automecanik/app/CLAUDE.md` pour le détail :

- **Source de vérité gouvernance** : `/opt/automecanik/governance-vault/` (jamais écrire dans `app/.local/`)
- **Vérifier l'existant AVANT d'inventer** : grep racine, lire `.claude/knowledge/`, `MEMORY.md`
- **3-VPS Architecture** : DEV `46.224.118.55` = SoT, PROD `49.12.233.2` = read-only mirror, AI-COS `178.104.1.118` = agents IA
- **Démarrage de session** : lire `/opt/automecanik/app/log.md` pour le contexte récent

## Règles spécifiques SEO

Voir `.claude/rules/seo-batch.md` pour :
- Sources RAG (`/opt/automecanik/rag/knowledge/`) — jamais seed depuis LLM
- Pièges DB connus (`gamme_aggregates`, V-Level v5.0, vehicles)
- Anti-patterns (parts-feed re-scrape, naming "tecdoc")

## Mémoire & contexte

L'auto-memory Claude Code utilise un store distinct par workspace : ce workspace écrit dans `~/.claude/projects/-opt-automecanik-app-workspaces-seo-batch/memory/`. Le contexte SEO ne pollue donc pas la mémoire dev daily.

L'index `MEMORY.md` du monorepo (`-opt-automecanik-app/memory/`) reste consultable manuellement pour les faits cross-workload (V-Level, gamme_aggregates, etc.).

---

_Workspace créé pour séparer la surface d'outils (39 agents + 16 skills SEO) du daily dev — voir `README.md` pour la motivation._
