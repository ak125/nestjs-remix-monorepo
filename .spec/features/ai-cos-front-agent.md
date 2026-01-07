---
title: "AI-COS Front-Agent - Agent Pilotage Global"
status: active
version: 1.0.0
authors: [Product Team, UX Team]
created: 2026-01-01
updated: 2026-01-01
relates-to:
  - ./ai-cos-operating-system.md
  - ./ai-cos-products.md
  - ../workflows/ai-cos-index.md
tags: [front-agent, ux, interface, pilotage, orchestration, critical]
priority: critical
---

# AI-COS Front-Agent

## Overview

Le **Front-Agent** est l'interface intelligente entre l'humain et l'AI-COS. Il traduit les demandes floues en intentions métier, active les bons Produits IA, et restitue des résultats actionnables.

> **Ce qu'il est** : La façade UX de l'AI-COS
> **Ce qu'il n'est PAS** : Un décideur autonome

## Distinction avec IA-CEO

> **GOUVERNANCE** : Voir [AI-COS Governance Rules](./ai-cos-governance-rules.md)
> Ni le Front-Agent ni l'IA-CEO ne sont souverains. **L'HUMAIN décide toujours.**

```
┌─────────────────────────────────────────────────────────────┐
│                     AI-COS Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  👤 HUMAIN (SOUVERAIN)                                       │
│      │                                                       │
│      ▼                                                       │
│  🧠 FRONT-AGENT ◄─────────────────────────► IA-CEO          │
│  (Interface UX)                        (Synthèse interne)    │
│                                                              │
│  - Traduit demandes floues              - Consolide KPIs     │
│  - Restitue diagnostics                 - Prépare arbitrages │
│  - Collecte décision humaine            - Coordonne agents   │
│                                                              │
│  ❌ NE DÉCIDE PAS                        ❌ NE DÉCIDE PAS    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| Aspect | Front-Agent | IA-CEO | HUMAIN |
|--------|-------------|--------|--------|
| **Rôle** | Interface UX | Synthèse stratégique | **SOUVERAIN** |
| **Communication** | Human-to-Machine | Machine-to-Machine | Décision finale |
| **Visibilité** | Dashboard exposé | Backend invisible | Partout |
| **Décision** | ❌ Propose | ❌ Propose | ✅ **Décide** |
| **Langage** | Naturel (français) | Structuré (JSON) | Validation |

## Workflow Complet

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONT-AGENT WORKFLOW                           │
└──────────────────────────────────────────────────────────────────────┘

     ENTRÉE                    TRAITEMENT                    SORTIE
  ┌──────────┐              ┌──────────────┐              ┌──────────┐
  │ Demande  │              │   🧠 FRONT   │              │ Résultat │
  │  floue   │─────────────▶│    AGENT     │─────────────▶│actionable│
  └──────────┘              └──────┬───────┘              └──────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
   │ 1. Comprend │         │ 2. Identifie│         │ 3. Active   │
   │  l'intention│         │  le Produit │         │  les Squads │
   │    métier   │         │     IA      │         │             │
   └─────────────┘         └─────────────┘         └─────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
                           ┌─────────────┐
                           │ 4. Restitue │
                           │  - Diagnostic│
                           │  - Actions   │
                           │  - Risques   │
                           │  - Décision  │
                           └─────────────┘
                                   │
                                   ▼
                           ┌─────────────┐
                           │  HUMAIN     │
                           │  valide ou  │
                           │  ajuste     │
                           └─────────────┘
```

## Capacités du Front-Agent

### 1. Compréhension d'Intention

```yaml
Input_types:
  - question: "Pourquoi le trafic a baissé ?"
  - commande: "Analyse le SEO de la page X"
  - alerte: "Il y a un problème avec les commandes"
  - exploration: "Qu'est-ce qui ne va pas ?"

Processing:
  - NLP: Extraction entités (pages, dates, métriques)
  - Context: Historique conversation + état système
  - Clarification: Questions si ambiguïté > 30%

Output:
  intention:
    type: diagnostic_seo
    scope: site_entier | page_specifique
    urgence: haute | moyenne | basse
    confiance: 85%
```

### 2. Mapping vers Produits IA

