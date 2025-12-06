---
title: "AI-COS Implementation Guide - Guide Technique"
status: draft
version: 1.2.0
authors: [Tech Team, Architecture Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ../architecture/006-ai-cos-enrichment.md
  - ../features/ai-cos-operating-system.md
tags: [ai-cos, technical, implementation, guide, nestjs, supabase]
priority: high
---

# AI-COS Implementation Guide

## Overview

Guide technique détaillé pour l'implémentation d'AI-COS Enrichment (v1.0 → v2.0).  
Architecture 5 niveaux, 26 agents, 40 KPIs, coordination temps réel.

## Architecture 4 Pôles Métier

```
IA-CEO v2 (Orchestrateur Global)
        ↓
┌───────┴──────┬──────────┬──────────┐
│              │          │          │
🧩 Stratégique ⚙️ Tech    📊 Business 🌍 Expansion
5 agents      8 agents   8 agents   5 agents
```

**Organisation packages par pôle** :
- `@repo/ai-cos-core/agents/strategic/` → 🧩 Pôle Stratégique
- `@repo/ai-cos-core/agents/tech/` → ⚙️ Pôle Tech & Produit
- `@repo/ai-cos-core/agents/business/` → 📊 Pôle Business & Marché
- `@repo/ai-cos-core/agents/expansion/` → 🌍 Pôle Expansion & Innovation
- `@repo/ai-cos-core/squads/` → Meta-agents transversaux

## Stack Technique Complet

### Packages Monorepo

```
packages/
├── ai-cos-core/                    # Types, config, agents (EXISTING + ENRICHED)
│   ├── src/
│   │   ├── board/                  # IA-BOARD (Niveau 1 Governance)
│   │   │   ├── ia-ceo.board.ts                # CEO Board member
│   │   │   ├── ia-cfo-coo.board.ts            # CFO/COO fusion
│   │   │   ├── ia-legal.board.ts              # Legal/Compliance
│   │   │   ├── ia-risk.board.ts               # Risk Detection (NEW)
│   │   │   └── board-kpis.types.ts            # Board KPIs types
│   │   ├── agents/
│   │   │   ├── strategic/          # 🧩 PÔLE STRATÉGIQUE (5 agents)
│   │   │   │   ├── ia-ceo-v2.types.ts         # Orchestration opérationnelle
│   │   │   │   ├── ia-cfo-v2.types.ts         # Finance intelligence ops
│   │   │   │   ├── ia-legal.types.ts          # Legal/Compliance ops
│   │   │   │   ├── ia-esg.types.ts            # EXISTING - Durabilité
│   │   │   │   └── ia-hr.types.ts             # NEW - HR/Talent
│   │   │   ├── tech/               # ⚙️ PÔLE TECH & PRODUIT (8 agents)
│   │   │   │   ├── ia-cto.types.ts            # EXISTING
│   │   │   │   ├── ia-devops.types.ts         # EXISTING
│   │   │   │   ├── ia-ciso.types.ts           # EXISTING
│   │   │   │   ├── ia-designer.types.ts       # EXISTING
│   │   │   │   ├── ia-docker-optimizer.types.ts  # NEW - Build & Container
│   │   │   │   ├── ia-qa.types.ts             # NEW - Quality
│   │   │   │   ├── ia-product.types.ts        # NEW - Product mgmt
│   │   │   │   └── ia-content.types.ts        # NEW - Content strategy
│   │   │   ├── business/           # 📊 PÔLE BUSINESS & MARCHÉ (8 agents)
│   │   │   │   ├── ia-cmo.types.ts            # NEW - Marketing
│   │   │   │   ├── seo-sentinel.types.ts      # EXISTING
│   │   │   │   ├── pricing-bot.types.ts       # EXISTING
│   │   │   │   ├── stock-forecaster.types.ts  # EXISTING
│   │   │   │   ├── ia-crm.types.ts            # EXISTING
│   │   │   │   ├── ia-logistics.types.ts      # NEW - Fulfillment
│   │   │   │   ├── ia-supply-chain.types.ts   # NEW - Procurement
│   │   │   │   └── ia-support.types.ts        # NEW - Customer support
│   │   │   └── expansion/          # 🌍 PÔLE EXPANSION (agents transversaux)
│   │   │       └── README.md                  # Futurs agents R&D, Partenaires
│   │   ├── kpis/
│   │   │   ├── tech.kpis.ts                   # 6 KPIs (EXISTING)
│   │   │   ├── business.kpis.ts               # 5 KPIs (EXISTING)
│   │   │   ├── ux.kpis.ts                     # 3 KPIs (EXISTING)
│   │   │   ├── expansion.kpis.ts              # 1 KPI (EXISTING)
│   │   │   ├── marketing.kpis.ts              # 5 KPIs (NEW)
│   │   │   ├── finance.kpis.ts                # 6 KPIs (NEW)
│   │   │   ├── logistics.kpis.ts              # 5 KPIs (NEW)
│   │   │   ├── product.kpis.ts                # 4 KPIs (NEW)
│   │   │   ├── support.kpis.ts                # 3 KPIs (NEW)
│   │   │   └── operations.kpis.ts             # 2 KPIs (NEW)
│   │   ├── squads/                 # META-AGENTS TRANSVERSAUX (6 squads)
│   │   │   ├── performance.squad.ts           # EXISTING - Lead: IA-CTO (⚙️)
│   │   │   ├── ecommerce.squad.ts             # EXISTING - Lead: Pricing Bot (📊)
│   │   │   ├── resilience.squad.ts            # EXISTING - Lead: IA-CISO (⚙️)
│   │   │   ├── customer.squad.ts              # EXISTING - Lead: IA-CRM (📊)
│   │   │   ├── business-growth.squad.ts       # NEW - Lead: IA-CMO (📊)
│   │   │   │   # Coordination: 📊 Business + ⚙️ Tech + 🧩 Stratégique
│   │   │   └── operations-excellence.squad.ts # NEW - Lead: IA-Logistics (📊)
│   │   │       # Coordination: 📊 Business + 🧩 Stratégique
│   │   ├── orchestration/                     # NEW - IA-CEO v2 coordination
│   │   │   ├── coordinator.types.ts
│   │   │   ├── event-bus.types.ts
│   │   │   └── state-machine.types.ts
│   │   └── simulation/                        # NEW - What-if engine
│   │       ├── scenario.types.ts
│   │       ├── predictor.types.ts
│   │       └── validator.types.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ai-cos-kpis/                    # Calculateurs KPIs (EXISTING + ENRICHED)
│   ├── src/
│   │   ├── snapshot.ts                        # ENRICHED - 15 → 40 KPIs
│   │   ├── tech/
│   │   │   ├── codeHealth.ts                  # EXISTING
│   │   │   ├── backendP95.ts                  # EXISTING
│   │   │   ├── frontendP95.ts                 # EXISTING
│   │   │   ├── testCoverage.ts                # EXISTING
│   │   │   ├── techDebt.ts                    # EXISTING
│   │   │   └── securityScore.ts               # EXISTING
│   │   ├── business/
│   │   │   ├── conversionRate.ts              # EXISTING
│   │   │   ├── cartAbandonment.ts             # EXISTING
│   │   │   ├── aov.ts                         # EXISTING
│   │   │   ├── stockRupture.ts                # EXISTING
│   │   │   └── roiCampaigns.ts                # EXISTING
│   │   ├── ux/
│   │   │   ├── uxScore.ts                     # EXISTING
│   │   │   ├── seoScore.ts                    # EXISTING
│   │   │   └── accessibilityScore.ts          # EXISTING
│   │   ├── expansion/
│   │   │   └── esgScore.ts                    # EXISTING
│   │   ├── marketing/                         # NEW - 5 calculateurs
│   │   │   ├── cac.ts
│   │   │   ├── ltv.ts
│   │   │   ├── emailOpenRate.ts
│   │   │   ├── socialEngagement.ts
│   │   │   └── contentVelocity.ts
│   │   ├── finance/                           # NEW - 6 calculateurs
│   │   │   ├── burnRate.ts
│   │   │   ├── runway.ts
│   │   │   ├── grossMargin.ts
│   │   │   ├── paymentDelay.ts
│   │   │   ├── invoiceAccuracy.ts
│   │   │   └── budgetVariance.ts
│   │   ├── logistics/                         # NEW - 5 calculateurs
│   │   │   ├── fulfillmentTime.ts
│   │   │   ├── shippingAccuracy.ts
│   │   │   ├── inventoryTurnover.ts
│   │   │   ├── warehouseCapacity.ts
│   │   │   └── returnRate.ts
│   │   ├── product/                           # NEW - 4 calculateurs
│   │   │   ├── catalogCoverage.ts
│   │   │   ├── timeToMarket.ts
│   │   │   ├── featureAdoption.ts
│   │   │   └── productQuality.ts
│   │   ├── support/                           # NEW - 3 calculateurs
│   │   │   ├── responseTime.ts
│   │   │   ├── resolutionRate.ts
│   │   │   └── csat.ts
│   │   └── operations/                        # NEW - 2 calculateurs
│   │       ├── timeToHire.ts
│   │       └── employeeRetention.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ai-cos-simulation/              # NEW - Moteur what-if
│   ├── src/
│   │   ├── engine/
│   │   │   ├── SimulationEngine.ts
│   │   │   └── ScenarioRunner.ts
│   │   ├── scenarios/
│   │   │   ├── BudgetScenario.ts              # Simulation budget reallocation
│   │   │   ├── PricingScenario.ts             # Simulation pricing changes
│   │   │   ├── InventoryScenario.ts           # Simulation stock levels
│   │   │   └── CampaignScenario.ts            # Simulation ROI campaigns
│   │   ├── predictors/
│   │   │   ├── KpiPredictor.ts                # ML simple (TensorFlow.js)
│   │   │   └── TrendAnalyzer.ts
│   │   └── validators/
│   │       ├── ScenarioValidator.ts
│   │       └── ResultValidator.ts
│   ├── package.json
│   └── tsconfig.json
│
└── ai-cos-coordination/            # NEW - Orchestration inter-agents
    ├── src/
    │   ├── orchestrator/
    │   │   ├── CeoOrchestrator.ts             # IA-CEO v2 coordination engine
    │   │   ├── EventCoordinator.ts
    │   │   └── ActionPrioritizer.ts
    │   ├── events/
    │   │   ├── RedisEventBus.ts               # Redis pub/sub
    │   │   ├── LocalEventEmitter.ts           # NestJS EventEmitter
    │   │   └── EventTypes.ts
    │   └── state/
    │       ├── OperationModeStateMachine.ts   # safe/assisted/auto-drive/forecast
    │       └── AgentStateManager.ts
    ├── package.json
    └── tsconfig.json
```

### Supabase Database Schema

#### Tables Principales

```sql
-- ============================================
-- TABLE: ai_cos_snapshots (ENRICHED)
-- Description: Snapshots KPIs 40 total (15 existing + 25 new)
-- ============================================

CREATE TABLE ai_cos_snapshots (
  -- Meta
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode TEXT NOT NULL DEFAULT 'assisted',
  
  -- ============================================
  -- KPIs TECH (6 - EXISTING)
  -- ============================================
  code_health NUMERIC,                      -- /100 - Maintenabilité code
  backend_p95_ms NUMERIC,                   -- ms - Temps réponse API p95
  frontend_p95_ms NUMERIC,                  -- ms - Chargement pages p95
  test_coverage NUMERIC,                    -- % - Coverage tests
  tech_debt_score NUMERIC,                  -- /100 - Dette technique
  security_score NUMERIC,                   -- /100 - Sécurité (0 vulns HIGH/CRITICAL)
  
  -- ============================================
  -- KPIs BUSINESS (5 - EXISTING)
  -- ============================================
  conversion_rate NUMERIC,                  -- % - Visiteurs → Acheteurs
  cart_abandonment NUMERIC,                 -- % - Abandon panier
  average_order_value NUMERIC,              -- € - Panier moyen
  stock_rupture NUMERIC,                    -- % - Rupture stock
  roi_campaigns NUMERIC,                    -- % - ROI marketing
  
  -- ============================================
  -- KPIs UX (3 - EXISTING)
  -- ============================================
  ux_score NUMERIC,                         -- /100 - Score UX global
  seo_score NUMERIC,                        -- /100 - Lighthouse, Core Web Vitals
  accessibility_score NUMERIC,              -- /100 - WCAG AA
  
  -- ============================================
  -- KPIs EXPANSION (1 - EXISTING)
  -- ============================================
  esg_score NUMERIC,                        -- /100 - ESG global
  
  -- ============================================
  -- KPIs MARKETING (5 - NEW)
  -- ============================================
  cac NUMERIC,                              -- € - Customer Acquisition Cost
  ltv NUMERIC,                              -- € - Lifetime Value
  email_open_rate NUMERIC,                  -- % - Performance email campaigns
  social_engagement NUMERIC,                -- /100 - ROI social media
  content_velocity NUMERIC,                 -- articles/semaine - Production contenu
  
  -- ============================================
  -- KPIs FINANCE (6 - NEW)
  -- ============================================
  burn_rate NUMERIC,                        -- €/mois - Consumption cash mensuelle
  runway NUMERIC,                           -- mois - Mois avant cash-out
  gross_margin NUMERIC,                     -- % - Marge brute
  payment_delay NUMERIC,                    -- jours - Délai moyen paiement clients
  invoice_accuracy NUMERIC,                 -- % - Factures sans erreur
  budget_variance NUMERIC,                  -- % - Écart budget vs réel
  
  -- ============================================
  -- KPIs LOGISTICS (5 - NEW)
  -- ============================================
  fulfillment_time NUMERIC,                 -- heures - Order → ship
  shipping_accuracy NUMERIC,                -- % - Livraisons correctes
  inventory_turnover NUMERIC,               -- fois/an - Rotation stock
  warehouse_capacity NUMERIC,               -- % - Utilisation espace
  return_rate NUMERIC,                      -- % - Retours produits
  
  -- ============================================
  -- KPIs PRODUCT (4 - NEW)
  -- ============================================
  catalog_coverage NUMERIC,                 -- % - Produits actifs utilisés
  time_to_market NUMERIC,                   -- jours - Feature → prod
  feature_adoption NUMERIC,                 -- % - Users using new features
  product_quality NUMERIC,                  -- defects/100 - Défauts/plaintes
  
  -- ============================================
  -- KPIs SUPPORT (3 - NEW)
  -- ============================================
  response_time NUMERIC,                    -- minutes - Premier temps réponse
  resolution_rate NUMERIC,                  -- % - Tickets résolus
  csat NUMERIC,                             -- /5 - Customer satisfaction
  
  -- ============================================
  -- KPIs OPERATIONS (2 - NEW)
  -- ============================================
  time_to_hire NUMERIC,                     -- jours - Durée recrutement
  employee_retention NUMERIC,               -- % - Turnover (100 - churn%)
  
  -- ============================================
  -- SCORES GLOBAUX (REQUIRED)
  -- ============================================
  global_health NUMERIC NOT NULL,           -- /100 - Score santé globale
  confidence NUMERIC DEFAULT 0,             -- /100 - Confiance snapshot
  risk NUMERIC DEFAULT 0                    -- /100 - Risque global
);

-- Indexes performance
CREATE INDEX idx_ai_cos_snapshots_created_at 
  ON ai_cos_snapshots(created_at DESC);
CREATE INDEX idx_ai_cos_snapshots_mode 
  ON ai_cos_snapshots(mode);

-- Comments (sampling - add all 40)
COMMENT ON COLUMN ai_cos_snapshots.cac 
  IS 'Customer Acquisition Cost en € (cible: 38€) - CRITICAL';
COMMENT ON COLUMN ai_cos_snapshots.ltv 
  IS 'Lifetime Value client en € (cible: 180€) - CRITICAL';
COMMENT ON COLUMN ai_cos_snapshots.burn_rate 
  IS 'Consumption mensuelle cash en €/mois (cible: 50000€) - CRITICAL';
COMMENT ON COLUMN ai_cos_snapshots.fulfillment_time 
  IS 'Temps Order → ship en heures (cible: 24h) - CRITICAL';
COMMENT ON COLUMN ai_cos_snapshots.response_time 
  IS 'Premier temps réponse support en minutes (cible: 120min) - CRITICAL';

-- ============================================
-- TABLE: ai_cos_simulations (NEW)
-- Description: Simulations what-if scenarios
-- ============================================

CREATE TABLE ai_cos_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Scenario
  scenario_name TEXT NOT NULL,
  scenario_type TEXT NOT NULL,              -- 'budget' | 'pricing' | 'inventory' | 'campaign'
  
  -- Input params (JSONB flexible)
  input_params JSONB NOT NULL,              -- Ex: {"budget_cut_percent": 20, "target_domain": "marketing"}
  
  -- Résultats simulation
  predicted_kpis JSONB NOT NULL,            -- Ex: {"cac": 45, "revenue": 92000, "margin": 38}
  impact_analysis JSONB NOT NULL,           -- Ex: {"revenue_change": -8, "margin_change": 2}
  
  -- Metadata
  executed_by TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0,
  notes TEXT
);

CREATE INDEX idx_ai_cos_simulations_scenario_type 
  ON ai_cos_simulations(scenario_type, created_at DESC);

-- ============================================
-- TABLE: ai_cos_coordination_events (NEW)
-- Description: Coordination inter-agents events
-- ============================================

CREATE TABLE ai_cos_coordination_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Event
  event_type TEXT NOT NULL,                 -- 'STOCK_ALERT' | 'COST_ANOMALY' | 'PERFORMANCE_DEGRADATION'
  source_agent_id TEXT NOT NULL,
  target_agent_ids TEXT[] NOT NULL,
  
  -- Event data
  event_data JSONB NOT NULL,                -- Ex: {"product_id": "123", "stock_level": 5, "threshold": 10}
  coordination_plan JSONB,                  -- Ex: [{"agent": "ia-logistics", "action": "alert"}, ...]
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'coordinating' | 'completed' | 'failed'
  completed_at TIMESTAMPTZ,
  
  -- Results
  actions_triggered INT DEFAULT 0,
  success_rate NUMERIC DEFAULT 0
);

CREATE INDEX idx_ai_cos_coordination_events_status 
  ON ai_cos_coordination_events(status, created_at DESC);
CREATE INDEX idx_ai_cos_coordination_events_event_type 
  ON ai_cos_coordination_events(event_type);

-- ============================================
-- TABLE: ai_cos_actions (EXISTING - NO CHANGE)
-- Description: Actions proposées par agents
-- ============================================

-- Keep existing table structure (no changes needed)
```

#### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE ai_cos_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_coordination_events ENABLE ROW LEVEL SECURITY;

-- Policies: Admin/System only
CREATE POLICY "Admin access ai_cos_snapshots" ON ai_cos_snapshots
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Admin access ai_cos_simulations" ON ai_cos_simulations
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Admin access ai_cos_coordination_events" ON ai_cos_coordination_events
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'service_role'
  );
