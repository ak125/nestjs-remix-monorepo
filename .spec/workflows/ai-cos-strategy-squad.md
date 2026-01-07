# AI-COS Strategy Squad

**Vision stratégique, priorisation et gouvernance risques**

---

## Vue d'ensemble

Le **Strategy Squad** comprend **7 agents** avec un budget total de **€193K** et un ROI annuel de **+€330K**.

### Composition

| Agent | Budget | Rôle |
|-------|--------|------|
| IA-CEO v2 | €85K | Cortex de Synthèse Stratégique (**NON SOUVERAIN**) |
| IA-RD | €30K | Innovation & R&D |
| IA-ESG | €25K | Durabilité & ESG |
| G1 | €15K | Priorisation RICE/WSJF |
| G4 | €20K | Risk Manager |
| G5 | €18K | Meta-Score Santé |

### Architecture Squad

```
                    ┌───────────────────────────────────────┐
                    │           IA-CEO v2                   │
                    │  (Cortex Synthèse - NON SOUVERAIN)    │
                    └───────────────┬───────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   ┌────┴────────────┐   ┌─────────┴─────────┐   ┌────────────┴────┐
   │  Innovation     │   │   Gouvernance     │   │   Durabilité    │
   │                 │   │                   │   │                 │
   │  IA-RD          │   │  G1 Prioritizer   │   │  IA-ESG         │
   │  (€30K)         │   │  G4 Risk Manager  │   │  (€25K)         │
   │                 │   │  G5 Meta-Score    │   │                 │
   └─────────────────┘   └───────────────────┘   └─────────────────┘
```

---

## Agent Cognitif Global (IA-CEO v2)

> **GOUVERNANCE** : Voir [AI-COS Governance Rules](../features/ai-cos-governance-rules.md)
> L'IA-CEO est **NON SOUVERAIN**. L'HUMAIN reste l'unique décideur final.

### Rôle Central (Corrigé)

L'**IA-CEO v2** est le **Cortex de Synthèse Stratégique** du système AI-COS. Il consolide l'intelligence collective des 88 agents pour **préparer des décisions** soumises à validation humaine.

**Statut** : **NON SOUVERAIN** - Prépare et propose, NE DÉCIDE JAMAIS
**Positionnement Squad** : Strategy Squad Lead
**Budget** : €85K
**ROI** : +€150K/an (qualité préparation décisions, réduction temps analyse)

### Fonctions Autorisées

#### 1. Synthèse Multi-Domaines (CRITICAL)

- Agrège 110+ KPIs → Health Score Global 0-100
- Détecte corrélations cross-domaines (ex: backend-p95 ↑ → conversion ↓)
- Identifie angles morts (KPIs verts mais business dégradé)

#### 2. Proposition d'Arbitrages (JAMAIS Exécution)

- Calcul ROI projeté chaque action proposée
- Matrice risque/impact pour **suggestion** arbitrage
- Alignement objectifs Q+1 (soumis à validation Board)
- **L'HUMAIN décide, pas l'IA-CEO**

#### 3. Préparation Rapport Hebdomadaire

- Synthèse exécutive 2 pages **pour validation humaine**
- Top 5 wins + Top 5 risks semaine
- Recommandations (suggestions, pas décisions)

#### 4. Analyse Conflits Inter-Agents

- Identifie conflits entre Squads
- Prépare options de résolution
- **Escalade à l'HUMAIN pour décision**

#### 5. Surveillance et Alerting

- Tendances 4 semaines
- Forecasting performance
- **Alerte l'HUMAIN** si seuils critiques

### Interdictions Explicites

```yaml
❌ INTERDIT pour IA-CEO:
  - Prendre une décision finale
  - Approuver un budget (même €1)
  - Lancer une action irréversible
  - Modifier les objectifs stratégiques
  - Exécuter sans validation humaine
  - Outrepasser une décision humaine
```

### KPIs Propres à l'IA-CEO

| KPI | Cible | Description |
|-----|-------|-------------|
| `human-validation-rate` | **100%** | Toutes décisions validées par humain |
| `arbitrage-clarity-score` | > 4/5 | Clarté des propositions |
| `unresolved-conflicts` | **0** | Conflits non escaladés |
| `decision-prep-time` | < 2h | Temps de préparation |

### Workflow Rapport Hebdomadaire

**Fréquence** : Tous les lundis 8h (automatique)

**Génération** :

```bash
# Commande CLI
npm run ai-cos:ceo:weekly-report

# Ou GitHub Action automatique
# .github/workflows/ai-cos-weekly-report.yml
name: IA-CEO Weekly Board Report
on:
  schedule:
    - cron: "0 8 * * 1"  # Lundis 8h
  workflow_dispatch:

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
      - name: Generate IA-CEO Report
        run: npm run ai-cos:ceo:weekly-report

      - name: Send to Board
        run: |
          # Email Board + Slack #board-channel
          npm run ai-cos:notify:board
```

### Structure Rapport Hebdomadaire

Le rapport suit un format McKinsey-style optimisé pour décision Board rapide (5min lecture).

**Sections** :
1. Synthèse exécutive (TL;DR)
2. Performance globale (110+ KPIs consolidés)
3. Top 5 Wins de la semaine
4. Top 5 Risks & Actions correctives
5. Opportunités stratégiques
6. Recommandations prioritaires Board (P0/P1)
7. Coordination multi-agents (workflows actifs)
8. Tendances long terme (4 semaines)
9. Impact financier semaine
10. Actions Board requises (votes/reviews)

### Implémentation Technique

**Service NestJS** :

