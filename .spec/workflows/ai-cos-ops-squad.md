# AI-COS Ops Squad

**Operations Squad** - Logistique, Stock et Transport

---

## Vue d'ensemble

L'**Ops Squad** gère l'ensemble de la chaîne logistique : prévision des stocks, optimisation du transport, gestion des douanes import/export, et capital humain.

### Composition

| Agent | Budget | Rôle Principal |
|-------|--------|----------------|
| IA-Stock | €35K | Stock Forecaster ML |
| IA-Transport | €30K | Transport Optimizer |
| G10 | €5K | Chaos Lite (Resilience) |
| G17 | €5K | Incident Coach (Post-mortems) |
| IA-Customs | €25K | Import/Export Manager |
| IA-HR | €28K | Ressources Humaines |

**Budget Total** : €128K
**ROI Annuel** : +€460K/an

---

## Agent Stock Forecaster (IA-Stock)

### Rôle Spécialisé

L'**IA-Stock** est le "Prédicteur Logistique" de l'**E-Commerce Squad**. Il analyse l'historique des ventes, la saisonnalité, et les tendances marché pour anticiper les ruptures de stock et les surstocks. Il est la clé d'un inventaire optimisé qui maximise la disponibilité tout en minimisant les coûts de stockage.

**Positionnement** : Specialized Agent (E-Commerce Squad)
**Budget** : €35K (Dev €28K + ML €7K)
**ROI** : +€120K/an (réduction ruptures -60% + liquidation surstocks)

### 5 Responsabilités Clés

#### 1. Demand Forecasting ML (CRITICAL)

**Algorithme** : Prophet/ARIMA + Features saisonnières + Météo
**Granularité** : Par catégorie produit + Top 200 SKUs individuels
**Horizon** : J+7, J+14, J+30, J+90
**Précision cible** : MAPE <15% (Mean Absolute Percentage Error)

**KPI** : `forecast-accuracy` : >85%

#### 2. Rupture Prevention (CRITICAL)

**Détection** : Stock < Safety Stock projeté à J+14

**Alertes** :
- YELLOW : Stock critique J+14
- ORANGE : Stock critique J+7
- RED : Rupture imminente J+3

**Action** : Commande fournisseur automatique si Mode Auto-Drive

**KPI** : `rupture-stock` : <5%

#### 3. Surstock Alert (HIGH)

**Détection** : Stock > 3x Rotation moyenne (stockage > 90j)
**Impact** : Coût stockage + Capital immobilisé

**Actions** :
- Alerte IA-Ads pour promotion ciblée
- Suggestion bundle IA-Merch
- Signal Pricing Bot pour déstockage progressif

**KPI** : `surstock-rate` : <10%

#### 4. Safety Stock Optimizer (HIGH)

**Calcul dynamique** : Safety Stock = σ × Z × √(Lead Time)

**Facteurs** :
- Variabilité demande (σ)
- Niveau de service cible (Z = 1.65 pour 95%)
- Délai fournisseur moyen (Lead Time)

**Ajustement** : Mensuel ou événement (Black Friday +50%)

#### 5. Supplier Lead Time Tracker (MEDIUM)

**Source** : ERPNext Purchase Orders (historique réel)
**Analyse** : Délai moyen, écart-type, fiabilité fournisseur
**Action** : Alerte si délai dépasse +20% moyenne
**Coordination** : Supplier Scorer pour notation fournisseurs

**KPI** : `inventory-turnover` : >6x/an

### 3 Workflows Critiques

#### Workflow 1 : Rupture Prevention Loop

**Trigger** : Cron quotidien 6h (avant ouverture)

**Actions** :
1. **Forecast** : Calcul demande J+14 (Prophet model)
2. **Compare** : Stock actuel vs Stock projeté
3. **Identify** : SKUs avec Stock < Safety Stock à J+14
4. **Alert** :
   ```
   RUPTURE ALERT - 12 SKUs critiques

   | SKU | Stock | Demande J+14 | Safety | Action |
   |-----|-------|--------------|--------|--------|
   | PLAQ-BOSCH-123 | 45 | 62 | 25 | Commander +50 |
   | DISQ-BREMBO-456 | 12 | 28 | 15 | Commander +40 |
   ```
5. **Action Mode Assisted** : Notification Slack + Draft PO ERPNext
6. **Action Mode Auto-Drive** : Création PO automatique si <€5K

**SLA** : Détection → Alerte <2h

#### Workflow 2 : Surstock Liquidation

**Trigger** : Stock > 3x Rotation (scan hebdomadaire)

**Actions** :
1. Identify : Produits avec rotation >90j
2. Calculate : Coût stockage mensuel (€/m² × volume)
3. Strategy :
   - Si rotation 90-120j : Signal Pricing Bot -10%
   - Si rotation 120-180j : Promo IA-Ads -20%
   - Si rotation >180j : Bundle IA-Merch + Promo -30%
4. Monitor : Suivi écoulement sur 30j
5. Escalate : Si invendu → IA-CFO pour arbitrage

#### Workflow 3 : Seasonal Demand Spike

**Trigger** : Événement calendrier (Black Friday, Noël, Été)

**Actions** :
1. **Predict** : Uplift saisonnier par catégorie
   - Pneus Hiver : +150% (Nov-Dec)
   - Climatisation : +80% (Juin-Août)
   - Batteries : +60% (Oct-Jan)