```

### NestJS Backend Architecture

#### Module Structure

```
backend/src/
├── modules/
│   ├── ai-cos/                             # EXISTING + ENRICHED
│   │   ├── ai-cos.module.ts
│   │   ├── ai-cos.controller.ts            # API endpoints
│   │   ├── ai-cos.service.ts               # Orchestration service
│   │   ├── agents/                         # NEW - Agent services
│   │   │   ├── strategic/
│   │   │   │   ├── ceo-orchestrator.service.ts      # IA-CEO v2
│   │   │   │   └── cfo-intelligence.service.ts      # IA-CFO v2
│   │   │   ├── tech/
│   │   │   │   ├── platform-engineer.service.ts     # NEW
│   │   │   │   └── qa-engineer.service.ts           # NEW
│   │   │   ├── business/
│   │   │   │   ├── cmo-marketing.service.ts         # NEW
│   │   │   │   ├── product-manager.service.ts       # NEW
│   │   │   │   ├── logistics-manager.service.ts     # NEW
│   │   │   │   ├── supply-chain.service.ts          # NEW
│   │   │   │   ├── support-manager.service.ts       # NEW (wrapper)
│   │   │   │   └── content-strategist.service.ts    # NEW
│   │   │   └── expansion/
│   │   │       ├── hr-talent.service.ts             # NEW
│   │   │       └── legal-compliance.service.ts      # NEW
│   │   ├── coordination/                   # NEW - Coordination logic
│   │   │   ├── event-bus.service.ts        # Redis pub/sub
│   │   │   ├── orchestrator.service.ts     # IA-CEO v2 coordination
│   │   │   └── state-machine.service.ts    # Modes operation
│   │   ├── simulation/                     # NEW - What-if engine
│   │   │   ├── simulation-engine.service.ts
│   │   │   ├── scenario-runner.service.ts
│   │   │   └── kpi-predictor.service.ts
│   │   └── kpis/
│   │       ├── kpi-calculator.service.ts   # ENRICHED - 40 KPIs
│   │       └── snapshot-generator.service.ts
│   │   
│   ├── database/
│   │   └── services/
│   │       ├── ai-cos-data.service.ts      # ENRICHED - 40 KPIs
│   │       ├── simulation-data.service.ts  # NEW
│   │       └── coordination-data.service.ts # NEW
│   │
│   └── support/                            # EXISTING - Integration
│       ├── ai-support.module.ts
│       ├── smart-response.service.ts       # EXISTING (integrate)
│       ├── escalation-prediction.service.ts # EXISTING (integrate)
│       └── workflow-optimization.service.ts # EXISTING (integrate)
```

#### Pattern: BaseAgentService

```typescript
// backend/src/modules/ai-cos/agents/base-agent.service.ts

