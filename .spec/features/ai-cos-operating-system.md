---
title: "AI-COS Operating System"
status: active
version: 2.7.0
authors: [Product Team, Tech Team]
created: 2025-11-18
updated: 2025-12-29
relates-to:
  - ../architecture/ai-cos-enrichment-plan.md
  - ../architecture/ai-cos-vision.md
  - ../technical/stack-technique-ai-cos.md
tags: [ai-cos, agents, kpis, orchestration, feature, health-board, modes, coordination]
priority: critical
coverage:
  modules: [ai-cos-core, ai-cos-kpis, dashboard, monitoring, orchestration]
  routes: [/admin/ai-cos/*, /api/ai-cos/*]
---

# AI-COS Operating System

## Overview

**Système d'orchestration intelligent du monorepo piloté par 57 agents IA**, KPIs temps réel (52 métriques), coordination inter-domaines automatisée, et intégration Spec Kit. Transforme l'organisation en **Entreprise Augmentée** où les agents gèrent 80% des opérations avec gouvernance transparente via Health Board.

## Vision Globale : Entreprise Augmentée

> "Chaque domaine (technique, commercial, marketing, produit, finances, logistique, etc.) est opéré par des agents IA spécialisés, coordonnés par un Agent Cognitif Global (IA-CEO v2)."

### Objectifs Stratégiques

🎯 **Orchestration automatique** : Performance optimisée de chaque pôle métier  
🎯 **Alignement stratégique** : Tech + Business + Produit synchronisés temps réel  
🎯 **Décisions proactives** : Fondées sur données + simulations + intelligence prédictive  
🎯 **Exécution rapide** : Mesurable, sans perte de cohérence organisationnelle

### Transformation v1.0 → v2.0

| Dimension | v1.0 (Actuel) | v2.0 (Enrichi) | Gain |
|-----------|---------------|----------------|------|
| **Agents** | 14 agents | **57 agents** | **+307%** |
| **KPIs** | 15 KPIs | **52 KPIs** | **+247%** |
| **Squads** | 4 squads | **5 squads** | +25% |
| **Coverage Modules** | 23.7% (9/38) | 76.3% (29/38) | +223% |
| **Orchestration** | KPI consolidation | **Health Board + Escalation** | Proactif |
| **Simulation** | Non | **Scénarios what-if (Forecast)** | Prédictif |
| **Gouvernance** | Manuelle | **4 Modes d'Opération** | Autonomie contrôlée |
| **Infrastructure** | Basic | **3 Méta-Couches Cognitives** | Intelligence collective |

**Vision** : Transformer l'organisation en **Entreprise Augmentée** où les agents IA gèrent 80% des opérations quotidiennes avec gouvernance transparente (Health Board) et autonomie progressive (Modes Safe→Assisted→Auto-Drive→Forecast).

**ROI Global** : **324%** (€1.332M gains / €411K coût)
- Gains agents : €800K/an
- Gains méta-couches : €300K/an
- Gains modes : €48K/an  
- Gains monitoring : €184K/an

## Agents & Responsabilités

### Architecture 4 Niveaux (57 Agents Total)

Référence complète : [ADR-006 Enrichment](../architecture/006-ai-cos-enrichment.md)

```
NIVEAU 1 - IA-BOARD (4 board members)
├── IA-CEO v2 (Cognitif Global)
├── IA-CFO/COO (Finance & Opérations)
├── IA-LEGAL (Conformité & Contrats)
└── IA-RISK (Gestion Risques)

NIVEAU 2 - TECH & PRODUIT (22 agents)
├── Code Quality Squad (6 agents)
│   ├── IA-CTO, Code Review Bot, Refactor Agent
│   ├── Dependency Scanner, Test Coverage Bot, Doc Generator
├── Infrastructure Squad (5 agents)
│   ├── IA-DevOps, Cache Optimizer, Database Optimizer
│   ├── Container Orchestrator, Network Monitor
├── Security Squad (4 agents)
│   ├── IA-CISO, Security Shield, Pen Test Bot, Compliance Bot
├── UX/Frontend Squad (4 agents)
│   ├── IA-Designer, A/B Test Bot, Performance Monitor, Accessibility Bot
└── Product Squad (3 agents)
    ├── IA-Product Manager, Feature Prioritizer, Roadmap Bot

NIVEAU 3 - BUSINESS CORE (16 agents)
├── Ventes & CRM (4 agents)
│   ├── IA-CRM, Lead Scorer, Churn Predictor, Upsell Bot
├── Marketing & SEO (5 agents)
│   ├── IA-CMO, SEO Sentinel, Campaign Optimizer, Content Bot, Social Media Bot
├── Pricing & Finance (4 agents)
│   ├── Pricing Bot, Margin Optimizer, Invoice Bot, Payment Reconciler
└── Logistique & Supply Chain (3 agents)
    ├── Stock Forecaster, Delivery Optimizer, Supplier Scorer

NIVEAU 4 - EXPANSION & SUPPORT (15 agents)
├── RH & Talent (3 agents)
│   ├── IA-HR, Recruiting Bot, Onboarding Bot
├── Innovation & R&D (3 agents)
│   ├── IA-Innovation, Patent Scout, Trend Analyzer
├── ESG & Durabilité (3 agents)
│   ├── IA-ESG, Carbon Tracker, Supply Chain Ethics Bot
├── Partenariats (3 agents)
│   ├── Partnership Scorer, Contract Negotiator, Integration Bot
└── Customer 360° (3 agents)
    ├── Support Bot, Feedback Analyzer, NPS Tracker
```

**Total : 57 agents opérationnels** organisés en 4 niveaux hiérarchiques avec coordination via 5 Squads transversaux.

### Niveau 0 - Global Orchestration

#### IA-CEO v2 (Enhanced Global Orchestrator)
- **Rôle** : Chef d'orchestre du système
- **Responsabilités** :
  - Consolidation KPIs globaux
  - Priorisation actions cross-domaines
  - Arbitrage budgets et ressources
  - Validation décisions critiques
- **KPIs surveillés** : `code-health`, `conversion-rate`, `esg-score`
- **Capacités** : `orchestrate`, `analyze`, `forecast`

#### IA-CFO (Agent Financier)
- **Rôle** : Simulation budgétaire et ROI
- **Responsabilités** :
  - Projection ROI initiatives
  - Contrôle coûts cloud et opérationnels
  - Simulation budgétaire
  - Alertes dépassements budgets
- **KPIs surveillés** : `roi-campaigns`, `aov`
- **Capacités** : `analyze`, `forecast`, `recommend`

### Niveau 2 - Tech & Produit

#### IA-CTO (Agent Technique)
- **Rôle** : Qualité code et architecture
- **Responsabilités** :
  - Surveillance santé du code
  - Détection dette technique
  - Planification upgrades frameworks
  - Validation patterns architecturaux
- **KPIs surveillés** : `code-health`, `tech-debt`, `test-coverage`
- **Capacités** : `analyze`, `detect`, `recommend`, `orchestrate`

#### IA-DevOps (Agent Infrastructure)
- **Rôle** : Performance et observabilité
- **Responsabilités** :
  - Monitoring performance (p95, p99)
  - Optimisation infra et coûts cloud
  - Gestion incidents et rollbacks
  - Build time et CI/CD
- **KPIs surveillés** : `backend-p95`, `frontend-p95`
- **Capacités** : `analyze`, `detect`, `fix`, `recommend`

#### IA-CISO (Agent Sécurité)
- **Rôle** : Scan vulnérabilités et compliance
- **Responsabilités** :
  - Scan dépendances (npm audit)
  - Détection failles sécurité
  - Conformité RGPD/OWASP
  - Gestion secrets et tokens
- **KPIs surveillés** : `security-score`
- **Capacités** : `analyze`, `detect`, `recommend`

#### IA-Designer (Agent UX/UI)
- **Rôle** : Cohérence design et accessibilité
- **Responsabilités** :
  - Audit design tokens
  - Détection patterns UI incohérents
  - Accessibilité (WCAG)
  - Optimisation bundle CSS
- **KPIs surveillés** : `ux-score`, `accessibility-score`
- **Capacités** : `analyze`, `detect`, `recommend`

### Niveau 3 - Business Core

#### SEO Sentinel (Agent SEO)
- **Rôle** : Monitoring et optimisation référencement
- **Responsabilités** :
  - Surveillance positions SEO
  - Détection erreurs 404/410/412
  - Optimisation meta tags et schemas
  - Monitoring Core Web Vitals
- **KPIs surveillés** : `seo-score`, `conversion-rate`
- **Capacités** : `analyze`, `detect`, `recommend`

#### Pricing Bot (Agent Pricing)
- **Rôle** : Optimisation prix et marges
- **Responsabilités** :
  - Analyse pricing concurrents
  - Recommandations tarifs dynamiques
  - Surveillance marges produits
  - Optimisation promos
- **KPIs surveillés** : `aov`, `conversion-rate`
- **Capacités** : `analyze`, `forecast`, `recommend`

#### Stock Forecaster (Agent Stock)
- **Rôle** : Prévision et alertes ruptures
- **Responsabilités** :
  - Prévision demande produits
  - Alertes rupture stock imminente
  - Optimisation niveaux stock
  - Analyse saisonnalité
- **KPIs surveillés** : `stock-rupture`
- **Capacités** : `analyze`, `forecast`, `recommend`

#### IA-CRM (Agent CRM)
- **Rôle** : Fidélisation et churn
- **Responsabilités** :
  - Détection risque churn
  - Recommandations cross/up-sell
  - Segmentation clients
  - Scoring satisfaction client
- **KPIs surveillés** : `conversion-rate`, `cart-abandonment`
- **Capacités** : `analyze`, `forecast`, `recommend`

### Niveau 4 - Expansion & Support

#### IA-ESG (Agent Durabilité)
- **Rôle** : Durabilité et conformité ESG
- **Responsabilités** :
  - Calcul empreinte carbone
  - Conformité certifications
  - Audit supply chain éthique
  - Reporting ESG
- **KPIs surveillés** : `esg-score`
- **Capacités** : `analyze`, `recommend`

## Squads Transversaux

### E-Commerce Squad (4 membres)
- **Mission** : Acquisition → Conversion → Checkout optimisé
- **Membres** : SEO Sentinel, Pricing Bot, Stock Forecaster, A/B Test Bot
- **KPIs** : `conversion-rate` (>3.5%), `cart-abandonment` (<25%), `aov` (>€150)
- **Budget** : €15K/trim, autonomie <€2K/action
- **Objectif Q1 2025** : Atteindre 3.5% conversion (actuel: 3.2%)
- **Status** : Active

### Performance Squad (4 membres)
- **Mission** : Vélocité tech + UX fluide
- **Membres** : IA-CTO, IA-DevOps, IA-Designer, Cache Optimizer
- **KPIs** : `backend-p95` (<180ms), `frontend-p95` (<500ms), `build-time` (<4min)
- **Budget** : €12K/trim, autonomie <€2K/action
- **Objectif Q1 2025** : p95 backend < 180ms (actuel: 230ms)
- **Status** : Active

### Expansion Squad (4 membres)
- **Mission** : Croissance externe (SEO, marketing, partenariats)
- **Membres** : IA-CMO, Campaign Optimizer, Partnership Scorer, Content Bot
- **KPIs** : `seo-score` (>90), `roi-campaigns` (>300%), `partner-revenue` (>€50K/trim)
- **Budget** : €20K/trim, autonomie <€5K/action
- **Objectif Q1 2025** : ROI campagnes >300%
- **Status** : Active

### Resilience Squad (2 membres)
- **Mission** : Sécurité + Observabilité + Compliance
- **Membres** : IA-CISO, IA-RISK
- **KPIs** : `security-score` (100/100), `uptime` (>99.9%), `compliance` (100%)
- **Budget** : €8K/trim, autonomie <€2K/action
- **Objectif Q1 2025** : 0 vulnérabilités HIGH/CRITICAL
- **Status** : Active

### Customer Squad (3 membres)
- **Mission** : Post-achat → Fidélisation → NPS
- **Membres** : IA-CRM, Support Bot, NPS Tracker
- **KPIs** : `nps` (>50), `churn-rate` (<5%), `ltv` (>€500)
- **Budget** : €10K/trim, autonomie <€2K/action
- **Objectif Q1 2025** : NPS >50 (actuel: 42)
- **Status** : Active

**Budget Squads Total** : €260K/an (€65K/trim × 4 trimestres)

## Coordination Inter-Domaines

### Principes Fondamentaux

L'architecture AI-COS v2.0 repose sur **3 mécanismes de coordination** permettant aux 57 agents de collaborer intelligemment à travers les 4 niveaux hiérarchiques et 5 squads transversaux.

#### 1. Event Bus Redis (Pub/Sub)

**Canal unique** : `ai-cos:events`

**Types d'événements** :
```typescript
type AiCosEvent = 
  | { type: 'kpi.threshold', kpi: string, value: number, threshold: number }
  | { type: 'action.proposed', agentId: string, action: AgentAction }
  | { type: 'action.completed', actionId: string, impact: KpiImpact }
  | { type: 'escalation.required', level: 'squad' | 'ceo' | 'board', reason: string }
  | { type: 'simulation.requested', scenario: ForecastScenario }
  | { type: 'alert.cross-domain', correlation: CorrelationDetected }
```

**Workflow** :
1. Agent détecte événement → Publie sur Redis
2. Agents abonnés reçoivent notification temps réel
3. Data Brain enregistre événement (audit trail)
4. Dialogue Layer met à jour Health Board UI

**Exemple** :
```typescript
// IA-DevOps détecte dégradation performance
redisClient.publish('ai-cos:events', JSON.stringify({
  type: 'kpi.threshold',
  kpi: 'backend-p95',
  value: 230,
  threshold: 180,
  agent: 'IA-DevOps',
  timestamp: new Date()
}));

// Performance Squad reçoit alerte
// A/B Test Bot vérifie impact conversion
// IA-CEO est notifié (coordination niveau 1)
```

#### 2. Shared Context (Data Brain)

**Table** : `ai_cos_shared_context`

```sql
CREATE TABLE ai_cos_shared_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context_type TEXT NOT NULL, -- 'kpi_snapshot' | 'decision' | 'correlation' | 'knowledge'
  domain TEXT NOT NULL, -- 'tech' | 'business' | 'support' | 'expansion'
  data JSONB NOT NULL,
  agents_contributing TEXT[] NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all' -- 'all' | 'squad' | 'level'
);

CREATE INDEX idx_shared_context_type ON ai_cos_shared_context(context_type, created_at DESC);
CREATE INDEX idx_shared_context_domain ON ai_cos_shared_context(domain);
```

**Use Cases** :
- **KPI Snapshots** : Tous agents accèdent dernier état 52 KPIs (cache Redis 5min)
- **Décisions historiques** : Embedding Vector DB → agents apprennent des décisions passées
- **Corrélations détectées** : Data Brain publie patterns cross-domain
- **Knowledge Base** : Documentation techniques, best practices, playbooks

**Exemple** :
```typescript
// Data Brain détecte corrélation
await supabase.from('ai_cos_shared_context').insert({
  context_type: 'correlation',
  domain: 'tech-business',
  data: {
    pattern: 'backend-p95 > 200ms → conversion -0.5%',
    confidence: 0.87,
    observations: 42,
    recommendation: 'Priorité CRITICAL sur Performance Squad'
  },
  agents_contributing: ['Data Brain', 'IA-DevOps', 'SEO Sentinel'],
  visibility: 'all'
});

// IA-CEO reçoit notification
// Performance Squad et E-Commerce Squad coordonnent action
```

#### 3. Orchestration Workflows (IA-CEO)

**Rôle** : IA-CEO joue le chef d'orchestre pour décisions cross-domaines nécessitant coordination multi-squads.

**Patterns** :
- **Cascade Impacts** : Action Squad A → Impacts KPIs Squad B → Coordination
- **Budget Arbitrage** : Conflits budgets entre squads → IA-CFO + IA-CEO arbitrent
- **Escalation Hierarchy** : Yellow → Squad Lead, Orange → IA-CEO, Red → Board

**Workflow Type** : SAGA Pattern (orchestration centralisée)

```typescript
interface OrchestrationWorkflow {
  id: string;
  trigger: AiCosEvent;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  coordinator: 'IA-CEO' | 'IA-CFO' | 'Board';
}

interface WorkflowStep {
  agent: string;
  action: string;
  dependencies: string[]; // Autres steps requis avant
  timeout: number; // SLA en minutes
  rollback?: string; // Action rollback si échec
}
```

**Exemple Workflow** : Optimisation Conversion Multi-Squad

```typescript
{
  id: 'wf-conversion-boost-2025-q1',
  trigger: { type: 'kpi.threshold', kpi: 'conversion-rate', value: 3.2 },
  coordinator: 'IA-CEO',
  steps: [
    {
      agent: 'SEO Sentinel',
      action: 'Audit meta descriptions 100 top produits',
      dependencies: [],
      timeout: 120 // 2h
    },
    {
      agent: 'A/B Test Bot',
      action: 'Test variantes CTA checkout',
      dependencies: [],
      timeout: 480 // 8h (parallel avec SEO)
    },
    {
      agent: 'Pricing Bot',
      action: 'Analyse élasticité prix top 20 produits',
      dependencies: ['SEO Sentinel'], // Attend SEO fini
      timeout: 60
    },
    {
      agent: 'IA-CEO',
      action: 'Consolidation résultats + recommandations Board',
      dependencies: ['SEO Sentinel', 'A/B Test Bot', 'Pricing Bot'],
      timeout: 30
    }
  ]
}
```

### Scénarios Multi-Agents

#### Scénario 1 : Dégradation Performance → Impact Ventes

**Trigger** : `backend-p95 > 200ms` pendant 15 minutes

**Workflow** :
```
1. IA-DevOps détecte KPI rouge (230ms > 180ms)
   └─ Publie event 'kpi.threshold'

2. Data Brain corrèle avec conversion-rate
   └─ Détecte baisse -0.3% conversion dernières 2h
   └─ Publie event 'alert.cross-domain'

3. IA-CEO reçoit alerte ORANGE (SLA 4h)
   └─ Crée workflow orchestration SAGA

4. Performance Squad (parallel)
   ├─ Cache Optimizer : Augmente TTL Redis équipementiers
   ├─ Database Optimizer : Analyse slow queries PostgreSQL
   └─ IA-DevOps : Active monitoring traces OpenTelemetry

5. E-Commerce Squad (standby)
   └─ A/B Test Bot : Monitore impact conversion temps réel

6. IA-CEO : Consolidation après 1h
   └─ backend-p95 = 175ms ✅
   └─ conversion-rate = 3.4% (recovery) ✅
   └─ Action complétée, workflow terminé

7. Data Brain : Enregistre pattern pour futur
   └─ Knowledge Base : "Backend p95 > 200ms → -0.5% conversion (confidence 0.92)"
```

**Impact** :
- Détection : 15min (automatique)
- Résolution : 1h (3 agents coordonnés)
- Coût évité : ~€2K perte ventes (conversion recovery rapide)

#### Scénario 2 : Lancement Promo Q1 (Multi-Domaines)

**Trigger** : Board demande simulation "Promo -15% top 50 produits Q1 2025"

**Mode** : Forecast (simulations uniquement)

**Workflow** :
```
1. Board : Crée scénario via UI Forecast
   └─ Mode Forecast activé (sandbox environnement)

2. Simulation Layer : Clone état actuel
   ├─ KPIs snapshots (52 métriques)
   ├─ Stock niveaux (Database snapshot)
   └─ Pricing tables (PostgreSQL copy)

3. Pricing Bot : Applique réduction -15% (sandbox)
   └─ Calcul nouveau prix 50 produits

4. Stock Forecaster : Simule demande
   └─ Prévision +40% volume Q1 (elasticité prix)
   └─ Alerte : 12 produits risque rupture stock

5. Margin Optimizer : Calcul impact marge
   └─ Marge globale : 40% → 32% (-8 points)
   └─ CA projeté : +25% (volume compense prix)

6. IA-CFO : Simulation cashflow
   └─ Trésorerie Q1 : Impact -€50K (délai paiement fournisseurs)
   └─ Recommandation : Négocier paiement fournisseurs J+60

7. IA-CEO : Consolidation Board
   ├─ ✅ CA +25% (€180K)
   ├─ ⚠️ Marge -8pts (€40K)
   ├─ 🔴 Rupture stock risque (12 produits)
   └─ Recommandations :
       • Stock safety +30% produits critiques (€25K)
       • Budget marketing +€15K (maximiser promo)
       • Négociation fournisseurs J+60 (cashflow)

8. Board : Décision
   └─ Approuve promo avec ajustements recommandés
   └─ Transition mode Assisted → Exécution réelle
```

**Impact Simulation** :
- Durée : 4h (6 agents, sandbox)
- Coût : €0 (simulations uniquement)
- Décision éclairée : Évite risque rupture stock (€80K perte potentielle)

#### Scénario 3 : Détection Churn Client (Support + CRM)

**Trigger** : NPS score < 40 pendant 7 jours (cible: >50)

**Workflow** :
```
1. NPS Tracker : Détecte tendance baissière
   └─ NPS actuel : 38/100 (vs 50 cible)
   └─ Publie event 'kpi.threshold'

2. Data Brain : Analyse feedbacks clients
   └─ Détecte pattern : "Délai livraison trop long" (42% mentions)
   └─ Corrèle avec delivery-time : 72h (vs 48h cible)

3. IA-CRM : Identifie segments risque churn
   └─ 340 clients commande >€200, dernier achat >90j
   └─ Risque churn : HIGH (score 0.78)

4. Customer Squad : Plan action coordonné
   ├─ Support Bot : Envoie email personnalisé 340 clients
   │   └─ Offre : -10% prochaine commande + livraison express offerte
   ├─ Delivery Optimizer : Analyse goulots logistique
   │   └─ Identifie : Entrepôt Sud saturé (cause délais)
   └─ IA-CFO : Valide budget promo (€6.8K)

5. Logistique Squad : Résolution root cause
   ├─ Stock Forecaster : Réallocation stock Nord → Sud
   └─ Delivery Optimizer : Contrat transporteur alternatif

6. Monitoring J+14
   ├─ NPS : 38 → 46 (+8 pts) ⚠️ (cible 50)
   ├─ Delivery-time : 72h → 52h ✅ (cible 48h proche)
   └─ Churn-rate : 7% → 4.5% ✅ (objectif <5%)

7. IA-CEO : Ajustement continu
   └─ Prolonge action Support Bot 30j supplémentaires
   └─ Budget additionnel €10K (ROI projeté 220%)
```

**Impact** :
- Clients retenus : 270/340 (79% taux succès)
- Revenue sauvé : €54K (LTV moyenne €200)
- Coût action : €16.8K
- ROI : 221%

### Métriques Coordination

**4 nouveaux KPIs** mesurant efficacité coordination inter-domaines :

| KPI | Cible | Description | Owner |
|-----|-------|-------------|-------|
| `coordination-latency` | <30min | Délai moyen entre détection → 1ère action coordonnée | IA-CEO |
| `workflow-success-rate` | >85% | % workflows multi-agents terminés avec succès | IA-CEO |
| `cross-domain-alerts` | 5-10/sem | Nombre corrélations détectées Data Brain (ni trop ni trop peu) | Data Brain |
| `escalation-time` | <2h | Délai moyen escalation Squad → CEO → Board | IA-CEO |

**Dashboard Section** : `/admin/ai-cos/coordination`

```
┌─────────────────────────────────────────────────────────┐
│ 🔗 COORDINATION INTER-DOMAINES (Temps Réel)            │
├─────────────────────────────────────────────────────────┤
│ • Workflows actifs : 3                                  │
│   ├─ [wf-perf-001] Performance → Ventes (85% done)     │
│   ├─ [wf-churn-002] Support → CRM (validation pending) │
│   └─ [wf-stock-003] Logistique → Pricing (30% done)    │
│                                                         │
│ • Dernières corrélations détectées (24h)               │
│   ├─ backend-p95 ↑ → conversion ↓ (confidence 0.92)   │
│   ├─ stock-rupture ↑ → cart-abandonment ↑ (0.84)      │
│   └─ nps ↓ → delivery-time ↑ (0.78)                   │
│                                                         │
│ • Métriques coordination                               │
│   ├─ Latency : 18min (🟢 cible <30min)                │
│   ├─ Success Rate : 89% (🟢 cible >85%)               │
│   └─ Escalation Time : 1.2h (🟢 cible <2h)            │
└─────────────────────────────────────────────────────────┘
```

## KPIs du Système

**Total : 52 KPIs** (6 Board + 10 Tech + 10 Business + 12 Support + 14 Squads)

Référence complète : [ADR-006 KPIs](../architecture/006-ai-cos-enrichment.md#kpis)

### KPIs Board Consolidés (6 KPIs)

| KPI | Calcul | Cible | Propriétaire |
|-----|--------|-------|--------------|
| `health-score-global` | Moyenne pondérée 40 KPIs | >85/100 | IA-CEO |
| `roi-previsionnel` | Simulations Q+1 | >150% | IA-CFO/COO |
| `cashflow-forecast` | Prévisions 6 mois | >€200K | IA-CFO/COO |
| `risque-global` | Agrégation risques | <30/100 | IA-RISK |
| `compliance-score` | % conformité | 100% | IA-LEGAL |
| `ops-efficiency` | Efficacité ops | >80/100 | IA-CFO/COO |

### Tech & Produit (10 KPIs)

| KPI | Cible | Unité | Priorité | Owner |
|-----|-------|-------|----------|-------|
| `maintenabilité` | >90 | /100 | CRITICAL | IA-CTO |
| `backend-p95` | <180 | ms | **CRITICAL** | IA-DevOps |
| `frontend-p95` | <500 | ms | HIGH | Performance Monitor |
| `build-time` | <4 | min | CRITICAL | IA-DevOps |
| `deploy-success` | 100 | % | CRITICAL | IA-DevOps |
| `security-score` | 100 | /100 | **CRITICAL** | IA-CISO |
| `test-coverage` | >85 | % | HIGH | IA-CTO |
| `api-errors` | <0.1 | % | HIGH | IA-DevOps |
| `cache-hit-rate` | >90 | % | MEDIUM | Cache Optimizer |
| `ux-score` | >85 | /100 | HIGH | IA-Designer |

### Business Core (10 KPIs)

| KPI | Cible | Unité | Priorité | Owner |
|-----|-------|-------|----------|-------|
| `conversion-globale` | >3.5 | % | **CRITICAL** | IA-CRM, SEA Optimizer |
| `cart-abandonment` | <25 | % | HIGH | A/B Test Bot |
| `marge-nette` | >40 | % | CRITICAL | Margin Optimizer |
| `rupture-stock` | <5 | % | HIGH | Stock Forecaster |
| `aov` | >€150 | € | HIGH | Pricing Bot |
| `roi-publicité` | >300 | % | HIGH | SEA Optimizer |
| `ltv` | >€500 | € | MEDIUM | IA-CRM |
| `cac` | <€50 | € | MEDIUM | Campaign Optimizer |
| `seo-score` | >90 | /100 | HIGH | SEO Sentinel |
| `delivery-time` | <48 | h | MEDIUM | Delivery Optimizer |

### Expansion & Support (12 KPIs)

| KPI | Cible | Unité | Priorité | Owner |
|-----|-------|-------|----------|-------|
| `satisfaction-employés` | >80 | /100 | HIGH | IA-HR |
| `time-to-hire` | <30 | j | MEDIUM | Recruiting Bot |
| `turnover` | <10 | % | HIGH | IA-HR |
| `innovation-index` | >75 | /100 | MEDIUM | IA-Innovation |
| `r&d-roi` | >200 | % | MEDIUM | IA-Innovation |
| `score-esg-global` | >75 | /100 | CRITICAL | IA-ESG |
| `empreinte-carbone` | <100 | tCO2/an | HIGH | Carbon Tracker |
| `partner-revenue` | >€50K | €/trim | MEDIUM | Partnership Scorer |
| `contract-close-rate` | >60 | % | MEDIUM | Contract Negotiator |
| `nps-client` | >50 | score | CRITICAL | NPS Tracker |
| `first-response-time` | <2 | h | HIGH | Support Bot |
| `csat` | >85 | % | HIGH | Feedback Analyzer |

### KPIs Squads (14 KPIs)

Voir section Squads Transversaux ci-dessus.

## Health Board Dashboard

### Vue Consolidée & Gouvernance

Le **Health Board** est la pièce centrale de gouvernance AI-COS. Dashboard unique `/admin/ai-cos/board` consolidant 52 KPIs → **Health Score Global 0-100** avec workflow escalation automatisé.

**Référence complète** : [ADR-006 Monitoring & KPIs Globaux](../architecture/006-ai-cos-enrichment.md#monitoring--kpis-globaux)

### Formule Health Score

```typescript
Health Score Global = 
  Tech & Produit (25%) +
  Business Core (40%) +
  Expansion & Support (20%) +
  Squads Transversaux (15%)
```

**Pondération détaillée** :
- **Tech (25%)** : backend-p95 (8%), maintenabilité (10%), ux-score (7%)
- **Business (40%)** : conversion (15%), marge (10%), stock (10%), roi-pub (12%), seo (8%)
- **Support (20%)** : esg (8%), nps (10%), satisfaction-employés (7%)
- **Squads (15%)** : vélocité (5%), coordination (5%), budget (5%)

### Seuils Alertes

| Niveau | Score | Couleur | Action | SLA |
|--------|-------|---------|--------|-----|
| **GREEN** | ≥85 | 🟢 | Business as usual | - |
| **YELLOW** | 70-84 | 🟡 | Lead Squad review | <24h |
| **ORANGE** | 50-69 | 🟠 | IA-CEO coordination | <4h |
| **RED** | <50 | 🔴 | Board arbitrage | <2h |

### Dashboard UI Sections

**Route** : `/admin/ai-cos/board`

```
┌────────────────────────────────────────────────────────────┐
│ 📊 HEALTH BOARD - Score Global : 82/100 🟡                 │
├────────────────────────────────────────────────────────────┤
│ 1. KPIs Cards (7 métriques critiques temps réel)          │
│    • Code Health (90/100) • Backend p95 (165ms)           │
│    • UX Score (88/100) • Conversion (3.4%)                 │
│    • ROI Campagnes (320%) • Stock Rupture (3%)            │
│    • ESG Score (78/100)                                    │
│                                                            │
│ 2. 🚨 Alertes Actives (panel prioritaire + SLA)           │
│    • [YELLOW] conversion-rate : 3.4% < 3.5% (SLA: 18h)    │
│    • [ORANGE] backend-p95 : 230ms > 180ms (SLA: 2h)       │
│                                                            │
│ 3. ⏳ Approbations Pending (validation humaine requise)    │
│    • E-Commerce Squad : Réduction prix -12% (€8K budget)  │
│    • Performance Squad : Migration Redis Cluster (€15K)   │
│                                                            │
│ 4. 📜 Timeline Actions (20 dernières actions agents)       │
│    • 14:32 - SEO Sentinel : meta description 42 produits  │
│    • 13:15 - Pricing Bot : ajustement tarifs promo Q1     │
│                                                            │
│ 5. 🔮 Lien Mode Forecast (simulations what-if Board)       │
│    → /admin/ai-cos/modes?mode=forecast                     │
└────────────────────────────────────────────────────────────┘
```

### Workflow Escalation

```
DÉCISION AGENT
      │
      ├─ <€2K + LOW risk ──────────────→ AUTO (Safe/Auto-Drive)
      │
      ├─ €2K-€10K + MEDIUM risk ───────→ SQUAD LEAD validation
      │                                   (<2h SLA)
      │
      ├─ >€10K + HIGH risk ────────────→ IA-CEO coordination
      │                                   (<4h SLA, Slack alert)
      │
      └─ CRITICAL (score <50) ─────────→ BOARD arbitrage
                                          (<2h SLA, PagerDuty)
```

**Audit Trail** : Table `ai_cos_monitoring_events` (Supabase) avec timestamps, agent_id, action, impact_prévisionnel, decision (AUTO/SQUAD/CEO/BOARD).

### KPIs Méta-Monitoring

**4 nouveaux KPIs** surveillant la santé du monitoring lui-même :

| KPI | Cible | Description |
|-----|-------|-------------|
| `dashboard-latency` | <500ms | Performance UI Health Board |
| `kpi-freshness` | <5min | Fraîcheur données Redis/Supabase |
| `alert-response-time` | <15min | SLA réponse escalation |
| `health-score-stability` | ±2 pts/jour | Volatilité score (éviter oscillations) |

### Alertes Proactives

**3 types d'alertes intelligentes** :

1. **Reactive** : KPI < seuil → Alerte immédiate
2. **Prédictive** : Tendance 7j → Alerte avant franchir seuil
3. **Corrélation** : Data Brain détecte impacts cross-domain
   - Ex: backend-p95 ↑ + conversion ↓ → Alert "Performance impacte ventes"

## Modes d'Opération

### 4 Modes Progressifs

L'architecture AI-COS propose **4 modes d'opération** permettant d'ajuster l'autonomie des agents selon le contexte business, la maturité de l'organisation, et le niveau de risque acceptable.

**Référence complète** : [ADR-006 Modes d'Opération](../architecture/006-ai-cos-enrichment.md#modes-dopération)

| Mode | Autonomie | Validation | Budget Max | Use Case |
|------|-----------|------------|------------|----------|
| **Safe** | 0% | Toutes actions | €0 | Audit/discovery initial |
| **Assisted** | 30% | Actions >€2K | €2K/action | Démarrage progressif |
| **Auto-Drive** | 80% | Actions >€10K | €10K/action | Production mature |
| **Forecast** | 0% | Simulations only | €0 | Planification stratégique |

### Mode Safe (Audit)

**Objectif** : Discovery architecture existante, détection gaps  
**Autonomie** : 0% (aucune action autonome)  
**Validation** : Toutes propositions → humain  
**Budget** : €0/action  

**Workflow** :
1. Agents scannent codebase/infra/KPIs
2. Génèrent rapports détection (gaps, risques, opportunités)
3. Toutes actions proposées → `status: pending_validation`
4. Dashboard affiche liste complète → décideur approuve manuellement

**Durée typique** : 2-4 semaines (phase initiale)

### Mode Assisted (Démarrage)

**Objectif** : Agents autonomes sur actions low-risk, validation humaine high-risk  
**Autonomie** : 30% (actions <€2K)  
**Validation** : Actions >€2K ou HIGH risk → humain  
**Budget** : €2K/action autonome  

**Workflow** :
```
Agent propose action
  │
  ├─ <€2K + LOW risk ────→ AUTO (exécution immédiate)
  │                         └─ Log audit trail
  │
  └─ >€2K ou MEDIUM+ risk ─→ PENDING (validation humaine)
                              └─ Slack alert Lead Squad
```

**Durée typique** : 3-6 mois (apprentissage confiance)

### Mode Auto-Drive (Production Mature)

**Objectif** : Agents gèrent 80% opérations quotidiennes  
**Autonomie** : 80% (actions <€10K)  
**Validation** : Actions >€10K ou CRITICAL → IA-CEO/Board  
**Budget** : €10K/action autonome  

**Workflow** :
```
Agent propose action
  │
  ├─ <€10K + LOW/MEDIUM risk ──→ AUTO (exécution immédiate)
  │                               └─ Monitoring continu
  │
  ├─ €10K-€50K + HIGH risk ────→ IA-CEO coordination (<4h)
  │                               └─ Simulation impact préalable
  │
  └─ >€50K ou CRITICAL ─────────→ BOARD arbitrage (<2h)
                                   └─ Mode Forecast simulations
```

**Conditions activation** :
- Health Score Global >85 pendant 30j
- 0 incidents critiques 60j
- Confiance Board validée

**Durée typique** : Régime permanent (6+ mois après démarrage)

### Mode Forecast (Simulations)

**Objectif** : Simulations what-if stratégiques, 0 exécution réelle  
**Autonomie** : 0% (simulations uniquement)  
**Validation** : Présentation résultats → Board  
**Budget** : €0 (environnement sandbox)  

**Workflow** :
1. Board définit scénarios (ex: "Réduction prix -15% Q1 2025")
2. Simulation Layer exécute scénarios :
   - Calcul impacts KPIs (conversion, marge, stock)
   - Identification risques (rupture stock, pression trésorerie)
   - Recommandations compensatoires (budget marketing, stock safety)
3. Dashboard Forecast affiche résultats comparatifs
4. Board décide : implémenter (→ mode Assisted) ou rejeter

**Use Cases** :
- Planification stratégique Q+1
- Évaluation initiatives majeures (refonte UX, nouveau marché)
- Gestion crise (simulation scénarios dégradés)

### Transitions Modes

**Commandes CLI** :

```bash
# Vérifier mode actuel
ai-cos mode:status

# Transition Safe → Assisted (après 2 semaines audit)
ai-cos mode:transition --from=safe --to=assisted

# Transition Assisted → Auto-Drive (après 6 mois confiance)
ai-cos mode:transition --from=assisted --to=auto-drive

# Activer Forecast (session Board temporaire)
ai-cos mode:forecast --scenario="price-reduction-15pct"
```

**Conditions Transition Auto-Drive** :
- ✅ Health Score >85/100 (30 jours consécutifs)
- ✅ 0 incidents CRITICAL (60 jours)
- ✅ >90% actions Assisted réussies (3 mois)
- ✅ Validation explicite Board (vote)

## Méta-Couches Cognitives

### Infrastructure Intelligence Collective

**3 méta-couches** assurant l'intelligence collective des 57 agents :

**Référence complète** : [ADR-006 Méta-Couches Cognitives](../architecture/006-ai-cos-enrichment.md#méta-couches-cognitives)

### 1. Data Brain (€60K)

**Rôle** : Mémoire centralisée + détection patterns cross-domain

**Capacités** :
- Consolidation 52 KPIs temps réel (Redis + Supabase)
- Détection corrélations (ex: backend-p95 ↑ → conversion ↓)
- Base connaissances partagée (décisions historiques)
- APIs accessibles tous agents

**Tech Stack** : Redis (cache KPIs), Supabase (historical data), Vector DB (embeddings décisions)

**Budget** : €60K (8 semaines développement)

### 2. Dialogue Layer (€36K)

**Rôle** : Communication agents ↔ humains + Health Board UI

**Capacités** :
- API REST `/api/ai-cos/*` (KPIs, actions, validations)
- Dashboard Remix `/admin/ai-cos/board`
- Alertes Slack/Email/PagerDuty
- CLI commands (`ai-cos health`, `ai-cos approve`, etc.)

**Tech Stack** : NestJS (backend), Remix (frontend), Slack API, SendGrid

**Budget** : €36K (5 semaines, inclut €16K Health Board)

### 3. Simulation Layer (€25K)

**Rôle** : Mode Forecast + simulations what-if

**Capacités** :
- Sandbox isolé (fork état actuel)
- Simulation impacts actions (KPIs projetés)
- Scénarios Board (price changes, budget shifts)
- Rollback zero-impact (environnement lecture seule)

**Tech Stack** : PostgreSQL clone, Redis sandbox, simulation engine Python

**Budget** : €25K (3 semaines développement)

### Budget Total Méta-Couches

**€151K** (Data Brain €60K + Dialogue €36K + Simulation €25K + State Machine €30K)

**ROI Méta-Couches** : **300K€ gains/an** (vélocité décisions, prévention incidents) → ROI 199%

## Data Model

### Table: ai_cos_snapshots

```sql
CREATE TABLE ai_cos_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode TEXT NOT NULL DEFAULT 'assisted',
  
  -- KPIs Tech (6)
  code_health NUMERIC,
  backend_p95_ms NUMERIC,
  frontend_p95_ms NUMERIC,
  test_coverage NUMERIC,
  tech_debt_score NUMERIC,
  security_score NUMERIC,
  
  -- KPIs Business (5)
  conversion_rate NUMERIC,
  cart_abandonment NUMERIC,
  average_order_value NUMERIC,
  stock_rupture NUMERIC,
  roi_campaigns NUMERIC,
  
  -- KPIs UX (3)
  ux_score NUMERIC,
  seo_score NUMERIC,
  accessibility_score NUMERIC,
  
  -- KPIs Expansion (1)
  esg_score NUMERIC,
  
  -- Scores globaux (requis)
  global_health NUMERIC NOT NULL,
  confidence NUMERIC DEFAULT 0,
  risk NUMERIC DEFAULT 0
);

CREATE INDEX idx_ai_cos_snapshots_created_at 
  ON ai_cos_snapshots(created_at DESC);
```

### Table: ai_cos_actions

```sql
CREATE TABLE ai_cos_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent_id TEXT NOT NULL,
  squad_id TEXT,
  type TEXT NOT NULL, -- 'fix' | 'recommendation' | 'alert' | 'forecast'
  priority TEXT NOT NULL, -- 'low' | 'medium' | 'high' | 'critical'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Impact (JSONB pour flexibilité)
  kpi_ids TEXT[] NOT NULL,
  expected_improvement JSONB NOT NULL,
  risk NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  requires_validation BOOLEAN DEFAULT true,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Evidence
  evidence TEXT[] DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX idx_ai_cos_actions_agent_id 
  ON ai_cos_actions(agent_id, created_at DESC);
CREATE INDEX idx_ai_cos_actions_status 
  ON ai_cos_actions(status);
CREATE INDEX idx_ai_cos_actions_priority 
  ON ai_cos_actions(priority);
```

## Intégration Spec Kit

### Workflow Automatique

```mermaid
graph TD
    A[AI-COS détecte KPI rouge] --> B[Agent Squad Planner]
    B --> C[Génère spec dans .spec/features/]
    C --> D[Crée GitHub Issue]
    D --> E[/speckit.specify]
    E --> F[/speckit.plan]
    F --> G[/speckit.implement]
    G --> H[Copilot implémente]
    H --> I[PR créée]
    I --> J[Review & Merge]
    J --> K[Nouveau snapshot AI-COS]
    K --> L{KPI vert?}
    L -->|Oui| M[✅ Objectif atteint]
    L -->|Non| B
```

### Exemple Concret

**Scénario** : p95 backend = 230ms (cible: 180ms)

1. **Détection** (snapshot quotidien 3h)
   ```
   ⚠️ KPI backend-p95 hors cible
   Actuel: 230ms, Cible: 180ms, Delta: +28%
   Agent: Performance Squad
   ```

2. **Génération Spec** (Agent Squad Planner)
   ```markdown
   # .spec/features/performance-backend-optimization.md
   ---
   title: "Optimisation Performance Backend p95 < 180ms"
   status: draft
   priority: high
   squad: performance-squad
   ---
   
   ## Context
   p95 backend = 230ms, cible = 180ms (+28%)
   
   ## Objective
   Réduire p95 à < 180ms via optimisations Redis + queries SQL
   
   ## Plan
   - Augmenter TTL cache équipementiers 30min → 1h
   - Optimiser requêtes N+1 sur module vehicles
   - Implémenter cache multi-niveaux conseils
   ```

3. **Issue GitHub créée**
   ```
   [AI-COS] Optimisation Performance Backend p95 < 180ms
   Labels: ai-cos, performance-squad, high-priority
   Assignee: Performance Squad
   ```

4. **Implémentation Spec Kit**
   ```bash
   /speckit.specify  # Affiner spec
   /speckit.plan     # Plan technique détaillé
   /speckit.implement # Copilot code
   ```

5. **Validation**
   ```bash
   npm run ai-cos:snapshot
   # backend-p95 = 175ms ✅
   ```

## API Endpoints

### Dashboard

```typescript
GET /api/ai-cos/health
// Response: { globalHealth: 88, kpisRed: 2, actionsPending: 5 }

GET /api/ai-cos/snapshots?limit=30
// Response: AiCosSnapshot[]

GET /api/ai-cos/agents
// Response: AgentRole[]

GET /api/ai-cos/squads
// Response: Squad[]
```

### Actions

```typescript
GET /api/ai-cos/actions?status=pending
// Response: AgentAction[]

POST /api/ai-cos/actions
// Body: Omit<AgentAction, 'id' | 'timestamp'>
// Response: AgentAction

PATCH /api/ai-cos/actions/:id/validate
// Body: { approved: boolean, validatedBy: string }
// Response: AgentAction

PATCH /api/ai-cos/actions/:id/complete
// Body: { completedAt: Date }
// Response: AgentAction
```

### Snapshots

```typescript
POST /api/ai-cos/snapshots
// Body: Omit<AiCosSnapshot, 'id'>
// Response: AiCosSnapshot

GET /api/ai-cos/snapshots/latest
// Response: AiCosSnapshot | null
```

## Testing Requirements

### Unit Tests

- ✅ Calculateurs KPIs individuels
- ✅ Helpers modes d'opération
- ✅ Mappers DB ↔ Types TypeScript
- ✅ Validation données entrée/sortie

### Integration Tests

- ✅ Service `AiCosDataService` complet
- ✅ API endpoints (CRUD snapshots/actions)
- ✅ Bridge agents Python → KPIs
- ✅ Génération snapshot complet

### E2E Tests

- ✅ Workflow détection → action → validation
- ✅ Génération spec automatique via Squad Planner
- ✅ Dashboard fonctionnel (navigation, affichage)
- ✅ Notifications Slack/Teams

## Implementation Status

### Phase 1 - Documentation ✅
- [x] ADR-005: AI-COS System
- [x] Feature Spec: AI-COS Operating System
- [x] Workflow: AI-COS Daily Usage

### Phase 2 - Infrastructure 🚧
- [ ] Package `@repo/ai-cos-core` (Types + Config)
- [ ] Migration SQL Supabase (tables)
- [ ] Service `AiCosDataService` (NestJS)
- [ ] Module `AiCosModule` (NestJS)

### Phase 3 - KPIs 📋
- [ ] Package `@repo/ai-cos-kpis`
- [ ] Calculateurs Tech (6 KPIs)
- [ ] Calculateurs Business (5 KPIs)
- [ ] Calculateurs UX (3 KPIs)
- [ ] Bridge agents Python existants
- [ ] Script `ai-cos-compute-kpis.ts`

### Phase 4 - Dashboard 🎨
- [ ] Routes Remix `/admin/ai-cos/*`
- [ ] Composants UI (Health Board, Agents, Actions)
- [ ] Graphiques et visualisations
- [ ] API endpoints backend

### Phase 5 - Intégration Spec Kit 🔗
- [ ] Agent Squad Planner (Python)
- [ ] Génération specs automatique
- [ ] Création issues GitHub
- [ ] Tests end-to-end workflow complet

### Phase 6 - Production 🚀
- [ ] GitHub Action snapshot quotidien
- [ ] Notifications Slack/Teams
- [ ] Monitoring Grafana/Loki
- [ ] Documentation utilisateur finale

## Fiches Documentaires Pricing

### Principe

Les mises a jour tarifs fournisseurs sont tracees via des **fiches markdown** dans Git, sans stocker les fichiers bruts.

```
/docs/pricing/updates/
├── tarif-2024-11.md
├── tarif-2025-01.md
└── ...
```

### Structure d'une fiche

```markdown
# Mise a jour tarif - {Mois} {Annee}

**Date de reception :** JJ/MM/AAAA
**Source :** Fournisseur XYZ
**Fichier :** {emplacement du fichier brut}
**Type :** Prix public + remise + disponibilite
**Volume :** X lignes

## Modifications cles
- Description des changements majeurs

## Actions effectuees
- Import SQL
- Tables mises a jour

## Historique lie
- Fiche precedente
- Tickets associes
```

### Integration AI-COS

| Agent | Role |
|-------|------|
| **Pricing Bot** | Detecte les nouvelles fiches, valide coherence |
| **IA-CFO** | Analyse impact marge, alertes |
| **Stock Manager** | Synchronise disponibilites |

### Avantages

- Leger (markdown, pas de fichiers lourds)
- Versionne par Git
- Indexable par RAG (namespace `knowledge:pricing`)
- Tracabilite complete

## Fiches Documentaires Vehicules

### Principe

Le contenu technique vehicule (pannes, symptomes, reparations, entretien) est organise via des **fiches markdown** dans Git, indexables par le RAG pour recherche semantique.

```
/docs/vehicles/
├── pannes/
│   ├── moteur-diesel-vibrations.md
│   ├── abs-temoin-allume.md
│   └── climatisation-ne-refroidit-plus.md
├── entretien/
│   ├── intervalles-vidange.md
│   ├── kit-distribution-timing.md
│   └── plaquettes-usure-normale.md
├── symptomes/
│   ├── bruit-claquement-direction.md
│   └── fumee-blanche-echappement.md
└── _template.md
```

### Structure d'une fiche

```markdown
# {Type} : {Titre}

**Vehicules concernes :** {Marque Modele (annees)}
**Symptomes :** {Description courte}
**Frequence :** {Courante/Rare} ({X}% des cas atelier)

## Causes possibles
1. Cause principale (X%)
2. Cause secondaire (Y%)

## Diagnostic
- Tests a effectuer
- Codes OBD associes

## Solution
- Intervention et cout estime

## Pieces liees
- References produits catalogue

## Sources
- Origine des informations
```

### Integration AI-COS

| Agent | Role |
|-------|------|
| **SEO Sentinel** | Genere contenu blog/guides depuis fiches |
| **Support Bot** | Repond aux questions clients via RAG |
| **Stock Forecaster** | Anticipe demande pieces liees |
| **Content Bot** | Detecte fiches manquantes ou obsoletes |

### Namespaces RAG

| Namespace | Contenu |
|-----------|---------|
| `knowledge:vehicles:pannes` | Fiches pannes et reparations |
| `knowledge:vehicles:entretien` | Fiches maintenance preventive |
| `knowledge:vehicles:symptomes` | Fiches diagnostic symptomes |

### Avantages

- **SEO** : Contenu indexable pour blog/guides
- **IA** : RAG peut repondre "pourquoi mon diesel vibre ?"
- **Atelier** : Base de connaissance partagee
- **Ventes** : Suggestions pieces automatiques
- **Versionne** : Git history complet
- **Leger** : Markdown, pas de fichiers lourds

## Systeme de Validation des Donnees Vehicules

### REGLE D'OR

> **On ne JAMAIS ajoute une info brute (web, forum, crawler) directement dans les fiches.**

| Workflow | Resultat |
|----------|----------|
| ❌ Raw Web → Fiche | INTERDIT |
| ✅ Raw Web → SQL Staging → Validation → Git JSON → Fiche | CORRECT |

### Architecture Hybride : SQL Staging + Git Validated

| Couche | Stockage | Contenu |
|--------|----------|---------|
| **Staging** | `__vehicle_staging` (SQL) | Donnees brutes, non validees |
| **Validated** | `/data/vehicles/*.json` (Git) | Donnees validees |
| **Fiches** | `/docs/vehicles/*.md` (Git) | Fiches generees |

```
┌─────────────────┐
│   Sources Web   │ (forums, RTA, constructeur)
└────────┬────────┘
         │ collect.py
         ▼
┌─────────────────┐
│  SQL Staging    │ __vehicle_staging (status: pending)
└────────┬────────┘
         │ validate.py (Triple Verification)
         ▼
┌─────────────────┐
│   Git JSON      │ /data/vehicles/*.json (status: validated)
└────────┬────────┘
         │ generate.py
         ▼
┌─────────────────┐
│  Fiches MD      │ /docs/vehicles/*.md
└─────────────────┘
```

### Securite : FicheGenerator Isole

```python
class FicheGenerator:
    """
    REGLE DE SECURITE : Ce generateur n'a JAMAIS acces au SQL staging.
    Il lit UNIQUEMENT les fichiers JSON valides dans Git.
    """
    ALLOWED_SOURCES = ["data/vehicles/**/*.json"]  # Git only

    def __init__(self):
        # ⛔ PAS de connexion DB - interdit par design
        self.db = None
```

### Systeme de Triple Verification

#### Verification 1 — Croisement Multi-Sources

L'IA doit trouver **au moins 2 sources differentes** confirmant l'information :

| Source | Poids |
|--------|-------|
| Constructeur officiel | 1.0 |
| Revue Technique Auto | 0.95 |
| Base pieces OEM | 0.85 |
| Forum specialise | 0.6 |
| YouTube garage pro | 0.5 |
| Forum generaliste | 0.3 |

**Regle** : Minimum **2 sources differentes** obligatoires.

#### Verification 2 — Reference OEM/Constructeur

Pour les donnees techniques, on verifie la correspondance :

| Element | Verification |
|---------|--------------|
| Code moteur | K9K 708, K9K 732, F4R 830... |
| References OEM | Courroie CT1065, Galet VKMA06134... |
| Tableau constructeur | Intervalles officiels |

**Regle** : Si une info ne correspond a AUCUN moteur ou AUCUNE reference OEM → status = `probable_false`

#### Verification 3 — Regles Metier Internes

Fichier de regles pour detecter les aberrations :

| Type | Min | Max |
|------|-----|-----|
| Courroie distribution | 60 000 km | 200 000 km |
| Vidange | 10 000 km | 30 000 km |
| Liquide frein | 2 ans | 4 ans |

**Regle** : Valeur hors fourchette → REJET automatique

### Seuils de Confiance

| Score | Action |
|-------|--------|
| **≥ 0.90** | Auto-approve ✅ Publication automatique |
| **0.75 – 0.90** | Validation humaine OU IA specialisee 🔍 |
| **< 0.75** | REJET automatique ❌ |

```python
class Validator:
    THRESHOLDS = {
        "auto_approve": 0.90,
        "manual_review": 0.75,
        "auto_reject": 0.75  # < this value
    }

    def validate(self, item):
        confidence = self._calculate_confidence(item)

        if confidence >= self.THRESHOLDS["auto_approve"]:
            return "approved"
        elif confidence >= self.THRESHOLDS["manual_review"]:
            return "pending_review"
        else:
            return "rejected"
```

### Cas d'Usage : Validation Symptome Vanne EGR (Clio 3)

#### Contexte

L'IA collecte des symptomes pour la fiche "Vanne EGR - Renault Clio 3 1.5 dCi K9K".

#### Symptomes Valides (multi-sources)

| Symptome | Sources | Confiance | Decision |
|----------|---------|-----------|----------|
| Fumee noire | RTA, Forum, TecDoc, Constructeur | 0.94 | ✅ Auto-approve |
| Perte de puissance | RTA, Forum, TecDoc | 0.91 | ✅ Auto-approve |
| Mode degrade | TecDoc, Constructeur | 0.92 | ✅ Auto-approve |
| Voyant moteur | RTA, TecDoc, Forum, Constructeur | 0.95 | ✅ Auto-approve |

#### Symptome Rejete (1 seule source)

```json
{
  "info": "claquement moteur",
  "valid": false,
  "sources_count": 1,
  "sources_required": 2,
  "semantic_match": false,
  "semantic_reason": "claquement = mecanique (distribution, bielles), EGR = emissions",
  "confidence": 0.32,
  "reason": "seulement 1 source, incoherent avec symptomes EGR typiques"
}
```

#### Analyse Technique

| Critere | Resultat |
|---------|----------|
| Sources | ❌ 1 seule (< 2 minimum) |
| Coherence semantique | ❌ Claquement ≠ EGR |
| Score confiance | 0.32 (< 0.75 seuil rejet) |

**Pourquoi "claquement moteur" est incoherent ?**

- Claquement = probleme mecanique (chaine distribution, bielles, pre-allumage)
- EGR = systeme emissions (recirculation gaz echappement)

**Decision finale** : REJET ❌ - Cette info ne sera JAMAIS ajoutee a la fiche.

#### Benefice

- ✅ Protege la qualite des fiches techniques
- ✅ Evite les erreurs de diagnostic
- ✅ Economise temps et argent (pas de pieces inutiles)

#### Schema ValidationResult avec Coherence Semantique

```python
class ValidationResult(BaseModel):
    """Resultat de validation avec coherence semantique."""

    info: str = Field(..., description="Information a valider")
    valid: bool = Field(..., description="Valide ou non")

    # Sources
    sources_count: int = Field(..., ge=0)
    sources_required: int = Field(default=2)
    sources_list: List[str] = Field(default_factory=list)

    # Coherence semantique (ANTI-FAKE)
    semantic_match: bool = Field(..., description="Coherence avec le contexte")
    semantic_reason: Optional[str] = Field(None, description="Explication si incoherent")
    semantic_category_expected: Optional[str] = Field(None, description="Categorie attendue")
    semantic_category_found: Optional[str] = Field(None, description="Categorie detectee")

    # Score final
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str = Field(..., description="Raison de la decision")

    @validator('valid', pre=True, always=True)
    def compute_valid(cls, v, values):
        """Auto-calcul de valid base sur sources + semantic + confidence."""
        sources_ok = values.get('sources_count', 0) >= values.get('sources_required', 2)
        semantic_ok = values.get('semantic_match', False)
        confidence_ok = values.get('confidence', 0) >= 0.75
        return sources_ok and semantic_ok and confidence_ok
```

#### Matrice Coherence Semantique par Categorie

| Categorie Piece | Symptomes Attendus | Symptomes Incoherents |
|-----------------|--------------------|-----------------------|
| **EGR** | fumee, puissance, ralenti, voyant | claquement, vibration chassis |
| **Turbo** | sifflement, fumee, puissance | ABS, direction |
| **Freins** | bruit freinage, vibration pedale | fumee echappement |
| **Injection** | demarrage, ralenti, consommation | climatisation |
| **Distribution** | claquement, calage, demarrage | echappement, freins |
| **Embrayage** | patinage, vibration, bruit pedale | voyant ABS, direction |
| **Direction** | bruit braquage, durete, jeu | fumee, consommation |
| **Climatisation** | froid insuffisant, bruit compresseur | voyant moteur, puissance |

Cette matrice permet de detecter automatiquement les incoherences semantiques.

### Architecture Optimisee : 1 IA + 3 Agents

#### Principe Fondamental

> **1 seul appel Claude** execute **3 roles d'agents** sequentiellement.
> Chaque agent voit le travail du precedent = contexte partage.

#### Comparatif Cout

| Approche | API Calls | Cout | Latence | Contexte |
|----------|-----------|------|---------|----------|
| ❌ 3 IA separees | 3 | 3x | ~3s | Perdu entre calls |
| ✅ 1 IA + 3 Agents | 1 | 1x | ~1s | Partage |

**Economie** : 66% reduction cout API + meilleure coherence.

#### Diagramme Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    1 APPEL CLAUDE                                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ AGENT #1    │→ │ AGENT #2    │→ │ AGENT #3    │              │
│  │ COLLECTEUR  │  │ MECANIQUE   │  │ COHERENCE   │              │
│  │             │  │             │  │             │              │
│  │ Extraction  │  │ Validation  │  │ Score final │              │
│  │ JSON        │  │ technique   │  │ Decision    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Contexte partage : chaque agent voit le travail precedent      │
└─────────────────────────────────────────────────────────────────┘
```

#### Roles des 3 Agents

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| **#1 COLLECTEUR** | Extraction et structuration | Raw text | JSON structure |
| **#2 MECANIQUE** | Validation technique auto | JSON | tech_valid: bool |
| **#3 COHERENCE** | Score final et decision | JSON + tech | confidence + decision |

#### Regle de Securite

> **Aucun agent ne peut publier seul.**

| Agent | Peut collecter | Peut valider | Peut publier |
|-------|----------------|--------------|--------------|
| #1 COLLECTEUR | ✅ | ❌ | ❌ |
| #2 MECANIQUE | ❌ | ✅ | ❌ |
| #3 COHERENCE | ❌ | ❌ | ✅ (si #1 + #2 OK) |

#### Prompt Multi-Roles (PROMPT_TRIPLE_AGENT)

```python
PROMPT_TRIPLE_AGENT = """
Tu vas analyser cette information en 3 etapes distinctes.
Reponds avec les 3 sections clairement separees.

---
## ETAPE 1 — AGENT COLLECTEUR
Role : Extracteur de donnees automobile
Tache : Structure l'information brute en JSON

Output attendu :
{
  "symptom": "description du symptome",
  "category": "categorie piece (egr, turbo, freins, etc.)",
  "sources": ["source1", "source2"],
  "raw_confidence": 0.0
}

---
## ETAPE 2 — AGENT MECANIQUE
Role : Expert mecanique automobile (20 ans experience)
Tache : Verifie la coherence technique

Questions a repondre :
1. Ce symptome est-il coherent avec cette piece/categorie ?
2. Est-ce techniquement plausible ?
3. Les sources sont-elles fiables pour ce type d'info ?

Output attendu :
{
  "tech_valid": true/false,
  "tech_reason": "explication technique",
  "tech_confidence": 0.0
}

---
## ETAPE 3 — AGENT COHERENCE
Role : Data scientist specialise qualite donnees
Tache : Decision finale basee sur les 2 agents precedents

Controles :
1. Score sources (>= 2 sources differentes ?)
2. Score semantique (matrice coherence categorie/symptome)
3. Score technique (resultat agent #2)

Output final :
{
  "valid": true/false,
  "confidence": 0.0,
  "decision": "approved|rejected|pending_review",
  "reason": "synthese des 3 agents"
}
"""
```

#### Implementation Python (TripleAgentValidator)

```python
class TripleAgentValidator:
    """Validation par 1 IA + 3 Agents (roles sequentiels)."""

    def __init__(self, claude_client):
        self.claude = claude_client
        self.prompt_template = PROMPT_TRIPLE_AGENT

    async def validate(self, raw_info: str, context: dict) -> ValidationResult:
        """1 seul appel Claude, 3 roles executes sequentiellement."""

        prompt = f"""
{self.prompt_template}

---
## INFORMATION A ANALYSER

Vehicule : {context["vehicle"]}
Categorie piece : {context["category"]}
Information brute : {raw_info}

Procede maintenant avec les 3 etapes.
"""

        # 1 SEUL appel API (pas 3)
        response = await self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse les 3 sections de la reponse
        result = self._parse_triple_response(response.content[0].text)

        return ValidationResult(
            agent1_output=result["collecteur"],
            agent2_output=result["mecanique"],
            agent3_output=result["coherence"],
            final_decision=result["coherence"]["decision"],
            final_confidence=result["coherence"]["confidence"]
        )

    def _parse_triple_response(self, content: str) -> dict:
        """Parse la reponse structuree en 3 sections JSON."""
        import re
        import json

        sections = {}

        # Extract JSON blocks from each section
        patterns = {
            "collecteur": r"ETAPE 1.*?```json\s*(\{.*?\})\s*```",
            "mecanique": r"ETAPE 2.*?```json\s*(\{.*?\})\s*```",
            "coherence": r"ETAPE 3.*?```json\s*(\{.*?\})\s*```"
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, content, re.DOTALL)
            if match:
                sections[key] = json.loads(match.group(1))

        return sections
```

#### Seuils de Decision Automatique

| Score final | Decision | Intervention |
|-------------|----------|--------------|
| **>= 0.90** | `approved` | ❌ Aucune (100% auto) |
| **0.75-0.90** | `pending_review` | ⚠️ Re-verification ou humain |
| **< 0.75** | `rejected` | ❌ Aucune (auto-rejet) |

**Resultat** : **90% des cas** traites automatiquement sans intervention humaine.

#### Avantage Contexte Partage

```
Agent #2 peut referencer Agent #1 :
"L'extraction indique 'claquement moteur' mais pour une EGR
 c'est incoherent car EGR = emissions, pas mecanique."

Agent #3 peut synthetiser :
"Agent #1 : extraction OK (4 sources)
 Agent #2 : REJET technique (incoherence semantique)
 Decision finale : rejected, confidence 0.32"
```

**Impossible avec 3 appels separes** car le contexte serait perdu entre chaque call.

#### Exemple Complet : Validation EGR avec Triple Agent

```json
// Input
{
  "vehicle": "Renault Clio 3 1.5 dCi K9K",
  "category": "egr",
  "raw_info": "La vanne EGR cause des claquements moteur selon un forum"
}

// Output Agent #1 (Collecteur)
{
  "symptom": "claquement moteur",
  "category": "egr",
  "sources": ["forum_auto"],
  "raw_confidence": 0.4
}

// Output Agent #2 (Mecanique)
{
  "tech_valid": false,
  "tech_reason": "Claquement = mecanique (distribution, bielles). EGR = emissions. Incoherent.",
  "tech_confidence": 0.2
}

// Output Agent #3 (Coherence)
{
  "valid": false,
  "confidence": 0.32,
  "decision": "rejected",
  "reason": "1 seule source (forum), incoherence semantique EGR/claquement, rejet Agent #2"
}
```

### Principe d'Integrite des Donnees (Data Integrity)

#### Regle Fondamentale

> **Toute information ajoutee au systeme passe par 7 controles obligatoires.**
> Ce principe s'applique a TOUS les domaines, pas seulement aux vehicules.

#### Les 7 Controles Obligatoires

| # | Controle | Description | Responsable |
|---|----------|-------------|-------------|
| 1 | **Croisement sources** | Info croisee avec min 2 sources fiables | Agent #1 |
| 2 | **Regles techniques** | Regles metier du domaine respectees | Agent #2 |
| 3 | **Detection incoherences** | Anomalies semantiques detectees | Agent #3 |
| 4 | **Donnees structurees** | JSON/Schema Pydantic valides | Pipeline |
| 5 | **Generation auto** | Fiches generees automatiquement | FicheGenerator |
| 6 | **Reutilisation** | Systeme reutilise ces donnees propres | RAG Index |
| 7 | **Diffusion controlee** | IA ne diffuse QUE des infos validees | Gate final |

#### Diagramme Flux Data Integrity

```
┌─────────────────────────────────────────────────────────────────┐
│  ENTREE : Nouvelle information (web, API, humain, migration)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. CROISEMENT SOURCES                                          │
│  └─ Minimum 2 sources differentes ? → Si non : REJET            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. REGLES TECHNIQUES                                           │
│  └─ Regles metier du domaine respectees ? → Si non : REJET      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. DETECTION INCOHERENCES                                      │
│  └─ Matrice semantique OK ? → Si non : REJET                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. DONNEES STRUCTUREES                                         │
│  └─ Schema Pydantic valide ? → Si non : REJET                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. GENERATION AUTO                                             │
│  └─ Fiche/contenu genere automatiquement                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. REUTILISATION                                               │
│  └─ Donnee indexee dans RAG pour reutilisation                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. DIFFUSION CONTROLEE                                         │
│  └─ IA peut maintenant utiliser cette info validee              │
└─────────────────────────────────────────────────────────────────┘
```

#### Application par Domaine

| Domaine | Controle 1 (Sources) | Controle 2 (Regles) | Controle 3 (Coherence) |
|---------|----------------------|---------------------|------------------------|
| **Vehicules** | TecDoc + RTA | Regles mecanique | Matrice symptomes |
| **Produits** | Fournisseur + TecDoc | Compatibilite OE | Coherence categorie |
| **Pricing** | Fournisseur + historique | Marge min/max | Ecart prix marche |
| **SEO** | Google + concurrent | Regles SEO | Densite mots-cles |
| **Support** | FAQ + historique tickets | Ton/politesse | Pertinence reponse |
| **Blog** | Sources officielles + expertise | Regles editoriales | Coherence thematique |

#### Benefices Systemiques

| Benefice | Impact |
|----------|--------|
| **Zero fake** | IA ne diffuse jamais d'info non validee |
| **Tracabilite** | Chaque donnee a une source prouvee |
| **Qualite** | Fiches toujours a jour et coherentes |
| **Confiance** | Utilisateurs font confiance au systeme |
| **Scalabilite** | 90% automatique, humain sur 10% edge cases |
| **Reputatoin** | Marque protegee contre erreurs critiques |

#### Integration avec Architecture 1 IA + 3 Agents

Les 3 agents executent les controles 1-3 dans un seul appel Claude :

| Agent | Controles executes |
|-------|-------------------|
| Agent #1 COLLECTEUR | Controle 1 (croisement sources) |
| Agent #2 MECANIQUE/METIER | Controle 2 (regles techniques du domaine) |
| Agent #3 COHERENCE | Controle 3 (detection incoherences) + Decision |

Le pipeline automatique execute les controles 4-7 apres validation des agents :

```
Agents (1-3) → Pipeline (4-7) → Donnee validee dans systeme
```

#### Garantie Zero Erreur Critique

```
❌ SANS Data Integrity :
   Info brute → Directement dans fiche → Risque erreur critique

✅ AVEC Data Integrity :
   Info brute → 7 controles → Validation → Fiche propre

   Si echec a n'importe quel controle → REJET automatique
   L'info n'entre JAMAIS dans le systeme sans validation
```

### Pipeline Simplifie : 3 Scripts

```
collect.py → validate.py → generate.py
    ↓            ↓              ↓
SQL Staging   Git JSON      Markdown
(pending)    (validated)    (fiches)
```

#### Script 1 — collect.py (IA Collecte)

- Recherche web multi-sources (forums, RTA, constructeur)
- Extraction structuree via Claude
- Stockage SQL staging (status: pending, confidence: 0.0)

```bash
python scripts/collect.py --vehicle "renault_clio_3_k9k" --sources web,forums,rta
```

#### Script 2 — validate.py (Triple Verification + Gate)

- Verification 1 : Croisement multi-sources
- Verification 2 : Reference OEM/constructeur
- Verification 3 : Regles metier
- Gate : Export vers Git JSON si confidence >= 0.75

```bash
python scripts/validate.py --vehicle "renault_clio_3_k9k" --auto-approve
```

#### Script 3 — generate.py (Generation Fiches)

- Lit UNIQUEMENT Git JSON (⛔ jamais SQL)
- Genere fiches Markdown
- Aucune connexion DB par design

```bash
python scripts/generate.py --vehicle "renault_clio_3_k9k"
```

### Modele de Generation : 100% IA + Validation Humaine

| Etape | Responsable | Action |
|-------|-------------|--------|
| Generation | **IA (Claude)** | Genere 100% du contenu |
| Validation | **Humain** | Review et approbation |
| Publication | **Script** | Git commit + RAG index |

**Regle fondamentale** : L'humain ne redige JAMAIS - il valide seulement.

### Balises de Generation

| Balise | Source | Description |
|--------|--------|-------------|
| `<!-- AUTO:BEGIN:* -->` | SQL/JSON | Donnees structurees (templates Jinja2) |
| `<!-- AI:GENERATED -->` | LLM | Contenu editorial genere par Claude |

### Workflow Complet

```
1. collect.py   → Collecte IA multi-sources → SQL staging (pending)
2. validate.py  → Triple Verification → confidence score
3. Gate         → Si >= 0.75 → Export Git JSON
4. generate.py  → Lit Git JSON → Genere Markdown
5. Commit       → Git commit automatique
6. RAG          → Indexation namespace knowledge:vehicles
```

### Pipeline d'Alimentation Automatise (7 Etapes)

#### Sources d'Information

| Source | Type | Fiabilite | Validation |
|--------|------|-----------|------------|
| TecDoc (API/export) | Structuree | Haute | Automatique |
| PHP dump (migration) | Legacy | Moyenne | Manuelle |
| Docs constructeur | Officielle | Haute | Automatique |
| Expertise atelier | Interne | Haute | Automatique |
| Retours clients | Support | Moyenne | Review |
| Forums specialises | Externe | Basse | Stricte |

#### Diagramme Pipeline Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│  SOURCES D'INFORMATION                                              │
├─────────────────────────────────────────────────────────────────────┤
│  • TecDoc (API/export)     • Forums (scraping valide)              │
│  • PHP dump (migration)    • Retours clients (tickets support)     │
│  • Docs constructeur       • Expertise atelier                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. EXTRACTION IA (Claude)                                          │
│  └─ Raw text → JSON structure (code, title, signs, causes, fix)    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. VALIDATION SCHEMA (Pydantic)                                    │
│  ├─ Validation structure obligatoire                               │
│  ├─ Detection doublons automatique                                 │
│  └─ Score confiance selon source                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. ENRICHISSEMENT RAG                                              │
│  ├─ Recherche retours clients similaires                           │
│  ├─ Claude : reformulation pro, ajout contexte                     │
│  └─ Liens : pieces concernees, codes OBD associes                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. STOCKAGE (status: pending_validation)                           │
│  └─ INSERT INTO __vehicle_symptoms (...) VALUES (...)              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. VALIDATION HUMAINE (Interface Admin)                            │
│  ├─ ✅ Approve → status = 'approved'                               │
│  ├─ ❌ Reject → status = 'rejected' + motif                        │
│  └─ 📝 Edit → corrections manuelles                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. GENERATION FICHE (automatique post-approval)                    │
│  ├─ Script: python generate_vehicle_docs.py --vehicle <id>         │
│  ├─ Update sections AUTO:BEGIN/END                                 │
│  └─ Commit Git automatique                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. INDEXATION RAG                                                  │
│  └─ Weaviate namespace: knowledge:diagnostic                       │
└─────────────────────────────────────────────────────────────────────┘
```

#### Schemas Pydantic

```python
from pydantic import BaseModel, validator, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime

class SourceType(str, Enum):
    """Types de sources avec niveaux de confiance implicites"""
    TECDOC = "tecdoc"           # Haute confiance (0.9)
    PHP_DUMP = "php_dump"       # Moyenne confiance (0.7)
    CONSTRUCTEUR = "constructeur"  # Haute confiance (0.95)
    EXPERTISE = "expertise_atelier"  # Haute confiance (0.9)
    CLIENT = "retour_client"    # Moyenne confiance (0.6)
    FORUM = "forum"             # Basse confiance (0.4)

CONFIDENCE_SCORES = {
    SourceType.TECDOC: 0.9,
    SourceType.PHP_DUMP: 0.7,
    SourceType.CONSTRUCTEUR: 0.95,
    SourceType.EXPERTISE: 0.9,
    SourceType.CLIENT: 0.6,
    SourceType.FORUM: 0.4,
}

class SourceInfo(BaseModel):
    """Information sur la source d'une donnee"""
    type: SourceType
    url: Optional[str] = None
    date: datetime = Field(default_factory=datetime.now)
    validated_by: Optional[str] = None

    @property
    def confidence(self) -> float:
        return CONFIDENCE_SCORES.get(self.type, 0.5)

class Symptom(BaseModel):
    """Schema de validation pour un symptome vehicule"""
    code: str = Field(..., min_length=3, max_length=50)
    title: str = Field(..., min_length=5, max_length=200)
    category: str = Field(..., pattern=r'^(injection|moteur|transmission|freinage|electricite|depollution|climatisation|autres)$')
    severity: str = Field(default="medium", pattern=r'^(low|medium|high|critical)$')
    signs: List[str] = Field(..., min_items=1)
    causes: List[str] = Field(..., min_items=1)
    fix: List[str] = Field(..., min_items=1)
    obd_codes: List[str] = Field(default_factory=list)
    pieces_concernees: List[str] = Field(default_factory=list)
    source: SourceInfo

    @validator('title')
    def title_not_empty(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('title trop court (min 5 caracteres)')
        return v.strip()

    @validator('signs', 'causes', 'fix')
    def at_least_one_item(cls, v):
        if len(v) < 1:
            raise ValueError('au moins un element requis')
        return [item.strip() for item in v if item.strip()]
```

#### VehicleFichePipeline Class

```python
from supabase import Client
from anthropic import Anthropic
from datetime import datetime
import subprocess
import json

class VehicleFichePipeline:
    """
    Pipeline complet d'alimentation des fiches vehicules.

    Workflow:
    1. Reception info brute
    2. Extraction IA (Claude)
    3. Validation Pydantic
    4. Enrichissement RAG
    5. Stockage pending
    6. Validation humaine
    7. Generation fiche + Commit + Index RAG
    """

    def __init__(self, db: Client, claude: Anthropic, rag_service):
        self.db = db
        self.claude = claude
        self.rag = rag_service

    async def process_new_info(self, vehicle_id: str, raw_info: str, source: SourceInfo) -> dict:
        """
        Etapes 1-5 : Reception → Stockage pending
        """
        # 1. Reception (raw_info)

        # 2. Extraction IA
        structured = await self._extract_with_claude(raw_info)

        # 3. Validation schema Pydantic
        try:
            symptom = Symptom(**structured, source=source)
        except ValidationError as e:
            return {"status": "validation_failed", "errors": e.errors()}

        # 4. Detection doublon
        existing = await self._check_duplicate(vehicle_id, symptom.code)
        if existing:
            return {"status": "duplicate", "existing_id": existing["id"]}

        # 4b. Enrichissement RAG
        enriched = await self._enrich_with_rag(symptom, vehicle_id)

        # 5. Stockage pending
        result = self.db.table("__vehicle_symptoms").insert({
            "vehicle_id": vehicle_id,
            "code": symptom.code,
            "title": symptom.title,
            "category": symptom.category,
            "severity": symptom.severity,
            "signs": symptom.signs,
            "causes": symptom.causes,
            "fix": symptom.fix,
            "obd_codes": symptom.obd_codes,
            "pieces_concernees": symptom.pieces_concernees,
            "source_type": source.type.value,
            "confidence_score": source.confidence,
            "status": "pending_validation"
        }).execute()

        return {"status": "pending", "symptom_id": result.data[0]["id"]}

    async def approve(self, symptom_id: str, approved_by: str) -> dict:
        """
        Etapes 6-7 : Validation humaine → Publication
        """
        # 6. Update status
        self.db.table("__vehicle_symptoms").update({
            "status": "approved",
            "validated_by": approved_by,
            "validated_at": datetime.now().isoformat()
        }).eq("id", symptom_id).execute()

        # Get vehicle_id
        symptom = self.db.table("__vehicle_symptoms").select("vehicle_id").eq("id", symptom_id).single().execute()
        vehicle_id = symptom.data["vehicle_id"]

        # 7a. Regenerer fiche
        fiche_path = await self._regenerate_fiche(vehicle_id)

        # 7b. Commit Git
        subprocess.run([
            "git", "add", fiche_path,
            "&&", "git", "commit", "-m", f"docs(vehicle): update {vehicle_id} fiche [auto]"
        ], check=True)

        # 7c. Index RAG
        await self.rag.index_document(fiche_path, namespace="knowledge:diagnostic")

        return {"status": "published", "vehicle_id": vehicle_id, "fiche_path": fiche_path}

    async def reject(self, symptom_id: str, rejected_by: str, reason: str) -> dict:
        """Rejeter une information avec motif"""
        self.db.table("__vehicle_symptoms").update({
            "status": "rejected",
            "validated_by": rejected_by,
            "validated_at": datetime.now().isoformat(),
            "rejection_reason": reason
        }).eq("id", symptom_id).execute()

        return {"status": "rejected", "reason": reason}

    async def _extract_with_claude(self, raw_info: str) -> dict:
        """Extraction structuree via Claude"""
        response = self.claude.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""Extrait les informations structurees de ce texte sur un probleme vehicule.

Texte: {raw_info}

Retourne un JSON avec:
- code: identifiant unique (ex: "egr_encrassee")
- title: titre court
- category: une de [injection, moteur, transmission, freinage, electricite, depollution, climatisation, autres]
- signs: liste des symptomes observables
- causes: liste des causes possibles
- fix: liste des solutions/reparations"""
            }]
        )
        return json.loads(response.content[0].text)

    async def _check_duplicate(self, vehicle_id: str, code: str) -> Optional[dict]:
        """Verifie si un symptome similaire existe deja"""
        result = self.db.table("__vehicle_symptoms") \
            .select("id") \
            .eq("vehicle_id", vehicle_id) \
            .eq("code", code) \
            .execute()
        return result.data[0] if result.data else None

    async def _enrich_with_rag(self, symptom: Symptom, vehicle_id: str) -> Symptom:
        """Enrichit avec contexte RAG (retours clients similaires)"""
        similar = await self.rag.search(
            f"{symptom.title} {vehicle_id}",
            namespace="knowledge:diagnostic",
            limit=3
        )
        # Enrichissement via Claude si resultats pertinents
        if similar:
            # ... enrichissement
            pass
        return symptom

    async def _regenerate_fiche(self, vehicle_id: str) -> str:
        """Regenere la fiche Markdown du vehicule"""
        generator = FicheGenerator(self.db)
        return generator.generate_and_save(vehicle_id)
```

#### FicheGenerator avec Jinja2

```python
from jinja2 import Environment, FileSystemLoader
from pathlib import Path
from datetime import datetime
from supabase import Client

class FicheGenerator:
    """
    Generateur de fiches Markdown avec templates Jinja2.

    REGLE DE SECURITE: Ce generateur n'a JAMAIS acces aux donnees staging.
    Il lit UNIQUEMENT les donnees validees (status = 'approved').
    """

    def __init__(self, db: Client, template_dir: str = "templates/fiches"):
        self.db = db
        self.env = Environment(loader=FileSystemLoader(template_dir))
        self.fiche_template = self.env.get_template("vehicle_fiche.md.j2")

    def generate_fiche(self, vehicle_id: str) -> str:
        """Genere le contenu Markdown de la fiche"""
        vehicle = self._get_vehicle_data(vehicle_id)
        symptoms = self._get_approved_symptoms(vehicle_id)
        maintenance = self._get_maintenance(vehicle_id)

        return self.fiche_template.render(
            vehicle=vehicle,
            symptoms=symptoms,
            maintenance=maintenance,
            generated_at=datetime.now().isoformat(),
            schema_version="1.0"
        )

    def generate_and_save(self, vehicle_id: str) -> str:
        """Genere et sauvegarde la fiche"""
        vehicle = self._get_vehicle_data(vehicle_id)
        content = self.generate_fiche(vehicle_id)

        # Path: docs/vehicles/{marque}/{modele}/fiche.md
        fiche_path = Path(f"docs/vehicles/{vehicle['marque']}/{vehicle['modele']}/fiche.md")
        fiche_path.parent.mkdir(parents=True, exist_ok=True)
        fiche_path.write_text(content)

        return str(fiche_path)

    def _get_vehicle_data(self, vehicle_id: str) -> dict:
        """Recupere les donnees du vehicule"""
        result = self.db.table("__vehicles").select("*").eq("id", vehicle_id).single().execute()
        return result.data

    def _get_approved_symptoms(self, vehicle_id: str) -> list:
        """Recupere UNIQUEMENT les symptomes valides (status = approved)"""
        result = self.db.table("__vehicle_symptoms") \
            .select("*") \
            .eq("vehicle_id", vehicle_id) \
            .eq("status", "approved") \
            .order("category") \
            .execute()
        return result.data

    def _get_maintenance(self, vehicle_id: str) -> list:
        """Recupere les operations d'entretien"""
        result = self.db.table("__vehicle_maintenance") \
            .select("*") \
            .eq("vehicle_id", vehicle_id) \
            .order("interval_km") \
            .execute()
        return result.data
```

#### Template Jinja2 (vehicle_fiche.md.j2)

```jinja2
---
marque: {{ vehicle.marque }}
modele: {{ vehicle.modele }}
generation: {{ vehicle.generation }}
motorisations: {{ vehicle.motorisations | tojson }}
annees: [{{ vehicle.annee_debut }}, {{ vehicle.annee_fin }}]
generated_at: {{ generated_at }}
schema_version: "{{ schema_version }}"
namespace: knowledge:diagnostic:{{ vehicle.marque | lower }}:{{ vehicle.modele | lower }}
---

# {{ vehicle.marque }} {{ vehicle.modele }} – {{ vehicle.generation }}

## Resume
<!-- AI:GENERATED source=claude -->
{{ vehicle.description | default("Description a generer par IA.") }}

---

## Pannes & Symptomes Frequents
<!-- AUTO:BEGIN:symptoms source=supabase:__vehicle_symptoms -->

{% for category, items in symptoms | groupby('category') %}
### {{ category | title }}

{% for symptom in items %}
#### {{ symptom.title }}

**Signes :**
{% for sign in symptom.signs %}
- {{ sign }}
{% endfor %}

**Causes probables :**
{% for cause in symptom.causes %}
- {{ cause }}
{% endfor %}

**Pistes de reparation :**
{% for fix in symptom.fix %}
- {{ fix }}
{% endfor %}

{% if symptom.obd_codes %}
**Codes OBD :** {{ symptom.obd_codes | join(', ') }}
{% endif %}

---

{% endfor %}
{% endfor %}

<!-- AUTO:END:symptoms -->

---

## Entretien & Intervalles
<!-- AUTO:BEGIN:maintenance source=supabase:__vehicle_maintenance -->

| Operation | Intervalle | Cout estime |
|-----------|------------|-------------|
{% for item in maintenance %}
| {{ item.operation }} | {{ item.interval_km }} km / {{ item.interval_months }} mois | {{ item.cost_min }}-{{ item.cost_max }}€ |
{% endfor %}

<!-- AUTO:END:maintenance -->

---

## Sources

- Donnees validees via pipeline AI-COS
- Generated at: {{ generated_at }}
```

#### CI/CD GitHub Actions

```yaml
# .github/workflows/generate-vehicle-fiches.yml
name: Generate Vehicle Fiches

on:
  push:
    paths:
      - 'data/vehicles/**/*.json'
      - 'supabase/migrations/**'
  workflow_dispatch:
    inputs:
      vehicle_id:
        description: 'Vehicle ID to regenerate (or "all")'
        required: false
        default: 'all'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Validate JSON schemas
        run: |
          npm install -g ajv-cli
          ajv validate -s schemas/vehicle.schema.json -d "data/vehicles/**/*.json"
          ajv validate -s schemas/symptom.schema.json -d "data/symptoms/**/*.json"

  generate:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install supabase jinja2 pydantic

      - name: Generate fiches
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          if [ "${{ github.event.inputs.vehicle_id }}" = "all" ] || [ -z "${{ github.event.inputs.vehicle_id }}" ]; then
            python scripts/generate_vehicle_docs.py --all
          else
            python scripts/generate_vehicle_docs.py --vehicle "${{ github.event.inputs.vehicle_id }}"
          fi

      - name: Commit generated fiches
        run: |
          git config user.name "AI-COS Bot"
          git config user.email "bot@automecanik.fr"
          git add docs/vehicles/
          git diff --staged --quiet || git commit -m "chore: regenerate vehicle fiches [skip ci]"
          git push
```

#### Comparatif : Pipeline Manuel vs Automatise

| Aspect | Pipeline Manuel | Pipeline Automatise |
|--------|-----------------|---------------------|
| **Validation donnees** | ❌ Manuelle, risque erreurs | ✅ Pydantic automatique |
| **Tracabilite source** | ❌ Non documentee | ✅ SourceType + confidence |
| **Detection doublons** | ❌ Manuelle | ✅ Automatique (code unique) |
| **Enrichissement IA** | ❌ Manuel | ✅ Claude + RAG contextuel |
| **CI/CD** | ❌ Scripts manuels | ✅ GitHub Actions |
| **Workflow validation** | ❌ Implicite | ✅ Status explicite (pending → approved/rejected) |
| **Audit trail** | ❌ Non | ✅ validated_by, validated_at, rejection_reason |
| **Scalabilite** | ⚠️ Limitee | ✅ 10k+ vehicules |

### Architecture SQL pour > 5000 Vehicules

Pour supporter plus de 5000 vehicules avec performances optimales, on utilise le partitionnement SQL par marque.

#### Schema Principal avec Partitionnement

```sql
-- Table principale partitionnee par marque
CREATE TABLE __vehicles (
  id text PRIMARY KEY,
  marque text NOT NULL,
  modele text NOT NULL,
  generation text,
  annee_debut int,
  annee_fin int,
  motorisation jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
) PARTITION BY LIST (marque);

-- Partitions par marque (les plus courantes)
CREATE TABLE __vehicles_renault PARTITION OF __vehicles FOR VALUES IN ('renault');
CREATE TABLE __vehicles_peugeot PARTITION OF __vehicles FOR VALUES IN ('peugeot');
CREATE TABLE __vehicles_citroen PARTITION OF __vehicles FOR VALUES IN ('citroen');
CREATE TABLE __vehicles_volkswagen PARTITION OF __vehicles FOR VALUES IN ('volkswagen');
CREATE TABLE __vehicles_autres PARTITION OF __vehicles DEFAULT;

-- Index par marque/modele pour recherche rapide
CREATE INDEX idx_vehicles_marque_modele ON __vehicles (marque, modele);
CREATE INDEX idx_vehicles_motorisation ON __vehicles USING GIN (motorisation);
```

#### Table Symptomes/Pannes

```sql
CREATE TABLE __vehicle_symptoms (
  id serial PRIMARY KEY,
  vehicle_id text REFERENCES __vehicles(id) ON DELETE CASCADE,
  code text NOT NULL,              -- ex: SYM-CLO3-K9K-001
  title text NOT NULL,
  category text NOT NULL,          -- entretien, panne, usure
  severity text DEFAULT 'medium',  -- low, medium, high, critical
  signs jsonb,                     -- symptomes observables
  causes jsonb,                    -- causes possibles
  fix jsonb,                       -- solutions
  confidence_score decimal(3,2),   -- 0.00 - 1.00
  source_count int DEFAULT 0,      -- nombre sources validees
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_symptoms_vehicle ON __vehicle_symptoms (vehicle_id);
CREATE INDEX idx_symptoms_category ON __vehicle_symptoms (category);
CREATE INDEX idx_symptoms_confidence ON __vehicle_symptoms (confidence_score);
```

#### Table Staging (donnees brutes)

```sql
CREATE TABLE __vehicle_staging (
  id serial PRIMARY KEY,
  vehicle_ref text NOT NULL,       -- renault_clio_3_k9k
  data_type text NOT NULL,         -- symptom, maintenance, part
  raw_data jsonb NOT NULL,
  source_url text,
  source_type text,                -- forum, rta, oem, youtube
  source_weight decimal(3,2),      -- poids de la source
  confidence_score decimal(3,2) DEFAULT 0.0,
  status text DEFAULT 'pending',   -- pending, validated, rejected
  validated_at timestamptz,
  validated_by text,               -- human_user_id ou ai_agent
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_staging_status ON __vehicle_staging (status);
CREATE INDEX idx_staging_vehicle ON __vehicle_staging (vehicle_ref);
```

#### Avantages du Partitionnement

| Aspect | Benefice |
|--------|----------|
| Performance | Requetes filtrées par marque = scan partition unique |
| Maintenance | Vacuum/analyze par partition |
| Scalabilite | Ajout nouvelles marques sans impact |
| Archive | DROP partition pour purge anciens modeles |

### Modele Hybride : Zones AUTO + MANUAL

Pour les fiches avec contenu mixte (genere + manuel), on preserve les zones manuelles lors des regenerations.

#### Patterns de Zones

```markdown
<!-- AUTO:BEGIN:motorisation -->
## Motorisation
K9K 832 - 1.5 dCi 90ch
<!-- AUTO:END:motorisation -->

<!-- MANUAL:BEGIN:astuces_garage -->
## Astuces de Garage
> Note du mécanicien : Sur ce moteur, toujours...
<!-- MANUAL:END:astuces_garage -->

<!-- AI:GENERATED:2025-12-29 -->
Le moteur K9K 832 équipe la Clio 3...
<!-- AI:END -->
```

#### HybridFicheGenerator

```python
import re
from pathlib import Path

class HybridFicheGenerator:
    """
    Generateur qui preserve les zones MANUAL lors des regenerations.
    Lit UNIQUEMENT depuis Git JSON - jamais de connexion SQL.
    """

    MANUAL_PATTERN = r'<!-- MANUAL:BEGIN:(\w+) -->.*?<!-- MANUAL:END:\1 -->'
    AUTO_PATTERN = r'<!-- AUTO:BEGIN:(\w+) -->.*?<!-- AUTO:END:\1 -->'

    def __init__(self):
        self.db = None  # ⛔ JAMAIS de connexion SQL par design

    def regenerate(self, fiche_path: Path, json_data: dict) -> str:
        """
        Regenere une fiche en preservant les zones MANUAL.
        """
        # 1. Lire fiche existante
        existing_content = ""
        if fiche_path.exists():
            existing_content = fiche_path.read_text()

        # 2. Extraire zones MANUAL a preserver
        manual_zones = self._extract_manual_zones(existing_content)

        # 3. Generer nouveau contenu AUTO
        new_content = self._generate_auto_content(json_data)

        # 4. Fusionner : nouveau AUTO + ancien MANUAL
        final_content = self._merge_zones(new_content, manual_zones)

        return final_content

    def _extract_manual_zones(self, content: str) -> dict:
        """Extrait toutes les zones MANUAL existantes."""
        zones = {}
        for match in re.finditer(self.MANUAL_PATTERN, content, re.DOTALL):
            zone_name = match.group(1)
            zones[zone_name] = match.group(0)
        return zones

    def _generate_auto_content(self, json_data: dict) -> str:
        """Genere le contenu AUTO depuis les donnees JSON validees."""
        # Template Jinja2 ou string formatting
        content = f"""# {json_data['title']}

<!-- AUTO:BEGIN:motorisation -->
## Motorisation
{json_data.get('motorisation', 'Non specifie')}
<!-- AUTO:END:motorisation -->

<!-- AUTO:BEGIN:entretien -->
## Entretien
{self._format_entretien(json_data.get('entretien', []))}
<!-- AUTO:END:entretien -->

<!-- AUTO:BEGIN:pannes -->
## Pannes Courantes
{self._format_pannes(json_data.get('pannes', []))}
<!-- AUTO:END:pannes -->
"""
        return content

    def _merge_zones(self, new_content: str, manual_zones: dict) -> str:
        """Fusionne nouveau contenu avec zones MANUAL preservees."""
        final = new_content

        # Ajouter les zones MANUAL a la fin ou a leur position originale
        for zone_name, zone_content in manual_zones.items():
            marker = f"<!-- MANUAL_PLACEHOLDER:{zone_name} -->"
            if marker in final:
                final = final.replace(marker, zone_content)
            else:
                # Ajouter a la fin avant le footer
                final += f"\n\n{zone_content}"

        return final

    def _format_entretien(self, items: list) -> str:
        return "\n".join([f"- {item}" for item in items]) or "Aucun"

    def _format_pannes(self, items: list) -> str:
        return "\n".join([f"- {item}" for item in items]) or "Aucune"
```

#### Workflow Regeneration

```
1. Lecture fiche existante
2. Extraction zones MANUAL (preservees)
3. Lecture Git JSON (donnees validees)
4. Generation nouveau contenu AUTO
5. Fusion AUTO + MANUAL
6. Ecriture fiche finale
7. Git commit
```

#### Regles de Preservation

| Zone | Regeneration | Preservation |
|------|--------------|--------------|
| `AUTO:BEGIN/END` | ✅ Regenere | ❌ Non preserve |
| `MANUAL:BEGIN/END` | ❌ Non touche | ✅ Toujours preserve |
| `AI:GENERATED` | ✅ Peut etre regenere | ⚠️ Selon config |

---

## Knowledge Graph + Reasoning Engine (v2.8.0)

### Principe Fondamental

> **Le meilleur modèle n'est pas "tables + règles", c'est un Knowledge Graph + Reasoning Engine.**

Evolution de l'architecture vers un graphe de connaissances pour :
- Diagnostic multi-symptômes naturel
- Ajout de connaissances sans refactor
- Pannes récurrentes par modèle
- SEO/Insights automatiques

### Architecture du Knowledge Graph

```
┌──────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE GRAPH                                │
│                                                                       │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌───────────┐      │
│  │ VEHICLE │───►│ SYSTEM   │───►│ OBSERVABLE │───►│   FAULT   │      │
│  │  Node   │    │   Node   │    │    Node    │    │   Node    │      │
│  └─────────┘    └──────────┘    └────────────┘    └─────┬─────┘      │
│       │                                                  │            │
│       │         ┌────────────────────────────────────────┘            │
│       │         │                                                     │
│       │         ▼                                                     │
│       │    ┌────────────┐    ┌───────────┐                           │
│       └───►│   ACTION   │◄───│   PART    │◄──────────────────────────┤
│            │    Node    │    │   Node    │                           │
│            └────────────┘    └───────────┘                           │
│                                                                       │
│  Edges: CAUSES, FIXED_BY, COMPATIBLE_WITH, CORRELATES_WITH          │
└──────────────────────────────────────────────────────────────────────┘
```

### Types de Nodes

| Type | Description | Exemple |
|------|-------------|---------|
| **Vehicle** | Véhicule spécifique | Renault Clio 3 1.5 dCi K9K |
| **System** | Système du véhicule | Moteur, Freinage, Refroidissement |
| **Observable** | Symptôme observable | Fumée noire, voyant moteur |
| **Fault** | Panne identifiée | EGR encrassée, turbo HS |
| **Action** | Action diagnostic/réparation | Nettoyage EGR, remplacement |
| **Part** | Pièce concernée | Vanne EGR, Turbo |

### Types de Relations (Edges)

| Edge Type | Description | Exemple |
|-----------|-------------|---------|
| `HAS_SYSTEM` | Vehicle → System | Clio → Moteur |
| `SHOWS_SYMPTOM` | System → Observable | Moteur → fumée noire |
| `CAUSES` | Observable → Fault | fumée noire → EGR encrassée |
| `FIXED_BY` | Fault → Part | EGR encrassée → Vanne EGR |
| `DIAGNOSED_BY` | Fault → Action | EGR encrassée → Nettoyage |
| `COMPATIBLE_WITH` | Part → Vehicle | Vanne EGR → Clio K9K |
| `CORRELATES_WITH` | Observable ↔ Observable | symptômes associés |
| `OFTEN_WITH` | Fault ↔ Fault | pannes souvent liées |

### Tables SQL

```sql
-- kg_nodes : Entités du graphe
CREATE TABLE kg_nodes (
  node_id UUID PRIMARY KEY,
  node_type TEXT NOT NULL,      -- Vehicle, System, Observable, Fault, Action, Part
  node_label TEXT NOT NULL,     -- "Fumée noire à l'échappement"
  node_category TEXT,           -- "Électrique", "Mécanique"
  node_data JSONB DEFAULT '{}', -- Metadata flexible
  confidence FLOAT DEFAULT 1.0,
  sources TEXT[],               -- ["TecDoc", "RTA", "Forum"]
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

-- kg_edges : Relations versionnées
CREATE TABLE kg_edges (
  edge_id UUID PRIMARY KEY,
  source_node_id UUID REFERENCES kg_nodes,
  target_node_id UUID REFERENCES kg_nodes,
  edge_type TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  confidence FLOAT DEFAULT 1.0,
  evidence JSONB DEFAULT '{}',
  sources TEXT[],
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

-- kg_reasoning_cache : Cache diagnostics
CREATE TABLE kg_reasoning_cache (
  cache_id UUID PRIMARY KEY,
  query_hash TEXT UNIQUE,
  input_observables TEXT[],
  result_faults JSONB,
  result_score FLOAT,
  result_explanation TEXT,
  hit_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ
);
```

### Reasoning Engine (TypeScript)

```typescript
class KnowledgeGraphService {
  /**
   * Diagnostic multi-symptômes via traversal du graphe.
   *
   * Exemple:
   * - vehicle: "renault-clio-3-1.5-dci"
   * - observables: ["fumée noire", "perte puissance", "voyant moteur"]
   * - Résultat: Vanne EGR défaillante (confidence: 0.94)
   */
  async diagnose(
    vehicleId: string,
    observables: string[],
    confidenceThreshold = 0.75
  ): Promise<DiagnosticResult> {
    // 1. Trouver les nodes Observable correspondants
    const observableNodes = await this.findObservableNodes(observables);

    // 2. Traverser le graphe: Observable → CAUSES → Fault
    const faultCandidates = await this.traverseToFaults(observableNodes);

    // 3. Scorer chaque fault par symptômes matchés
    const scoredFaults = this.scoreFaults(faultCandidates, observableNodes);

    // 4. Enrichir avec Actions et Parts
    return this.enrichWithSolutions(scoredFaults);
  }

  private scoreFaults(faults: FaultCandidate[], observables: UUID[]): ScoredFault[] {
    /**
     * Score = (symptômes matchés / total) × confiance moyenne
     *
     * Exemple:
     * - EGR Fault: 3/3 symptômes → 1.0 × 0.94 = 0.94 ✅
     * - Turbo Fault: 2/3 symptômes → 0.66 × 0.85 = 0.56
     */
    const faultScores = new Map<string, { matches: number; confidenceSum: number }>();

    for (const fault of faults) {
      const current = faultScores.get(fault.faultId) || { matches: 0, confidenceSum: 0 };
      current.matches++;
      current.confidenceSum += fault.confidence;
      faultScores.set(fault.faultId, current);
    }

    return Array.from(faultScores.entries())
      .map(([faultId, data]) => ({
        faultId,
        score: (data.matches / observables.length) * (data.confidenceSum / data.matches),
        matchedSymptoms: data.matches,
        totalSymptoms: observables.length,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
```

### RPC Functions SQL

```sql
-- Diagnostic complet: symptômes → pannes scorées avec pièces/actions
CREATE FUNCTION kg_diagnose(
  p_vehicle_id UUID,
  p_observable_labels TEXT[],
  p_confidence_threshold FLOAT DEFAULT 0.75
) RETURNS TABLE (
  fault_id UUID,
  fault_label TEXT,
  match_score FLOAT,
  matched_symptoms INT,
  total_symptoms INT,
  parts JSONB,
  actions JSONB
) AS $$
  -- 1. Trouve les Observable nodes correspondants
  -- 2. Traverse: Observable → CAUSES → Fault
  -- 3. Score par nombre de symptômes matchés
  -- 4. Enrichit avec FIXED_BY → Parts et DIAGNOSED_BY → Actions
$$ LANGUAGE plpgsql;
```

### Exemple Diagnostic : Vanne EGR

**Input utilisateur:**
> "Ma Clio 3 1.5 dCi fait de la fumée noire, perd de la puissance et le voyant moteur s'allume"

**Traversal Graph:**
```
Observable["fumée noire"] ──CAUSES──► Fault["EGR encrassée"] ──FIXED_BY──► Part["Vanne EGR"]
Observable["perte puissance"] ──CAUSES──► Fault["EGR encrassée"]
Observable["voyant moteur"] ──CAUSES──► Fault["EGR encrassée"]
                                              │
                                              └──DIAGNOSED_BY──► Action["Nettoyage EGR"]
```

**Scoring:**
| Fault | Symptômes matchés | Score |
|-------|-------------------|-------|
| EGR encrassée | 3/3 | 1.0 × 0.94 = **0.94** |
| Turbo HS | 2/3 | 0.66 × 0.85 = 0.56 |
| Injecteur | 1/3 | 0.33 × 0.80 = 0.26 |

**Output:**
```json
{
  "diagnostic": "Vanne EGR encrassée",
  "confidence": 0.94,
  "matched_symptoms": ["fumée noire", "perte puissance", "voyant moteur"],
  "recommended_actions": ["Nettoyage EGR", "Remplacement si nécessaire"],
  "parts": [
    {"ref": "EGR-REN-K9K-001", "name": "Vanne EGR Renault K9K", "price": 189.90}
  ],
  "explanation": "Les 3 symptômes correspondent au profil typique d'une EGR défaillante sur K9K."
}
```

### Avantages vs Architecture Tables + Règles

| Critère | Tables + Règles | Knowledge Graph |
|---------|-----------------|-----------------|
| Ajout connaissance | Refactor code | `INSERT INTO kg_edges` |
| Diagnostic multi-symptômes | Code complexe | Traversal naturel |
| Pannes récurrentes | Stats manuelles | Query `OFTEN_WITH` |
| Explication | Hardcodée | Générée du chemin |
| SEO/Insights | Queries SQL custom | Graph analytics |
| Versioning | Difficile | Natif (`version` column) |

### Intégration Architecture 1 IA + 3 Agents

```
┌─────────────────────────────────────────────────────────────────────┐
│                         1 APPEL CLAUDE                               │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │  AGENT #1    │──►│  AGENT #2    │──►│  AGENT #3    │             │
│  │  COLLECTEUR  │   │  GRAPH QUERY │   │  REASONER    │             │
│  │              │   │              │   │              │             │
│  │ Parse texte  │   │ Traverse KG  │   │ Score final  │             │
│  │ → Observables│   │ → Faults     │   │ + Explication│             │
│  └──────────────┘   └──────────────┘   └──────────────┘             │
│                                                                      │
│  Agent #2 utilise le Knowledge Graph au lieu de règles hardcodées   │
└─────────────────────────────────────────────────────────────────────┘
```

### Migration des Données Existantes

| Source | Target Node Type | Méthode |
|--------|------------------|---------|
| `auto_type` | Vehicle | Import direct avec `type_id` |
| `pieces_gamme` | Observable, Fault | Mapping sémantique |
| `pieces_relation_type` | Edge COMPATIBLE_WITH | Conversion directe |
| Forums/RTA | Edge CAUSES | Extraction IA + validation |

### Fichiers Créés

| Fichier | Description |
|---------|-------------|
| `backend/supabase/migrations/20251230_knowledge_graph.sql` | Tables + RPC functions |
| `backend/src/modules/knowledge-graph/kg.module.ts` | Module NestJS |
| `backend/src/modules/knowledge-graph/kg.service.ts` | Reasoning Engine |
| `backend/src/modules/knowledge-graph/kg-data.service.ts` | CRUD nodes/edges |

---

## Related Documents

- [AI-COS Vision](../architecture/ai-cos-vision.md)
- [AI-COS Workflow](../workflows/ai-cos-workflow.md)
- [Cache Multi-Levels](../architecture/003-cache-redis-multi-levels.md)
- [Spec Kit README](../README.md)

## Change Log

- **2025-12-30 v2.8.0** : Knowledge Graph + Reasoning Engine (architecture graphe Vehicle → System → Observable → Fault → Action → Part), tables kg_nodes/kg_edges/kg_reasoning_cache avec RPC functions, KnowledgeGraphService TypeScript pour diagnostic multi-symptomes, scoring automatique par symptomes matches, integration architecture 1 IA + 3 Agents, migration progressive depuis donnees existantes
- **2025-12-30 v2.7.5** : Principe Data Integrity systemique (7 controles obligatoires pour TOUTE info entrant dans le systeme), application multi-domaines (vehicules, produits, pricing, SEO, support, blog), diagramme flux avec gates de rejet, integration architecture 1 IA + 3 Agents (controles 1-3) + pipeline (controles 4-7), garantie zero erreur critique
- **2025-12-30 v2.7.4** : Architecture 1 IA + 3 Agents (1 appel Claude = 3 roles sequentiels, economie 66% cout API, contexte partage), PROMPT_TRIPLE_AGENT template multi-roles, TripleAgentValidator class Python, regle securite "aucun agent ne publie seul", 90% validation automatique sans intervention humaine
- **2025-12-30 v2.7.3** : Cas d'usage realiste Vanne EGR Clio 3 (demonstration systeme anti-fake), Schema ValidationResult avec coherence semantique (semantic_match, semantic_reason, semantic_category), Matrice coherence semantique par categorie piece (EGR, Turbo, Freins, Injection, Distribution, Embrayage, Direction, Climatisation)
- **2025-12-29 v2.7.2** : Pipeline Alimentation Automatise complet (7 etapes avec diagramme), Schemas Pydantic (SourceType, SourceInfo, Symptom avec validators), VehicleFichePipeline class (process_new_info, approve, reject, enrichissement RAG), FicheGenerator avec Jinja2 templates, CI/CD GitHub Actions (validation JSON + generation fiches), Comparatif Pipeline Manuel vs Automatise
- **2025-12-29 v2.7.1** : Architecture SQL pour > 5000 vehicules (partitionnement par marque, tables __vehicles, __vehicle_symptoms, __vehicle_staging), Modele Hybride zones AUTO + MANUAL (HybridFicheGenerator avec preservation zones manuelles lors regenerations)
- **2025-12-29 v2.7.0** : Systeme Validation Donnees - REGLE D'OR (jamais info brute web → fiche), architecture hybride SQL staging + Git validated, Triple Verification (multi-sources avec poids, OEM, regles metier), seuils confiance (≥0.90 auto, 0.75-0.90 review, <0.75 rejet), Pipeline 3 scripts (collect/validate/generate), modele 100% IA + validation humaine
- **2025-12-29 v2.3.0** : Ajout section Fiches Documentaires Vehicules (pannes, symptomes, entretien)
- **2025-12-29 v2.2.0** : Ajout section Fiches Documentaires Pricing (tracabilite tarifs fournisseurs)
- **2025-12-29 v2.1.1** : Mise a jour references fichiers renommes (ai-cos-vision.md, ai-cos-enrichment-plan.md)
- **2025-11-19 v2.1.0** : Enrichissement coordination inter-domaines (3 mécanismes, 3 scénarios multi-agents, 4 KPIs coordination, dashboard section)
- **2025-11-18 v2.0.0** : Transformation Entreprise Augmentée (57 agents, 52 KPIs, 5 squads, 4 modes, 3 méta-couches, Health Board)
- **2025-11-18 v1.0.0** : Version initiale (draft)