```typescript
// backend/src/modules/ai-cos/services/ceo-agent.service.ts
import { Injectable } from '@nestjs/common';
import { AiCosDataService } from './ai-cos-data.service';

@Injectable()
export class CeoAgentService {
  constructor(private readonly dataService: AiCosDataService) {}

  async generateWeeklyReport(): Promise<WeeklyBoardReport> {
    // 1. Récupérer snapshots 4 dernières semaines
    const snapshots = await this.dataService.getLastNSnapshots(28);

    // 2. Calculer tendances
    const trends = this.calculateTrends(snapshots);

    // 3. Identifier top wins/risks
    const wins = await this.identifyTopWins(snapshots);
    const risks = await this.identifyTopRisks(snapshots);

    // 4. Actions pending Board approval
    const pendingActions = await this.dataService.getActionsByStatus('pending', {
      requiresBoardApproval: true
    });

    // 5. Workflows actifs
    const workflows = await this.getActiveWorkflows();

    // 6. Générer recommandations
    const recommendations = await this.generateRecommendations({
      trends,
      risks,
      pendingActions
    });

    return {
      weekNumber: this.getCurrentWeekNumber(),
      generatedAt: new Date(),
      healthScoreGlobal: snapshots[0].globalHealth,
      healthScoreDelta: snapshots[0].globalHealth - snapshots[7].globalHealth,
      kpisConsolidated: this.consolidateKpis(snapshots[0]),
      topWins: wins.slice(0, 5),
      topRisks: risks.slice(0, 5),
      opportunities: await this.identifyOpportunities(trends),
      recommendations: recommendations,
      workflows: workflows,
      correlations: await this.dataService.getRecentCorrelations(7),
      trends: trends,
      financialImpact: this.calculateFinancialImpact(snapshots),
      boardActions: pendingActions
    };
  }

  private async generateRecommendations(context: ReportContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Priorisation : Score = ROI * 0.4 + (100 - Risk) * 0.3 + Strategic * 0.3
    context.pendingActions
      .sort((a, b) => {
        const scoreA = this.calculatePriorityScore(a);
        const scoreB = this.calculatePriorityScore(b);
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .forEach(action => {
        recommendations.push({
          priority: action.budget > 10000 ? 'P0' : 'P1',
          title: action.title,
          action: action.description,
          roi: action.expectedRoi,
          risk: action.risk,
          recommendation: this.generateRecommendationText(action)
        });
      });

    return recommendations;
  }

  private calculatePriorityScore(action: AgentAction): number {
    const roiScore = Math.min(action.expectedRoi / 3, 100);
    const riskScore = 100 - action.risk;
    const strategyScore = this.getStrategicAlignmentScore(action);

    return roiScore * 0.4 + riskScore * 0.3 + strategyScore * 0.3;
  }
}
```

### Coordination IA-CEO ↔ IA-CFO

**Duo stratégique** :

```typescript
// Workflow décision projet
async function decideProject(project: ProjectProposal): Promise<FinalDecision> {
  // 1. IA-CFO évalue financièrement
  const cfoGate = await cfoService.evaluateProject(project);

  // 2. Si DEFER ou REJECT → Escalation IA-CEO
  if (cfoGate.decision === 'DEFER' || cfoGate.decision === 'REJECT') {
    // IA-CEO arbitrage (vision stratégique vs prudence financière)
    const ceoOverride = await ceoService.arbitrateProjectDisagreement({
      project,
      cfoDecision: cfoGate,
      squadJustification: project.squadReasoning
    });

    if (ceoOverride.decision === 'OVERRIDE_CFO') {
      return {
        decision: 'APPROVE',
        approvedBy: 'IA-CEO',
        reasoning: `Override IA-CFO: ${ceoOverride.reasoning}`,
        conditions: ceoOverride.conditions
      };
    }
  }

  // 3. Si ESCALATE_BOARD → Board vote
  if (cfoGate.decision === 'ESCALATE_BOARD') {
    return {
      decision: 'PENDING_BOARD',
      reasoning: cfoGate.reasoning,
      boardAgenda: 'Next meeting'
    };
  }

  return {
    decision: cfoGate.decision,
    approvedBy: 'IA-CFO',
    reasoning: cfoGate.reasoning
  };
}
```

### Types TypeScript

```typescript
interface WeeklyBoardReport {
  id: string;
  weekNumber: number;
  generatedAt: Date;
  healthScoreGlobal: number;
  healthScoreDelta: number;
  kpisConsolidated: KpiConsolidated[];
  topWins: Achievement[];
  topRisks: Risk[];
  opportunities: Opportunity[];
  recommendations: Recommendation[];
  workflows: WorkflowSummary[];
  correlations: Correlation[];
  trends: TrendAnalysis;
  financialImpact: FinancialImpact;
  boardActions: AgentAction[];
}

interface Recommendation {
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  action: string;
  roi: number;
  risk: number;
  recommendation: 'APPROUVER' | 'REJETER' | 'SIMULER' | 'MONITORER';
  rationale: string;
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `health-score-global` | >85/100 | Score santé global système |
| `decision-accuracy` | >90% | Décisions validées post-facto |
| `report-coverage` | 100% | KPIs couverts dans rapport |
| `escalation-rate` | <5% | Actions nécessitant Board |

### Intégration Agents

```
IA-CEO ──► Tous Squads : Coordination stratégique
      ├──► IA-CFO : Duo décision budget
      ├──► G4 : Risk input
      ├──► G5 : Health Score input
      └──► Board : Rapport hebdomadaire