2. **Adjust Safety Stock** : ×1.5 pour catégories impactées
3. **Pre-order** : Commande fournisseur anticipée J-30
4. **Coordinate** :
   - IA-Ads : Budget campagne ×2
   - Pricing Bot : Prix dynamiques selon stock
   - IA-CFO : Validation budget achat exceptionnel

### Coordination

- **Pricing Bot** : Stock faible → Prix monte. Surstock → Prix baisse
- **IA-Ads** : Surstock détecté → Campagne promo ciblée
- **IA-Merch** : Surstock → Suggestion bundle
- **IA-CFO** : Validation achats exceptionnels >€10K
- **Supplier Scorer** : Délais fournisseurs impactent Safety Stock
- **ERPNext** : Source de vérité stock, destination PO

### Implémentation (StockForecasterService)

```typescript
@Injectable()
export class StockForecasterService {
  constructor(
    private readonly erpnext: ErpNextClient,
    private readonly prophet: ProphetMLService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 6 * * *') // Daily 6am
  async runDailyForecast(): Promise<ForecastReport> {
    // 1. Fetch current stock from ERPNext
    const stock = await this.erpnext.getStockLevels();

    // 2. Get sales history (last 365 days)
    const salesHistory = await this.erpnext.getSalesHistory({
      period: '365d',
      granularity: 'daily',
    });

    // 3. Run Prophet forecast
    const forecasts = await this.prophet.predict({
      history: salesHistory,
      horizons: [7, 14, 30],
      seasonality: ['weekly', 'yearly'],
    });

    // 4. Calculate safety stock
    const safetyStock = this.calculateSafetyStock(forecasts, {
      serviceLevel: 0.95,
      leadTime: await this.getAverageLeadTime(),
    });

    // 5. Identify at-risk SKUs
    const atRisk = stock.filter(
      (item) => item.quantity < safetyStock[item.sku] * 1.2,
    );

    // 6. Generate alerts
    if (atRisk.length > 0) {
      await this.alertRuptureRisk(atRisk);
    }

    return { forecasts, atRisk, safetyStock };
  }

  async detectSurstock(): Promise<SurstockReport> {
    const stock = await this.erpnext.getStockLevels();
    const turnover = await this.calculateTurnoverRate();

    const surstock = stock.filter((item) => {
      const avgRotation = turnover[item.sku] || 30;
      const daysOfStock = item.quantity / (avgRotation / 30);
      return daysOfStock > 90; // >3 months stock
    });

    if (surstock.length > 0) {
      await this.triggerLiquidationWorkflow(surstock);
    }

    return { surstock, totalValue: this.calculateValue(surstock) };
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `rupture-stock` | <5% | 12% | Ventes perdues |
| `surstock-rate` | <10% | 18% | Capital immobilisé |
| `forecast-accuracy` | >85% | 65% | Fiabilité planning |
| `inventory-turnover` | >6x/an | 4.2x | Efficacité stock |

**Top Win** : "Le Sauveur de Noël"
- **Contexte** : Prédiction +150% demande pneus hiver
- **Action** : Pré-commande J-45 + Safety Stock ×1.5
- **Résultat** : 0 rupture Black Friday, +€45K ventes sauvées

---

## Agent Transport Optimizer (IA-Transport)

### Rôle Spécialisé

L'**IA-Transport** est l'"Optimiseur Logistique" de l'**E-Commerce Squad**. Il calcule les routes de livraison optimales, compare les coûts transporteurs en temps réel, et garantit la meilleure promesse de livraison au client.

**Positionnement** : Specialized Agent (E-Commerce Squad)
**Budget** : €30K (Dev €24K + APIs transporteurs €6K)
**ROI** : +€95K/an (réduction coûts transport -18% + satisfaction client +12%)

### 5 Responsabilités Clés

#### 1. Carrier Cost Comparator (CRITICAL)

**Fonction** : Comparaison temps réel des tarifs transporteurs
**Transporteurs** : Colissimo, Chronopost, Mondial Relay, DPD, GLS, UPS
**Facteurs** : Poids, dimensions, zone géographique, délai souhaité
**Optimisation** : Meilleur ratio coût/délai selon préférence client

**KPI** : `delivery-cost` : <€8/colis moyen

#### 2. Route Optimization (CRITICAL)

**Algorithme** : Dijkstra + heuristiques métier

**Paramètres** :
- Distance entrepôt → client
- Zones de livraison transporteur
- Contraintes horaires (express avant 13h)
- Jours fériés et week-ends

**Output** : Route optimale + ETA précis

**KPI** : `delivery-time` : <48h (standard), <24h (express)

#### 3. Delivery Promise Engine (HIGH)

**Calcul** : Stock dispo + Picking time + Transit time = Date livraison
**Affichage checkout** : "Livré le [DATE] si commandé avant [HEURE]"
**Précision cible** : 95% des promesses tenues
**Fallback** : Si incertitude, afficher fourchette

**KPI** : `promise-accuracy` : >95%

#### 4. Multi-Warehouse Routing (HIGH)

**Scénario** : Commande avec articles dans plusieurs entrepôts

**Stratégies** :
- **Single Ship** : Attendre consolidation (délai +24-48h, coût -30%)
- **Split Ship** : Expéditions séparées (délai optimal, coût +50%)
- **Hybrid** : Split si économie >€3 ou délai -24h

**Décision** : Automatique selon profil client (Prime vs Standard)

#### 5. Carbon Footprint Tracker (MEDIUM)

**Calcul** : CO2 par mode transport × distance
**Affichage** : Option "Livraison éco-responsable" (point relais)
**Incitation** : -€1 si point relais + badge "Éco-livraison"
**Reporting** : Bilan carbone mensuel pour IA-ESG

**KPI** : `delivery-carbon` : -15% vs année précédente

### 3 Workflows Critiques

#### Workflow 1 : Best Carrier Selection (Checkout)

**Trigger** : Client sélectionne mode livraison

**Actions** :
1. **Input** : Panier (poids, dimensions), Adresse destination
2. **Query APIs** : Colissimo, Chronopost, Mondial Relay, DPD
3. **Calculate** : Prix, ETA, CO2 pour chaque transporteur
4. **Rank** : Selon préférence (prix, délai, éco)
5. **Display** : Options triées avec badges (Moins cher, Plus rapide, Éco)
6. **Cache** : 15min (éviter re-calcul)

**SLA** : Réponse <500ms

**Output Frontend** :
```
Options de livraison :

