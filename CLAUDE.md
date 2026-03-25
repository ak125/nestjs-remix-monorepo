# CLAUDE.md

> Derniere revision : 2026-03-25

Detailed rules in `.claude/rules/`: backend, frontend, payments, deployment, agent-teams, context7

## Regle #0 — TOUJOURS demander avant d'agir

**JAMAIS prendre de decision seul.** Presenter les options, attendre validation AVANT d'implementer. Si ambiguite : poser la question. Format : "Je propose X car Y. Tu valides ?" — puis ATTENDRE.

## Regle #1 — Nettoyer au fur et a mesure

Supprimer fichiers obsoletes/doublons apres refactoring. Verifier qu'un equivalent n'existe pas avant de creer. Cible : `.spec/`, `scripts/`, composants, services, configs temporaires.

## Presentation des reponses

Ordre haut→bas : contexte, actions, resultat final (le plus visible en bas).

## Project Overview

NestJS + Remix monorepo, e-commerce pieces auto. Backend sert API + frontend sur port 3000.
- 4M+ produits, 59k+ users, 9k+ categories
- Docker + Caddy, DB Supabase (pas de Prisma)

## Infrastructure

| Env | Serveur | Role |
|-----|---------|------|
| DEV | `46.224.118.55` (`/opt/automecanik/app`) | Claude Code, tests |
| PROD | `49.12.233.2` | Deploye par GitHub Actions |

`git push main` → CI/CD → Docker → deploiement auto PROD. Claude Code = DEV uniquement.

## Source of Truth

| Fichier | Contenu |
|---------|---------|
| `.spec/00-canon/repo-map.md` | Structure monorepo |
| `.spec/00-canon/architecture.md` | Architecture technique |
| `.spec/00-canon/rules.md` | 7 regles non-negociables |

RAG Knowledge : `/opt/automecanik/rag/knowledge/` (~318 fichiers .md)

## Common Commands

```bash
npm run dev                    # Full stack (port 3000)
npm run build                  # Build all (Turbo)
npm run lint && npm run typecheck
curl http://localhost:3000/health
```

## Git Workflow

**Push sur `main` = VALIDATION MANUELLE OBLIGATOIRE** (deploiement immediat en prod).
Ne committer QUE les fichiers de la session en cours. Verifier `git status` + `git diff --name-only origin/main` avant chaque commit.

## Common Pitfalls

1. Redis requis pour sessions
2. Port 3000 partage backend/frontend
3. Payment : HMAC SHA512 (Paybox), SHA256 (SystemPay), `timingSafeEqual` obligatoire
4. Supabase : service role key backend, anon key frontend
5. Turbo cache stale : `npm run clean-turbo-cache`
6. Memory limit : `--max-old-space-size=4096`

## Governance & Security

**Airlock** : mode `observe`, bundles `/opt/automecanik/airlock/inbox/`
**RPC Gate** : `enforce` P2. P0=BLOCK_ALL(7), P1=SERVICE_ROLE(17), P2=ALLOWLIST(40). Service: `backend/src/security/rpc-gate/rpc-gate.service.ts`
**Governance Vault** : `/opt/automecanik/governance-vault/`, 10 ADRs
**Hooks** : bash-guard, file-guard, supabase-guard, lint-check (voir `.claude/settings.json`)

## Incident 2026-01-11

Module `rm/` importe `@monorepo/shared-types` non lie en Docker → crash prod 15min. Lecon : verifier imports resolus dans Docker avant push.

## Key Files

`backend/src/main.ts`, `backend/src/app.module.ts`, `frontend/app/root.tsx`, `frontend/app/routes/_index.tsx`, `turbo.json`, `docker-compose.prod.yml`
