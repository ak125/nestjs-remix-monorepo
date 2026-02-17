# Implementation Plan - Module Marketing

## Approche

MVP en 3 pages avec agent teams (Template 1 - Couche technique).

## Agents

| Agent | Model | Scope | Fichiers |
|-------|-------|-------|----------|
| **Lead** | Opus | Migration SQL, coordination, seed data, verification | MCP Supabase, curl, lint |
| **Backend Agent** | Sonnet | Module NestJS complet (MVP) | `backend/src/modules/marketing/**`, `app.module.ts`, `packages/database-types/` |
| **Frontend Agent** | Sonnet | 3 routes MVP + sidebar | `frontend/app/routes/admin.marketing*`, `AdminSidebar.tsx` |

## Sequencing

```
Phase 1 (Lead)          Phase 2 (parallele)              Phase 3 (Lead)
┌──────────────────┐    ┌──────────────────────────┐     ┌──────────────────┐
│ Migration SQL    │───→│ Backend Agent             │───→│ Seed data GSC    │
│ 6 tables via MCP │    │ - marketing.module.ts     │    │ Import backlinks │
│                  │    │ - 3 controllers           │    │ Import roadmap   │
│                  │    │ - 4 services              │    │ Snapshot KPI     │
│                  │    │ - data service            │    │                  │
│                  │    │ - interfaces              │    │ npm run lint     │
│                  │    │ - app.module.ts           │    │ npm run typecheck│
│                  │    │ - database-types          │    │                  │
│                  │    ├──────────────────────────┤    │ curl tests       │
│                  │    │ Frontend Agent            │    │                  │
│                  │    │ - admin.marketing._index  │    │                  │
│                  │    │ - admin.marketing.backlinks│   │                  │
│                  │    │ - admin.marketing.content-│    │                  │
│                  │    │   roadmap                 │    │                  │
│                  │    │ - AdminSidebar.tsx         │    │                  │
└──────────────────┘    └──────────────────────────┘     └──────────────────┘
```

## Fichiers crees (total)

### Backend (Backend Agent)
```
backend/src/modules/marketing/
  marketing.module.ts
  interfaces/
    marketing.interfaces.ts
  controllers/
    marketing-dashboard.controller.ts
    marketing-backlinks.controller.ts
    marketing-content-roadmap.controller.ts
  services/
    marketing-data.service.ts
    marketing-dashboard.service.ts
    marketing-backlinks.service.ts
    marketing-content-roadmap.service.ts
```

### Frontend (Frontend Agent)
```
frontend/app/routes/
  admin.marketing._index.tsx
  admin.marketing.backlinks.tsx
  admin.marketing.content-roadmap.tsx
```

### Fichiers modifies
```
backend/src/app.module.ts                    # + MarketingModule import
frontend/app/components/AdminSidebar.tsx      # + Marketing nav item
packages/database-types/src/constants.ts      # + __marketing_* constants
```

## Verification

| # | Test | Commande | Resultat attendu |
|---|------|----------|-----------------|
| 1 | Tables creees | `SELECT count(*) FROM __marketing_campaigns` | 0 (pas d'erreur) |
| 2 | Dashboard API | `curl localhost:3000/api/admin/marketing/dashboard` | `{ success: true }` |
| 3 | Backlinks API | `curl localhost:3000/api/admin/marketing/backlinks` | `{ success: true, data: [] }` |
| 4 | Roadmap API | `curl localhost:3000/api/admin/marketing/content-roadmap` | `{ success: true, data: [] }` |
| 5 | Coverage API | `curl localhost:3000/api/admin/marketing/content-roadmap/coverage` | `{ total_gammes: 221, ... }` |
| 6 | Frontend | Naviguer vers `/admin/marketing` | Dashboard affiche |
| 7 | Sidebar | Cliquer "Marketing" dans sidebar | 3 sous-items visibles |
| 8 | Lint | `npm run lint` | 0 erreurs |
| 9 | Typecheck | `npm run typecheck` | 0 erreurs |

## Regles de securite

- Tous les endpoints sous `@UseGuards(IsAdminGuard)` (level >= 7)
- Pas de push sur main sans validation utilisateur
- Pas de modification de fichiers systeme (.env, docker-compose, etc.)
- Validation Zod sur tous les Body des POST/PATCH