```yaml
Règles_de_mapping:

  "trafic baisse" → Diagnostic SEO Migration
  "conversion chute" → Analyse Tunnel Conversion
  "stock rupture" → Prévision Rupture Stock
  "client parti" → Détection Churn Client
  "site lent" → Analyse Performance Critique
  "sécurité" → Audit Sécurité Express
  "prix concurrent" → Veille Tarifaire Concurrence
```

### 3. Activation des Squads

```yaml
Orchestration:

  1. Sélection Produit IA
  2. Identification agents requis
  3. Envoi requête à IA-CEO
  4. IA-CEO coordonne les Squads
  5. Collecte résultats
  6. Agrégation pour restitution
```

### 4. Restitution Intelligente

```yaml
Format_restitution:

  diagnostic:
    summary: "Baisse trafic -23% due à 3 causes identifiées"
    details:
      - cause: "404 sur 45 pages"
        impact: -12%
        confiance: 95%
      - cause: "Contenu dupliqué"
        impact: -8%
        confiance: 85%
      - cause: "Lenteur mobile"
        impact: -3%
        confiance: 70%

  actions_proposées:
    - titre: "Corriger les 404"
      priorité: P0
      effort: 2h
      impact: +12% trafic
      agents: [SEO Sentinel, IA-DevOps]

    - titre: "Dédupliquer contenu"
      priorité: P1
      effort: 4h
      impact: +8% trafic
      agents: [SEO Sentinel, Content Bot]

  risques:
    - "Si non traité sous 7j: perte estimée €15K"
    - "Risque de déclassement Google"

  décision_requise:
    type: validation_plan
    deadline: 24h
    options:
      - "Exécuter tout le plan"
      - "Exécuter P0 uniquement"
      - "Demander plus de détails"
```

## Interface Utilisateur

### Route Dashboard

```
/admin/ai-cos/assistant
```

### Composants UI

```typescript
// Interface principale
interface FrontAgentUI {
  // Zone de saisie
  inputArea: {
    type: 'chat' | 'voice' | 'quick-action';
    placeholder: "Décrivez votre problème ou question...";
    suggestions: string[]; // Basées sur l'état système
  };

  // Zone de résultat
  resultArea: {
    diagnostic: DiagnosticCard;
    actions: ActionList;
    risks: RiskBanner;
    decision: DecisionButtons;
  };

  // Historique
  history: ConversationThread[];

  // État système
  systemStatus: {
    health: number; // 0-100
    activeAlerts: Alert[];
    pendingDecisions: Decision[];
  };
}
```

### Maquette UI

```
┌─────────────────────────────────────────────────────────────────┐
│  🧠 AI-COS Assistant                          Health: 92/100 🟢 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 💬 Pourquoi le trafic a baissé cette semaine ?            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📊 DIAGNOSTIC                                              │  │
│  │                                                            │  │
│  │ Baisse trafic: -23% (vs semaine précédente)               │  │
│  │                                                            │  │
│  │ Causes identifiées:                                        │  │
│  │ ├── 🔴 404 sur 45 pages (-12%) ████████████ 95%           │  │
│  │ ├── 🟠 Contenu dupliqué (-8%) ████████░░ 85%              │  │
│  │ └── 🟡 Lenteur mobile (-3%) ███████░░░ 70%                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🎯 ACTIONS PROPOSÉES                                       │  │
│  │                                                            │  │
│  │ [P0] Corriger 404 (2h) → +12% trafic      [▶ Lancer]     │  │
│  │ [P1] Dédupliquer (4h) → +8% trafic        [▶ Lancer]     │  │
│  │ [P2] Optimiser mobile (8h) → +3% trafic   [▶ Lancer]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ⚠️ RISQUES                                                 │  │
│  │ Si non traité sous 7j: perte estimée €15K/mois            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │       [✅ Tout exécuter]  [🔧 P0 seulement]  [❓ Détails] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Specification

### Endpoints

```yaml
POST /api/ai-cos/assistant/query
  description: Soumettre une demande au Front-Agent
  body:
    message: string
    context?: object
  response:
    intent: Intent
    product: ProductIA
    status: 'processing' | 'ready'

GET /api/ai-cos/assistant/result/{queryId}
  description: Récupérer le résultat d'une requête
  response:
    diagnostic: Diagnostic
    actions: Action[]
    risks: Risk[]
    decision: DecisionRequest