import { Injectable } from '@nestjs/common';
import { AgentReport, AgentAction, Kpi } from '@repo/ai-cos-core';

@Injectable()
export abstract class BaseAgentService {
  abstract agentId: string;
  abstract domain: string;
  abstract kpiIds: string[];

  /**
   * Analyse données et génère rapport
   */
  abstract analyze(): Promise<AgentReport>;

  /**
   * Génère actions recommandées
   */
  abstract generateActions(report: AgentReport): Promise<AgentAction[]>;

  /**
   * Calcule KPIs de l'agent
   */
  abstract computeKpis(): Promise<Record<string, number>>;

  /**
   * Valide santé agent
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.computeKpis();
      return true;
    } catch {
      return false;
    }
  }
}
```

#### Example: IA-CMO Service

```typescript
// backend/src/modules/ai-cos/agents/business/cmo-marketing.service.ts

import { Injectable } from '@nestjs/common';
import { BaseAgentService } from '../base-agent.service';
import { AgentReport, AgentAction } from '@repo/ai-cos-core';
import { SupabaseService } from '@/database/supabase.service';

@Injectable()
export class CmoMarketingService extends BaseAgentService {
  agentId = 'ia-cmo';
  domain = 'business';
  kpiIds = ['cac', 'ltv', 'email-open-rate', 'social-engagement', 'content-velocity'];

  constructor(private supabase: SupabaseService) {
    super();
  }

  async analyze(): Promise<AgentReport> {
    // Calculer KPIs marketing
    const kpis = await this.computeKpis();
    
    // Détecter anomalies
    const findings = [];
    if (kpis.cac > 38) {
      findings.push({
        type: 'kpi_red',
        kpiId: 'cac',
        message: `CAC à ${kpis.cac}€, cible 38€ (+${((kpis.cac - 38) / 38 * 100).toFixed(0)}%)`,
        severity: 'high'
      });
    }
    
    return {
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
      kpis,
      findings,
      recommendations: await this.generateActions({ kpis, findings })
    };
  }

  async generateActions(report: AgentReport): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    
    // Si CAC élevé, proposer optimisation
    const cacFinding = report.findings.find(f => f.kpiId === 'cac');
    if (cacFinding) {
      actions.push({
        agentId: this.agentId,
        type: 'recommendation',
        priority: 'high',
        title: 'Optimiser CAC via targeting IA',
        description: 'Améliorer ciblage campagnes paid ads pour réduire CAC',
        kpiIds: ['cac'],
        expectedImprovement: { cac: -15 }, // -15% attendu
        risk: 25,
        confidence: 88,
        requiresValidation: true
      });
    }
    
    return actions;
  }

  async computeKpis(): Promise<Record<string, number>> {
    // Calcul CAC
    const { data: orders } = await this.supabase.client
      .from('orders')
      .select('created_at, total')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    const { data: campaigns } = await this.supabase.client
      .from('marketing_campaigns')
      .select('cost')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    const totalCost = campaigns?.reduce((sum, c) => sum + c.cost, 0) || 0;
    const newCustomers = new Set(orders?.map(o => o.user_id)).size || 1;
    const cac = totalCost / newCustomers;
    
    // Calcul LTV (simplified)
    const avgOrderValue = orders?.reduce((sum, o) => sum + o.total, 0) / orders?.length || 0;
    const ltv = avgOrderValue * 1.8; // Estimation 1.8 orders lifetime
    
    return {
      cac,
      ltv,
      emailOpenRate: 0, // TODO: Implement
      socialEngagement: 0, // TODO: Implement
      contentVelocity: 0 // TODO: Implement
    };
  }
}
```

### Redis Coordination Architecture

```typescript
// backend/src/modules/ai-cos/coordination/event-bus.service.ts

import { Injectable } from '@nestjs/common';
import { RedisService } from '@/cache/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CoordinationEvent {
  type: 'STOCK_ALERT' | 'COST_ANOMALY' | 'PERFORMANCE_DEGRADATION' | 'CAMPAIGN_OPPORTUNITY';
  sourceAgentId: string;
  data: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class EventBusService {
  private readonly CHANNEL = 'ai-cos:orchestration';

  constructor(
    private redis: RedisService,
    private eventEmitter: EventEmitter2
  ) {
    this.subscribeToEvents();
  }

  /**
   * Publier événement coordination
   */
  async publish(event: CoordinationEvent): Promise<void> {
    await this.redis.client.publish(this.CHANNEL, JSON.stringify(event));
    this.eventEmitter.emit(`ai-cos:${event.type}`, event);
  }

