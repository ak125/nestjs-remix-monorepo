---
title: "AI-COS Operating System"
status: active
version: 2.2.0
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

## Related Documents

- [AI-COS Vision](../architecture/ai-cos-vision.md)
- [AI-COS Workflow](../workflows/ai-cos-workflow.md)
- [Cache Multi-Levels](../architecture/003-cache-redis-multi-levels.md)
- [Spec Kit README](../README.md)

## Change Log

- **2025-12-29 v2.2.0** : Ajout section Fiches Documentaires Pricing (tracabilite tarifs fournisseurs)
- **2025-12-29 v2.1.1** : Mise a jour references fichiers renommes (ai-cos-vision.md, ai-cos-enrichment-plan.md)
- **2025-11-19 v2.1.0** : Enrichissement coordination inter-domaines (3 mécanismes, 3 scénarios multi-agents, 4 KPIs coordination, dashboard section)
- **2025-11-18 v2.0.0** : Transformation Entreprise Augmentée (57 agents, 52 KPIs, 5 squads, 4 modes, 3 méta-couches, Health Board)
- **2025-11-18 v1.0.0** : Version initiale (draft)