POST /api/ai-cos/assistant/decision/{queryId}
  description: Soumettre une décision utilisateur
  body:
    decision: 'execute_all' | 'execute_p0' | 'details' | 'cancel'
    comments?: string
  response:
    status: 'accepted' | 'queued'
    executionId: string

GET /api/ai-cos/assistant/history
  description: Historique des conversations
  response:
    conversations: Conversation[]
```

### Types TypeScript

```typescript
interface Intent {
  type: string;
  scope: 'site' | 'page' | 'product' | 'customer';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  entities: Entity[];
}

interface ProductIA {
  id: string;
  name: string;
  agents: string[];
  estimatedTime: string;
  validationRequired: boolean;
}

interface Diagnostic {
  summary: string;
  causes: Cause[];
  totalImpact: string;
  confidence: number;
}

interface Cause {
  description: string;
  impact: string;
  confidence: number;
  evidence: Evidence[];
}

interface Action {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: string;
  expectedImpact: string;
  agents: string[];
  status: 'proposed' | 'approved' | 'executing' | 'completed';
}

interface Risk {
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  deadline?: string;
  financialImpact?: string;
}

interface DecisionRequest {
  type: 'validation' | 'choice' | 'confirmation';
  deadline: string;
  options: DecisionOption[];
}
```

## NestJS Implementation

### Module Structure

```
backend/src/modules/ai-cos/
├── front-agent/
│   ├── front-agent.module.ts
│   ├── front-agent.controller.ts
│   ├── front-agent.service.ts
│   ├── intent-parser.service.ts
│   ├── product-mapper.service.ts
│   ├── result-aggregator.service.ts
│   └── dto/
│       ├── query.dto.ts
│       ├── result.dto.ts
│       └── decision.dto.ts
```

### Service Principal

```typescript
// front-agent.service.ts

@Injectable()
export class FrontAgentService {
  constructor(
    private intentParser: IntentParserService,
    private productMapper: ProductMapperService,
    private ceoOrchestrator: CeoOrchestratorService,
    private resultAggregator: ResultAggregatorService,
  ) {}

  async processQuery(message: string, context?: QueryContext): Promise<QueryResult> {
    // 1. Parser l'intention
    const intent = await this.intentParser.parse(message, context);

    // 2. Mapper vers Produit IA
    const product = await this.productMapper.findBestMatch(intent);

    // 3. Déléguer à IA-CEO pour orchestration
    const executionId = await this.ceoOrchestrator.execute(product, intent);

    // 4. Attendre et agréger les résultats
    const result = await this.resultAggregator.aggregate(executionId);

    return {
      queryId: executionId,
      intent,
      product,
      diagnostic: result.diagnostic,
      actions: result.actions,
      risks: result.risks,
      decision: result.decisionRequest,
    };
  }

  async submitDecision(queryId: string, decision: DecisionDto): Promise<ExecutionStatus> {
    // Valider et transmettre la décision
    return this.ceoOrchestrator.executeDecision(queryId, decision);
  }
}
```

## KPIs du Front-Agent

| KPI | Cible | Description |
|-----|-------|-------------|
| `intent-accuracy` | > 90% | Précision de compréhension d'intention |
| `response-time` | < 30s | Temps avant première réponse |
| `full-diagnostic-time` | < 5min | Temps pour diagnostic complet |
| `user-satisfaction` | > 4/5 | Note utilisateur sur les réponses |
| `decision-rate` | > 80% | % de diagnostics menant à une décision |
| `action-success-rate` | > 95% | % d'actions exécutées avec succès |

## Évolutions Futures

### Phase 1 (MVP)
- Interface chat textuelle
- 5 Produits IA principaux
- Validation manuelle obligatoire

### Phase 2
- Suggestions proactives (basées sur alertes)
- Voice input
- 15 Produits IA

### Phase 3
- Mode auto pour actions à faible risque
- Apprentissage des préférences utilisateur
- Intégration Slack/Teams

## Related Documents

- [AI-COS Products](./ai-cos-products.md) - Catalogue des Produits IA
- [AI-COS Operating System](./ai-cos-operating-system.md) - Système global
- [AI-COS Index](../workflows/ai-cos-index.md) - Navigation
