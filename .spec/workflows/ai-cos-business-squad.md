# AI-COS Business Squad

**E-commerce, marketing, ventes, analytics et intelligence prix**

---

## Vue d'ensemble

Le **Business Squad** comprend **17 agents** avec un budget total de **€262K** et un ROI annuel de **+€935K**.

> ⚠️ **CHANGEMENT MAJEUR v3.9.0** : Séparation SEO / Marketing
> Voir [Governance Rules - Règle de Non-Interférence SEO/Marketing](../features/ai-cos-governance-rules.md#règle-de-non-interférence-seo--marketing)

### Composition

| Agent | Budget | Rôle | Squad |
|-------|--------|------|-------|
| **IA-SEO Master** | €25K | **Lead SEO Squad** - Structure & Vérité | SEO Squad |
| **IA-Marketing Director** | €30K | **Lead Marketing Squad** - Acquisition | Marketing Squad |
| Growth IA | €18K | A/B Testing | E-Commerce |
| IA-CRM | €22K | CRM & Loyalty | Customer |
| IA-Sales | €20K | Sales Coach | Customer |
| IA-Merch | €15K | Cross-sell/Upsell | E-Commerce |
| SEO Sentinel | €15K | Veille SEO & indexation | SEO Squad |
| VoC Miner | €12K | Feedbacks clients | Intelligence |
| Analytics Agent | €18K | Funnel conversion | Intelligence |
| Pricing Intel | €20K | Prix & marges (VERROUILLÉ) | E-Commerce |
| M1 | €15K | Ontology Extractor | Data |
| M2 | €12K | Workflow Métier | E-Commerce |
| M3 | €10K | Règles Métier | Tech |
| M4 | €18K | Data Sanity | Data |
| M5 | €12K | Mapping Produit | E-Commerce |

### Architecture Squad (v3.9.0 - Séparation SEO/Marketing)

```
                         ┌───────────────────────────────────────┐
                         │        BUSINESS SQUAD                 │
                         │         €262K | 17 agents             │
                         └───────────────┬───────────────────────┘
                                         │
    ┌─────────────────┬──────────────────┼──────────────────┬─────────────────┐
    │                 │                  │                  │                 │
┌───┴─────────┐  ┌────┴────────┐   ┌────┴────────┐   ┌────┴────────┐   ┌────┴────────┐
│ SEO Squad   │  │ Marketing   │   │ E-Commerce  │   │ Intelligence│   │ Customer    │
│ [NOUVEAU]   │  │ Squad [NEW] │   │             │   │             │   │             │
├─────────────┤  ├─────────────┤   ├─────────────┤   ├─────────────┤   ├─────────────┤
│ IA-SEO      │  │ IA-Marketing│   │ Growth IA   │   │ VoC Miner   │   │ IA-CRM      │
│ Master      │  │ Director    │   │ IA-Merch    │   │ Analytics   │   │ IA-Sales    │
│ SEO Sentinel│  │ Content Bot │   │ Pricing Intel│  │ Agent       │   │             │
│ Schema Bot  │  │ Social Media│   │             │   │             │   │             │
└─────────────┘  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘

     ⚠️ RÈGLE CARDINALE: SEO et Marketing NE SE MÉLANGENT JAMAIS
     En cas de conflit: Escalade IA-CEO → HUMAIN décide
     Priorité par défaut: SEO > Marketing (structure long-terme)
```

### Règle de Non-Interférence SEO/Marketing

```
┌─────────────────────────────────────────────────────────────────────┐
│                 RÈGLE DE NON-INTERFÉRENCE SEO/MARKETING             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ❌ INTERDIT : Mélanger SEO et Growth dans un même raisonnement    │
│                                                                      │
│   Décisions SEO → IA-SEO Master décide SEUL                         │
│   Décisions Marketing → IA-Marketing Director décide SEUL           │
│                                                                      │
│   En cas de conflit :                                                │
│   1. Escalade vers IA-CEO                                           │
│   2. IA-CEO prépare arbitrage                                       │
│   3. HUMAIN décide                                                   │
│                                                                      │
│   PRIORITÉ PAR DÉFAUT : SEO > MARKETING                             │
│   (La structure long-terme prime sur l'acquisition court-terme)     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent A/B Testing (Growth IA)

### Rôle Central

L'**Agent Growth IA** est un **Specialized Agent** (E-Commerce Squad) orchestrant les tests A/B croissance multi-domaines : pricing, catalogues, marketing. Distinct de l'IA-CPO (focus UX), Growth IA optimise revenue, AOV, CLTV via expérimentation systématique.

**Positionnement Squad** : E-Commerce Squad - Peer agent avec Pricing Bot, IA-CRM, Stock Forecaster
**Budget** : €18K
**ROI** : +€80K/an (optimisation pricing + marketing)

### 7 Responsabilités Clés

#### 1. Pricing Experimentation (CRITICAL)

Tests prix dynamiques -5%/-10%/-15%, coordination IA-CFO validation marge seuil <-5pts, bundles 3 vs 5 produits, promos timing Black Friday 7j vs 14j.

**KPI** : `aov` (Average Order Value) : €180 target (actuel €165)

#### 2. Catalog Organization Tests (HIGH)

Taxonomie 2 vs 3 niveaux +8% découvrabilité, filtres 8 vs 12 optimisation, search Elastic scoring variants, ordre catégories popularité vs prix.

**KPI** : `catalog-discoverability` : +8% clicks produits

#### 3. Marketing Campaigns Tests (HIGH)

Emailing subject lines 3 variantes baseline/urgency/value +18% open rate, landing pages hero sections CTR, SEO titles 50 vs 60 vs 70 chars, ad creatives tests.

**KPIs** : `email-open-rate` >22%, `landing-conversion` >4%

#### 4. Product Recommendations ML (HIGH)

Algorithms Collaborative filtering vs Content-based vs Hybrid CTR >5%, placements homepage/product pages/cart upsells, cross-sell revenue maximization.

**KPI** : `recommendations-ctr` : >5%

#### 5. Growth Loops Engineering (MEDIUM)

Viral K-factor >1.2, referral incentives €10 vs €15 vs 10% discount, invite flow email/SMS/social, activation triggers timing.

**KPI** : `k-factor` : >1.2 target

#### 6. Retention Experiments (MEDIUM)

Onboarding 3 vs 5 steps activation, re-activation emails 7j/14j/30j timing, engagement gamification, win-back campaigns discount tiers, churn <5%.

**KPIs** : `retention-d30` >70%, `churn-rate` <5%

#### 7. Revenue Optimization (CRITICAL)

Upsells timing checkout vs post-purchase, bundles discount 10% vs 15% vs 20%, free shipping threshold €50/€75/€100, payment methods 1-click impact.

**KPI** : `revenue-growth-mom` : +5% MoM target

### 3 Workflows Critiques

#### Workflow 1 : Pricing A/B Test

IA-CFO simulation ROI 140% → test -10% top 30 produits 14j 2500 visitors → volume +28% conversion 3.2%→4.1% revenue +€32K marge 40%→35% p-value 0.008 → IA-CFO validation ROI 128% → deploy saisonniers monitoring marge Q+1.

**Output** : Revenue +€32K, ROI 128%, impact annuel +€384K

#### Workflow 2 : Emailing Subject Line Test

3 variants baseline/urgency emoji/value 15K subscribers 48h → open rate 18%/25%/22% click 2.8%/4.2%/3.5% conversions 42/63/53 → winner urgency +39% open +50% conversions p-value 0.01 → pattern stocké Data Brain → auto-apply next campaigns.

**Output** : +420 conversions/mois (+€6.3K)

#### Workflow 3 : Recommendations ML Hybrid

Homepage CTR 3% target >5% → 3 algorithms Collaborative/Content/Hybrid 3000 users 7j → CTR 3.4%/4.2%/5.8% conversions 28/35/52 revenue €4.6K/€5.8K/€8.6K → winner Hybrid +71% CTR +86% revenue → deploy homepage/product pages/cart.

**Output** : +€36K revenue/mois

### Implémentation

**Service NestJS** : `GrowthAgentService`
- Méthodes : `runPricingTest()`, `testCatalogTaxonomy()`, `runMarketingTest()`, `testRecommendations()`, `measureAOV()`, `measureCLTV()`, `measureKFactor()`
- Intégrations : Optimizely API, Segment tracking, Google Optimize, Amplitude funnels
- Dashboard : `/admin/ai-cos/growth`

### Coordination E-Commerce Squad

- **Pricing Bot → Growth IA** : Propose prix dynamiques → Growth IA teste variants → Winner validation IA-CFO
- **IA-CPO ↔ Growth IA** : Calendrier tests synchronisé (éviter 2 tests simultanés même page), handoff tests UX→CPO vs pricing/catalog→Growth IA
- **Marketing Squad → Growth IA** : Propose test → Content Maker exécute → Growth IA mesure → Pattern stocké

---

## Agent CRM & Loyalty (IA-CRM)

### Rôle Central

L'**IA-CRM** est le "Cerveau Client" de la **Customer Squad**. Il ne se contente pas de stocker des données, il les active pour maximiser la valeur client (LTV) et minimiser le churn. Il agit comme un analyste commercial et un responsable fidélisation disponible 24/7.

**Positionnement Squad** : Customer Squad - Specialized Agent
**Budget** : €22K (Dev €18K + APIs €4K)
**ROI** : +€75K/an (réduction churn + upsell)

### 7 Responsabilités Clés

#### 1. Lead Scoring (Propensity-to-Buy v2)

**Algorithme** : Scoring prédictif 0-100 temps réel.

**Facteurs** :
- Comportemental (Visite pricing, download whitepaper)
- Démographique (Taille entreprise, secteur via Enrichment)
- Engagement (Ouverture emails, CTR)

**Action** : Routing automatique (Sales vs Nurturing).

**KPI** : `lead-conversion-rate` : >15% (MQL → SQL)

#### 2. Segmentation Dynamique

**Méthode** : RFM (Récence, Fréquence, Montant) + Personas IA.

**Segments** :
- `VIP_LOYAL` (High LTV, High Engagement)
- `AT_RISK` (High LTV, Low Engagement)
- `NEW_B2B` (High Potential, New)

**Usage** : Ciblage ultra-personnalisé pour Growth IA.

#### 3. Churn Prediction (Early Warning)

**Détection** : Signaux faibles <30j avant départ.

**Signaux** : Baisse fréquence usage, visite page "Résiliation", tickets support négatifs.

**Action** : Alerte "Risk Level High" → Workflow rétention.

**KPI** : `churn-rate` : <5%

#### 4. Next Best Action (NBA)

**Moteur** : Recommandation contextuelle pour chaque client.

**Actions** :
- *Upsell* (Usage >80% → Plan Supérieur)
- *Cross-sell* (Acheté X → Proposer Y)
- *Retention* (Risque → Appel VIP)
- *Nurturing* (Froid → Contenu éducatif)

#### 5. Fidélisation & Gamification

**Programme** : Points auto-gérés, Tiers dynamiques (Gold/Silver).

**Actions** :
- Récompense anniversaire (automatique)
- Bonus "Ambassadeur" (parrainage)
- Déblocage features beta pour VIP

**KPI** : `nps` : >50

#### 6. Data Enrichment

**Sources** : APIs externes (Clearbit, LinkedIn, Company House).

**Données** : CA entreprise, effectif, stack technique, décideurs.

**Objectif** : 0 champ formulaire inutile (UX) mais profil complet (Data).

#### 7. Sales Pipeline Automation

**Transitions** : Prospect → Lead → MQL → SQL → Client → Ambassadeur.

**Automation** :
- Relances automatiques J+3, J+7
- Création tâches CRM pour Sales (Appels prioritaires)
- Mise à jour probabilité closing

**KPI** : `upsell-revenue` : +10% MoM

### 4 Workflows Critiques

#### Workflow 1 : Lead Scoring & Routing

**Trigger** : Visite Pricing + Download Whitepaper

**Output** :
```
HOT LEAD DETECTED
Company: TechCorp (500 emp)
Score: 85/100
Action: Sales Notification sent
Context: Visited Pricing 3x, Downloaded Security Whitepaper
```

#### Workflow 2 : Churn Prevention Protocol

**Trigger** : Score santé < 40/100

**Actions** :
1. Analyse : Usage -40% sur 30j + Ticket support non résolu
2. Action NBA : Intervention Humaine Requise
3. Support : Création ticket VIP "Risque Churn" prioritaire
4. Offre : Génération code promo -15% (si éligible)

#### Workflow 3 : Win-Back Automation

**Trigger** : Inactif > 90j (Ancien LTV > €200)

#### Workflow 4 : Upsell Opportunity

**Trigger** : Usage quota > 85%

### Implémentation (CrmAgentService)

```typescript
@Injectable()
export class CrmAgentService {
  @Cron('0 */4 * * *') // Every 4 hours
  async runLeadScoringPipeline(): Promise<ScoringReport> {
    const prospects = await this.crmRepo.findActiveProspects();

    const results = await Promise.all(prospects.map(async (p) => {
      const score = await this.scoringEngine.calculate(p);
      if (score > 80) await this.salesNotifier.notifyHotLead(p);
      return { id: p.id, score };
    }));

    return { processed: results.length };
  }

  @Cron('0 2 * * *') // Daily 2am
  async runChurnPrevention(): Promise<void> {
    const atRisk = await this.churnModel.predictRisk({ threshold: 0.6 });
    for (const client of atRisk) {
      await this.nbaEngine.executeNextBestAction(client);
    }
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `cltv` | >€500 | Customer Lifetime Value |
| `churn-rate` | <5% | Taux de churn |
| `lead-conversion` | >15% | MQL → SQL |
| `upsell-revenue` | +10% | Revenue upsell MoM |
| `nps` | >50 | Net Promoter Score |

---

## Agent Sales Coach (IA-Sales)

### Rôle Central

L'**IA-Sales** est le "Coach Commercial" de la **Customer Squad**. Il ne remplace pas les vendeurs, il les augmente en analysant chaque interaction pour maximiser la conversion et la vélocité du pipeline.

**Positionnement Squad** : Customer Squad - Specialized Agent
**Budget** : €20K
**ROI** : +€60K/an (+20% closing rate)

### 7 Responsabilités Clés

#### 1. Smart Follow-up

**Algorithme** : Détection intention & timing optimal.

**Facteurs** :
- Signaux d'intérêt (Ouverture email, visite pricing)
- Délai depuis dernier contact
- Contexte deal (Phase négociation, découverte)

**Action** : Génération brouillon email relance hyper-personnalisé.

**KPI** : `response-rate` : >30%

#### 2. Call Analysis & Debrief

**Méthode** : Transcription & NLP (Sentiment, Keywords).

**Analyse** :
- Ratio écoute/parole (Talk-to-listen ratio)
- Questions posées vs subies
- Moments "Aha!" vs Objections

**Usage** : Coaching immédiat post-call + Score qualité appel.

#### 3. Objection Handling

**Moteur** : Base de connaissance dynamique "Battlecards".

**Actions** :
- Détection objection temps réel (si possible) ou post-call
- Suggestion réponse éprouvée ("C'est trop cher" → ROI calculator)
- Identification nouvelles objections pour training

#### 4. Pipeline Velocity

**Analyse** : Temps passé par étape du funnel.

**Actions** :
- Alerte "Deal Stalled" (>10j sans mouvement)
- Identification goulots d'étranglement
- Recommandation action pour débloquer (ex: Intro N+1)

**KPI** : `deal-velocity` : -20% cycle vente

#### 5. Meeting Prep

**Automation** : Recherche contextuelle avant RDV.

**Output** : "One-pager" briefing :
- Dernières news entreprise
- Profil LinkedIn interlocuteurs
- Historique interactions & tickets support
- Sujets à aborder absolument

**KPI** : `meeting-booked-rate` : >25%

#### 6. Competitor Intel

**Veille** : Surveillance mentions concurrents.

**Actions** :
- Alerte "Concurrent cité" dans appel
- Fourniture arguments différenciants (Kill sheets)
- Analyse Win/Loss vs concurrents spécifiques

#### 7. Sentiment Analysis

**Tracking** : Évolution humeur prospect au fil du temps.

**Signaux** : Ton voix, mots clés positifs/négatifs emails.

**Objectif** : Prédire probabilité closing basée sur l'émotion.

### 3 Workflows Critiques

#### Workflow 1 : Smart Follow-up

**Trigger** : Pas de réponse J+3 après démo

**Output** :
```
DRAFT EMAIL READY
To: Jean Dupont (CTO)
Subject: Solution pour votre problème de [X]
Context: Demo J-3, objection sur sécurité levée
Action: Review & Send
```

#### Workflow 2 : Call Debrief & Coaching

**Trigger** : Fin appel Zoom/Meet

**Actions** :
1. Transcription : Speech-to-Text
2. Analyse : Score 7/10 (Bonne écoute, Objection prix mal gérée)
3. Coaching : "Conseil : Utilise la méthode XYZ pour le prix la prochaine fois"
4. CRM : Mise à jour champs qualifs (Budget, Authority, Need, Timing)

#### Workflow 3 : Deal Rescue

**Trigger** : Probabilité closing chute > 20%

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `response-rate` | >30% | Taux réponse emails |
| `meeting-booked` | >25% | Taux RDV bookés |
| `deal-velocity` | -20% | Réduction cycle vente |
| `closing-rate` | +20% | Amélioration closing |
| `call-quality` | >8/10 | Score qualité appels |

---

## Agent Cross-Sell / Upsell (IA-Merch)

### Rôle Central

L'**IA-Merch** est l'expert produit technique de l'**E-Commerce Squad**. Il agit comme un vendeur comptoir expérimenté qui suggère les pièces complémentaires indispensables tout en garantissant la compatibilité véhicule à 100%.

**Positionnement Squad** : E-Commerce Squad - Specialized Agent
**Budget** : €15K
**ROI** : +€45K/an (+10% AOV)

### 4 Responsabilités Clés

#### 1. Compatibility Engine (Moteur de Compatibilité)

**Fonctionnement** : Analyse le `vehicle_id` de chaque pièce ajoutée au panier.

**Logique** : Interroge `pieces_relation_type` pour trouver les pièces liées compatibles *uniquement* avec ce véhicule.

**Sécurité** : Filtre strict "Fitment Guarantee" pour éviter les retours.

**KPI** : `compatibility-return-rate` : <1%

#### 2. Bundle Generator (Générateur de Lots)

**Règles Métier** : Relations Parent-Enfant (Disques → Plaquettes, Amortisseurs → Coupelles).

**Offre Dynamique** : Création de "Virtual Bundles" à la volée avec incitation prix.

**Exemple** : "Ajoutez les plaquettes compatibles pour 35€ de plus (au lieu de 42€)".

#### 3. Smart Upsell (Montée en Gamme)

**Logique** : Suggestion alternative Premium.

**Trigger** : Choix marque "Economy".

**Action** : "Pour 15€ de plus, passez sur du Bosch (Durée de vie x2)".

#### 4. In-Cart Injection

**Intégration** : Enrichissement réponse API `getCart` avec champ `suggestions`.

**Performance** : Latence < 50ms (Cache Redis).

**KPI** : `suggestion-ctr` : >15%

### 3 Workflows Critiques

#### Workflow 1 : Smart Bundle Injection

**Trigger** : Ajout produit au panier (ex: Disques Avant)

**Output** :
```json
{
  "cart": { ... },
  "suggestions": [
    {
      "type": "complementary",
      "product_id": "PLAQ-123",
      "reason": "Indispensable avec vos disques",
      "bundle_price": 35.00
    }
  ]
}
```

#### Workflow 2 : Premium Upgrade

**Trigger** : Ajout produit gamme "Eco"

#### Workflow 3 : Compatibility Guard

**Trigger** : Tentative ajout produit incompatible

### Implémentation (MerchAgentService)

```typescript
@Injectable()
export class MerchAgentService {
  async getSuggestions(cartItems: CartItem[]): Promise<Suggestion[]> {
    const suggestions = [];
    for (const item of cartItems) {
      const relatedTypes = await this.repo.findRelatedTypes(item.productType);
      const compatibleProducts = await this.repo.findCompatible(
        relatedTypes,
        item.vehicleId
      );
      if (compatibleProducts.length > 0) {
        suggestions.push(this.createBundle(item, compatibleProducts[0]));
      }
    }
    return suggestions;
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `aov` | +10% | Augmentation panier moyen |
| `attach-rate` | >25% | Taux d'attachement |
| `suggestion-ctr` | >15% | CTR suggestions |
| `compatibility-returns` | <1% | Retours incompatibilité |

---

## IA-SEO Master (Lead SEO Squad) [NOUVEAU v3.9.0]

### Rôle Central

L'**IA-SEO Master** est le **Lead du SEO Squad**, responsable de la **Structure & Vérité SEO**. Il ne mélange JAMAIS ses décisions avec celles du Marketing. Son rôle est de garantir l'intégrité technique et la véracité du contenu pour le référencement.

**Positionnement Squad** : SEO Squad - Lead Agent
**Budget** : €25K
**ROI** : +€100K/an (structure SEO long-terme, indexation optimale)

### Règle Cardinale

> **"La vérité SEO prime sur l'optimisation marketing"**

### Responsabilités

- Structure technique SEO (sitemap, robots, canonicals)
- Vérité contenu (exactitude, cohérence)
- Schema.org et structured data
- Indexation et crawl budget
- Core Web Vitals SEO

### Interdictions ABSOLUES

```yaml
❌ INTERDIT:
  - Modifier contenu pour "conversion"
  - Faire de changements pour "A/B tests marketing"
  - Altérer la vérité pour l'engagement
  - Sacrifier structure pour performance court-terme
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `seo-score` | >90 | Score SEO global |
| `indexation-rate` | >95% | Taux indexation |
| `schema-coverage` | >80% | Couverture structured data |
| `content-accuracy` | >95% | Exactitude contenu |
| `crawl-budget-efficiency` | >85% | Efficacité crawl |

### Coordination

- **SEO Sentinel** : Agent exécution sous IA-SEO Master
- **Schema Bot** : Structured data
- **IA-Marketing Director** : Escalade conflits → HUMAIN

---

## IA-Marketing Director (Lead Marketing Squad) [NOUVEAU v3.9.0]

### Rôle Central

L'**IA-Marketing Director** est le **Lead du Marketing Squad**, responsable de l'**Acquisition & Conversion**. Il ne mélange JAMAIS ses décisions avec celles du SEO. Son rôle est d'optimiser la croissance tout en respectant la structure SEO.

**Positionnement Squad** : Marketing Squad - Lead Agent
**Budget** : €30K
**ROI** : +€120K/an (acquisition optimisée, conversion améliorée)

### Règle Cardinale

> **"La croissance ne doit pas sacrifier la structure SEO"**

### Responsabilités

- Stratégie acquisition (paid + organic)
- Optimisation conversion (CRO)
- Campagnes et promotions
- Social media et engagement
- A/B tests marketing (hors structure SEO)

### Interdictions ABSOLUES

```yaml
❌ INTERDIT:
  - Modifier structure SEO
  - Altérer les meta tags techniques
  - Impacter crawl budget
  - Créer redirections sans accord SEO
  - Modifier URLs existantes
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `roi-campaigns` | >300% | ROI campagnes |
| `cac` | <€50 | Coût acquisition client |
| `conversion-rate` | >3.5% | Taux conversion |
| `aov` | >€180 | Panier moyen |
| `campaign-revenue` | >€100K/trim | Revenue campagnes |

### Coordination

- **Campaign Optimizer** : Exécution campagnes
- **Content Bot** : Contenu persuasif
- **Social Media Bot** : Réseaux sociaux
- **IA-SEO Master** : Escalade conflits → HUMAIN

---

## Agent SEO Sentinel

### Rôle Central

L'**Agent SEO Sentinel** est le "Gardien du Référencement" du **SEO Squad**. Il surveille en permanence la santé SEO du site : indexation Google, positions ranking, Core Web Vitals, et détection des anomalies. Il agit comme un expert SEO disponible 24/7 pour alerter et recommander des actions correctives.

> **Depuis v3.9.0** : SEO Sentinel rapporte à **IA-SEO Master** (Lead SEO Squad)

**Positionnement Squad** : SEO Squad - Agent d'exécution (sous IA-SEO Master)
**Budget** : €15K (Dev €12K + APIs €3K)
**ROI** : +€60K/an (traffic organique +15%, ranking stabilité)

### 5 Responsabilités Clés

#### 1. Monitoring Indexation Google (CRITICAL)

**Source** : Google Search Console API
**Métriques** :
- Pages indexées vs soumises
- Erreurs crawl (404, 5xx, soft 404)
- Couverture index (valid, excluded, error)
- Nouveaux contenus indexés

**Alertes** :
- Chute indexation >5% en 24h
- Erreurs crawl >100/jour
- Pages importantes désindexées

**KPI** : `pages-indexed` : >95%

#### 2. Alertes Ranking Drop (CRITICAL)

**Source** : Google Search Console + Semrush/Ahrefs API
**Surveillance** :
- Top 100 mots-clés prioritaires
- Positions quotidiennes
- Changements >5 positions

**Actions** :
- Alerte immédiate si drop >5 positions
- Analyse cause probable (algo update, concurrent, technique)
- Recommandation action corrective

**KPI** : `ranking-stability` : <5 drops/semaine

#### 3. Surveillance Core Web Vitals (HIGH)

**Métriques CWV** :
- LCP (Largest Contentful Paint) : <2.5s
- FID (First Input Delay) : <100ms
- CLS (Cumulative Layout Shift) : <0.1
- INP (Interaction to Next Paint) : <200ms

**Source** : Chrome UX Report (CrUX) + Lighthouse CI
**Granularité** : Par template de page (homepage, catégorie, produit)

**Alertes** :
- Passage de "Good" à "Needs Improvement"
- Dégradation >20% sur métrique

**KPI** : `cwv-green-pages` : >75%

#### 4. Détection Pages Désindexées (HIGH)

**Surveillance** :
- Pages stratégiques (top 500 par traffic)
- Nouvelles pages (<30j)
- Pages avec backlinks

**Détection** :
- Disparition de l'index
- Tag noindex ajouté par erreur
- Canonical incorrect

**Action** : Alerte IA-CTO + ticket correction

**KPI** : `strategic-pages-indexed` : 100%

#### 5. Analyse Concurrents SEO (MEDIUM)

**Surveillance** :
- Top 5 concurrents
- Nouveaux contenus publiés
- Gains/pertes positions

**Output** :
- Rapport hebdomadaire gap analysis
- Opportunités mots-clés identifiées
- Alertes si concurrent prend position

**KPI** : `competitive-coverage` : >80%

### 3 Workflows Critiques

#### Workflow 1 : Ranking Drop Alert

**Trigger** : Position keyword prioritaire chute >5 places

**Actions** :
1. **Detect** : Scan quotidien positions via API
2. **Analyze** : Cause probable
   - Algo update ? (check Google announcements)
   - Concurrent ? (analyse SERP)
   - Technique ? (check CWV, erreurs)
3. **Alert** :
   ```
   RANKING DROP ALERT

   Keyword: "plaquettes frein clio 4"
   Position: #3 → #9 (-6)
   Traffic impact: -120 visits/day (-€180/day)

   Probable cause: Competitor content update
   Competitor: oscaro.com published new guide

   Recommended action:
   - Update content (add FAQ section)
   - Improve internal linking
   ```
4. **Escalate** : IA-CTO si multiple drops

**SLA** : Détection <4h, alerte <30min

#### Workflow 2 : Indexation Health Check

**Trigger** : Quotidien 6h00

**Actions** :
1. **Fetch** : Google Search Console coverage report
2. **Compare** : vs baseline (semaine précédente)
3. **Identify** : Nouvelles erreurs, pages exclues
4. **Report** :
   ```
   INDEXATION DAILY REPORT

   Status: HEALTHY (98.2% indexed)

   Pages indexed: 45,230 / 46,100
   New indexed (24h): +156
   New errors (24h): 12
   └─ 8x 404 (produits supprimés)
   └─ 4x redirect chains

   Action items:
   - Fix redirect chains → 4 URLs
   - Review excluded pages → 870 pages
   ```
5. **Auto-fix** : Création tickets pour erreurs récurrentes

#### Workflow 3 : CWV Monitoring

**Trigger** : Hebdomadaire + post-déploiement

**Actions** :
1. **Collect** : CrUX data par template
2. **Analyze** : Tendances 4 semaines
3. **Benchmark** : vs concurrents
4. **Report** :
   ```
   CWV WEEKLY REPORT

   Overall: 78% pages green

   By template:
   ├─ Homepage: LCP 1.8s | FID 45ms | CLS 0.02
   ├─ Category: LCP 2.1s | FID 62ms | CLS 0.08
   ├─ Product:  LCP 2.4s | FID 58ms | CLS 0.05
   └─ Cart:     LCP 1.9s | FID 40ms | CLS 0.03

   Alerts:
   - Product pages LCP approaching threshold
   - Recommend: optimize hero images
   ```
5. **Coordinate** : Performance Squad si dégradation

### Implémentation (SeoSentinelService)

```typescript
@Injectable()
export class SeoSentinelService {
  constructor(
    private readonly searchConsole: GoogleSearchConsoleClient,
    private readonly semrush: SemrushApiClient,
    private readonly lighthouse: LighthouseService,
    private readonly alertService: AlertService,
  ) {}

  @Cron('0 6 * * *') // Daily 6am
  async runDailyIndexationCheck(): Promise<IndexationReport> {
    const coverage = await this.searchConsole.getCoverageReport();
    const baseline = await this.getBaseline('indexation', '7d');

    const report: IndexationReport = {
      totalIndexed: coverage.valid,
      totalSubmitted: coverage.total,
      indexRate: coverage.valid / coverage.total,
      newErrors: coverage.errors.filter(e => e.isNew),
      trend: this.calculateTrend(coverage, baseline),
    };

    if (report.indexRate < 0.95) {
      await this.alertService.send({
        type: 'SEO_INDEXATION_DROP',
        severity: 'HIGH',
        data: report,
      });
    }

    return report;
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async checkRankingDrops(): Promise<RankingAlert[]> {
    const keywords = await this.getTrackedKeywords();
    const alerts: RankingAlert[] = [];

    for (const keyword of keywords) {
      const current = await this.semrush.getPosition(keyword);
      const previous = await this.getPreviousPosition(keyword);

      if (previous - current >= 5) {
        const alert: RankingAlert = {
          keyword: keyword.term,
          previousPosition: previous,
          currentPosition: current,
          drop: previous - current,
          probableCause: await this.analyzeDropCause(keyword),
        };
        alerts.push(alert);
        await this.alertService.send({
          type: 'SEO_RANKING_DROP',
          severity: current > 10 ? 'CRITICAL' : 'HIGH',
          data: alert,
        });
      }
    }

    return alerts;
  }

  async getCWVReport(template?: string): Promise<CWVReport> {
    const cruxData = await this.getCrUXData(template);

    return {
      lcp: { value: cruxData.lcp, status: this.getCWVStatus('lcp', cruxData.lcp) },
      fid: { value: cruxData.fid, status: this.getCWVStatus('fid', cruxData.fid) },
      cls: { value: cruxData.cls, status: this.getCWVStatus('cls', cruxData.cls) },
      inp: { value: cruxData.inp, status: this.getCWVStatus('inp', cruxData.inp) },
      greenPagesPercent: this.calculateGreenPages(cruxData),
    };
  }

  private getCWVStatus(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      inp: { good: 200, poor: 500 },
    };
    const t = thresholds[metric];
    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `pages-indexed` | >95% | Taux indexation |
| `ranking-stability` | <5 drops/sem | Drops >5 positions |
| `cwv-green-pages` | >75% | Pages CWV vertes |
| `seo-health-score` | >85/100 | Score santé global |
| `error-detection-time` | <4h | Temps détection erreur |

### Coordination

- **IA-CTO** : Escalade problèmes techniques (404 massifs, redirects)
- **Performance Squad** : Dégradation CWV → optimisation
- **IA-DevOps** : Alertes infrastructure (TTFB, uptime)
- **M1 Ontology** : Enrichissement structured data
- **Growth IA** : Impact SEO sur tests A/B

---

## Agent Voice-of-Customer Miner (VoC Miner)

### Rôle Central

L'**Agent VoC Miner** est l'"Analyste Voix Client" de l'**Intelligence Squad**. Il collecte, analyse et synthétise tous les feedbacks clients (avis, tickets support, emails, réseaux sociaux) pour extraire des insights actionnables. Il agit comme un analyste customer insights disponible 24/7.

**Positionnement Squad** : Intelligence Squad - Specialized Agent
**Budget** : €12K (Dev €10K + NLP APIs €2K)
**ROI** : +€45K/an (amélioration produit, NPS +10 points)

### 5 Responsabilités Clés

#### 1. Collecte Feedbacks Multi-Canal (CRITICAL)

**Sources** :
- Avis produits (site + Google Reviews)
- Tickets support (Zendesk/Freshdesk)
- Emails contacts
- Réseaux sociaux (mentions)
- Enquêtes NPS/CSAT

**Agrégation** :
- Déduplication
- Normalisation format
- Enrichissement client (historique achats)

**KPI** : `feedback-coverage` : >90% sources couvertes

#### 2. Analyse Sentiment NLP (CRITICAL)

**Modèle** : Sentiment analysis FR (CamemBERT ou API)
**Granularité** :
- Global (positif/négatif/neutre)
- Par aspect (livraison, produit, prix, support)

**Output** :
```json
{
  "text": "Livraison rapide mais produit abîmé",
  "global_sentiment": "mixed",
  "aspects": {
    "livraison": { "sentiment": "positive", "score": 0.85 },
    "produit": { "sentiment": "negative", "score": -0.72 }
  }
}
```

**KPI** : `negative-sentiment-rate` : <10%

#### 3. Extraction Thèmes (Topic Modeling) (HIGH)

**Méthode** : LDA/BERTopic clustering
**Output** : Top 10 thèmes par période

**Exemples thèmes** :
- "Délai livraison trop long"
- "Emballage insuffisant"
- "Prix compétitif"
- "Pièce incompatible"

**Usage** : Priorisation améliorations produit

#### 4. Alertes Insatisfaction (HIGH)

**Triggers** :
- Note <3/5
- Sentiment fortement négatif
- Mention "remboursement", "arnaque", "déçu"
- Client VIP mécontent

**Action** :
- Alerte temps réel IA-CRM
- Ticket support prioritaire
- Suggestion réponse personnalisée

**KPI** : `alert-response-time` : <2h

#### 5. Rapport Voice-of-Customer (MEDIUM)

**Fréquence** : Mensuel
**Contenu** :
- Score NPS/CSAT évolution
- Top 5 thèmes positifs/négatifs
- Verbatims marquants
- Recommandations actionnables

**Distribution** : IA-CEO, IA-CPO, IA-CRM

### 3 Workflows Critiques

#### Workflow 1 : Sentiment Alert

**Trigger** : Nouveau feedback score <3/5

**Actions** :
1. **Collect** : Réception feedback
2. **Analyze** : Sentiment + aspects
3. **Enrich** : Profil client (LTV, historique)
4. **Alert** :
   ```
   NEGATIVE FEEDBACK ALERT

   Client: Jean D. (LTV €450, 8 commandes)
   Source: Avis produit
   Rating: 2/5

   "Plaquettes reçues mais ne correspondent pas
   à ma Clio. Pourtant j'ai bien rentré mon
   véhicule. Très déçu."

   Aspects:
   - Produit: NEGATIVE (incompatibilité)
   - Site: NEGATIVE (sélection véhicule)

   Suggested action:
   - Vérifier compatibilité SKU/véhicule
   - Proposer échange gratuit + bon -15%
   ```
5. **Route** : IA-CRM pour action rétention

#### Workflow 2 : Monthly VoC Report

**Trigger** : 1er du mois

**Actions** :
1. **Aggregate** : Tous feedbacks M-1
2. **Analyze** : Tendances, thèmes, scores
3. **Generate** :
   ```
   VOICE OF CUSTOMER REPORT - Décembre 2025

   SCORES
   ├─ NPS: 42 (+3 vs M-1)
   ├─ CSAT: 4.2/5 (+0.1)
   └─ Review avg: 4.3/5 (stable)

   SENTIMENT DISTRIBUTION
   ├─ Positive: 72% (+2%)
   ├─ Neutral: 18% (-1%)
   └─ Negative: 10% (-1%)

   TOP THEMES POSITIFS
   1. Prix compétitifs (234 mentions)
   2. Livraison rapide (198 mentions)
   3. Large choix (156 mentions)

   TOP THEMES NÉGATIFS
   1. Délai livraison Corse/DOM (45 mentions)
   2. Emballage fragile (38 mentions)
   3. Erreur compatibilité (22 mentions)

   RECOMMANDATIONS
   1. [HIGH] Améliorer emballage pièces fragiles
   2. [MEDIUM] Revoir logistique Corse/DOM
   3. [LOW] Clarifier sélection véhicule
   ```
4. **Distribute** : Board + Product team

#### Workflow 3 : Theme Extraction

**Trigger** : Hebdomadaire

**Actions** :
1. **Collect** : Feedbacks 7 derniers jours
2. **Cluster** : BERTopic sur corpus
3. **Label** : Attribution labels humains
4. **Trend** : Comparaison semaines précédentes
5. **Alert** : Si nouveau thème émergent

### Implémentation (VoiceOfCustomerService)

```typescript
@Injectable()
export class VoiceOfCustomerService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly supportRepo: SupportTicketRepository,
    private readonly nlpService: NLPAnalysisService,
    private readonly alertService: AlertService,
  ) {}

  async analyzeFeedback(feedback: Feedback): Promise<FeedbackAnalysis> {
    // 1. Sentiment analysis
    const sentiment = await this.nlpService.analyzeSentiment(feedback.text);

    // 2. Aspect extraction
    const aspects = await this.nlpService.extractAspects(feedback.text);

    // 3. Enrich with customer data
    const customer = await this.getCustomerProfile(feedback.customerId);

    const analysis: FeedbackAnalysis = {
      feedbackId: feedback.id,
      globalSentiment: sentiment.label,
      sentimentScore: sentiment.score,
      aspects,
      customerLTV: customer.ltv,
      isVIP: customer.ltv > 500,
    };

    // 4. Alert if negative + VIP
    if (sentiment.score < -0.5 || (sentiment.label === 'negative' && analysis.isVIP)) {
      await this.triggerNegativeAlert(feedback, analysis);
    }

    return analysis;
  }

  @Cron('0 0 1 * *') // Monthly 1st day
  async generateMonthlyReport(): Promise<VoCReport> {
    const feedbacks = await this.collectMonthlyFeedbacks();
    const analysis = await this.aggregateAnalysis(feedbacks);
    const themes = await this.extractThemes(feedbacks);

    const report: VoCReport = {
      period: this.getCurrentMonth(),
      nps: analysis.nps,
      csat: analysis.csat,
      sentimentDistribution: analysis.sentimentBreakdown,
      topPositiveThemes: themes.filter(t => t.sentiment === 'positive').slice(0, 5),
      topNegativeThemes: themes.filter(t => t.sentiment === 'negative').slice(0, 5),
      recommendations: await this.generateRecommendations(themes),
    };

    await this.distributeReport(report);
    return report;
  }

  private async triggerNegativeAlert(feedback: Feedback, analysis: FeedbackAnalysis): Promise<void> {
    await this.alertService.send({
      type: 'VOC_NEGATIVE_FEEDBACK',
      severity: analysis.isVIP ? 'CRITICAL' : 'HIGH',
      data: {
        feedback,
        analysis,
        suggestedAction: this.suggestAction(feedback, analysis),
      },
    });
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `avg-review-score` | >4.2/5 | Score moyen avis |
| `negative-sentiment-rate` | <10% | Taux sentiment négatif |
| `feedback-response-time` | <24h | Temps réponse feedback |
| `insights-actioned` | >80% | Insights avec action |
| `nps` | >40 | Net Promoter Score |

### Coordination

- **IA-CRM** : Alertes clients VIP, actions rétention
- **IA-CPO** : Feedbacks UX, améliorations produit
- **IA-Sales** : Objections fréquentes
- **Growth IA** : Tests basés sur feedbacks

---

## Agent Analytics (Analytics Agent)

### Rôle Central

L'**Agent Analytics** est le "Data Analyst Conversion" de l'**Intelligence Squad**. Distinct de Growth IA (expérimentation), il se concentre sur la **mesure** : tracking funnel complet, détection abandon panier, cohortes utilisateurs, et attribution marketing. Il fournit les données pour toutes les décisions business.

**Positionnement Squad** : Intelligence Squad - Specialized Agent
**Budget** : €18K (Dev €15K + Analytics tools €3K)
**ROI** : +€80K/an (optimisation funnel +15% conversion)

### Distinction vs Growth IA

| Aspect | Analytics Agent | Growth IA |
|--------|-----------------|-----------|
| **Focus** | Mesure & Reporting | Expérimentation |
| **Output** | Dashboards, alertes | Tests A/B, variants |
| **Question** | "Que se passe-t-il ?" | "Que devons-nous tester ?" |
| **Fréquence** | Temps réel | Campagnes |

### 6 Responsabilités Clés

#### 1. Tracking Funnel Complet (CRITICAL)

**Étapes trackées** :
```
Acquisition → Landing → Browse → Add-to-Cart → Checkout → Payment → Confirmation
    │            │          │         │            │          │           │
    100%        45%        28%       12%          8%         6%          5%
```

**Métriques par étape** :
- Taux de passage
- Temps moyen
- Drop-off reasons

**KPI** : `funnel-completion-rate` : >2.5%

#### 2. Détection Abandon Panier (CRITICAL)

**Définition** : Panier créé sans checkout >60min

**Tracking temps réel** :
- Produits abandonnés (top 10)
- Moment abandon (étape checkout)
- Valeur perdue (€/jour)

**Alertes** :
- Spike abandon >+20% vs baseline
- Abandon checkout paiement (friction technique?)

**KPI** : `cart-abandonment-rate` : <25%

#### 3. Segmentation Comportementale (HIGH)

**Segments automatiques** :
- `first-time-buyer` : 1ère commande
- `repeat-buyer` : 2+ commandes
- `high-value` : Panier >€200
- `abandoner` : Abandons répétés
- `browser` : Visite sans ajout panier

**Usage** : Ciblage marketing, personnalisation

#### 4. Cohortes Utilisateurs (HIGH)

**Analyses cohortes** :
- Rétention par semaine d'acquisition
- LTV par source d'acquisition
- Comportement par device

**Output** :
```
COHORT RETENTION - Semaine 48/2025
        W0    W1    W2    W3    W4
Sem 44  100%  25%   18%   15%   12%
Sem 45  100%  28%   20%   -     -
Sem 46  100%  24%   -     -     -
Sem 47  100%  -     -     -     -
```

#### 5. Attribution Marketing (MEDIUM)

**Modèles** :
- Last-click
- First-click
- Linear
- Time-decay

**Canaux** :
- Organic Search
- Paid Search (Google Ads)
- Social
- Email
- Direct
- Referral

**KPI** : `attribution-accuracy` : >90%

#### 6. Dashboard Conversion Temps Réel (MEDIUM)

**Métriques live** :
- Visiteurs actifs
- Paniers en cours
- Commandes dernière heure
- Revenue today vs yesterday

**Route** : `/admin/ai-cos/analytics`

### 4 Workflows Critiques

#### Workflow 1 : Funnel Analysis Daily

**Trigger** : Quotidien 7h00

**Actions** :
1. **Calculate** : Conversion par étape
2. **Compare** : vs J-1, J-7, M-1
3. **Identify** : Étapes en régression
4. **Report** :
   ```
   FUNNEL DAILY REPORT - 30/12/2025

   Overall Conversion: 2.8% (+0.2% vs J-1)

   Stage Performance:
   ├─ Landing → Browse: 45% (stable)
   ├─ Browse → Cart: 28% (+2%)
   ├─ Cart → Checkout: 65% (-3%)
   └─ Checkout → Complete: 78% (+1%)

   Alerts:
   - Cart → Checkout dropping
   - Possible cause: New shipping options confusing?

   Revenue Impact: -€1,200/day estimated
   ```
5. **Escalate** : Si drop >5% → IA-CPO

#### Workflow 2 : Abandonment Detection

**Trigger** : Temps réel (panier inactif >60min)

**Actions** :
1. **Detect** : Panier sans activité
2. **Classify** : Étape d'abandon
3. **Aggregate** :
   ```
   ABANDONMENT LIVE STATS

   Last hour: 45 carts abandoned
   ├─ At product page: 12 (27%)
   ├─ At cart review: 18 (40%)
   ├─ At shipping: 8 (18%)
   └─ At payment: 7 (15%)

   Top abandoned products:
   1. Kit freins Clio 4 (8x)
   2. Filtre habitacle 207 (6x)
   3. Amortisseurs Golf 7 (5x)

   Value lost: €2,340
   ```
4. **Trigger** : IA-CRM pour email relance

#### Workflow 3 : Cohort Analysis

**Trigger** : Hebdomadaire

**Actions** :
1. **Build** : Matrices cohortes
2. **Calculate** : Rétention, LTV par cohorte
3. **Identify** : Cohortes performantes vs sous-performantes
4. **Recommend** : Ajustements acquisition

#### Workflow 4 : Attribution Report

**Trigger** : Mensuel

**Actions** :
1. **Collect** : Touchpoints tous parcours
2. **Apply** : Modèles attribution
3. **Compare** : Last-click vs Linear vs Time-decay
4. **Report** : ROI réel par canal

### Implémentation (AnalyticsAgentService)

```typescript
@Injectable()
export class AnalyticsAgentService {
  constructor(
    private readonly cartAnalytics: CartAnalyticsService,
    private readonly funnelService: FunnelTrackingService,
    private readonly cohortService: CohortAnalysisService,
    private readonly attributionService: AttributionService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 7 * * *') // Daily 7am
  async generateDailyFunnelReport(): Promise<FunnelReport> {
    const today = await this.funnelService.calculateFunnel('today');
    const yesterday = await this.funnelService.calculateFunnel('yesterday');
    const weekAgo = await this.funnelService.calculateFunnel('-7d');

    const report: FunnelReport = {
      date: new Date(),
      stages: today.stages.map((stage, i) => ({
        name: stage.name,
        rate: stage.rate,
        change: {
          vsYesterday: stage.rate - yesterday.stages[i].rate,
          vsWeekAgo: stage.rate - weekAgo.stages[i].rate,
        },
      })),
      overallConversion: today.overallRate,
      alerts: this.detectAnomalies(today, yesterday),
    };

    if (report.alerts.length > 0) {
      await this.escalateAlerts(report.alerts);
    }

    return report;
  }

  async getAbandonmentStats(period: string = '1h'): Promise<AbandonmentStats> {
    const stats = await this.cartAnalytics.getAbandonmentRate(period);
    const products = await this.cartAnalytics.getTopAbandonedProducts(10);

    return {
      period,
      totalAbandoned: stats.abandoned,
      byStage: await this.cartAnalytics.getAbandonmentByStage(),
      topProducts: products,
      valueLost: stats.totalValue,
      abandonmentRate: stats.rate,
    };
  }

  async buildCohortMatrix(
    metric: 'retention' | 'ltv',
    groupBy: 'week' | 'month',
  ): Promise<CohortMatrix> {
    const cohorts = await this.cohortService.getCohorts(groupBy);

    return cohorts.map(cohort => ({
      cohortPeriod: cohort.period,
      size: cohort.users,
      values: await this.cohortService.calculateMetric(cohort, metric),
    }));
  }

  getLiveStats(): Observable<LiveStats> {
    return interval(5000).pipe(
      switchMap(() => this.calculateLiveStats()),
    );
  }

  private async calculateLiveStats(): Promise<LiveStats> {
    const [visitors, carts, orders, revenue] = await Promise.all([
      this.redis.get('analytics:visitors:active'),
      this.redis.get('analytics:carts:active'),
      this.redis.get('analytics:orders:today'),
      this.redis.get('analytics:revenue:today'),
    ]);

    return {
      activeVisitors: parseInt(visitors) || 0,
      activeCarts: parseInt(carts) || 0,
      ordersToday: parseInt(orders) || 0,
      revenueToday: parseFloat(revenue) || 0,
    };
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `cart-abandonment-rate` | <25% | Taux abandon panier |
| `checkout-conversion` | >3.5% | Conversion checkout |
| `funnel-completion-rate` | >2.5% | Taux conversion global |
| `attribution-accuracy` | >90% | Précision attribution |
| `data-freshness` | <5min | Fraîcheur données live |

### Coordination

- **Growth IA** : Fournit données pour tests A/B
- **IA-CRM** : Déclenche relances abandon
- **IA-CFO** : Reporting revenue, ROI canaux
- **IA-CPO** : Alertes UX funnel

---

## Agent Pricing & Stock Intelligence (Pricing Intel)

### Rôle Central

L'**Agent Pricing Intel** est l'"Analyste Prix & Marges" de l'**E-Commerce Squad**. Il surveille en permanence les marges par produit/catégorie, détecte les anomalies de pricing, et corrèle stock/prix pour optimiser la rentabilité. Il agit comme un contrôleur de gestion e-commerce disponible 24/7.

> ⚠️ **VERROUILLAGE v3.9.0** : Le Pricing Engine RECOMMANDE, jamais ne DÉCIDE.
> Voir [Governance Rules - Pricing Engine Verrouillage](../features/ai-cos-governance-rules.md#pricing-engine--verrouillage)

**Positionnement Squad** : E-Commerce Squad - Specialized Agent
**Budget** : €20K (Dev €16K + Monitoring tools €4K)
**ROI** : +€100K/an (optimisation marges +5%, évitement pertes)

### Règle Cardinale Pricing [NOUVEAU v3.9.0]

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRICING ENGINE - VERROUILLAGE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ❗ AUCUN PRIX NE CHANGE SANS SEUIL HUMAIN DÉFINI                  │
│                                                                      │
│   Règles absolues :                                                  │
│   1. Changement > 5% → Validation humaine obligatoire               │
│   2. Marge < 20% → Alerte immédiate IA-CFO                          │
│   3. Marge < 15% → Blocage automatique + validation CEO             │
│   4. Marge négative → Blocage vente INSTANTANÉ                      │
│   5. Changements massifs (>100 SKUs/jour) → Validation CFO          │
│                                                                      │
│   Le Pricing Engine RECOMMANDE, jamais ne DÉCIDE                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5 Responsabilités Clés

#### 1. Surveillance Marges par Catégorie (CRITICAL)

**Calcul marge** :
```
Marge % = (Prix vente - Prix achat - Frais) / Prix vente × 100
```

**Granularité** :
- Par produit (SKU)
- Par catégorie (gamme/sous-gamme)
- Par fournisseur
- Par période (tendance)

**Seuils** :
- Marge cible : 25-35%
- Alerte : <20%
- Critique : <15%

**KPI** : `avg-margin` : >25%

#### 2. Alertes Marge Négative/Faible (CRITICAL)

**Détection automatique** :
- Marge négative (vente à perte)
- Marge <15% (seuil critique)
- Chute marge >10pts en 7j

**Causes analysées** :
- Prix achat augmenté (fournisseur)
- Prix vente baissé (promo/erreur)
- Frais augmentés (transport)

**Action** :
- Alerte immédiate IA-CFO
- Blocage vente si marge négative (optionnel)
- Suggestion nouveau prix

**KPI** : `negative-margin-products` : 0

#### 3. Pricing Concurrentiel (HIGH)

**Sources** :
- Scraping prix concurrents (Oscaro, Mister Auto, etc.)
- Google Shopping
- Marketplaces (Amazon, Cdiscount)

**Analyse** :
- Position prix (moins cher, moyen, plus cher)
- Écart % vs concurrent le moins cher
- Tendances prix marché

**KPI** : `price-competitiveness-score` : >85%

#### 4. Recommandations Prix Dynamiques (HIGH)

**Facteurs** :
- Marge actuelle vs cible
- Position concurrentielle
- Stock disponible
- Demande (vélocité vente)
- Saisonnalité

**Output** :
```json
{
  "sku": "PLAQ-BOSCH-123",
  "current_price": 45.90,
  "recommended_price": 48.50,
  "reason": "Marge faible + stock bas + demande haute",
  "expected_margin_change": "+4pts",
  "expected_volume_change": "-3%",
  "net_impact": "+€1,200/mois"
}
```

#### 5. Corrélation Stock ↔ Prix (MEDIUM)

**Logique** :
- Stock bas + demande haute → Prix peut monter
- Stock haut + demande basse → Prix doit baisser
- Rupture imminente → Alerte IA-Stock

**Dashboard** :
- Matrice Stock/Marge par catégorie
- Produits à risque (stock bas, marge haute)
- Opportunités (stock haut, marge faible)

**KPI** : `stock-availability` : >95%

### 3 Workflows Critiques

#### Workflow 1 : Margin Alert

**Trigger** : Marge produit <15% ou négative

**Actions** :
1. **Detect** : Scan quotidien marges
2. **Analyze** : Cause (achat/vente/frais)
3. **Alert** :
   ```
   MARGIN ALERT - CRITICAL

   Product: PLAQ-BOSCH-123 (Plaquettes Bosch)
   Category: Freinage > Plaquettes

   Current margin: 8.5% (target: 25%)

   Analysis:
   ├─ Purchase price: €32.00 (+15% vs M-1)
   ├─ Selling price: €38.90 (unchanged)
   ├─ Shipping cost: €3.50 (unchanged)
   └─ Cause: Supplier price increase

   Recommended actions:
   1. Increase price to €44.90 (+15%)
   2. Or: Negotiate with supplier
   3. Or: Switch to alternative supplier

   Impact if unchanged: -€450/month loss
   ```
4. **Escalate** : IA-CFO pour décision

#### Workflow 2 : Price Recommendation

**Trigger** : Hebdomadaire + sur demande

**Actions** :
1. **Collect** : Prix actuels, coûts, concurrence
2. **Analyze** : Gap vs optimal
3. **Generate** :
   ```
   PRICE RECOMMENDATIONS - Week 52

   Total products analyzed: 4,200
   Recommendations generated: 312

   By type:
   ├─ Price increase: 156 products (+€8,400/mois)
   ├─ Price decrease: 89 products (-€2,100/mois but +18% volume)
   └─ No change: 67 products

   Top 10 high-impact:
   1. Kit embrayage 206 : €289 → €319 (+€3,200/mois)
   2. Amortisseurs Golf : €89 → €99 (+€1,800/mois)
   ...

   Expected net impact: +€12,500/month
   ```
4. **Route** : IA-CFO validation, puis auto-apply si approuvé

#### Workflow 3 : Stock-Price Correlation

**Trigger** : Quotidien

**Actions** :
1. **Build** : Matrice Stock × Marge × Demande
2. **Identify** :
   - Opportunités : Stock haut, marge ok, demande basse → Promo
   - Risques : Stock bas, marge haute, demande haute → Réappro urgent
3. **Report** :
   ```
   STOCK-PRICE MATRIX

   Quadrant Analysis (4,200 SKUs):

   ┌─────────────────┬─────────────────┐
   │   LIQUIDATE     │   MAINTAIN      │
   │   Stock↑ Margin↓│   Stock↑ Margin↑│
   │   234 SKUs      │   1,890 SKUs    │
   │   Action: Promo │   Action: None  │
   ├─────────────────┼─────────────────┤
   │   URGENT RESTOCK│   PREMIUM PRICE │
   │   Stock↓ Margin↓│   Stock↓ Margin↑│
   │   156 SKUs      │   320 SKUs      │
   │   Action: Order │   Action: +Price│
   └─────────────────┴─────────────────┘

   Alerts sent: 45 (urgent restock)
   Recommendations: 89 (price adjustments)
   ```
4. **Coordinate** : IA-Stock pour réappro

### Implémentation (PricingIntelService)

```typescript
@Injectable()
export class PricingIntelService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly marginCalc: MarginCalculationService,
    private readonly competitorService: CompetitorPriceService,
    private readonly stockService: StockManagementService,
    private readonly alertService: AlertService,
  ) {}

  @Cron('0 5 * * *') // Daily 5am
  async runDailyMarginCheck(): Promise<MarginReport> {
    const products = await this.productRepo.findAll();
    const alerts: MarginAlert[] = [];

    for (const product of products) {
      const margin = await this.marginCalc.calculate(product);

      if (margin.percent < 0) {
        alerts.push({
          sku: product.sku,
          margin: margin.percent,
          severity: 'CRITICAL',
          cause: await this.analyzeMarginDrop(product),
        });
      } else if (margin.percent < 15) {
        alerts.push({
          sku: product.sku,
          margin: margin.percent,
          severity: 'HIGH',
          cause: await this.analyzeMarginDrop(product),
        });
      }
    }

    if (alerts.length > 0) {
      await this.sendMarginAlerts(alerts);
    }

    return {
      totalProducts: products.length,
      avgMargin: this.calculateAvgMargin(products),
      alerts,
    };
  }

  async generatePriceRecommendations(): Promise<PriceRecommendation[]> {
    const products = await this.productRepo.findAll();
    const recommendations: PriceRecommendation[] = [];

    for (const product of products) {
      const current = await this.getCurrentPricing(product);
      const competitor = await this.competitorService.getBestPrice(product.sku);
      const stock = await this.stockService.getLevel(product.sku);
      const demand = await this.getDemandVelocity(product.sku);

      const optimal = this.calculateOptimalPrice({
        currentPrice: current.price,
        purchasePrice: current.cost,
        competitorPrice: competitor?.price,
        stockLevel: stock.quantity,
        demandVelocity: demand,
        targetMargin: 0.25,
      });

      if (Math.abs(optimal - current.price) / current.price > 0.05) {
        recommendations.push({
          sku: product.sku,
          currentPrice: current.price,
          recommendedPrice: optimal,
          expectedImpact: this.calculateImpact(product, current.price, optimal),
        });
      }
    }

    return recommendations.sort((a, b) => b.expectedImpact.revenue - a.expectedImpact.revenue);
  }

  async getStockPriceMatrix(): Promise<StockPriceMatrix> {
    const products = await this.productRepo.findAll();

    const matrix = {
      liquidate: [],    // High stock, low margin
      maintain: [],     // High stock, high margin
      urgentRestock: [], // Low stock, low margin
      premiumPrice: [], // Low stock, high margin
    };

    for (const product of products) {
      const stock = await this.stockService.getLevel(product.sku);
      const margin = await this.marginCalc.calculate(product);

      const quadrant = this.classifyQuadrant(stock.daysOfStock, margin.percent);
      matrix[quadrant].push({
        sku: product.sku,
        stock: stock.quantity,
        daysOfStock: stock.daysOfStock,
        margin: margin.percent,
        recommendedAction: this.getQuadrantAction(quadrant),
      });
    }

    return matrix;
  }

  private classifyQuadrant(daysOfStock: number, margin: number): string {
    const highStock = daysOfStock > 60;
    const highMargin = margin > 20;

    if (highStock && !highMargin) return 'liquidate';
    if (highStock && highMargin) return 'maintain';
    if (!highStock && !highMargin) return 'urgentRestock';
    return 'premiumPrice';
  }
}
```

### KPIs & Impact

| KPI | Cible | Description |
|-----|-------|-------------|
| `avg-margin` | >25% | Marge moyenne |
| `negative-margin-products` | 0 | Produits marge négative |
| `price-competitiveness-score` | >85% | Score compétitivité prix |
| `stock-availability` | >95% | Disponibilité stock |
| `price-recommendation-accuracy` | >80% | Précision recommandations |

### Coordination

- **IA-CFO** : Validation prix, alertes marges critiques
- **IA-Stock** : Corrélation stock/prix, alertes rupture
- **IA-Merch** : Bundles, promotions stock haut
- **Growth IA** : Tests prix
- **Supplier Scorer** : Négociation fournisseurs

### Extension FinOps (G5)

**Cloud Cost Monitoring** :
- Tracking coûts temps réel : Supabase, Vercel, Docker Hub
- Budget alerts : Notification si >110% budget mensuel
- Resource usage : CPU/RAM/Storage par service
**KPI** : `cloud-cost-budget` : <€500/mois

**Optimisation Ressources** :
| Ressource | Monitoring | Alerte |
|-----------|------------|--------|
| Supabase DB | Rows count, Storage | >80% quota |
| Vercel Functions | Invocations, Bandwidth | >90% usage |
| CDN | Bandwidth, Cache hit | Cache <80% |

### Extension Cost-Performance (G15)

**Cost per Request Tracking** :
```typescript
const costMetrics = {
  avgCostPerRequest: 0.0012,  // €
  avgCostPerOrder: 0.45,       // €
  apiCallsPerOrder: 12,
  cacheHitRate: 0.85           // Objectif >80%
};
```

**Performance/Cost Ratio** :
- Target : Latency P95 <200ms pour coût <€0.002/req
- Alerte si ratio dégradé >20%

**Optimization Recommendations** :
- Cache miss élevé → Ajuster TTL Redis
- Coût DB élevé → Optimiser requêtes N+1
- Bandwidth → Compresser images, lazy loading

**KPIs additionnels** :
| KPI | Cible | Description |
|-----|-------|-------------|
| `cost-per-request` | <€0.002 | Coût moyen requête |
| `cost-per-order` | <€0.50 | Coût moyen commande |
| `cloud-efficiency` | >85% | Ratio perf/coût |

---

## Agent Ontology Extractor (M1)

### Rôle Central

L'**M1** (Ontology Extractor) est un **Agent Métier du Data Squad**, expert en modélisation du domaine auto-pièces. Il construit et maintient l'ontologie métier : vocabulaire, hiérarchies, relations sémantiques.

**Positionnement Squad** : Data Squad - Agent Métier Python
**Budget** : €15K
**ROI** : Amélioration SEO +€50K/an, réduction erreurs catalogue -€30K/an

### 5 Responsabilités Clés

#### 1. Extraction Vocabulaire Métier (CRITICAL)

**Sources analysées** :
- Tables Supabase : `__gammes`, `__sssgammes`, `__products`, `__product_families`
- Code TypeScript : enums, types, interfaces du catalogue
- Fichiers SEO : meta descriptions, titres, slugs

**Output** : Dictionnaire métier unifié (FR/technique/synonymes)

```typescript
interface VocabularyEntry {
  term: string;           // "plaquettes de frein"
  technical_code: string; // "BRAKE_PAD"
  synonyms: string[];     // ["garniture", "patin"]
  category_path: string;  // "freinage/disques-plaquettes/plaquettes"
}
```

#### 2. Construction Hiérarchie Catégories

**Niveaux** :
```
Gamme (niveau 1)
└── Sous-gamme (niveau 2)
    └── Sous-sous-gamme (niveau 3)
        └── Produit (niveau 4)
```

**Validation** :
- Pas de catégorie orpheline
- Profondeur max = 4 niveaux
- Chaque produit a un chemin complet

#### 3. Relations Sémantiques

**Types de relations** :
| Relation | Exemple |
|----------|---------|
| `compatible_avec` | Disques ↔ Plaquettes |
| `remplace` | Ancienne réf → Nouvelle réf |
| `équivalent` | OEM → Aftermarket |
| `accessoire_de` | Kit montage → Pièce principale |

#### 4. Synchronisation Catalogue

**Workflow quotidien** (cron 2h) :
1. Scan nouvelles entrées catalogue
2. Classification automatique (ML)
3. Enrichissement vocabulaire
4. Validation cohérence hiérarchie

#### 5. Export Knowledge Graph

**Formats** :
- JSON-LD (SEO structured data)
- Neo4j (graphe relations)
- Elasticsearch (search index)

#### 6. Intent Extraction & Naming Conventions

**Intent Extraction** :
- Analyse requêtes utilisateurs → intentions
- Mapping intention → catégorie produit
- Enrichissement search synonymes

**Naming Convention Enforcement** :

| Élément | Convention | Exemple |
|---------|------------|---------|
| Tables | snake_case pluriel | `__products`, `__orders` |
| DTO | PascalCase + suffixe | `ProductResponseDto` |
| Services | PascalCase + Service | `ProductDataService` |
| Routes | kebab-case | `/api/products/{id}` |

**Gate** : 🟠 Nommage incohérent → warning pré-commit

**Traceability Audit** :
- Story → Code → Test linkage
- Coverage story/endpoint : >90%

**KPI** : `naming-compliance` : >95%

### Output JSON

```typescript
interface OntologyResult {
  vocabulary_count: number;      // 15000+ termes
  categories_count: number;      // 180 gammes
  relations_count: number;       // 50000+ relations
  orphan_products: string[];     // Produits sans catégorie
  duplicate_terms: string[];     // Termes en doublon
  coverage_percent: number;      // 98.5%
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `ontology-coverage` | >98% | Produits avec catégorie complète |
| `vocabulary-completeness` | >95% | Termes avec synonymes |
| `relation-accuracy` | >99% | Relations validées |
| `orphan-products` | <50 | Produits sans classification |
| `naming-compliance` | >95% | Respect conventions nommage |

### Intégration Agents

```
M1 ──► IA-SEO : Structured data enrichi
   ├──► IA-Merch : Relations cross-sell
   ├──► M5 : Validation SKU/catégories
   └──► IA-CEO : Rapport Data Health
```

---

## Agent Workflow Métier (M2)

### Rôle Central

L'**M2** (Workflow Métier) est un **Agent Métier du E-Commerce Squad**, gardien de la cohérence des processus métier. Il surveille le flux Panier→Commande→Paiement→Stock→Expédition→Facture.

**Positionnement Squad** : E-Commerce Squad - Agent Métier
**Budget** : €12K
**ROI** : Réduction litiges -€40K/an, détection fraude -€20K/an

### 5 Responsabilités Clés

#### 1. Validation États Commande (CRITICAL)

**Machine à états** :
```
PANIER (1) → VALIDÉ (2) → PAYÉ (3) → PRÉPARÉ (4) → EXPÉDIÉ (5) → LIVRÉ (6)
                      ↓
                   ANNULÉ (7)
                   REMBOURSÉ (8)
```

**Règles** :
- Transition 2→3 : Paiement confirmé obligatoire
- Transition 3→4 : Stock réservé obligatoire
- Transition 4→5 : Numéro tracking obligatoire

#### 2. Détection Anomalies Process

**Alertes temps réel** :
| Anomalie | Seuil | Action |
|----------|-------|--------|
| Commande bloquée >24h | status=2 | Alerte IA-Sales |
| Paiement non confirmé >1h | status=2+payment_pending | Relance client |
| Stock négatif | qty<0 | Blocage commande |
| Expédition sans tracking | status=5+no_tracking | Alerte logistique |

#### 3. Audit Trail Complet

**Événements tracés** :
```typescript
interface AuditEvent {
  order_id: string;
  timestamp: Date;
  event_type: 'status_change' | 'payment' | 'stock' | 'shipping';
  old_value: any;
  new_value: any;
  actor: string;  // user_id ou 'system'
}
```

**Rétention** : 7 ans (conformité fiscale)

#### 4. SLA Monitoring

**SLAs par statut** :
| Transition | SLA | Alerte |
|------------|-----|--------|
| Panier → Validé | N/A | Abandon >1h → IA-CRM |
| Validé → Payé | <30min | >1h → Relance |
| Payé → Préparé | <4h | >8h → IA-Stock |
| Préparé → Expédié | <24h | >48h → IA-Transport |

#### 5. Rapports Cohérence

**Dashboard** : `/admin/ai-cos/workflow-health`

**Métriques** :
- Commandes en anomalie (%)
- Temps moyen par étape
- Taux conversion panier
- Violations SLA/jour

### Output JSON

```typescript
interface WorkflowHealthResult {
  orders_in_anomaly: number;
  sla_violations_24h: number;
  avg_order_completion_time: number;  // minutes
  blocked_orders: OrderAnomaly[];
  audit_events_24h: number;
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `order-anomaly-rate` | <2% | Commandes en état incohérent |
| `sla-compliance` | >95% | Respect SLA par étape |
| `order-completion-time` | <48h | Panier → Livré |
| `audit-coverage` | 100% | Événements tracés |

### Intégration Agents

```
M2 ──► IA-Stock : Alertes stock négatif
   ├──► IA-Transport : Violations SLA expédition
   ├──► IA-CRM : Abandons panier
   └──► IA-CFO : Rapport anomalies financières
```

---

## Agent Règles Métier Dynamiques (M3)

### Rôle Central

L'**M3** (Règles Métier) est un **Agent Métier du Tech Squad**, synchroniseur des règles entre code et catalogue. Il détecte les conflits entre validateurs TypeScript et règles catalogue.

**Positionnement Squad** : Tech Squad - Agent Métier
**Budget** : €10K
**ROI** : Réduction bugs métier -€35K/an, cohérence catalogue +€25K/an

### 5 Responsabilités Clés

#### 1. Extraction Règles Code (CRITICAL)

**Sources analysées** :
```typescript
// Validators Zod
const orderSchema = z.object({
  min_amount: z.number().min(15),  // Règle: commande min €15
  max_items: z.number().max(100),  // Règle: max 100 articles
});

// Guards NestJS
@MinOrderAmount(15)
@MaxCartItems(100)

// Enums/Constants
const DELIVERY_ZONES = ['FR', 'BE', 'CH'];  // Règle: zones livraison
```

#### 2. Extraction Règles Catalogue

**Tables Supabase** :
- `__business_rules` : Règles explicites
- `__product_constraints` : Contraintes produits
- `__shipping_rules` : Règles livraison
- `__pricing_rules` : Règles tarification

#### 3. Détection Conflits

**Types de conflits** :
| Type | Exemple | Sévérité |
|------|---------|----------|
| Valeur différente | Code: min€15, Catalogue: min€20 | HIGH |
| Règle orpheline | Code seulement, pas catalogue | MEDIUM |
| Règle obsolète | Catalogue seulement, code supprimé | LOW |

#### 4. Versioning Règles

**Historique complet** :
```typescript
interface RuleVersion {
  rule_id: string;
  version: number;
  value: any;
  source: 'code' | 'catalog';
  changed_by: string;
  changed_at: Date;
  reason: string;
}
```

#### 5. Synchronisation Automatique

**Workflow** :
1. Scan code (AST parsing) → Extraction règles
2. Scan catalogue (Supabase) → Extraction règles
3. Diff → Détection conflits
4. Rapport → IA-CTO + IA-CPO
5. Auto-fix (optionnel) → Mise à jour catalogue

### Output JSON

```typescript
interface RulesHealthResult {
  rules_in_code: number;
  rules_in_catalog: number;
  conflicts: RuleConflict[];
  orphan_rules: string[];
  sync_coverage: number;  // 0-100%
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `rules-sync-rate` | >95% | Règles synchronisées |
| `conflict-count` | 0 | Conflits actifs |
| `orphan-rules` | <10 | Règles sans correspondance |
| `rule-coverage` | 100% | Domaines couverts |

### Intégration Agents

```
M3 ──► IA-CTO : Conflits code détectés
   ├──► IA-CPO : Règles UX incohérentes
   ├──► IA-Legal : Règles conformité
   └──► M4 : Validation data vs règles
```

---

## Agent Data Sanity (M4)

### Rôle Central

L'**M4** (Data Sanity) est un **Agent Métier du Data Squad**, gardien de l'intégrité des données. Il vérifie la cohérence entre Supabase, Redis et les contraintes métier.

**Positionnement Squad** : Data Squad - Agent Métier
**Budget** : €18K
**ROI** : Réduction erreurs data -€60K/an, conformité RGPD +€40K/an

### 5 Responsabilités Clés

#### 1. Vérification Intégrité Référentielle (CRITICAL)

**Contrôles FK** :
```sql
-- Commandes avec client inexistant
SELECT * FROM __orders o
WHERE NOT EXISTS (SELECT 1 FROM __users u WHERE u.id = o.user_id);

-- Produits avec catégorie inexistante
SELECT * FROM __products p
WHERE NOT EXISTS (SELECT 1 FROM __gammes g WHERE g.id = p.gamme_id);
```

#### 2. Détection Orphelins

**Tables surveillées** :
| Table | FK | Action |
|-------|-----|--------|
| `__orders` | user_id | Alerte si orphelin |
| `__order_items` | order_id, product_id | Suppression auto |
| `__cart_items` | cart_id, product_id | Cleanup 7j |
| `__payments` | order_id | Alerte critique |

#### 3. Sync Redis ↔ PostgreSQL

**Caches vérifiés** :
```typescript
// Sessions utilisateur
redis.get(`session:${userId}`) === supabase.from('sessions')

// Paniers
redis.get(`cart:${cartId}`) === supabase.from('carts')

// Stock temps réel
redis.get(`stock:${productId}`) === supabase.from('inventory')
```

**Réconciliation** : Quotidienne 3h00

#### 4. Data Quality Score

**Formule** :
```
DQ_Score = (
  completeness * 0.30 +    // Champs requis remplis
  accuracy * 0.25 +        // Formats corrects
  consistency * 0.25 +     // FK valides
  timeliness * 0.20        // Données à jour
) * 100
```

**Cible** : >95/100

#### 5. RGPD Compliance

**Contrôles** :
- Données personnelles chiffrées
- Logs d'accès
- Droit à l'oubli (anonymisation)
- Rétention conforme (7 ans fiscal)

### Output JSON

```typescript
interface DataSanityResult {
  orphan_records: OrphanRecord[];
  fk_violations: number;
  redis_sync_drift: number;      // Records désynchronisés
  data_quality_score: number;    // 0-100
  rgpd_compliance: boolean;
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `data-quality-score` | >95 | Score qualité global |
| `orphan-records` | <100 | Enregistrements orphelins |
| `redis-sync-drift` | <0.1% | Désync Redis/PostgreSQL |
| `rgpd-compliance` | 100% | Conformité RGPD |

### Intégration Agents

```
M4 ──► IA-DevOps : Alertes sync Redis
   ├──► IA-Legal : Rapport RGPD
   ├──► IA-CEO : Data Health Score
   └──► M3 : Validation règles vs data
```

---

## Agent Mapping Produit ↔ Données (M5)

### Rôle Central

L'**M5** (Mapping Produit) est un **Agent Métier du E-Commerce Squad**, expert en cohérence catalogue. Il valide les SKU, mappings véhicules et URLs SEO.

**Positionnement Squad** : E-Commerce Squad - Agent Métier
**Budget** : €12K
**ROI** : Réduction retours -€45K/an, amélioration SEO +€35K/an

### 5 Responsabilités Clés

#### 1. Validation SKU Unique (CRITICAL)

**Règles** :
```typescript
interface SKUValidation {
  format: /^[A-Z0-9]{6,20}$/;     // Alphanumérique 6-20 chars
  unique: true;                    // Pas de doublon
  prefix_valid: ['AM', 'OE', 'AF']; // Prefixes autorisés
}
```

**Détection doublons** :
- Même SKU, produits différents → CRITICAL
- SKU similaires (<3 chars diff) → WARNING

#### 2. Mapping Produit ↔ Véhicule

**Table** : `__product_vehicles` (N:N)

**Validation** :
```sql
-- Produit sans véhicule compatible
SELECT * FROM __products p
WHERE NOT EXISTS (
  SELECT 1 FROM __product_vehicles pv WHERE pv.product_id = p.id
);

-- Véhicule inconnu
SELECT * FROM __product_vehicles pv
WHERE NOT EXISTS (
  SELECT 1 FROM __vehicles v WHERE v.id = pv.vehicle_id
);
```

#### 3. Cohérence URLs SEO

**Règles URL** :
```typescript
// Format attendu
/pieces/{gamme-slug}/{sssgamme-slug}/{product-slug}

// Validations
// - slug unique
// - pas de caractères spéciaux
// - lowercase
// - tirets (pas underscores)
// - max 100 chars
```

**Détection 404** :
- URL existante → Produit supprimé
- URL modifiée → Redirect 301 manquant

#### 4. Détection Doublons Références

**Critères doublon** :
| Critère | Seuil | Action |
|---------|-------|--------|
| Même OEM ref | Exact | Merge automatique |
| Même EAN | Exact | Alerte critique |
| Titre similaire | >90% | Review manuel |
| Description similaire | >85% | Suggestion merge |

#### 5. Enrichissement Données Manquantes

**Champs requis** :
- `sku` (obligatoire)
- `ean` (recommandé)
- `oem_ref` (recommandé)
- `description` (obligatoire)
- `vehicle_compatibility` (obligatoire)
- `seo_url` (auto-généré)

### Output JSON

```typescript
interface MappingResult {
  sku_duplicates: string[];
  orphan_products: string[];       // Sans véhicule
  broken_seo_urls: string[];
  missing_ean: number;
  duplicate_candidates: DuplicatePair[];
  coverage_score: number;          // 0-100%
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `sku-uniqueness` | 100% | Pas de SKU en doublon |
| `vehicle-coverage` | >95% | Produits avec véhicule |
| `seo-url-validity` | 100% | URLs valides |
| `ean-coverage` | >80% | Produits avec EAN |

### Intégration Agents

```
M5 ──► IA-SEO : URLs invalides, redirects
   ├──► IA-Merch : Doublons à merger
   ├──► M1 : Ontologie catégories
   └──► IA-Stock : Produits sans stock mappé
```

---

## Dashboards Business Squad

| Route | Description |
|-------|-------------|
| `/admin/ai-cos/growth` | Dashboard Growth IA A/B Tests |
| `/admin/ai-cos/crm` | Dashboard CRM & Loyalty |
| `/admin/ai-cos/sales` | Dashboard Sales Coach |
| `/admin/ai-cos/merch` | Dashboard IA-Merch Cross-sell |
| `/admin/ai-cos/seo-sentinel` | Dashboard SEO Health & Indexation |
| `/admin/ai-cos/voc` | Dashboard Voice-of-Customer |
| `/admin/ai-cos/analytics` | Dashboard Analytics & Conversion |
| `/admin/ai-cos/pricing-intel` | Dashboard Pricing & Margins |
| `/admin/ai-cos/workflow-health` | Santé Workflow Métier |

---

## KPIs Globaux Business Squad

| KPI | Cible | Agent |
|-----|-------|-------|
| `conversion-rate` | >3.5% | Growth IA |
| `aov` | >€180 | IA-Merch |
| `cart-abandonment` | <25% | M2, Analytics |
| `nps` | >50 | IA-CRM |
| `cltv` | >€500 | IA-CRM |
| `churn-rate` | <5% | IA-CRM |
| `data-quality-score` | >95 | M4 |
| `pages-indexed` | >95% | SEO Sentinel |
| `cwv-green-pages` | >75% | SEO Sentinel |
| `ranking-stability` | <5 drops/sem | SEO Sentinel |
| `avg-review-score` | >4.2/5 | VoC Miner |
| `negative-sentiment-rate` | <10% | VoC Miner |
| `funnel-completion-rate` | >2.5% | Analytics |
| `attribution-accuracy` | >90% | Analytics |
| `avg-margin` | >25% | Pricing Intel |
| `price-competitiveness` | >85% | Pricing Intel |
| `stock-availability` | >95% | Pricing Intel |

---

## Liens Documentation

- [AI-COS Index](./ai-cos-index.md) - Navigation principale
- [Tech Squad](./ai-cos-tech-squad.md) - 10 agents techniques
- [Strategy Squad](./ai-cos-strategy-squad.md) - 7 agents stratégie
- [Ops Squad](./ai-cos-ops-squad.md) - 4 agents opérations
- [Perf & Expansion](./ai-cos-perf-expansion.md) - 30 agents transversaux
- [Quality Squad](./ai-cos-quality-squad.md) - 4 agents qualité
- [CHANGELOG](./CHANGELOG-ai-cos.md) - Historique versions