```

---

## Agent Innovation & R&D IA (IA-RD)

### Rôle Central

L'**IA-RD** est le "Veilleur Technologique & Stratège Innovation" du **Board AI-COS**. Il scrute en permanence les évolutions du secteur automobile : électrification massive, véhicules autonomes, ADAS (systèmes d'aide à la conduite), pièces connectées et imprimées 3D. Son rôle est d'anticiper les disruptions pour adapter le catalogue produits avant la concurrence et identifier les opportunités de croissance.

**Positionnement** : Board Member (Strategy & Innovation)
**Budget** : €30K (Dev €22K + APIs veille tech €8K)
**ROI** : +€120K/an (anticipation marché EV + nouveaux segments + avantage concurrentiel)

### 5 Responsabilités Clés

#### 1. Tech Radar Automotive (CRITICAL)

**Fonction** : Cartographie des technologies émergentes impactant les pièces détachées.

**Domaines surveillés** :
- **Électrification** : Batteries (LFP, solid-state), moteurs, onduleurs, câblage HV
- **ADAS** : Capteurs LiDAR, caméras, radars, calculateurs
- **Connectivité** : OBD-II avancé, V2X, mises à jour OTA
- **Fabrication** : Impression 3D pièces, nouveaux matériaux composites
- **Hydrogène** : Piles à combustible, réservoirs, composants spécifiques

**Sources** : Arxiv, IEEE, SAE International, brevets USPTO/EPO.
**Output** : Radar mensuel avec maturité (Emerging/Growing/Mature/Declining).

**KPI** : `tech-coverage` : >90% technologies pertinentes suivies

#### 2. Market Disruption Detector (CRITICAL)

**Fonction** : Alerte précoce sur les changements de marché majeurs.

**Signaux surveillés** :
- Annonces constructeurs (arrêt moteur thermique, nouvelles plateformes)
- Réglementations (Euro 7, interdiction thermique 2035, normes batteries)
- Mouvements startups (levées de fonds, acquisitions)
- Tendances recherche Google/Amazon (demande émergente)

**Analyse** : Impact sur notre catalogue à 6/12/24 mois.
**Alerte** : Score disruption >7/10 → notification IA-CEO + rapport stratégique.

**KPI** : `disruption-lead-time` : >6 mois d'anticipation moyenne

#### 3. Product Opportunity Finder (HIGH)

**Fonction** : Identification de nouvelles catégories produits à haute valeur.

**Méthode** :
1. **Parc roulant** : Évolution mix thermique/hybride/EV par année
2. **Âge moyen** : Quand les EV actuels auront besoin de pièces (3-5 ans)
3. **Gap catalogue** : Pièces EV/ADAS non couvertes vs demande
4. **Marge potentielle** : Estimation pricing et volumes

**Opportunités types** :
- Filtres habitacle HEPA (qualité air EV)
- Plaquettes régénération spécifiques EV
- Câbles de charge et adaptateurs
- Capteurs ADAS de remplacement (pare-brise)

**Livrable** : Business case par opportunité avec ROI estimé.

**KPI** : `opportunities-validated` : >5/trimestre

#### 4. Competitive Intelligence (HIGH)

**Fonction** : Surveillance des mouvements concurrents et benchmark.

**Concurrents surveillés** : Oscaro, Mister-Auto, Autodoc, Amazon Auto, constructeurs (pièces OE).

**Signaux** :
- Nouveaux produits/catégories lancés
- Changements de prix significatifs (>10%)
- Acquisitions/partenariats annoncés
- Campagnes marketing majeures
- Avis clients (pain points non adressés)

**Output** : Rapport hebdomadaire mouvements + alerte temps réel si critique.

**KPI** : `competitive-response-time` : <48h sur mouvement majeur

#### 5. Patent & Regulation Watch (MEDIUM)

**Fonction** : Veille brevets et réglementations impactant l'activité.

**Brevets** :
- Dépôts constructeurs/équipementiers (nouvelles pièces propriétaires)
- Expiration brevets (opportunité pièces génériques)
- Brevets bloquants (risques légaux)

**Réglementations** :
- Normes européennes (CE, type-approval)
- Homologations pièces de sécurité
- RGPD véhicules connectés
- Recyclage batteries (responsabilité étendue producteur)

**Coordination** : IA-Legal pour analyse conformité.

**KPI** : `regulation-compliance-lead` : >12 mois avant entrée en vigueur

### 4 Workflows Critiques

#### Workflow 1 : EV Parts Opportunity Scanner

**Trigger** : Mensuel (1er lundi du mois)

**Actions** :
1. **Parc Analysis** : Extraction données immatriculations (AAA Data, CCFA)
2. **Gap Identification** : Croisement parc EV vs catalogue actuel
3. **Opportunity Scoring** : Volume × Marge × Sourcing feasibility
4. **Business Case Generation** : ROI par catégorie
5. **Recommendation** : Top 5 opportunités prioritaires → IA-CEO + Purchasing

**Output** :
```
EV PARTS OPPORTUNITY REPORT - December 2025

Market Context:
├─ EV share (BEV+PHEV): 26% (+3pts vs 2024)
├─ First major service wave: 2027 (Zoé/e-208 2020-2021)
└─ Estimated addressable market: €45M/year by 2028

TOP 5 OPPORTUNITIES:

1. EV Brake Pads (Regenerative-specific)
   ├─ Market size: €8M/year (France)
   ├─ Current coverage: 12% of models
   ├─ Gap: Tesla, VW ID, Hyundai Ioniq
   ├─ Margin potential: 35% (vs 22% ICE pads)
   └─ Recommendation: PRIORITY HIGH

