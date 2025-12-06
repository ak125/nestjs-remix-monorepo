---
title: "AI-COS - AI-Driven Company Operating System"
status: draft
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ../features/ai-cos-operating-system.md
  - 003-cache-redis-multi-levels.md
  - 004-seo-switches-migration-php-ts.md
tags: [ai-cos, architecture, orchestration, agents, critical]
priority: high
---

# ADR-005: AI-COS - AI-Driven Company Operating System

## Status

**DRAFT** - En cours de révision

## Context

Le monorepo NestJS-Remix gère une plateforme e-commerce complexe avec :
- 29 modules documentés (79% coverage)
- Agents IA Python pour qualité code
- Spec Kit pour documentation
- Stack : NestJS + Remix + Supabase + Redis

**Problème** : Manque d'orchestration globale entre tech, business et produit.

## Decision

Implémentation d'**AI-COS** : système d'orchestration à 4 niveaux pilotant le monorepo via agents IA, KPIs et Spec Kit.

### Architecture

```
AI-COS (Meta-Layer)
├── Niveau 1 - Strategic (IA-CEO, IA-CFO)
├── Niveau 2 - Tech & Produit (IA-CTO, IA-DevOps, IA-CISO)
├── Niveau 3 - Business Core (SEO, Pricing, Stock, CRM)
└── Niveau 4 - Expansion (IA-ESG, IA-HR)

Squads Transversaux
├── Performance Squad
├── E-Commerce Squad
├── Resilience Squad
└── Customer Squad
```

### Stack Technique

**Packages** :
- `@repo/ai-cos-core` : Types, config, agents (TypeScript)
- `@repo/ai-cos-kpis` : Calculateurs de scores

**Base de données** :
- Tables Supabase : `ai_cos_snapshots`, `ai_cos_actions`
- Accès via `AiCosDataService` (pattern existant `SupabaseBaseService`)

**Dashboard** :
- Routes Remix : `/admin/ai-cos`
- Composants shadcn/ui

**Agents** :
- Existants Python → alimentent KPIs tech
- Nouveaux agents business (à développer)

### Modes d'Opération

| Mode | Description | Auto | Validation |
|------|-------------|------|------------|
| `safe` | Corrections 100% sûres | ✅ | ❌ |
| `assisted` | Propose, validation humaine | ❌ | ✅ |
| `auto-drive` | Auto après apprentissage | ✅ | ❌ |
| `forecast` | Simulation uniquement | ❌ | ✅ |

**Mode initial** : `assisted`

## Rationale

### Pourquoi AI-COS ?

1. **Orchestration manquante** : Agents isolés, pas de vision globale
2. **KPIs éparpillés** : Métriques tech/business non unifiées
3. **Décisions manuelles** : Priorisation ad-hoc
4. **Spec Kit sous-exploité** : Pas de génération auto specs

### Pourquoi Supabase direct (pas Prisma) ?

1. **Stack existante** : Déjà `SupabaseBaseService` établi
2. **Simplicité** : Tables simples, pas d'ORM overhead
3. **Performance** : SQL direct, JSONB natif
4. **Patterns établis** : 15+ services existants

### Pourquoi intégration Spec Kit ?

1. **Spec-Driven** : Méthodologie déjà en place
2. **Agent Squad Planner** : Génère specs auto quand KPI rouge
3. **Workflow naturel** : AI-COS détecte → Spec Kit documente → Copilot implémente

## Consequences

### Positives

- ✅ Vision unifiée tech + business + produit
- ✅ Décisions data-driven automatiques
- ✅ Priorisation intelligente via KPIs
- ✅ Génération specs automatique
- ✅ Zéro dépendance IA en production

### Négatives

- ⚠️ Complexité initiale (4 semaines setup)
- ⚠️ Maintenance agents supplémentaires
- ⚠️ Courbe d'apprentissage équipe

### Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Agents génèrent mauvaises décisions | Moyenne | Élevé | Mode `assisted` avec validation humaine |
| Overhead performance | Faible | Moyen | Snapshots async, cache Redis |
| Complexité maintenance | Moyenne | Moyen | Documentation exhaustive, tests |

## Alternatives Considered

### 1. Agents isolés (status quo)
- ❌ Pas d'orchestration
- ❌ Décisions fragmentées

### 2. Monitoring classique (Grafana/Prometheus)
- ❌ Pas d'intelligence
- ❌ Pas d'actions automatiques

### 3. AI-COS avec Prisma/TypeORM
- ❌ Overhead ORM
- ❌ Changement stack existante

## Implementation Plan

### Phase 1 - Documentation (Semaine 1)
- ADR-005 ✅
- Feature Spec
- Workflow Spec

### Phase 2 - Infrastructure (Semaines 2-3)
- Package `ai-cos-core`
- Tables Supabase
- Service `AiCosDataService`

### Phase 3 - KPIs (Semaine 4)
- Package `ai-cos-kpis`
- Bridge agents Python
- Script snapshots

### Phase 4 - Dashboard (Semaine 5)
- Routes Remix
- Composants UI
- API endpoints

### Phase 5 - Intégration Spec Kit (Semaines 6-7)
- Agent Squad Planner
- Génération specs auto
- Tests end-to-end

### Phase 6 - Production (Semaine 8)
- CI/CD
- Monitoring
- Documentation finale

## References

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec-Driven Development](../README.md)
- [Cache Multi-Levels ADR](003-cache-redis-multi-levels.md)

## Change Log

- 2025-11-18 : Version initiale (draft)
