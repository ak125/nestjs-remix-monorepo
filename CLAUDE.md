# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Detailed rules in `.claude/rules/`: backend, frontend, payments, deployment, agent-teams, context7

## Presentation des reponses

**Ordre de lecture naturel :** Toujours structurer les reponses pour une lecture de haut en bas :
- Contexte/historique en haut
- Actions/modifications au milieu
- Resultat final et informations importantes en bas (le plus visible)

## Project Overview

This is a production-ready NestJS + Remix monorepo for an automotive parts e-commerce platform. The backend (NestJS) serves both the API and the frontend (Remix) on the same port (3000) in development and production.

**Key Stats:**
- 4M+ products, 59k+ users, 9k+ categories
- Production deployment with Docker + Caddy reverse proxy
- Database: Supabase (PostgreSQL) - pas de Prisma

## Source of Truth (00-canon)

Les fichiers canoniques definissent la verite du projet. Toujours consulter ces fichiers en priorite.

| Fichier | Contenu |
|---------|---------|
| `.spec/00-canon/repo-map.md` | Structure monorepo (40 modules, 158 routes, 9 packages) |
| `.spec/00-canon/architecture.md` | Architecture technique NestJS/Remix/Supabase/Redis |
| `.spec/00-canon/rules.md` | 7 regles non-negociables du projet |

**RAG Knowledge:** Le corpus RAG est dans `/opt/automecanik/rag/knowledge/` (14 docs valides avec truth_level L1/L2).

## Common Commands

### Development
```bash
# Start full stack (backend + frontend on port 3000)
npm run dev

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Start with Redis (required for sessions)
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine
npm run dev
```

### Building
```bash
# Build all packages (uses Turbo)
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build

# Clean build artifacts
cd backend && npm run prebuild  # removes dist/ and tsconfig.tsbuildinfo
```

### Testing (curl)
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/catalog/families
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"xxx"}'
curl -s http://localhost:3000/api/catalog/families | jq '.data[:3]'
curl -b cookies.txt -c cookies.txt http://localhost:3000/api/user/profile
```

### Linting & Type Checking
```bash
npm run lint
npm run typecheck
cd backend && npm run lint -- --fix
cd frontend && npm run lint -- --fix
```

### Production
```bash
npm run start
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f app
```

### GitHub CLI (gh)
```bash
gh pr create --title "feat: description" --body "Description detaillee"
gh pr list
gh pr view 18
gh pr merge 18 --merge
gh issue create --title "Bug: description" --body "Details"
gh pr checks
```

## Git Workflow & Deploiement

**REGLE ABSOLUE : Push sur `main` = VALIDATION MANUELLE OBLIGATOIRE**

1. **Ne JAMAIS push sur `main`** sans approbation explicite de l'utilisateur
2. `main` = production automatique (deploiement immediat)
3. Workflow :
   - Travailler sur branche feature ou directement
   - Tester localement avec curl
   - **DEMANDER VALIDATION** avant tout push sur main
   - Attendre confirmation explicite ("ok push", "go", "valide")
   - Seulement apres : `git push origin main`

### Commits par Session (CRITIQUE)

> **REGLE ABSOLUE** : Ne committer QUE les fichiers de la session en cours !

**Avant chaque commit, verifier :**
```bash
git status
git diff --name-only origin/main
git reset HEAD backend/src/modules/<module-non-teste>/
```

## Common Pitfalls

1. **Redis Required:** Backend won't start without Redis for sessions
2. **Port 3000 Shared:** Backend serves frontend on the same port
3. **Payment Signatures:** Always verify HMAC signatures on callbacks (SHA512 Paybox, SHA256 SystemPay)
4. **Supabase RLS:** Use service role key in backend, anon key in frontend
5. **TypeScript Compilation:** Wait for `tsc --build` before testing changes
6. **Turbo Cache:** If builds seem stale: `npm run clean-turbo-cache`
7. **Memory Limits:** Backend build uses `--max-old-space-size=4096`

## Incidents et Post-Mortems

### 2026-01-11 : Crash Production (Module rm/)

**Cause :** Push du module `rm/` qui importe `@monorepo/shared-types` non lie dans Docker.

**Symptome :**
```
Error: Cannot find module '@monorepo/shared-types'
Require stack:
- /app/backend/dist/modules/rm/services/rm-listing.service.js
```

**Impact :** Site down ~15 minutes (Cloudflare 521)

**Lecon :** Toujours verifier que les imports sont resolus dans le build Docker avant push.

## Key Files to Reference

- `backend/src/main.ts` - NestJS bootstrap, middleware setup
- `backend/src/app.module.ts` - Root module with all imports
- `frontend/app/root.tsx` - Remix root with providers
- `frontend/app/routes/_index.tsx` - Homepage
- `turbo.json` - Monorepo build pipeline
- `docker-compose.prod.yml` - Production deployment