RECOMMANDÉ
   Colissimo - 6,90€ - Livré le 9 déc.

EXPRESS
   Chronopost - 12,50€ - Livré demain avant 13h

ÉCO-RESPONSABLE
   Mondial Relay - 4,50€ - Livré le 11 déc. (-1€ crédit fidélité)
```

#### Workflow 2 : Multi-Warehouse Split Decision

**Trigger** : Commande avec articles multi-entrepôts

**Actions** :
1. **Detect** : Articles répartis (ex: 2 à Lyon, 1 à Paris)
2. **Calculate Options** :
   - Option A - Single Ship (consolidation) : Délai +48h, Coût €8.50
   - Option B - Split Ship : Délai standard, Coût €14.20
   - Option C - Hybrid : Article Paris J+1, Lyon J+2, Coût €11.80
3. **Decision Logic** :
   - Si client Prime → Option B (délai prioritaire)
   - Si économie >€5 ET client accepte délai → Option A
   - Si différence délai <24h → Option la moins chère
4. **Communicate** : "Votre commande sera expédiée en 2 colis"

#### Workflow 3 : Delivery Delay Alert

**Trigger** : Tracking API détecte retard >24h vs ETA promis

**Actions** :
1. **Detect** : Colis bloqué (météo, grève, incident)
2. **Calculate** : Nouveau ETA estimé
3. **Notify Client** (proactif) : Email + SMS avec nouveau délai
4. **Log** : Incident transporteur pour Supplier Scorer
5. **Compensate** : Coupon auto si retard >48h

### Coordination

- **IA-Stock** : Disponibilité entrepôts pour routing
- **IA-CFO** : Validation compensations retard >€5. Budget transport mensuel
- **Pricing Bot** : Frais de port dynamiques selon marge produit
- **IA-CPO** : UX checkout options livraison
- **IA-ESG** : Reporting carbone livraisons
- **Supplier Scorer** : Notation transporteurs sur fiabilité SLA

### Implémentation (TransportOptimizerService)

```typescript
@Injectable()
export class TransportOptimizerService {
  constructor(
    private readonly carrierApi: CarrierAggregatorService,
    private readonly warehouseService: WarehouseService,
    private readonly redis: RedisService,
  ) {}

  async getShippingOptions(
    cart: CartDto,
    destination: AddressDto,
  ): Promise<ShippingOption[]> {
    const cacheKey = `shipping:${cart.id}:${destination.postalCode}`;

    // Check cache (15min TTL)
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Calculate package dimensions
    const packageInfo = this.calculatePackage(cart.items);

    // Query all carriers in parallel
    const [colissimo, chronopost, mondialRelay, dpd] = await Promise.all([
      this.carrierApi.getColissimoRate(packageInfo, destination),
      this.carrierApi.getChronopostRate(packageInfo, destination),
      this.carrierApi.getMondialRelayRate(packageInfo, destination),
      this.carrierApi.getDpdRate(packageInfo, destination),
    ]);

    // Build options with rankings
    const options = this.rankOptions([colissimo, chronopost, mondialRelay, dpd]);

    // Cache results
    await this.redis.set(cacheKey, JSON.stringify(options), 'EX', 900);

    return options;
  }

