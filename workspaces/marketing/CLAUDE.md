# CLAUDE.md — Workspace Marketing (AutoMecanik)

> Workspace dédié aux agents marketing G1 (ADR-036) : briefs orientés conversion, posts GBP, campagnes retention, plan hebdo cross-units.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/marketing && claude
```

Cette racine charge **uniquement** :
- 3 agents G1 marketing (Phase 1-2)
- skills marketing-relevant (au démarrage, réutilise via paths partagés)
- canon brand voice (`marketing-voice.md` distribué depuis vault)
- contrat de sortie agents (`agent-exit-contract.md` distribué depuis vault)

Pour le dev quotidien (backend NestJS, frontend Remix, hooks, refactor, CI, governance vault), utilise plutôt la racine monorepo `/opt/automecanik/app/`. Pour les campagnes SEO R0-R8, utilise `/opt/automecanik/app/workspaces/seo-batch/`.

## Règles génériques (héritées du monorepo)

Les règles globales suivantes s'appliquent même en marketing workspace — voir `/opt/automecanik/app/CLAUDE.md` pour le détail :

- **Source de vérité gouvernance** : `/opt/automecanik/governance-vault/` (jamais écrire dans `app/.local/`)
- **Vérifier l'existant AVANT d'inventer** : grep racine, lire `.claude/knowledge/`, `MEMORY.md`. Le module marketing backend `backend/src/modules/marketing/` existe déjà avec 9 services — JAMAIS le dupliquer, étendre.
- **3-VPS Architecture** : DEV `46.224.118.55` = SoT, PROD `49.12.233.2` = read-only mirror, AI-COS `178.104.1.118` = agents IA
- **Démarrage de session** : lire `/opt/automecanik/app/log.md` pour le contexte récent

## Règles spécifiques marketing

Voir `.claude/rules/marketing-batch.md` pour :
- Scope par agent (LOCAL only / ECOMMERCE primary+HYBRID / coordination cross-units)
- DTO Zod refinements (conversion_goal, business_unit, HYBRID 5 conditions)
- RGPD non-négociable (`marketing_consent_at IS NOT NULL` filtre dur RETENTION)
- Verrou `local_canon.validated=true` (sinon BLOCK systématique LOCAL/HYBRID)
- Anti-patterns écartés (.md flottants, schema Paperclip inventé, prédiction LLM, constantes magiques, etc.)

Voir `.claude/rules/marketing-voice.md` pour la voix de marque (canon vault).

Voir `.claude/rules/agent-exit-contract.md` pour le contrat de sortie obligatoire (AEC v1.0.0 — coverage manifest, 5 états séparés, statuts autorisés).

## Mémoire & contexte

L'auto-memory Claude Code utilise un store distinct par workspace : ce workspace écrit dans `~/.claude/projects/-opt-automecanik-app-workspaces-marketing/memory/`. Le contexte marketing ne pollue donc pas la mémoire dev daily ni SEO.

L'index `MEMORY.md` du monorepo (`-opt-automecanik-app/memory/`) reste consultable manuellement pour les faits cross-workload.

## Phase actuelle

**Phase 0 (en cours)** — gouvernance & socle :
- ADR-036 mergé côté vault ✅ (commit `2ab39944`)
- Canon brand voice distribué (`marketing-voice.md` SHA-256 vérifié)
- Workflow CI hash check (`marketing-voice-hash.yml`) opérationnel
- Workspace scaffold (ce dossier)
- Pré-requis Phase 1 = merge PR monorepo #222 (OperatingMatrixService)

**Phase 1 (à venir)** — pilote LOCAL-BUSINESS :
- Migration DB (`__marketing_brief` + `__marketing_feedback` + `__retention_trigger_rules` + `users.marketing_consent_at`)
- Agent `local-business-agent.md` créé ici
- Routine Paperclip `rt-local-gbp-week`
- Extension OperatingMatrixService (enum `MARKETING`)
- Routes admin `/admin/marketing/briefs` + `/admin/marketing/feedback`

**Décisions ouvertes bloquantes Phase 1** :
1. Nom légal exact magasin 93 (raison sociale RCS Bobigny + phone + opening_hours) — bloquant pour `local_canon.validated=true`
2. QTO humain assigné (mode dégradé CEO par défaut)

---

_Workspace créé Phase 0 ADR-036 — voir `README.md` pour la motivation et les phases suivantes._