2. Cabin Air Filters HEPA (EV Premium)
   ├─ Market size: €3M/year
   ├─ Current coverage: 5%
   ├─ Margin potential: 45%
   └─ Recommendation: PRIORITY HIGH
```

#### Workflow 2 : Tech Disruption Alert

**Trigger** : Temps réel (news monitoring) + Weekly digest

**Actions** :
1. **Monitor** : Flux RSS, Twitter/X, communiqués presse constructeurs
2. **Classify** : NLP extraction entités (constructeur, technologie, date)
3. **Score Impact** : Reach × Timeline × Catalogue impact
4. **Alert** : Si score >7/10 → notification immédiate
5. **Analysis** : Rapport d'impact détaillé sous 24h

#### Workflow 3 : Competitive Move Tracker

**Trigger** : Quotidien (scan concurrents) + alerte temps réel

**Actions** :
1. **Scrape** : Sites concurrents (nouveaux produits, prix)
2. **Compare** : Delta vs notre catalogue/pricing
3. **Categorize** : New product, Price change, Campaign, Partnership
4. **Alert** : Si mouvement significatif
5. **Recommend** : Actions de réponse

#### Workflow 4 : Regulatory Change Impact Assessment

**Trigger** : Nouveau texte EUR-Lex / JORF détecté

**Actions** :
1. **Detect** : Monitoring EUR-Lex, JORF, UNECE
2. **Parse** : Extraction obligations, dates, scope
3. **Map** : Impact sur catalogue (pièces concernées)
4. **Timeline** : Date entrée en vigueur, délais transition
5. **Compliance Plan** : Actions requises
6. **Coordinate** : IA-Legal pour validation juridique

### Implémentation (RDAgentService)

```typescript
@Injectable()
export class RDAgentService {
  constructor(
    private readonly techRadar: TechRadarService,
    private readonly marketIntel: MarketIntelligenceService,
    private readonly patentWatch: PatentWatchService,
    private readonly competitiveIntel: CompetitiveIntelService,
    private readonly regulationMonitor: RegulationMonitorService,
    private readonly catalogService: CatalogService,
  ) {}