  /**
   * Écouter événements Redis
   */
  private async subscribeToEvents(): Promise<void> {
    const subscriber = this.redis.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(this.CHANNEL, (message) => {
      const event: CoordinationEvent = JSON.parse(message);
      this.handleCoordinationEvent(event);
    });
  }

  /**
   * Gérer événement coordination
   */
  private handleCoordinationEvent(event: CoordinationEvent): void {
    // Émettre événement local pour orchestrator
    this.eventEmitter.emit('ai-cos:coordination', event);
  }
}
```

### Intégration Agents Python Existants

#### Bridge Python → TypeScript KPIs

```typescript
// backend/src/modules/ai-cos/kpis/python-bridge.service.ts

import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class PythonBridgeService {
  private readonly PYTHON_PATH = 'ai-agents-python';

  /**
   * Exécuter agents Python et extraire KPIs
   */
  async computeTechKpis(): Promise<Record<string, number>> {
    // Exécuter agents Python
    const { stdout } = await execAsync(
      `cd ${this.PYTHON_PATH} && python run.py --analyze-only --output json`
    );
    
    const report = JSON.parse(stdout);
    
    // Mapper résultats Python → KPIs AI-COS
    return {
      codeHealth: this.calculateCodeHealth(report),
      techDebt: this.calculateTechDebt(report),
      securityScore: this.calculateSecurityScore(report)
    };
  }

  private calculateCodeHealth(report: any): number {
    const { complexity, duplication, deadCode } = report;
    
    // Formule: 100 - pénalités
    let score = 100;
    score -= complexity.high_complexity_files * 2;
    score -= duplication.duplicated_blocks * 0.5;
    score -= deadCode.unused_files * 0.3;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateTechDebt(report: any): number {
    const { complexity, duplication, massiveFiles } = report;
    
    // Score dette: 0 (max dette) → 100 (zero dette)
    const debtFactors = [
      massiveFiles.count / 10,
      duplication.duplicated_blocks / 50,
      complexity.total_violations / 100
    ];
    
    const totalDebt = debtFactors.reduce((sum, f) => sum + f, 0);
    return Math.max(0, 100 - totalDebt * 10);
  }

  private calculateSecurityScore(report: any): number {
    const { security } = report;
    
    // 0 vulns HIGH/CRITICAL = 100
    // 1+ vulns = score réduit
    if (security.high + security.critical === 0) return 100;
    
    const penalty = security.critical * 20 + security.high * 10;
    return Math.max(0, 100 - penalty);
  }
}
```

### Dashboard Remix Routes

```
frontend/app/
├── routes/
│   └── admin.ai-cos/
│       ├── _layout.tsx                     # Layout admin AI-COS
│       ├── index.tsx                       # Dashboard principal (40 KPIs)
│       ├── health.tsx                      # Health Board global
│       ├── agents/
│       │   ├── index.tsx                   # Liste 26 agents
│       │   └── $agentId.tsx                # Détail agent
│       ├── squads/
│       │   ├── index.tsx                   # Liste 6 squads
│       │   └── $squadId.tsx                # Détail squad
│       ├── actions/
│       │   ├── index.tsx                   # Actions pending/approved/rejected
│       │   └── $actionId.tsx               # Validation action
│       ├── simulation/                     # NEW - What-if scenarios
│       │   ├── index.tsx                   # Liste simulations
│       │   ├── new.tsx                     # Créer simulation
│       │   └── $simulationId.tsx           # Résultats simulation
│       ├── coordination/                   # NEW - Coordination events
│       │   ├── index.tsx                   # Events en cours
│       │   └── $eventId.tsx                # Détail coordination
│       └── kpis/
│           ├── index.tsx                   # Liste 40 KPIs
│           └── $kpiId.tsx                  # Détail KPI + trend
```

### CI/CD Pipeline

```yaml
# .github/workflows/ai-cos-snapshot.yml (ENRICHED)

name: AI-COS Health Snapshot Enhanced
on:
  schedule:
    - cron: "0 3 * * *"                    # 3h quotidien
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      # Agents Python (tech KPIs)
      - name: Run Python Analysis Agents
        run: |
          cd ai-agents-python
          pip install -r requirements.txt
          python run.py --analyze-only --output json > ../analysis-report.json
      
      # Calculer 40 KPIs + créer snapshot
      - name: Compute AI-COS KPIs (40 total)
        run: |
          npm ci
          npm run ai-cos:snapshot -- --source analysis-report.json
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
      
      # Coordination IA-CEO v2
      - name: Run IA-CEO v2 Orchestration
        run: npm run ai-cos:orchestrate
      
      # Notifications si KPIs critiques rouges
      - name: Notify Critical KPIs
        if: steps.snapshot.outputs.critical_red > 0
        run: npm run ai-cos:notify -- --channel slack
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Tests Strategy

### Unit Tests

```typescript
// packages/ai-cos-kpis/src/marketing/cac.test.ts

describe('CAC Calculator', () => {
  it('should compute CAC correctly', () => {
    const cac = computeCac({
      totalCost: 5000,
      newCustomers: 132
    });
    
    expect(cac).toBe(37.88);
  });
  
  it('should handle zero customers', () => {
    const cac = computeCac({
      totalCost: 5000,
      newCustomers: 0
    });
    
    expect(cac).toBe(0);
  });
});
```

### Integration Tests

```typescript
// backend/src/modules/ai-cos/agents/business/cmo-marketing.service.spec.ts

describe('CmoMarketingService', () => {
  let service: CmoMarketingService;
  let supabase: SupabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CmoMarketingService, SupabaseService]
    }).compile();
    
    service = module.get(CmoMarketingService);
    supabase = module.get(SupabaseService);
  });

  it('should generate high priority action when CAC > target', async () => {
    jest.spyOn(service, 'computeKpis').mockResolvedValue({
      cac: 45, // Above target 38
      ltv: 180
    });
    
    const report = await service.analyze();
    const actions = await service.generateActions(report);
    
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].priority).toBe('high');
    expect(actions[0].kpiIds).toContain('cac');
  });
});
```

### E2E Tests

```typescript
// backend/test/e2e/ai-cos-coordination.e2e-spec.ts

describe('AI-COS Coordination (e2e)', () => {
  it('should coordinate multi-agent response to stock alert', async () => {
    // Simuler rupture stock
    await request(app.getHttpServer())
      .post('/api/ai-cos/events/simulate')
      .send({
        type: 'STOCK_ALERT',
        sourceAgentId: 'stock-forecaster',
        data: { productId: '123', stockLevel: 3 }
      });
    
    // Attendre coordination (max 5s)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Vérifier coordination events
    const { body } = await request(app.getHttpServer())
      .get('/api/ai-cos/coordination/events')
      .query({ type: 'STOCK_ALERT', status: 'completed' });
    
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].actionTriggered).toBeGreaterThanOrEqual(3); // logistics, supply-chain, cmo
  });
});
```

## Deployment Checklist

### Phase 1 - CRITICAL (Weeks 1-4)

- [ ] Package `@repo/ai-cos-core` enrichi (26 agents, 40 KPIs)
- [ ] Package `@repo/ai-cos-coordination` créé
- [ ] Migration Supabase 25 colonnes KPIs
- [ ] IA-CEO v2 orchestration service
- [ ] IA-CFO service (6 KPIs finance)
- [ ] IA-CMO service (5 KPIs marketing)
- [ ] Dashboard Remix health 40 KPIs
- [ ] Tests E2E coordination (1 scénario)
- [ ] Deploy staging validation

### Phase 2 - HIGH (Weeks 5-8)

- [ ] IA-Logistics service (5 KPIs)
- [ ] IA-Product Manager service (4 KPIs)
- [ ] IA-Supply Chain service (3 KPIs)
- [ ] Operations Excellence Squad setup
- [ ] Tests coordination 3 agents
- [ ] Deploy staging validation

### Phase 3 - MEDIUM (Weeks 9-12)

- [ ] IA-Support Manager wrapper (3 KPIs)
- [ ] IA-Docker Optimizer service (4 KPIs)
  - [ ] Dockerfile optimization (remote cache, multi-stage improvements)
  - [ ] GitHub Actions workflow (registry cache)
  - [ ] docker-compose.prod.yml healthchecks
  - [ ] Caddy configuration optimization (gzip, caching)
  - [ ] Build metrics monitoring (Grafana dashboard)
- [ ] IA-Content Strategist service (3 KPIs)
- [ ] Business Growth Squad enrichi
- [ ] Deploy staging validation

### Phase 4 - EXPANSION (Weeks 13-16)

- [ ] IA-HR service (2 KPIs)
- [ ] IA-Legal service (3 KPIs)
- [ ] IA-QA Engineer service (3 KPIs)
- [ ] Deploy staging validation

### Phase 5 - ADVANCED (Weeks 17-20)

- [ ] Package `@repo/ai-cos-simulation`
- [ ] Simulation Engine implementation
- [ ] Auto-Learning feedback loop
- [ ] KPI predictors (TensorFlow.js)
- [ ] Dashboard simulation UI
- [ ] Tests E2E simulations
- [ ] Deploy production

## Related Documents

- [ADR-006: AI-COS Enrichment](../architecture/006-ai-cos-enrichment.md)
- [AI-COS Operating System](../features/ai-cos-operating-system.md)
- [AI-COS Enrichment Roadmap](../roadmaps/ai-cos-enrichment-roadmap.md)

## Change Log

- 2025-11-18 : Version initiale (draft) - Guide technique complet
- 2025-11-18 : Version 1.1.0 - Organisation packages par 4 pôles métier, squads comme meta-agents