  async getDeliveryPromise(
    sku: string,
    postalCode: string,
  ): Promise<DeliveryPromise> {
    // 1. Check stock availability
    const stock = await this.warehouseService.getStockBySku(sku);

    if (stock.quantity <= 0) {
      return { available: false, message: 'Rupture de stock' };
    }

    // 2. Get nearest warehouse with stock
    const warehouse = await this.warehouseService.getNearestWithStock(sku, postalCode);

    // 3. Calculate ETA
    const pickingTime = 4; // hours
    const transitTime = await this.getTransitTime(warehouse, postalCode);
    const cutoffHour = 14; // 2pm

    const now = new Date();
    const isBeforeCutoff = now.getHours() < cutoffHour;

    const deliveryDate = this.calculateDeliveryDate(
      now, pickingTime, transitTime, isBeforeCutoff
    );

    return {
      available: true,
      deliveryDate,
      message: `Livré le ${this.formatDate(deliveryDate)}`,
      cutoffMessage: isBeforeCutoff ? `Commandé avant ${cutoffHour}h` : 'Expédié demain',
    };
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `delivery-cost` | <€8 | €9.50 | Marge |
| `delivery-time` | <48h | 52h | Satisfaction |
| `carrier-sla` | >95% | 88% | Fiabilité |
| `delivery-carbon` | -15% | - | ESG |

**Top Win** : "L'Optimiseur de Noël"
- **Contexte** : Pic commandes +200%, transporteurs saturés
- **Action** : Routing dynamique Mondial Relay (moins saturé)
- **Résultat** : 94% SLA tenu vs 78% concurrent, +€32K économies

---

## Agent Chaos Lite (G10)

### Rôle Central

L'**G10** (Chaos Lite) est l'**Ingénieur Résilience** de l'Ops Squad. Il simule des pannes contrôlées pour tester la robustesse du système, mesure les temps de récupération, et identifie les points faibles avant qu'ils ne causent des incidents en production.

**Positionnement Squad** : Ops Squad - Agent Resilience
**Budget** : €5K
**ROI** : +€30K/an (incidents évités, downtime réduit)

### 4 Responsabilités Clés

#### 1. Failure Injection Tests (CRITICAL)

**Types de pannes simulées** :
- Container crash (Docker restart)
- Service unavailable (HTTP 503)
- Database connection lost
- Redis cache failure
**Fréquence** : Hebdomadaire (environnement staging)
**KPI** : `chaos-test-coverage` : >50% services critiques

#### 2. Latency Injection (HIGH)

**Simulations** :
- Network delay +500ms
- Slow database queries
- External API timeout
**Objectif** : Valider circuit breakers et fallbacks
**KPI** : `latency-tolerance` : système stable jusqu'à 2s

#### 3. Resource Exhaustion (HIGH)

**Tests** :
- Memory pressure (80% RAM)
- CPU spike (90% usage)
- Disk space low (<10%)
**Validation** : Auto-scaling et alertes fonctionnent
**KPI** : `resource-recovery` : <2min

#### 4. Recovery Time Measurement (CRITICAL)

**Métriques** :
- Time to Detection (TTD)
- Time to Mitigation (TTM)
- Time to Recovery (TTR)
**Gate** : 🔴 TTR >5min → plan d'action requis
**KPI** : `recovery-time` : <5min

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `chaos-test-coverage` | >50% | Services testés |
| `recovery-time` | <5min | Temps récupération |
| `latency-tolerance` | 2s | Tolérance latence |
| `resource-recovery` | <2min | Récup ressources |

### Intégration Agents

```
G10 ──► IA-DevOps : Coordination tests
    ├──► G17 : Post-mortems si échec
    ├──► G11 : Kill switch si incident
    └──► IA-CTO : Architecture resilience
```

---

## Agent Incident Coach (G17)

### Rôle Central

L'**G17** (Incident Coach) est le **Facilitateur Post-Mortem** de l'Ops Squad. Il génère automatiquement les templates post-incident, assiste l'analyse des causes racines, suit les action items, et détecte les patterns d'incidents récurrents.

**Positionnement Squad** : Ops Squad - Agent Learning
**Budget** : €5K
**ROI** : +€35K/an (MTTR réduit, récurrence évitée)

### 4 Responsabilités Clés

#### 1. Post-Mortem Template Generation (HIGH)

**Génération automatique** :
- Timeline incident (logs structurés)
- Impact assessment (users/revenue)
- Systèmes affectés
- Détection et résolution

**Template** :
```markdown
## Incident #XXX - [Date]
### Impact
- Durée: X minutes
- Users affectés: Y
- Revenue impact: €Z

### Timeline
- HH:MM - Détection
- HH:MM - Alerte
- HH:MM - Résolution

### Root Cause
[Analyse assistée par IA]

### Action Items
- [ ] Court terme (24h)
- [ ] Moyen terme (1 sem)
- [ ] Long terme (1 mois)
```
**KPI** : `postmortem-completion` : >95% incidents

#### 2. Root Cause Analysis Assistance (HIGH)

**Techniques** :
- 5 Whys automatisé
- Fishbone diagram suggestions
- Pattern matching avec incidents passés
**KPI** : `rca-accuracy` : >80%

#### 3. Action Items Tracking (HIGH)

**Suivi** :
- Création tickets JIRA/GitHub auto
- Rappels deadline
- Escalade si retard >7j
**KPI** : `action-item-closure` : >80% dans délais

#### 4. Incident Patterns Detection (MEDIUM)

**Analyse** :
- Corrélation temporelle (même heure/jour)
- Composants récurrents
- Triggers communs
**Alerte** : Pattern détecté → recommandation préventive
**KPI** : `pattern-detection` : >90% récurrences identifiées

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `postmortem-completion` | >95% | Post-mortems rédigés |
| `action-item-closure` | >80% | Actions fermées à temps |
| `rca-accuracy` | >80% | Causes racines correctes |
| `pattern-detection` | >90% | Patterns identifiés |

### Intégration Agents

```
G17 ──► IA-DevOps : Incidents data
    ├──► G10 : Résultats chaos tests
    ├──► IA-HR : Formation post-incidents
    └──► IA-CEO : Rapports mensuels
```

---

## Agent Import/Export (IA-Customs)

### Rôle Spécialisé

L'**IA-Customs** est le "Douanier Intelligent" de l'**E-Commerce Squad**. Il gère le commerce international : calcul automatique des droits de douane et taxes, suivi des expéditions transfrontalières, monitoring des délais portuaires et génération des documents de conformité.

**Positionnement** : Specialized Agent (E-Commerce Squad)
**Budget** : €25K (Dev €18K + APIs douanes €7K)
**ROI** : +€85K/an (conformité 100% + réduction retards douane -40% + optimisation droits)

### 5 Responsabilités Clés

#### 1. Customs Duty Calculator (CRITICAL)

**Fonction** : Calcul automatique des droits de douane et taxes à l'import
**Sources** : TARIC UE (base officielle), codes HS 8 chiffres

**Calculs** :
- Droits de douane : % selon code HS + pays origine
- TVA import : 20% France (base = valeur + droits + transport)
- Droits anti-dumping : si applicable (ex: pneus Chine)

**Précision** : 98% pour éviter redressements

**KPI** : `customs-accuracy` : >98%

#### 2. Shipment Tracking International (CRITICAL)

**Couverture** : Maritime (conteneurs), Aérien (express), Ferroviaire (Chine-UE)

**APIs** :
- Maritime : Searates, MarineTraffic
- Aérien : FlightAware Cargo
- Rail : China Railway Express

**Alertes** : Retard >24h, changement ETA, arrivée port

**KPI** : `international-transit` : <14j (Asie-UE standard)

#### 3. Port Delay Monitor (HIGH)

**Ports surveillés** : Shanghai, Ningbo, Shenzhen (départ) + Le Havre, Rotterdam, Anvers (arrivée)
**Facteurs** : Congestion, météo, grèves, inspections
**Prédiction** : ML sur historique délais par port/saison
**Action** : Alerte IA-Stock si retard impacte approvisionnement

**KPI** : `port-delay-rate` : <10% des shipments

#### 4. Incoterms Advisor (HIGH)

**Fonction** : Recommandation Incoterm optimal selon fournisseur/produit

**Incoterms courants** :
- **FOB** : Fournisseur livre au port (on gère transport maritime)
- **CIF** : Fournisseur inclut transport + assurance
- **DDP** : Fournisseur livre dédouané (zéro risque)

**Analyse** : Comparaison coût total selon Incoterm + fiabilité fournisseur

#### 5. Compliance Documents Generator (MEDIUM)

**Documents générés** :
- Facture proforma (Pro Forma Invoice)
- Packing List
- Certificat d'origine (EUR.1 intra-UE, Form A pays tiers)
- Déclaration de conformité CE
- Fiche de données de sécurité (MSDS si chimique)

**Format** : PDF + données structurées pour EDI douanes

**KPI** : `compliance-score` : 100% (zéro rejet douane)

### 3 Workflows Critiques

#### Workflow 1 : Auto Duty Calculation (Purchase Order)

**Trigger** : Création PO import dans ERPNext

**Actions** :
1. **Extract** : Codes HS des produits commandés
2. **Query TARIC** : Droits applicables par code HS + origine
3. **Calculate** : Droits, anti-dumping, VAT, landed cost total
4. **Update ERPNext** : Landed cost sur PO
5. **Alert** : Si droits anti-dumping détectés → notification IA-CFO

**SLA** : Calcul <30s après création PO

**Output** :
```
CUSTOMS DUTY CALCULATION - PO-2025-0123

Origin: China -> France

Items analyzed: 2
- PLAQ-BOSCH-CN (HS 8708.30.10): 4.5% duty = €225
- PNEU-HIVER-CN (HS 4011.10.00): 4.5% + 22.3% antidumping = €2,144

Summary:
- Goods value: €13,000
- Freight + Insurance: €1,350
- CIF Value: €14,350
- Customs duties: €585
- Antidumping duties: €1,784
- VAT (20%): €3,343.80
- TOTAL LANDED COST: €5,712.80 (+44%)

ALERT: Antidumping duties detected on tires!
Consider alternative suppliers (Thailand, Vietnam)
```

#### Workflow 2 : Port Congestion Alert

**Trigger** : Délai port >72h vs moyenne historique

**Actions** :
1. **Detect** : Congestion port Shanghai (+5j moyenne)
2. **Impact Analysis** : Conteneurs en transit affectés
3. **Calculate** : Nouveau ETA + impact stock
4. **Notify** :
   - IA-Stock : Ajuster prévisions arrivage
   - IA-CFO : Impact cashflow
   - Purchasing : Alternatives sourcing
5. **Dashboard** : Mise à jour temps réel

#### Workflow 3 : Customs Document Generation

**Trigger** : Shipment confirmé par fournisseur

**Actions** :
1. Gather Data : PO, Packing list fournisseur, valeurs
2. Generate Documents : Invoice, Packing List, Certificate, Declaration
3. Validate : Contrôle cohérence données
4. Store : ERPNext + Cloud backup
5. Transmit : EDI douanes si dédouanement anticipé

### Coordination

- **IA-Stock** : Alerte retards import → ajustement safety stock
- **IA-CFO** : Coûts landed intégrés au coût produit
- **IA-Transport** : Handoff dernière mile après dédouanement
- **Supplier Scorer** : Fiabilité fournisseurs sur délais et conformité
- **IA-Legal** : Conformité réglementaire (normes CE, REACH)
- **ERPNext** : Source PO, destination landed costs

### Implémentation (CustomsAgentService)

```typescript
@Injectable()
export class CustomsAgentService {
  constructor(
    private readonly taric: TaricApiService,
    private readonly tracking: ShipmentTrackingService,
    private readonly portMonitor: PortDelayService,
    private readonly erpnext: ErpNextClient,
    private readonly documentGenerator: CustomsDocumentService,
  ) {}

  async calculateDuties(poNumber: string): Promise<DutyCalculation> {
    // 1. Fetch PO details from ERPNext
    const po = await this.erpnext.getPurchaseOrder(poNumber);

    // 2. Get HS codes for each item
    const itemsWithHs = await this.enrichWithHsCodes(po.items);

    // 3. Query TARIC for duty rates
    const duties = await Promise.all(
      itemsWithHs.map(async (item) => {
        const rates = await this.taric.getDutyRates({
          hsCode: item.hsCode,
          originCountry: po.supplierCountry,
          destinationCountry: 'FR',
        });

        return {
          ...item,
          dutyRate: rates.customsDuty,
          antidumpingRate: rates.antidumping || 0,
          dutyAmount: item.value * (rates.customsDuty / 100),
          antidumpingAmount: item.value * ((rates.antidumping || 0) / 100),
        };
      }),
    );

    // 4. Calculate totals
    const goodsValue = duties.reduce((sum, d) => sum + d.value, 0);
    const totalDuty = duties.reduce((sum, d) => sum + d.dutyAmount, 0);
    const totalAntidumping = duties.reduce((sum, d) => sum + d.antidumpingAmount, 0);

    const cifValue = goodsValue + po.freight + po.insurance;
    const vatBase = cifValue + totalDuty + totalAntidumping;
    const vatAmount = vatBase * 0.20;

    // 5. Update ERPNext with landed cost
    await this.erpnext.updateLandedCost(poNumber, totalDuty + totalAntidumping + vatAmount);

    // 6. Alert if antidumping detected
    if (totalAntidumping > 0) {
      await this.alertAntidumping(result);
    }

    return result;
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async monitorPortDelays(): Promise<PortDelayReport[]> {
    const ports = ['CNSHA', 'CNNBO', 'CNSZX', 'FRLEH', 'NLRTM', 'BEANR'];

    const reports = await Promise.all(
      ports.map(async (portCode) => {
        const delay = await this.portMonitor.getCurrentDelay(portCode);
        const historicalAvg = await this.portMonitor.getHistoricalAverage(portCode);

        if (delay > historicalAvg * 1.5) {
          const affected = await this.getAffectedShipments(portCode);
          await this.notifyPortCongestion(portCode, delay, affected);
        }

        return { portCode, currentDelay: delay, historicalAvg };
      }),
    );

    return reports;
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `customs-accuracy` | >98% | 92% | Redressements |
| `international-transit` | <14j | 18j | Stock |
| `port-delay-rate` | <10% | 22% | Planning |
| `compliance-score` | 100% | 94% | Blocages |

**Top Win** : "L'Éviteur de Taxes"
- **Contexte** : Import pneus Chine avec antidumping 22%
- **Action** : Recommandation sourcing Thaïlande (0% antidumping)
- **Résultat** : Économie €45K/an sur droits de douane

---

## Agent RH IA (IA-HR)

### Rôle Central

L'**IA-HR** est le "DRH Intelligent" du **Board AI-COS**. Il supervise l'ensemble du capital humain : satisfaction et bien-être des équipes, acquisition et rétention des talents, formation continue et développement des compétences, gestion administrative des contrats, et planification stratégique des effectifs.

**Positionnement** : Board Member (People & Culture)
**Budget** : €28K (Dev €20K + SIRH APIs €8K)
**ROI** : +€95K/an (turnover -40% + productivité formation +15% + coûts recrutement -30%)

### 5 Responsabilités Clés

#### 1. Employee Satisfaction Monitor (CRITICAL)

**Fonction** : Mesure continue du moral et engagement des équipes

**Métriques** :
- **eNPS** (Employee Net Promoter Score) : enquête trimestrielle
- **Pulse surveys** : micro-sondages hebdomadaires (3 questions)
- **Signaux faibles** : analyse sentiment Slack/Teams, patterns congés

**Alertes** : Score <30, chute >15 pts, clusters de mécontentement
**Action** : Escalade manager + plan d'action personnalisé

**KPI** : `employee-nps` : >40 (excellent), >20 (bon), <0 (critique)

#### 2. Talent Acquisition Pipeline (CRITICAL)

**Fonction** : Sourcing, screening et onboarding automatisés

**Intégrations** :
- **Sourcing** : LinkedIn Recruiter API, Welcome to the Jungle, Indeed
- **ATS** : Scoring CV automatique, matching JD vs candidat
- **Assessment** : Tests techniques automatisés, soft skills analysis

**Métriques** :
- Time-to-hire : <30 jours
- Quality of hire : performance N+6 mois vs prédiction
- Cost per hire : <€3K

**KPI** : `time-to-hire` : <30j

#### 3. Training & Development Manager (HIGH)

**Fonction** : Identification gaps compétences et plans de formation

**Process** :
1. **Skills mapping** : inventaire compétences actuelles vs requises
2. **Gap analysis** : écarts critiques par rôle/individu
3. **Training plan** : recommandation formations (internes, MOOC, certifs)
4. **ROI tracking** : mesure impact post-formation

**Alertes** : Compétence critique <2 personnes, certification expirante

**KPI** : `training-completion` : >85%

#### 4. Contract & Admin Lifecycle (HIGH)

**Fonction** : Gestion automatisée du cycle de vie administratif

**Documents** :
- Contrats de travail (CDI, CDD, alternance)
- Avenants (promotion, augmentation, télétravail)
- Attestations (employeur, formation, congés)

**Alertes automatiques** :
- Période d'essai : J-15 avant fin → décision manager
- CDD : M-2 avant fin → renouvellement ou CDI ?
- Anniversaire : rappel entretien annuel
- Visite médicale : expiration <30j

**KPI** : `contract-compliance` : 100%

#### 5. Workforce Planning (MEDIUM)

**Fonction** : Anticipation besoins RH alignés sur stratégie business

**Analyses** :
- **Pyramide des âges** : risque départs retraite
- **Turnover prédictif** : ML sur signaux de départ
- **Charge de travail** : heures sup, burnout risk score
- **Succession planning** : identification hauts potentiels

**Horizon** : Court terme (3 mois), moyen terme (1 an), long terme (3 ans)

**KPI** : `workforce-stability` : turnover <15%/an

### 3 Workflows Critiques

#### Workflow 1 : eNPS Survey & Action Plan

**Trigger** : Trimestriel (1er jour du trimestre)

**Actions** :
1. **Survey Deploy** : Envoi questionnaire anonyme (10 questions)
2. **Collection** : 7 jours, rappels J+3 et J+6
3. **Analysis** :
   - Score eNPS global et par équipe
   - Analyse sentiment commentaires (NLP)
   - Comparaison N-1 et benchmark secteur
4. **Segmentation** :
   - Promoters (9-10) : ambassadeurs potentiels
   - Passives (7-8) : à engager davantage
   - Detractors (0-6) : intervention urgente
5. **Action Plan** : Génération recommandations personnalisées
6. **Escalade** : Si eNPS <20 → alerte IA-CEO + réunion direction

**SLA** : Résultats analysés <48h après clôture

#### Workflow 2 : Skills Gap Analysis & Training

**Trigger** : Semestriel ou nouveau projet/technologie

**Actions** :
1. Skills Inventory : Extraction compétences déclarées + validées
2. Requirements Mapping : Compétences requises par rôle
3. Gap Calculation : Écart niveau actuel vs requis par compétence
4. Training Recommendations : Matching formations disponibles
5. Budget Request : Soumission IA-CFO si >€2K
6. Enrollment : Inscription automatique formations validées
7. Follow-up : Rappels, tracking completion, évaluation post-formation

#### Workflow 3 : Contract Renewal & Compliance Alert

**Trigger** : Cron quotidien (scan échéances)

**Actions** :
1. Scan : Tous les contrats avec dates clés
2. Detect : Échéances dans fenêtre d'alerte
3. Categorize :
   - Période d'essai : J-15, J-7, J-1
   - CDD fin : M-2, M-1, J-15
   - Visite médicale : J-30, J-7
4. Notify : Manager concerné + RH
5. Track : Suivi décision et exécution
6. Archive : Stockage documents conformité RGPD

### Coordination

- **IA-CEO** : Rapport mensuel People & Culture. Escalade eNPS critique <20
- **IA-CFO** : Budget masse salariale, coûts recrutement, budget formation >€2K
- **IA-Legal** : Conformité contrats travail, RGPD données employés
- **IA-CTO** : Compétences tech requises, évaluation technique candidats
- **IA-CISO** : Accès systèmes employés, offboarding sécurisé
- **Managers** : Feedback collaborateurs, décisions période essai/renouvellement

### Implémentation (HRAgentService)

```typescript
@Injectable()
export class HRAgentService {
  constructor(
    private readonly surveyService: EmployeeSurveyService,
    private readonly skillsService: SkillsMatrixService,
    private readonly contractService: ContractLifecycleService,
    private readonly recruitmentService: TalentAcquisitionService,
    private readonly analyticsService: HRAnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

  async runENPSSurvey(quarter: string): Promise<ENPSReport> {
    // 1. Deploy survey
    const survey = await this.surveyService.deploy({
      type: 'ENPS',
      questions: this.getENPSQuestions(),
      duration: 7, // days
      anonymous: true,
    });

    return { surveyId: survey.id, status: 'DEPLOYED' };
  }

  async analyzeENPSSurvey(surveyId: string): Promise<ENPSAnalysis> {
    const responses = await this.surveyService.getResponses(surveyId);

    // Calculate eNPS
    const promoters = responses.filter(r => r.score >= 9).length;
    const detractors = responses.filter(r => r.score <= 6).length;
    const total = responses.length;

    const enps = Math.round(((promoters - detractors) / total) * 100);

    // Sentiment analysis on comments
    const sentiments = await this.analyticsService.analyzeSentiment(
      responses.map(r => r.comments).filter(Boolean)
    );

    // Alert if critical
    if (enps < 20) {
      await this.escalateToCEO('ENPS_CRITICAL', { enps, surveyId });
    }

    return { enps, byTeam: await this.groupByTeam(responses), sentiments };
  }

  async analyzeSkillsGap(teamId?: string): Promise<SkillsGapReport> {
    // 1. Get current skills inventory
    const inventory = await this.skillsService.getInventory(teamId);

    // 2. Get required skills from job descriptions
    const requirements = await this.skillsService.getRequirements(teamId);

    // 3. Calculate gaps
    const gaps = requirements.map(req => {
      const current = inventory.find(i => i.skillId === req.skillId);
      const avgLevel = current?.averageLevel || 0;
      return {
        skill: req.skillName,
        requiredLevel: req.requiredLevel,
        currentAverage: avgLevel,
        gap: avgLevel - req.requiredLevel,
        critical: (avgLevel - req.requiredLevel) < -1.5 || req.critical,
      };
    }).filter(g => g.gap < 0);

    // 4. Submit budget request if needed
    const totalBudget = await this.calculateTrainingBudget(gaps);
    if (totalBudget > 2000) {
      await this.submitBudgetRequest('TRAINING', totalBudget, gaps);
    }

    return { gaps, totalBudget };
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanContractDeadlines(): Promise<ContractAlerts> {
    const alerts = await this.contractService.getUpcomingDeadlines({
      trialEnd: { daysAhead: [15, 7, 1] },
      contractEnd: { daysAhead: [60, 30, 15] },
      medicalVisit: { daysAhead: [30, 7] },
      annualReview: { daysAhead: [30] },
    });

    // Notify managers for urgent items
    for (const alert of alerts.urgent) {
      await this.notificationService.send({
        to: alert.managerId,
        type: 'CONTRACT_ALERT',
        priority: 'HIGH',
        data: alert,
      });
    }

    return alerts;
  }

  async predictTurnoverRisk(): Promise<TurnoverPrediction[]> {
    const employees = await this.analyticsService.getAllEmployees();

    const predictions = await Promise.all(
      employees.map(async emp => {
        const signals = await this.gatherTurnoverSignals(emp.id);
        const riskScore = await this.analyticsService.predictTurnover(signals);

        return {
          employeeId: emp.id,
          name: emp.name,
          riskScore, // 0-100
          riskLevel: riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW',
          recommendedActions: this.getRetentionActions(signals),
        };
      })
    );

    // Alert for high-risk employees
    const highRisk = predictions.filter(p => p.riskLevel === 'HIGH');
    if (highRisk.length > 0) {
      await this.alertHighTurnoverRisk(highRisk);
    }

    return predictions;
  }
}
```

### KPIs & Impact

| KPI | Cible | Actuel | Impact |
|-----|-------|--------|--------|
| `employee-nps` | >40 | 28 | Engagement |
| `time-to-hire` | <30j | 45j | Agilité |
| `training-completion` | >85% | 62% | Compétences |
| `contract-compliance` | 100% | 94% | Légal |
| `workforce-stability` | <15% turnover | 22% | Rétention |

**Top Win** : "Le Sauveur de Talents"
- **Contexte** : Dev Senior signaux faibles (heures sup +40%, eNPS commentaire négatif)
- **Action** : Alerte turnover HIGH → entretien manager → augmentation + formation lead
- **Résultat** : Rétention confirmée, évite coût remplacement €45K

---

## KPIs Consolidés Ops Squad

| KPI | Cible | Agent |
|-----|-------|-------|
| `rupture-stock` | <5% | IA-Stock |
| `surstock-rate` | <10% | IA-Stock |
| `forecast-accuracy` | >85% | IA-Stock |
| `inventory-turnover` | >6x/an | IA-Stock |
| `delivery-cost` | <€8/colis | IA-Transport |
| `delivery-time` | <48h | IA-Transport |
| `carrier-sla` | >95% | IA-Transport |
| `delivery-carbon` | -15%/an | IA-Transport |
| `customs-accuracy` | >98% | IA-Customs |
| `international-transit` | <14j | IA-Customs |
| `compliance-score` | 100% | IA-Customs |
| `employee-nps` | >40 | IA-HR |
| `time-to-hire` | <30j | IA-HR |
| `training-completion` | >85% | IA-HR |
| `workforce-stability` | <15% turnover | IA-HR |

---

## Dashboards Ops Squad

| Route | Description | Agent |
|-------|-------------|-------|
| `/admin/ai-cos/stock` | Prévisions stock, alertes ruptures/surstocks | IA-Stock |
| `/admin/ai-cos/transport` | Options livraison, SLA transporteurs | IA-Transport |
| `/admin/ai-cos/customs` | Tracking international, duties calculator | IA-Customs |
| `/admin/ai-cos/hr` | eNPS, skills gap, contract alerts | IA-HR |

---

## Architecture Ops Squad

```
┌─────────────────────────────────────────────────────────────┐
│                       IA-CEO                                 │
│                   (Orchestrateur)                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      Ops Squad                               │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  IA-Stock    │ IA-Transport │ IA-Customs   │    IA-HR       │
│  €35K        │    €30K      │   €25K       │    €28K        │
│              │              │              │                │
│ • Forecast   │ • Carriers   │ • Duties     │ • eNPS         │
│ • Rupture    │ • Routing    │ • Tracking   │ • Recruiting   │
│ • Surstock   │ • Promise    │ • Ports      │ • Training     │
│ • Safety     │ • Split      │ • Documents  │ • Contracts    │
│ • Suppliers  │ • Carbon     │ • Incoterms  │ • Planning     │
└──────────────┴──────────────┴──────────────┴────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
     ┌─────────┐    ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ ERPNext │    │ Carrier │   │ TARIC   │   │  SIRH   │
     │ API     │    │ APIs    │   │ APIs    │   │  APIs   │
     └─────────┘    └─────────┘   └─────────┘   └─────────┘
```

---

## Liens

- [Index AI-COS](./ai-cos-index.md)
- [Tech Squad](./ai-cos-tech-squad.md)
- [Strategy Squad](./ai-cos-strategy-squad.md)
- [Business Squad](./ai-cos-business-squad.md)
- [Quality Squad](./ai-cos-quality-squad.md)
- [Performance & Expansion Squads](./ai-cos-perf-expansion.md)
- [CHANGELOG](./CHANGELOG-ai-cos.md)