  @Cron('0 8 1 * 1') // First Monday of month at 8am
  async scanEVOpportunities(): Promise<EVOpportunityReport> {
    this.logger.log('Scanning EV parts opportunities');

    // 1. Get current vehicle park data
    const parkData = await this.marketIntel.getVehicleParkData({
      country: 'FR',
      period: 'last_12_months',
      breakdown: ['powertrain', 'brand', 'model'],
    });

    // 2. Project service wave timing
    const serviceWave = this.projectServiceWave(parkData);

    // 3. Identify catalog gaps
    const currentCatalog = await this.catalogService.getEVCoverage();
    const gaps = await this.identifyCatalogGaps(parkData, currentCatalog);

    // 4. Score opportunities
    const opportunities = await Promise.all(
      gaps.map(async (gap) => {
        const marketSize = await this.estimateMarketSize(gap);
        const sourcing = await this.assessSourcingComplexity(gap);
        const margin = await this.estimateMargin(gap);

        return {
          ...gap,
          marketSize,
          sourcing,
          margin,
          score: this.calculateOpportunityScore(marketSize, sourcing, margin),
        };
      }),
    );

    return {
      period: new Date().toISOString().slice(0, 7),
      parkData,
      serviceWave,
      opportunities: opportunities.sort((a, b) => b.score - a.score),
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async monitorDisruptions(): Promise<DisruptionAlert[]> {
    const news = await this.techRadar.getLatestNews({
      sources: ['reuters', 'automotive_news', 'electrek', 'oem_press'],
      keywords: ['EV', 'electric', 'battery', 'ADAS', 'autonomous'],
      since: new Date(Date.now() - 60 * 60 * 1000),
    });

    const alerts: DisruptionAlert[] = [];

    for (const item of news) {
      const impact = await this.assessDisruptionImpact(item);

      if (impact.score >= 7) {
        alerts.push({
          id: item.id,
          source: item.source,
          title: item.title,
          impactScore: impact.score,
          catalogExposure: impact.catalogExposure,
          recommendedActions: impact.actions,
        });
        await this.escalateDisruption(alert);
      }
    }

    return alerts;
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `tech-coverage` | >90% | 65% | Vision |
| `disruption-lead-time` | >6 mois | 3 mois | Anticipation |
| `opportunities-validated` | >5/trim | 2/trim | Croissance |
| `competitive-response-time` | <48h | 5j | Réactivité |
| `regulation-compliance-lead` | >12 mois | 6 mois | Conformité |

### Coordination

- **IA-CEO** : Rapport stratégique trimestriel Innovation. Escalade disruptions majeures.
- **IA-CFO** : Business cases nouvelles catégories. ROI projections.
- **IA-Merch** : Nouvelles opportunités produits → intégration catalogue.
- **IA-Stock** : Prévisions demande nouvelles catégories.
- **IA-Legal** : Conformité réglementaire. Analyse brevets.

---

## Agent ESG & Durabilité (IA-ESG)

### Rôle Central

L'**IA-ESG** est le "Responsable Développement Durable IA" du **Board AI-COS**. Il pilote la stratégie environnementale et sociale de l'entreprise : calcul précis de l'empreinte carbone (Scopes 1, 2 et 3), conformité aux réglementations RSE (CSRD, taxonomie UE), suivi des objectifs de réduction CO2, évaluation éthique des fournisseurs et génération des rapports extra-financiers.

**Positionnement** : Board Member (Sustainability & Ethics)
**Budget** : €25K (Dev €18K + APIs carbone €7K)
**ROI** : +€75K/an (conformité CSRD anticipée + réduction énergie -15% + image marque + accès marchés publics)

### 5 Responsabilités Clés

#### 1. Carbon Footprint Calculator (CRITICAL)

**Fonction** : Calcul automatisé de l'empreinte carbone selon le GHG Protocol.

**Scopes couverts** :
- **Scope 1** : Émissions directes (véhicules société, chauffage gaz)
- **Scope 2** : Émissions indirectes énergie (électricité bureaux, entrepôts, serveurs)
- **Scope 3 Amont** : Achats (fabrication pièces), transport entrant
- **Scope 3 Aval** : Transport livraisons clients, emballages, fin de vie

**Sources données** :
- ADEME Base Carbone (facteurs d'émission FR)
- Climatiq API (facteurs internationaux)
- Données réelles transporteurs (IA-Transport)
- Factures énergie (intégration comptabilité)

**Granularité** : Par commande, par produit, par client, par période.

**KPI** : `carbon-intensity` : <50g CO2/€ CA (cible -20% sur 3 ans)

#### 2. CSR Compliance Monitor (CRITICAL)

**Fonction** : Veille et conformité aux réglementations RSE.

**Réglementations suivies** :
- **CSRD** (Corporate Sustainability Reporting Directive) - applicable 2026 pour PME
- **Taxonomie UE** : Classification activités durables
- **Devoir de vigilance** : Chaîne d'approvisionnement
- **RGPD** : Volet protection données (coordination IA-Legal)
- **Affichage environnemental** : Score carbone produits

**Livrables** :
- Rapport DPEF (Déclaration de Performance Extra-Financière)
- Matrice de matérialité
- Plan d'action RSE annuel

**Alertes** : Nouvelle réglementation, échéance proche, non-conformité détectée.

**KPI** : `csr-compliance-score` : 100% (zéro non-conformité)

#### 3. Sustainability KPI Dashboard (HIGH)

**Fonction** : Tableau de bord temps réel des indicateurs durabilité.

**Indicateurs environnementaux** :
- Empreinte carbone totale (tCO2e)
- Intensité carbone (g CO2/€)
- % énergie renouvelable
- Taux de recyclage emballages
- km évités (optimisation livraisons)

**Indicateurs sociaux** :
- Score bien-être employés (via IA-HR eNPS)
- Taux accidents travail
- Heures formation/employé
- Écart salarial H/F

**Indicateurs gouvernance** :
- Score éthique fournisseurs
- % fournisseurs audités
- Incidents corruption (0 tolérance)

**KPI** : `esg-score-global` : >75/100

#### 4. Supplier Ethics Scorer (HIGH)

**Fonction** : Évaluation éthique et environnementale des fournisseurs.

**Critères évalués** :
- **Environnement** : Certifications ISO 14001, bilan carbone, politique déchets
- **Social** : Conditions travail, audits sociaux, certifications SA8000
- **Gouvernance** : Anti-corruption, transparence, conformité locale
- **Géographie** : Risques pays (travail forcé, droits humains)

**Sources** :
- Questionnaires fournisseurs (auto-déclaration)
- Audits tiers (EcoVadis, Sedex)
- Bases de données risques (RepRisk)

**Score** : 0-100, seuil minimum 60 pour référencement.
**Action** : Fournisseur <40 = déréférencement, 40-60 = plan d'amélioration.

**KPI** : `supplier-ethics-avg` : >70/100

#### 5. Green Product Labeling (MEDIUM)

**Fonction** : Affichage environnemental des produits.

**Calculs par produit** :
- Empreinte carbone fabrication (données fournisseur ou estimation)
- Impact transport (origine → entrepôt → client)
- Durabilité (durée de vie, réparabilité)
- Recyclabilité (matériaux, filières)

**Affichage** :
- Score A-E (inspiré DPE)
- g CO2 équivalent
- Badge "Éco-responsable" si score A ou B

**KPI** : `green-products-share` : >30% catalogue labellisé A/B

### 4 Workflows Critiques

#### Workflow 1 : Monthly Carbon Report

**Trigger** : 1er jour du mois

**Output** :
```
CARBON FOOTPRINT REPORT - November 2025

Total Emissions: 280.9 tCO2e
├─ Scope 1 (Direct): 3.7 tCO2e (1.3%)
├─ Scope 2 (Energy): 19.2 tCO2e (6.8%)
├─ Scope 3 Upstream: 169.0 tCO2e (60.2%)
└─ Scope 3 Downstream: 89.0 tCO2e (31.7%)

Carbon Intensity: 33.0 g CO2/€
├─ vs Last Month: -4.2%
├─ vs Last Year: -12.8%
└─ vs Target (50g): ON TRACK

TOP 5 EMISSION HOTSPOTS:
1. Purchased goods (52%): Consider local suppliers
2. Outbound delivery (24%): Optimize routes + EV fleet
3. Inbound transport (8%): Consolidate shipments
4. Warehouse electricity (4%): Switch to green tariff
5. Packaging (3%): Reduce + recycled materials
```

#### Workflow 2 : CSRD Compliance Check

**Trigger** : Trimestriel + nouvelle réglementation détectée

**Output** :
```
CSRD COMPLIANCE ASSESSMENT - Q4 2025

Framework: CSRD / ESRS
Applicable From: January 1, 2026

Overall Readiness: 72%

By Category:
├─ E1 Climate: 85% (minor gaps)
├─ E2 Pollution: 60%
├─ E3 Water: 45% (data collection needed)
├─ E4 Biodiversity: 30% (low priority for e-commerce)
├─ E5 Circular Economy: 70%
├─ S1 Own Workforce: 90%
├─ S2 Value Chain Workers: 55%
└─ G1 Governance: 95%

PRIORITY ACTIONS (Q1 2026):
1. [HIGH] Complete Scope 3 category 11
2. [HIGH] Increase supplier audit coverage: 45% → 80%
3. [MEDIUM] Implement water usage tracking
```

#### Workflow 3 : Supplier Ethics Audit

**Trigger** : Nouveau fournisseur + Audit annuel fournisseurs existants

#### Workflow 4 : Green Delivery Optimization

**Trigger** : Coordination IA-Transport (choix transporteur)

### Implémentation (ESGAgentService)

```typescript
@Injectable()
export class ESGAgentService {
  constructor(
    private readonly carbonCalculator: CarbonCalculatorService,
    private readonly complianceMonitor: CSRComplianceService,
    private readonly supplierEthics: SupplierEthicsService,
    private readonly transportService: TransportDataService,
  ) {}

  @Cron('0 6 1 * *') // 1st of month at 6am
  async calculateMonthlyCarbonFootprint(): Promise<CarbonReport> {
    const period = this.getPreviousMonth();

    // Scope 1: Direct emissions
    const scope1 = await this.calculateScope1(period);

    // Scope 2: Energy indirect
    const scope2 = await this.calculateScope2(period);

    // Scope 3 Upstream: Purchased goods, inbound transport
    const scope3Upstream = await this.calculateScope3Upstream(period);

    // Scope 3 Downstream: Deliveries, packaging, end-of-life
    const scope3Downstream = await this.calculateScope3Downstream(period);

    const totalEmissions = scope1.total + scope2.total +
                           scope3Upstream.total + scope3Downstream.total;

    const revenue = await this.getRevenue(period);
    const intensity = (totalEmissions * 1000000) / revenue;

    return {
      period,
      scope1,
      scope2,
      scope3Upstream,
      scope3Downstream,
      totalEmissions,
      revenue,
      intensity,
    };
  }

  async assessSupplierEthics(supplierId: string): Promise<SupplierEthicsScore> {
    const questionnaire = await this.supplierEthics.getQuestionnaire(supplierId);
    const certifications = await this.supplierEthics.getCertifications(supplierId);
    const externalData = await this.supplierEthics.getExternalData(supplierId);

    const environmentScore = this.calculateEnvironmentScore(questionnaire, certifications);
    const socialScore = this.calculateSocialScore(questionnaire, certifications);
    const governanceScore = this.calculateGovernanceScore(questionnaire, certifications);
    const riskScore = await this.calculateRiskScore(supplierId, externalData);

    const totalScore =
      environmentScore * 0.30 +
      socialScore * 0.35 +
      governanceScore * 0.25 +
      riskScore * 0.10;

    let status: 'APPROVED' | 'CONDITIONAL' | 'PROBATION' | 'REJECTED';
    if (totalScore >= 70) status = 'APPROVED';
    else if (totalScore >= 60) status = 'CONDITIONAL';
    else if (totalScore >= 40) status = 'PROBATION';
    else status = 'REJECTED';

    return { supplierId, totalScore, status };
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `carbon-intensity` | <50g CO2/€ | 65g | Climat |
| `csr-compliance-score` | 100% | 72% | Réglementaire |
| `esg-score-global` | >75/100 | 68 | Réputation |
| `supplier-ethics-avg` | >70/100 | 58 | Chaîne valeur |
| `green-products-share` | >30% | 12% | Offre |

### Coordination

- **IA-CEO** : Rapport ESG trimestriel pour Board. Validation stratégie climat.
- **IA-CFO** : Budget initiatives vertes. Prix carbone interne.
- **IA-Transport** : Données livraisons pour Scope 3. Optimisation carbone.
- **IA-Stock** : Bilan carbone stockage. Emballages éco-responsables.
- **IA-Legal** : Conformité CSRD, devoir de vigilance.

---

## Agent Prioritizer RICE/WSJF (G1)

### Rôle Central

L'**G1** (Prioritizer) est un **Agent Gouvernance du Strategy Squad**, expert en priorisation de features et tâches selon les méthodologies RICE et WSJF. Il alimente le backlog avec des scores objectifs basés sur ROI, risques et alignement stratégique.

**Positionnement Squad** : Strategy Squad - Agent Gouvernance
**Budget** : €15K
**ROI** : Optimisation ressources +€100K/an, réduction waste -30%

**Note** : Complémente IA-CEO qui utilise un scoring simple avec une méthodologie formelle RICE/WSJF.

### 5 Responsabilités Clés

#### 1. Scoring RICE (CRITICAL)

**Formule RICE** :
```typescript
interface RICEScore {
  reach: number;        // Nombre users impactés (1-100K)
  impact: number;       // Impact 0.25x | 0.5x | 1x | 2x | 3x
  confidence: number;   // Confiance 20% | 50% | 80% | 100%
  effort: number;       // Personne-mois (0.5-12)
}

const RICE = (reach * impact * confidence) / effort;
```

**Sources data** :
- `reach` : Analytics GA4, segments CRM
- `impact` : Estimation PM + historique features
- `confidence` : Niveau documentation, POC existant
- `effort` : Estimation dev (T-shirt sizing → jours)

#### 2. Scoring WSJF (Weighted Shortest Job First)

**Formule SAFe** :
```typescript
interface WSJFScore {
  businessValue: number;      // 1-10 (ROI projeté)
  timeCriticality: number;    // 1-10 (urgence marché)
  riskReduction: number;      // 1-10 (risque mitigé)
  jobSize: number;            // 1-10 (effort estimé)
}

const WSJF = (businessValue + timeCriticality + riskReduction) / jobSize;
```

#### 2b. Cost-of-Delay (CoD) Analysis

**Formule SAFe étendue** :
```typescript
interface CostOfDelay {
  userValue: number;           // Valeur pour l'utilisateur (1-10)
  timeValue: number;           // Urgence temporelle (1-10)
  riskOpportunity: number;     // Réduction risque/opportunité (1-10)
}

const CoD = userValue + timeValue + riskOpportunity;
const CD3 = CoD / jobSize;  // Cost of Delay Divided by Duration
```

**Catégories urgence** :

| Type | Comportement | Action |
|------|--------------|--------|
| Standard | Valeur constante dans le temps | Normal |
| Fixed Date | Deadline légale/marketing | Priorité haute |
| Expedite | Perte €/jour immédiate | Traitement immédiat |
| Intangible | Enabler technique | Planifier en parallèle |

**KPI** : `cod-coverage` : >80% features évaluées CoD

#### 3. Priorisation Backlog Automatique

**Workflow** :
1. Scan Jira/Linear issues (hebdomadaire)
2. Calcul RICE + WSJF pour chaque item
3. Ranking par score composite
4. Suggestions réordonnancement
5. Alerte si divergence >20% vs priorité manuelle

#### 4. Arbitrage ROI vs Risques vs Stratégie

**Matrice décision** :
| Critère | Poids | Source |
|---------|-------|--------|
| ROI projeté | 40% | Business case |
| Risque technique | 25% | IA-CTO |
| Alignement stratégique | 25% | IA-CEO OKRs |
| Dépendances | 10% | A-CARTO graph |

#### 5. Rapport Priorisation

**Dashboard** : `/admin/ai-cos/prioritizer`

**Widgets** :
- Top 20 features par RICE
- Backlog santé (items sans score)
- Velocity vs priorités
- Drift priorisation (manuel vs auto)

### Output JSON

```typescript
interface PrioritizationResult {
  feature_id: string;
  rice_score: number;
  wsjf_score: number;
  composite_rank: number;
  confidence_level: 'low' | 'medium' | 'high';
  recommended_sprint: string;
  blockers: string[];
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `backlog-scored-rate` | 100% | Items avec score RICE |
| `prioritization-accuracy` | >85% | Alignement score vs delivery value |
| `velocity-alignment` | >90% | Sprint capacity vs top priorities |
| `waste-reduction` | -30% | Features low-ROI évitées |
| `cod-coverage` | >80% | Features avec Cost-of-Delay évalué |

### Intégration Agents

```
G1 ──► IA-CEO : Alignement OKRs stratégiques
   ├──► IA-CPO : Backlog sync
   ├──► IA-CTO : Risques techniques
   └──► G4 : Input risk scores
```

---

## Agent Risk Manager (G4)

### Rôle Central

L'**G4** (Risk Manager) est un **Agent Gouvernance du Strategy Squad**, cartographe des risques techniques, business et opérationnels. Il consolide les risk scores de tous les domaines et génère des alertes proactives.

**Positionnement Squad** : Strategy Squad - Agent Gouvernance
**Budget** : €20K
**ROI** : Évitement incidents -€150K/an, réduction MTTR -40%

### 5 Responsabilités Clés

#### 1. Cartographie Risques Multi-Domaines (CRITICAL)

**Domaines surveillés** :
```typescript
interface RiskDomains {
  tech: TechRiskScore;       // IA-CTO alimenté
  infra: InfraRiskScore;     // IA-DevOps alimenté
  security: SecurityRiskScore; // IA-CISO alimenté
  legal: LegalRiskScore;     // IA-Legal alimenté
  business: BusinessRiskScore; // IA-CEO alimenté
  supply: SupplyRiskScore;   // IA-Stock alimenté
}
```

#### 2. Calcul Risk Score Global

**Formule pondérée** :
```typescript
const GlobalRiskScore = (
  techRisk * 0.25 +
  infraRisk * 0.20 +
  securityRisk * 0.25 +
  legalRisk * 0.15 +
  businessRisk * 0.10 +
  supplyRisk * 0.05
);

// Seuils
// 0-30: Low
// 31-60: Medium
// 61-80: High
// 81-100: Critical
```

#### 3. Matrice Probabilité × Impact

**Visualisation** :
```
        Impact →
        Low   Medium   High   Critical
    ┌────────────────────────────────┐
Low │  LOW    LOW     MED     MED   │
    │                                │
Med │  LOW    MED     HIGH   CRIT   │
    │                                │
High│  MED    HIGH    CRIT   CRIT   │
    │                                │
Crit│  HIGH   CRIT    CRIT   BLOCK  │
    └────────────────────────────────┘
    ↑ Probabilité
```

#### 4. Alertes Proactives

**Seuils escalade** :
| Risk Score | Action |
|------------|--------|
| >70 | Alerte IA-CEO + Board |
| >50 | Alerte Squad Lead |
| >30 | Warning dashboard |
| Δ +20pts/7j | Trend alert |

#### 5. Risk Register & Mitigations

**Template** :
```typescript
interface RiskEntry {
  id: string;
  title: string;
  domain: RiskDomain;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  owner: string;           // Agent responsable
  mitigation: string;
  status: 'open' | 'mitigating' | 'accepted' | 'closed';
  review_date: Date;
}
```

### Output JSON

```typescript
interface RiskManagerResult {
  global_risk_score: number;
  domain_scores: Record<string, number>;
  top_5_risks: RiskEntry[];
  new_risks_7d: number;
  mitigated_risks_7d: number;
  trend: 'improving' | 'stable' | 'degrading';
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `global-risk-score` | <40 | Score risque global |
| `critical-risks` | 0 | Risques >80 non mitigés |
| `risk-coverage` | 100% | Domaines surveillés |
| `mitigation-rate` | >80% | Risques avec plan |

### Intégration Agents

```
G4 ──► IA-CEO : Rapport Board hebdo
   ├──► IA-CTO : Tech risk input
   ├──► IA-CISO : Security risk input
   ├──► IA-Legal : Legal risk input
   └──► G1 : Risk factor priorisation
```

---

## Agent Meta-Score Santé Global (G5)

### Rôle Central

L'**G5** (Meta-Score) est un **Agent Gouvernance du Strategy Squad**, consolidateur de tous les KPIs en un Health Score Global unique. Il fournit une vue 360° de la santé du système AI-COS.

**Positionnement Squad** : Strategy Squad - Agent Gouvernance
**Budget** : €18K
**ROI** : Visibilité exécutive +€80K/an, décisions data-driven

**Note** : Formalise et étend le Health Score de IA-CEO avec consolidation multi-dimensionnelle.

### 5 Responsabilités Clés

#### 1. Agrégation 100+ KPIs (CRITICAL)

**Sources** :
```typescript
const kpiSources = {
  tech: 25,      // A-CARTO, A2, A3, A4, IA-CTO
  business: 20,  // IA-CEO, IA-CFO, IA-Sales
  customer: 15,  // IA-CX360, IA-CRM, NPS
  ops: 15,       // IA-Stock, IA-Transport, IA-Customs
  security: 10,  // IA-CISO, G2
  quality: 15,   // F1-F6, tests
  governance: 10 // G1-G4
};
// Total: 110 KPIs consolidés
```

#### 2. Calcul Health Score Multi-Dimensionnel

**Formule** :
```typescript
const HealthScore = {
  tech: (techKPIs.reduce(sum) / techKPIs.length) * 0.25,
  business: (bizKPIs.reduce(sum) / bizKPIs.length) * 0.30,
  customer: (cxKPIs.reduce(sum) / cxKPIs.length) * 0.20,
  ops: (opsKPIs.reduce(sum) / opsKPIs.length) * 0.10,
  security: (secKPIs.reduce(sum) / secKPIs.length) * 0.10,
  governance: (govKPIs.reduce(sum) / govKPIs.length) * 0.05
};

const GlobalHealthScore = Object.values(HealthScore).reduce(sum);
// Cible: >85/100
```

#### 3. Détection Corrélations Cross-Domaines

**Analyses** :
- LCP ↑ → Conversion ↓ (correlation 0.85)
- Deployment frequency ↑ → Incidents ↓ (DORA)
- NPS ↑ → Churn ↓ (correlation 0.72)
- Tech debt ↑ → Velocity ↓ (correlation 0.68)

#### 4. Trend Analysis & Forecasting

**Prédictions** :
```typescript
interface HealthForecast {
  current_score: number;
  predicted_7d: number;
  predicted_30d: number;
  confidence: number;
  key_drivers: string[];      // KPIs impactant le plus
  risk_factors: string[];     // Risques identifiés
  recommendations: string[];  // Actions suggérées
}
```

#### 5. Executive Dashboard

**Route** : `/admin/ai-cos/health-global`

**Widgets** :
- Score global avec trend 30j
- Radar chart 6 dimensions
- Top 10 KPIs en amélioration
- Top 10 KPIs en dégradation
- Heatmap corrélations
- Forecast 7j/30j

### Output JSON

```typescript
interface HealthScoreResult {
  global_score: number;          // 0-100
  dimension_scores: {
    tech: number;
    business: number;
    customer: number;
    ops: number;
    security: number;
    governance: number;
  };
  trend_7d: number;              // delta pts
  trend_30d: number;
  top_improvements: KPIDelta[];
  top_degradations: KPIDelta[];
  correlations_detected: Correlation[];
  forecast: HealthForecast;
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `global-health-score` | >85 | Score santé global |
| `kpi-coverage` | 100% | KPIs consolidés |
| `forecast-accuracy` | >80% | Précision prédictions |
| `dimension-balance` | <15pts écart | Équilibre dimensions |

### Intégration Agents

```
G5 ──► IA-CEO : Rapport Board hebdo
   ├──► Tous agents : Input KPIs
   ├──► G4 : Correlation risks
   └──► Dashboard : Visualisation temps réel
```

---

## Dashboards Strategy Squad

| Route | Description |
|-------|-------------|
| `/admin/ai-cos/ceo` | Dashboard CEO principal |
| `/admin/ai-cos/prioritizer` | Priorisation RICE/WSJF |
| `/admin/ai-cos/risks` | Risk Manager |
| `/admin/ai-cos/health-global` | Meta-Score Health |

---

## KPIs Globaux Strategy Squad

| KPI | Cible | Agent |
|-----|-------|-------|
| `health-score-global` | >85/100 | G5 |
| `global-risk-score` | <40 | G4 |
| `backlog-scored-rate` | 100% | G1 |
| `carbon-intensity` | <50g CO2/€ | IA-ESG |
| `tech-coverage` | >90% | IA-RD |
| `decision-accuracy` | >90% | IA-CEO |

---

## Liens Documentation

- [AI-COS Index](./ai-cos-index.md) - Navigation principale
- [Tech Squad](./ai-cos-tech-squad.md) - 10 agents techniques
- [CHANGELOG](./CHANGELOG-ai-cos.md) - Historique versions
