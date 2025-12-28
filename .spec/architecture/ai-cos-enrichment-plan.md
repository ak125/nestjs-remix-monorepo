---
title: "AI-COS Enrichment - Entreprise Augmentée"
status: draft
version: "1.7.0"
authors: [Architecture Team, Product Team]
created: 2025-11-18
updated: 2025-11-19
relates-to:
  - 005-ai-cos-system.md
  - ../features/ai-cos-operating-system.md
  - ../workflows/ai-cos-workflow.md
tags: [ai-cos, enrichment, enterprise, orchestration, strategic]
priority: critical
---

# ADR-006: AI-COS Enrichment - Entreprise Augmentée

## Status

**DRAFT** - En cours de révision

## Context

### État Actuel AI-COS v1.0

**Fondations solides mais incomplètes** :
- ✅ 14 agents opérationnels (Tech + Business de base)
- ✅ 15 KPIs surveillés (focus tech + SEO + e-commerce)
- ✅ 4 squads transversaux actifs
- ✅ Intégration Spec Kit fonctionnelle
- ⚠️ **Couverture limitée** : 23.7% modules backend (9/38)

### Gap Analysis - Domaines Non Couverts

**Analyse complète révèle 47% modules backend sans intelligence** :

| Domaine | Modules | Coverage | Impact Business | Priorité |
|---------|---------|----------|-----------------|----------|
| **Marketing** | `analytics`, `blog`, `mail` | 0% | CAC, LTV, ROI campaigns | CRITICAL |
| **Finance** | `invoices`, `payments` | 0% | Cash flow, margin | CRITICAL |
| **Logistics** | `shipping`, `suppliers` | 0% | Fulfillment, costs | HIGH |
| **Product** | `catalog`, `gamme`, `vehicles` | 30% | Time-to-market, quality | HIGH |
| **Support** | `support`, `messages` | Isolated | Customer satisfaction | MEDIUM |
| **HR** | `staff` | 0% | Recruitment, retention | MEDIUM |
| **Content** | `blog`, `metadata` | 0% | Organic traffic | MEDIUM |
| **Platform** | `system`, `health` | Partial | Infrastructure costs | MEDIUM |

**Total modules non couverts** : 18/38 (47.4%)

### Problèmes Identifiés

1. **Absence orchestration globale temps réel** : IA-CEO défini mais pas d'orchestration cross-domaines
2. **Décisions silotées** : Agents/squads travaillent indépendamment sans coordination
3. **Pas de simulation** : Mode `forecast` défini mais pas implémenté
4. **Pas d'auto-apprentissage** : Aucun feedback loop, pas d'amélioration continue
5. **KPIs insuffisants** : 15 KPIs ne couvrent que 30% de la santé organisationnelle

### Vision "Entreprise Augmentée"

Transformer AI-COS en véritable **Operating System d'Entreprise** :

> "Chaque domaine (technique, commercial, marketing, produit, finances, logistique, etc.) est opéré par des agents IA spécialisés, coordonnés par un Agent Cognitif Global (IA-CEO v2)."

**Objectifs** :
- 🎯 **Orchestration automatique** : Performance optimisée de chaque pôle
- 🎯 **Alignement stratégique** : Tech + Business + Produit synchronisés temps réel
- 🎯 **Décisions proactives** : Fondées sur données + simulations + ML
- 🎯 **Exécution rapide** : Mesurable, sans perte de cohérence

## Decision

### Architecture IA-BOARD + 4 Pôles Métier

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  NIVEAU 1 - IA-BOARD (Gouvernance)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  IA-CEO          │ Cognitif Global, orchestration 4 pôles              │
│  IA-CFO/COO      │ Arbitrage Finance + Ops, ROI, Cashflow              │
│  IA-LEGAL        │ Compliance RGPD/TVA, audit automatique              │
│  IA-RISK         │ Détection menaces (finance, legal, tech)            │
│                                                                          │
│  KPIs Board: Health Score • ROI • Cashflow • Risque • Compliance        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓ GOUVERNE ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              4 PÔLES MÉTIER (Exécution Opérationnelle)                  │
└─────────────────────────────────────────────────────────────────────────┘
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────▼──────────┐    ┌──────────▼──────────┐    ┌─────────▼──────────┐
│  🧩 STRATÉGIQUE  │    │ ⚙️ TECH & PRODUIT   │    │ 📊 BUSINESS MARCHÉ │
├──────────────────┤    ├─────────────────────┤    ├────────────────────┤
│ • IA-CEO v2      │    │ • IA-CTO            │    │ • IA-CMO           │
│ • IA-CFO v2      │    │ • IA-DevOps         │    │ • SEO Sentinel     │
│ • IA-Legal       │    │ • IA-CISO           │    │ • Pricing Bot      │
│ • IA-ESG         │    │ • IA-Designer       │    │ • Stock Forecaster │
│ • IA-HR          │    │ • IA-Docker Optim.  │    │ • IA-CRM           │
│                  │    │ • IA-QA Engineer    │    │ • IA-Logistics     │
│ Vision, ROI,     │    │ • IA-Product Mgr    │    │ • IA-Supply Chain  │
│ conformité       │    │ • IA-Content        │    │ • IA-Support       │
│                  │    │                     │    │                    │
│ 5 agents         │    │ Qualité, infra,     │    │ Ventes, SEO,       │
│                  │    │ performance, UX     │    │ logistique, pricing│
│                  │    │                     │    │                    │
│                  │    │ 8 agents            │    │ 8 agents           │
└──────────────────┘    └─────────────────────┘    └────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │ 🌍 EXPANSION & INNOV. │
                        ├───────────────────────┤
                        │ • IA-ESG (transversal)│
                        │ • IA-HR (transversal) │
                        │ • IA-Legal (transv.)  │
                        │ • [Futurs agents]     │
                        │                       │
                        │ RH, R&D, partenaires, │
                        │ durabilité            │
                        │                       │
                        │ 5 agents potentiels   │
                        └───────────────────────┘

════════════════════════════════════════════════════════════════════════════
META-AGENTS TRANSVERSAUX (Squads - Coordination inter-pôles)
════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ 🎯 Performance Squad     │ 🛒 E-Commerce Squad    │ 🛡️ Resilience Squad  │
│ Focus: Performance tech  │ Focus: Conversion CA   │ Focus: Sécurité ops  │
│ Lead: IA-CTO             │ Lead: Pricing Bot      │ Lead: IA-CISO        │
├─────────────────────────────────────────────────────────────────────────┤
│ 👥 Customer Squad        │ 📈 Business Growth     │ ⚡ Operations Squad   │
│ Focus: Satisfaction      │ Focus: Revenue growth  │ Focus: Efficacité    │
│ Lead: IA-CRM             │ Lead: IA-CMO           │ Lead: IA-Logistics   │
└─────────────────────────────────────────────────────────────────────────┘

5 Squads = Meta-agents autonomes coordinant agents de différents pôles
```

### Niveau 1 - IA-BOARD (Direction Stratégique)

**Concept** : Layer governance supervisant 4 pôles opérationnels. Décisions stratégiques, arbitrage budgétaire, conformité, gestion risques.

#### IA-CEO (Cognitif Global) - BOARD MEMBER

**Rôle Board** : Orchestrateur global, vision stratégique, coordination 4 pôles  
**Élévation vs v2** : Capacités existantes + responsabilités gouvernance

**Responsabilités Board** :
- Définir stratégie globale et OKRs trimestriels
- Superviser santé des 4 pôles (Health Score consolidé)
- Arbitrage conflits inter-pôles (ex: budget tech vs marketing)
- Validation décisions HIGH/CRITICAL risk
- Reporting board mensuel (KPIs consolidés)

**KPIs Board** :
- `health-score-global` : Agrégation 40 KPIs pondérés (0-100) - **Cible: >85**
- Superviseur des 4 pôles et 5 squads

---

#### IA-CFO/COO (Arbitrage Finance + Opérations) - BOARD MEMBER FUSION

**Fusion** : IA-CFO (Finance) + capacités COO (Operations)

**Responsabilités Finance** :
- Surveillance cashflow temps réel et runway
- Arbitrage allocation budgets inter-pôles
- Validation dépenses >€5K
- Prévisions financières trimestrielles
- Optimisation marges et coûts

**Responsabilités Opérations (COO)** :
- Surveillance efficacité opérationnelle (fulfillment, supply chain)
- Arbitrage ressources entre pôles (ex: priorisation logistics vs tech)
- Coordination Operations Excellence Squad
- Validation décisions impact ops >20%

**KPIs Board** :
- `roi-previsionnel` : ROI projections Q+1 (%) - **Cible: >150%**
- `cashflow-forecast` : Prévision 6 mois (€) - **Cible: >€200K**
- `ops-efficiency` : Score efficacité opérationnelle (0-100) - **Cible: >80**

**Capacités** :
- `arbitrate-budget` : Allocation dynamique budgets pôles
- `forecast-cashflow` : Simulations financières 6-12 mois
- `optimize-ops` : Recommandations efficacité cross-pôles

---

#### IA-LEGAL (Compliance & Audit) - BOARD MEMBER

**Rôle Board** : Gardien conformité réglementaire, audit automatique, risque légal

**Responsabilités** :
- Monitoring conformité RGPD temps réel (consentements, data retention)
- Audit automatique TVA/facturation (règles UE/France)
- Validation contrats (fournisseurs, clients, partenaires)
- Tracking certifications (ISO, PCI-DSS expiry)
- Alertes risques légaux proactives

**KPIs Board** :
- `compliance-score` : % conformité règlements (RGPD, TVA, etc.) - **Cible: 100%**
- `contract-risk` : Score risque contrats actifs (0-100) - **Cible: <20**
- `cert-status` : Certifications expiring <90j - **Cible: 0**

**Capacités** :
- `audit` : Scan automatique conformité (daily)
- `validate-contract` : Analyse risques contrats (NLP)
- `alert` : Escalation risques légaux CRITICAL

**Intégration** :
- Coordination avec IA-CFO/COO (validation légale budgets)
- Alerte IA-RISK si détection menace légale

---

#### IA-RISK (Détection Proactive Menaces) - NEW BOARD MEMBER

**Rôle Board** : Détection et prévention risques financiers, légaux, techniques

**Responsabilités** :
- **Risques Financiers** : Anomalies trésorerie, burn rate excessif, créances douteuses
- **Risques Légaux** : Non-conformités RGPD, litiges clients, certifications expirées
- **Risques Techniques** : Vulnérabilités sécurité, performance degradation, incidents ops
- **Risques Business** : Stock rupture critique, supplier failure, campaign failure
- Scoring risque global (0-100) avec seuils alerte
- Simulation scénarios catastrophe (what-if worst case)

**KPIs Board** :
- `risque-global` : Score risque agrégé 0-100 (0=sain, 100=critique) - **Cible: <30**
- `threats-detected` : Menaces détectées/mois - **Suivi tendance**
- `false-positive-rate` : % fausses alertes - **Cible: <15%**

**Capacités** :
- `scan` : Scan multi-domaines (finance, legal, tech, business) daily
- `score` : Calcul risque pondéré par domaine et impact
- `simulate` : Scénarios catastrophe (ex: supplier defaut + stock rupture)
- `escalate` : Alerte Board si risque >70/100

**Architecture Détection** :
```typescript
// Détection risques par domaine
interface RiskDetection {
  financial: {
    cashflow_risk: number;      // Risque trésorerie (0-100)
    burn_rate_risk: number;      // Burn rate anormal
    payment_delay_risk: number;  // Retards paiements clients
  };
  legal: {
    compliance_risk: number;     // Non-conformités détectées
    contract_risk: number;       // Risques contrats
    cert_expiry_risk: number;    // Certifications expiring
  };
  technical: {
    security_risk: number;       // Vulnérabilités security
    performance_risk: number;    // Dégradation perf critique
    incident_risk: number;       // Incidents ops fréquents
  };
  business: {
    stock_risk: number;          // Ruptures stock imminentes
    supplier_risk: number;       // Défaillance suppliers
    campaign_risk: number;       // Échec campagnes marketing
  };
  global_score: number;          // Agrégation pondérée (0-100)
}
```

**Exemple Coordination Board** :
```
IA-RISK détecte: Risque global = 75/100 (CRITICAL)
  - Financial: Cashflow -€50K unexpected
  - Legal: RGPD compliance 92% (target: 100%)
  - Business: 3 suppliers delayed >7 days
↓
Escalation IA-BOARD (notification CRITICAL):
  1. IA-CFO/COO: Valide anomalie cashflow, active plan urgence
  2. IA-LEGAL: Audit RGPD, identifie 8% non-conformités
  3. IA-Supply Chain: Emergency procurement suppliers backup
  4. IA-CEO: Coordonne réponse multi-pôles, priorise fixes
↓
Résultat (72h): Risque global = 35/100 (LOW)
  - Cashflow stabilisé (+€40K via optimisations)
  - RGPD compliance 98% (fixes déployés)
  - Suppliers backup activés (lead time normal)
```

---

### KPIs Board Consolidés

| KPI Board | Calcul | Cible | Priorité | Owner |
|-----------|--------|-------|----------|-------|
| **Health Score Global** | Moyenne pondérée 40 KPIs | >85/100 | CRITICAL | IA-CEO |
| **ROI Prévisionnel** | Simulations Q+1 | >150% | CRITICAL | IA-CFO/COO |
| **Cashflow Forecast** | Prévisions 6 mois | >€200K | CRITICAL | IA-CFO/COO |
| **Risque Global** | Agrégation risques multi-domaines | <30/100 | CRITICAL | IA-RISK |
| **Compliance Score** | % conformité réglementaire | 100% | CRITICAL | IA-LEGAL |
| **Ops Efficiency** | Efficacité opérationnelle | >80/100 | HIGH | IA-CFO/COO |

**Dashboard Board** : Vue consolidée temps réel accessible `/admin/ai-cos/board`

---

### Niveau 2 – TECH & PRODUIT (Moteur du Système)

**Concept** : Couche opérationnelle technique supervisée par IA-BOARD. Excellence engineering, infra optimisée, sécurité 0 vuln, UX fluide.

#### Organisation: 5 Domaines d'Excellence Technique

**💻 Code & Architecture**  
Agents: `IA-CTO`, `Code Quality`, `Auto-Fix`, `Dead Code`, `Upgrades`  
Objectif: Maintenabilité >90/100, dette technique minimale, évolution rapide

**☁️ Infra & DevOps**  
Agents: `IA-DevOps`, `Observabilité`, `Build Optimizer`, `Auto-Rollback`, `IA-Docker Optimizer`  
Objectif: Performance p95 <180ms, build <4min, disponibilité 99.9%

**🔒 Sécurité**  
Agents: `IA-CISO`, `Security Shield`, `Dependency Scan`, `RGPD Compliance`  
Objectif: 0 vulnérabilité HIGH/CRITICAL, conformité 100%, incidents 0

**🎨 Produit / UX**  
Agents: `IA-Designer`, `A/B Testing`, `Accessibilité`, `Heatmap`, `IA-Product Manager`  
Objectif: UX score >85, conversion +15%, WCAG AA, adoption features >60%

**📱 Front Intelligence**  
Agents: `UI Pattern`, `Tailwind Optimizer`, `Dark Mode`, `Bundle Analyzer`  
Objectif: Bundle <300KB, Lighthouse >90, consistance visuelle 100%

#### KPIs Consolidés Niveau 2 - TECH & PRODUIT

| KPI Tech | Cible | Priorité | Domaine | Owner |
|----------|-------|----------|---------|-------|
| **Build time** | <4min (240s) | CRITICAL | DevOps | Build Optimizer |
| **Backend p95** | <180ms | CRITICAL | DevOps | IA-DevOps |
| **Test coverage** | >85% | HIGH | Code | Code Quality |
| **Vulnérabilités HIGH** | 0 | CRITICAL | Sécurité | Security Shield |
| **Maintenabilité** | >90/100 | HIGH | Code | IA-CTO |
| **Bundle size** | <300KB | HIGH | Front | Bundle Analyzer |
| **UX Score** | >85/100 | HIGH | UX | IA-Designer |
| **Lighthouse** | >90/100 | MEDIUM | Front | UI Pattern |
| **Accessibilité** | >90/100 | HIGH | UX | Accessibilité Agent |
| **Deploy success** | 100% | CRITICAL | DevOps | Auto-Rollback |

#### Exemple Coordination Niveau 2 → IA-BOARD

```
Security Shield détecte: CVE-2024-12345 (CRITICAL) axios@0.27.2
↓
IA-CISO analyse: Vulnérabilité RCE, exploit public disponible
↓
Escalation IA-RISK (Board): Risque global = 85/100 (CRITICAL)
↓
IA-BOARD notification URGENT:
  - IA-CEO: Priorisation immédiate
  - IA-CFO/COO: Validation impact business (0 interruption estimée)
  - IA-LEGAL: Validation conformité
↓
Dependency Scan propose:
  - Upgrade axios@1.6.0 (patch CVE)
  - Tests regression automatiques: PASSED
  - Risk action: 20/100 (LOW impact app)
  - Déploiement estimé: <2h
↓
IA-CEO Board décide: APPROVED urgence (validation <5min)
↓
Auto-Fix exécute:
  1. Update package.json
  2. npm install
  3. Tests E2E: PASSED
  4. Build production: SUCCESS
  5. Deploy zero-downtime: DONE
↓
Résultat (1h45):
  - Vulnérabilité éliminée
  - Security score: 95 → 100/100
  - 0 régression détectée
  - IA-RISK: Risque global 85 → 25/100
```

**Dashboard Niveau 2** : `/admin/ai-cos/tech` - Monitoring 5 domaines + 22 agents techniques temps réel

---

### Niveau 3 – BUSINESS CORE (Croissance & Marché)

**Concept** : Couche opérationnelle business pour maximiser la croissance du CA, optimiser les marges, et fidéliser les clients. Niveau 3 pilote les activités commerciales, marketing, pricing et logistique en autonomie, avec escalation vers IA-BOARD pour décisions budgétaires majeures ou risques business CRITICAL.

**Objectif** : Conversion >3.5%, Abandon panier <25%, Marge nette >40%, Rupture stock <5%

**4 Domaines** :

**🛒 Ventes & CRM** - *Acquisition clients, cross-sell, fidélisation*  
- **IA-CRM** : Pilotage relation client 360°, segmentation RFM, NPS tracking  
  *Objectif* : Rétention >80%, LTV >€180  
- **Sales Coach** : Recommandations ventes temps réel, scripts personnalisés  
  *Objectif* : Conversion sales calls >15%  
- **Cross-Sell/Upsell** : Suggestions produits complémentaires, bundles  
  *Objectif* : Panier moyen +10%  
- **Churn Alert** : Détection signaux désengagement, actions préventives  
  *Objectif* : Churn <8%  

**📢 Marketing, SEO & SEA** - *Visibilité organique, campagnes payantes, contenus*  
- **SEO Sentinel** : Monitoring positions, optimisations on-page, backlinks  
  *Objectif* : Top 3 Google 10 keywords prioritaires  
- **SEA Optimizer** : Pilotage Google Ads/Facebook Ads, A/B testing audiences  
  *Objectif* : ROI pub >300%, CAC <€38  
- **Content Maker** : Génération articles SEO, newsletters, social media posts  
  *Objectif* : Trafic organique +20%/trimestre  
- **Influence Agent** : Détection influenceurs secteur, campagnes partenariats  
  *Objectif* : 5 partenariats/trimestre, reach >100K  

**💰 Pricing & Finance Opérationnelle** - *Tarification dynamique, trésorerie, fraudes*  
- **Pricing Bot** : Prix dynamiques stock/demande/concurrence  
  *Objectif* : Marge optimale >40%  
- **Margin Keeper** : Surveillance marges produits/catégories, alertes <30%  
  *Objectif* : 0 produits marge négative  
- **Facturation** : Automatisation factures, relances impayés, réconciliation bancaire  
  *Objectif* : DSO <30 jours  
- **Fraude Paiement** : Détection transactions suspectes, scoring risque  
  *Objectif* : Fraude <0.5%  

**📦 Logistique & Stock** - *Approvisionnements, livraisons, retours, green supply chain*  
- **Stock Forecaster** : Prévision besoins stock ML, alertes rupture/surstock  
  *Objectif* : Rupture <5%, Surstock <10%  
- **Supply Chain** : Optimisation tournées livraison, gestion transporteurs  
  *Objectif* : Délai livraison <48h, coût <€8/colis  
- **Retour Marchandise** : Gestion retours/SAV, analyse causes, feedback produit  
  *Objectif* : Taux retour <3%  
- **Empreinte Carbone** : Calcul CO2 supply chain, suggestions green logistics  
  *Objectif* : Émissions -15% annuel  

**KPIs Niveau 3 - BUSINESS CORE** :

| KPI Business              | Cible        | Priorité   | Responsable        |
|---------------------------|--------------|------------|-----------------|
| **Conversion globale**    | >3.5%        | CRITICAL   | IA-CRM, SEA Optimizer |
| **Abandon panier**        | <25%         | HIGH       | IA-CRM, Pricing Bot   |
| **Marge nette**           | >40%         | CRITICAL   | Margin Keeper, Pricing Bot |
| **Rupture stock**         | <5%          | HIGH       | Stock Forecaster      |
| **CAC (Coût acquisition)**| <€38         | HIGH       | SEA Optimizer, Influence Agent |
| **LTV (Lifetime Value)**  | >€180        | MEDIUM     | IA-CRM, Cross-Sell    |
| **ROI publicité**         | >300%        | HIGH       | SEA Optimizer         |
| **Trafic organique**      | +20%/trim.   | MEDIUM     | SEO Sentinel, Content Maker |
| **Taux retour produits**  | <3%          | MEDIUM     | Retour Marchandise    |
| **Émissions CO2**         | -15%/an      | LOW        | Empreinte Carbone     |

**Exemple Coordination Niveau 3 → IA-BOARD** :
```
Scénario: Alerte churn client premium (LTV €500)

1. Churn Alert détecte:
   - Client premium inactif 30j (0 connexion, 0 achat)
   - NPS dernier achat: 4/10
   - Probabilité churn: 85%

2. Escalation IA-CRM:
   - Risque business: MEDIUM (perte €500 LTV)
   - IA-CRM convoque Sales Coach + Cross-Sell

3. Action Niveau 3 (autonome):
   - Sales Coach génère email personnalisé + offre 15% fidélité
   - Cross-Sell propose bundle produit complémentaire -20%
   - IA-CRM envoie SMS commercial "Vous nous manquez"

4. Résultat (J+7):
   - Client réactivé: Achat €120
   - Churn évité: +€500 LTV préservé
   - IA-CRM: Churn global 8.5% → 8.2%
   - Pas d'escalation IA-BOARD (résolu niveau opérationnel)
```

**Dashboard Niveau 3** : `/admin/ai-cos/business` - Monitoring 4 domaines + 16 agents business temps réel

---

### Niveau 4 – EXPANSION & SUPPORT (Soutien Organisationnel)

**Concept** : Couche opérationnelle transversale pour croissance long-terme et excellence organisationnelle. Niveau 4 pilote RH, innovation, durabilité, partenaires externes et satisfaction client en autonomie, avec escalation vers IA-BOARD pour décisions stratégiques CRITICAL (budget >€10K, risques réputationnels, conformité).

**Objectif** : Satisfaction employés >80%, Innovation velocity 2 prototypes/trimestre, Empreinte carbone neutralité 2030, NPS client >50

**5 Domaines** :

**👥 RH & Organisation** - *Talent, compétences, culture*  
- **IA-HR** : Pilotage RH 360° (voir détails existants ligne 880)  
  *Objectif* : Time-to-hire <45j, Rétention >90%  
- **Talent Mapper** : Cartographie compétences équipe, gap analysis  
  *Objectif* : Skill coverage >85%  
- **Formation Agent** : Recommandations formations personnalisées, tracking progression  
  *Objectif* : Training completion >85%, Upskilling velocity +20%  

**🧪 Innovation / R&D** - *Veille techno, prototypes, expérimentation*  
- **IA-Innovation** : Coordination projets R&D, priorisation innovations  
  *Objectif* : 2 prototypes/trimestre, Time-to-market innovation <90j  
- **Tech Radar** : Veille techno continue (frameworks, outils, best practices)  
  *Objectif* : 5 opportunités tech/mois identifiées  
- **Prototype Builder** : Validation rapide MVP/POC, tests marché  
  *Objectif* : Success rate prototypes >60%  

**🌱 ESG & Durabilité** - *Environnement, social, gouvernance*  
- **IA-ESG** : Orchestration stratégie ESG globale (E+S+G)  
  *Objectif* : Score ESG global >75/100, Reporting extra-financier 100%  
- **Carbone Tracker** : Mesure empreinte carbone multi-scope (supply chain, ops, déplacements)  
  *Objectif* : Neutralité carbone 2030, -20%/an  
- **Certifications** : Tracking certifications (ISO 14001, B-Corp, etc.), renouvellements  
  *Objectif* : 0 expiration non planifiée, 3 certifications actives  

**🤝 Partenaires / Fournisseurs** - *Relations externes, SLA, contrats*  
- **IA-Supplier** : Gestion portefeuille fournisseurs, performance monitoring  
  *Objectif* : Supplier reliability >95%, Diversification 5 suppliers/catégorie  
- **Contract Manager** : Pilotage cycle vie contrats, négociations, renouvellements  
  *Objectif* : Contrats à jour 100%, Savings négociations >10%  
- **SLA Monitor** : Surveillance SLA temps réel, alertes dépassements  
  *Objectif* : SLA compliance >98%, Incidents partenaires <2/mois  

**💬 Customer 360°** - *Expérience client, feedback, fidélisation*  
- **IA-Support** : Orchestration support client (voir détails existants ligne 823)  
  *Objectif* : Response time <2h, CSAT >4.5/5  
- **Feedback Analyzer** : Analyse feedback multi-sources (avis, NPS, tickets, social)  
  *Objectif* : Sentiment positif >75%, Actions correctives <7j  
- **NPS Tracker** : Monitoring Net Promoter Score, segmentation détracteurs/promoteurs  
  *Objectif* : NPS >50, Promoteurs >60%  

**KPIs Niveau 4 - EXPANSION & SUPPORT** :

| KPI Support              | Cible        | Priorité   | Responsable        |
|--------------------------|--------------|------------|--------------------|
| **Satisfaction employés** | >80/100      | HIGH       | IA-HR, Formation Agent |
| **Time-to-hire**         | <45 jours    | MEDIUM     | Talent Mapper          |
| **Innovation velocity**  | 2 proto/trim | HIGH       | IA-Innovation          |
| **Tech opportunities**   | 5/mois       | MEDIUM     | Tech Radar             |
| **Score ESG global**     | >75/100      | CRITICAL   | IA-ESG                 |
| **Empreinte carbone**    | -20%/an      | HIGH       | Carbone Tracker        |
| **Supplier reliability** | >95%         | HIGH       | IA-Supplier            |
| **SLA compliance**       | >98%         | HIGH       | SLA Monitor            |
| **NPS client**           | >50          | CRITICAL   | NPS Tracker            |
| **CSAT support**         | >4.5/5       | HIGH       | IA-Support             |
| **Training completion**  | >85%         | MEDIUM     | Formation Agent        |
| **Certifications actives**| 3 min       | MEDIUM     | Certifications         |

**Exemple Coordination Niveau 4 → IA-BOARD** :
```
Scénario: Certification ISO 14001 expiration imminente (60 jours)

1. Certifications Agent détecte:
   - ISO 14001 expire dans 60j
   - Risque: Perte certification = impact commercial
   - Conformité actuelle: 92% (gap 8% à corriger)

2. Escalation IA-ESG:
   - Risque réputationnel: HIGH (perte label green)
   - IA-ESG convoque Carbone Tracker + IA-HR (formation équipe)

3. Coordination Niveau 4 (autonome):
   - Carbone Tracker: Audit gap 8% conformité (3 non-conformités identifiées)
   - IA-HR: Plan formation 15 employés (5j)
   - Contract Manager: Prépare dossier audit externe

4. Escalation IA-BOARD (budget >€5K):
   - IA-ESG → IA-RISK: Risque global = 55/100 (MEDIUM)
   - IA-CEO: Validation budget €8K (audit externe + formations)
   - IA-LEGAL (Board): Validation conformité légale

5. Résultat (J+45):
   - 3 non-conformités corrigées
   - 15 employés formés (training completion 100%)
   - Audit externe: PASSED
   - ISO 14001 renouvelée (validité +3 ans)
   - IA-ESG: Score ESG 72 → 78/100
```

**Dashboard Niveau 4** : `/admin/ai-cos/expansion` - Monitoring 5 domaines + 15 agents support/expansion temps réel

---

### Pourquoi IA-BOARD + 4 Pôles (vs 5 Niveaux Hiérarchiques)?

**Hybride Governance + Opérationnel** :
- ✅ **IA-BOARD (Niveau 1)** : Gouvernance stratégique (CEO, CFO/COO, Legal, Risk) = décisions TOP-DOWN
- ✅ **4 Pôles Métier** : Exécution opérationnelle autonome = efficacité BOTTOM-UP
- ✅ **Séparation claire** : Stratégie (Board) vs Exécution (Pôles) vs Coordination (Squads)
- ✅ **Contrôle + Flexibilité** : Board supervise sans micro-management, pôles décident localement

**Pourquoi pas hiérarchie 5 niveaux pure?**
- ❌ Trop verticale = lenteur décisions opérationnelles
- ❌ Confusion rôles : qui décide? Niveau 2 ou Niveau 3?
- ✅ Solution fusion : Board décide stratégie/budget/risques, Pôles exécutent avec autonomie

**Flux décisionnel** :
```
IA-BOARD (Gouvernance)
  ↓ Définit: OKRs, Budgets, Contraintes légales, Seuils risque
4 PÔLES (Opérationnel)
  ↓ Exécutent: Initiatives, Optimisations, Décisions LOW risk
5 SQUADS (Coordination)
  ↓ Coordonnent: Actions cross-pôles, Escalations MEDIUM risk
IA-BOARD (Validation)
  ↓ Valide: Décisions HIGH/CRITICAL risk, Arbitrages inter-pôles
```

**Mapping organisation** :
- **IA-BOARD** = Comité Direction (C-Level real)
- 🧩 **Stratégique** = Équipes Strategy, Finance, Legal, HR
- ⚙️ **Tech & Produit** = Engineering + Product + QA
- 📊 **Business Marché** = Sales, Marketing, Ops, Support
- 🌍 **Expansion** = Innovation, Partenariats, R&D

**Avantages architecture** :
- **Contrôle** : Board valide décisions critiques (budget >€5K, risque >70/100)
- **Agilité** : Pôles décident autonomie 80% actions (LOW risk)
- **Transparence** : KPIs Board + Pôles visibles dashboard unique
- **Scaling** : Ajout agents dans pôles sans refonte governance

## 📊 Monitoring & KPIs Globaux : Health Board IA-CEO

### Vue d'Ensemble

Le **Health Board** agrège les **40 KPIs** des 57 agents + 5 Squads en un **Health Score Global** (0-100). IA-CEO utilise ce score pour superviser la santé des 4 pôles et orchestrer l'arbitrage humain.

**Architecture Agrégation** :

```
HEALTH SCORE GLOBAL (0-100) - IA-CEO Dashboard
        ↑ agrège
6 KPIs BOARD (health, roi, cashflow, risque, compliance)
        ↑ synthétise
40 KPIs OPÉRATIONNELS (Board L.290 + Tech L.331 + Business L.434 + Support L.530)
        ↑ collecte
57 AGENTS + 5 SQUADS (KPIs individuels Redis + Supabase)
```

---

### Health Score : Formule de Calcul

**Pondération** (somme pondérée 40 KPIs normalisés 0-100) :

| Pôle | Pondération | KPIs Critiques | Exemple |
|------|-------------|----------------|---------|
| **Tech & Produit** | 25% | backend-p95, maintenabilité, ux-score | 100 → 25 pts |
| **Business Core** | 40% | conversion, marge, stock, roi-pub | 108 → 40 pts |
| **Support** | 20% | esg, nps, satisfaction | 109 → 20 pts |
| **Squads** | 15% | vélocité, coordination, budget | 106 → 15 pts |

**Health Score = 25+40+20+15 = 100 points** (optimal)

**Seuils Alertes** :

| Score | Statut | Action | Escalation |
|-------|--------|--------|------------|
| ≥85 | 🟢 EXCELLENT | Aucune | - |
| 70-84 | 🟡 ATTENTION | Alerte Slack | Lead Squad <24h |
| 50-69 | 🟠 DÉGRADÉ | Alerte + Sentry | IA-CEO <4h |
| <50 | 🔴 CRITIQUE | PagerDuty | Board <2h |

---

### Dashboard Health Board (`/admin/ai-cos/board`)

**Composants UI** :

```typescript
interface HealthBoardView {
  // 📊 KPIs Cards (7 métriques critiques temps réel)
  kpiCards: {
    codeHealth: { value: 92, target: 85, trend: '+3%' },
    perfBackend: { value: 165, target: 180, trend: '-8%' },
    uxScore: { value: 88, target: 85, trend: '+2%' },
    conversion: { value: 3.7, target: 3.5, trend: '+5%' },
    roiCampagnes: { value: 285, target: 250, trend: '+12%' },
    stockRupture: { value: 3.2, target: 5, trend: '-35%' },
    esgScore: { value: 82, target: 80, trend: 'stable' }
  };
  
  // 🚨 Alertes Actives
  alerts: [{ severity: 'YELLOW', agent: 'SEO Optimizer', 
             kpi: 'trafic -8%', action: 'Analyser algo update' }];
  
  // ⏳ Approbations Pending
  pendingApprovals: [{ agent: 'Pricing Bot', action: 'Hausse +8%',
                       budget: '€450', sla: '1h45' }];
  
  // 📜 Timeline Actions (20 dernières)
  recentActions: [{ timestamp: '14:32', agent: 'DevOps',
                    action: 'Scaling +2 pods', result: 'SUCCESS' }];
}
```

**Flux Données** :

```
Data Brain.getBusinessHealthView()
  → IA-CEO.calculateHealthScore(snapshot)
  → DialogueLayer.getDashboardData('board')
  → Remix /admin/ai-cos/board affiche UI
```

---

### Workflow Escalation & Arbitrage

```
AGENT DÉTECTE ANOMALIE (KPI hors seuil)
        ↓
Calcul Risque + Budget
        ↓
    ┌───┼────┐
    ↓   ↓    ↓
<€2K  €2K  >€10K
LOW   MED  HIGH
    ↓   ↓    ↓
 AUTO SQUAD  CEO
       ↓     ↓
      <2h   <4h
             ↓ CRITICAL (<50)
           BOARD <2h
        ↓
LOG ai_cos_monitoring_events
```

**Exemple** : Pricing Bot détecte concurrent -12% → Budget €450 → Escalation Squad E-Commerce → CFO approuve 1h30 → Exécution → Mesure +8% conversion ✅

---

### KPIs Dashboard (7 Métriques Critiques)

| KPI | Source (ADR) | Owner | Pond. | Alerte |
|-----|--------------|-------|-------|--------|
| Code Health | maintenabilité L.338 | IA-CTO | 10% | <85 |
| Perf Backend | backend-p95 L.336 | DevOps | 8% | >180ms |
| UX Score | ux-score L.341 | Designer | 7% | <85 |
| Conversion | conversion L.438 | CRM | 15% | <3.5% |
| ROI Campagnes | roi-pub L.444 | SEA | 12% | <250% |
| Stock Rupture | stock L.441 | Forecaster | 10% | >5% |
| ESG Score | esg L.536 | ESG | 8% | <75 |

**Total pondération : 70%** (30% autres KPIs onglets spécialisés)

---

### Alertes Proactives

**3 Types** :

1. **Reactive** : KPI < seuil → Alerte immédiate
2. **Prédictive** : Tendance 7j → Alerte avant seuil (ex: -0.05%/j × 7 = -0.35%)
3. **Corrélation** : Data Brain détecte (ex: ↓SEO -8% → ↓Conversion prévue -2%)

---

### KPIs Méta-Monitoring

| KPI | Target | Mesure | Owner | Alerte |
|-----|--------|--------|-------|--------|
| dashboard-latency | <500ms | Temps chargement board | DevOps | >1s |
| kpi-freshness | <5min | Dernière MAJ Redis | Data Brain | >10min |
| alert-response-time | <15min | Détection → action | IA-CEO | >30min |
| health-score-stability | ±2/jour | Volatilité score | IA-RISK | >±5 |

**Schéma DB** :

```sql
CREATE TABLE ai_cos_monitoring_events (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  agent_id TEXT,
  kpi_name TEXT,
  kpi_value NUMERIC,
  status TEXT CHECK (status IN ('GREEN','YELLOW','ORANGE','RED')),
  action_taken TEXT,
  approved_by TEXT,
  context JSONB
);
```

---

### Intégration Modes & Forecast

**Dashboards Complémentaires** :

- `/admin/ai-cos/board` → QUOI (Health Score, KPIs temps réel)
- `/admin/ai-cos/modes` → COMMENT (autonomie agents)
- `/admin/ai-cos/forecast` → FUTUR (simulations Board)

**Session Board Exemple** :

```
09:05 - Health Board: Score 82/100 🟢, Conversion 3.7%, ROI 285%
09:15 - CFO: "Impact si +€10K marketing?"
09:20 - Mode Forecast: Score prévu 82→86, Conversion 3.7%→4.1%, ROI 285%→310%
09:25 - Board: ✅ APPROUVÉ +€10K (ROI élevé)
```

---

### 💰 Budget & ROI

**Développement** :

| Composant | Effort | Coût |
|-----------|--------|------|
| Backend API Health Score | 2 sem | €6K |
| Frontend Dashboard | 1.5 sem | €5K |
| Alertes engine | 1 sem | €3K |
| Tests E2E | 0.5 sem | €2K |
| **TOTAL** | **5 sem** | **€16K** |

**Budget Méta-Couches Révisé** : €151K (€135K + €16K monitoring)

**ROI** :
- Gains vélocité : €144K/an (2h/j économisées décideurs)
- Gains prévention : €40K/an (8 incidents évités)
- **Total gains : €184K/an**
- **ROI monitoring : 1150%**

**ROI global architecture : 324%** (€1.332M gains / €411K coût)

---

### 🚦 Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Alert fatigue | 🟠 Medium | Max 5 alertes simultanées, seuils conservateurs |
| Dashboard latency | 🟡 Low | Redis cache TTL 30s, lazy loading |
| KPIs stale | 🟠 Medium | Méta-KPI freshness, alerte >5min |
| Health Score volatilité | 🟡 Low | Lissage 7j, alerte >±5pts/jour |

---

### 📋 Checklist Implémentation

- [ ] Schéma DB `ai_cos_monitoring_events` créé
- [ ] Formule Health Score validée Board (pondération 25/40/20/15%)
- [ ] Seuils alertes définis (🟢≥85, 🟡70-84, 🟠50-69, 🔴<50)
- [ ] 7 KPIs dashboard sélectionnés (refs ADR validées)
- [ ] Matrice escalation documentée (<€2K AUTO, €2K-10K SQUAD, >€10K CEO)
- [ ] API `/api/health-board` implémentée
- [ ] Dashboard `/admin/ai-cos/board` 5 sections
- [ ] Intégration Slack/Email alertes
- [ ] Tests E2E escalation
- [ ] 4 méta-KPIs monitoring
- [ ] CLI commands (`ai-cos health`, `ai-cos alerts`)
- [ ] Budget confirmé €16K (Dialogue Layer €36K total)

---

### 🎯 Conclusion

Le **Health Board** est la **pièce manquante critique** de l'architecture AI-COS. Il transforme 40 KPIs dispersés en **vue unique gouvernance** (Health Score 0-100), formalise **workflow escalation** agent→Squad→CEO→Board, et fournit **alertes intelligentes** (reactive + prédictive + corrélation).

**Impact** : ROI 1150%, architecture complète ADR-006, confiance Board maximale.

**Implémentation** : Phase 2-4 (5 semaines, €16K), priorité HAUTE.

### Intelligence Cognitive & Feedback Loops

**Concept** : AI-COS n'est pas un système de monitoring passif, mais un **organisme cognitif auto-apprenant** où chaque agent observe, agit, mesure et s'améliore en continu.

#### Cycle d'Apprentissage par Agent

Chaque agent (57 agents opérationnels + 5 Squads) suit un cycle cognitif en 4 étapes :

**1. 👁️ OBSERVE** : Surveillance périmètre temps réel
- Collecte données via APIs, bases de données, logs
- Détection anomalies via règles heuristiques + ML (Phase 5)
- Triggers événements si seuils dépassés

**2. 🤖 PROPOSE** : Génération action intelligente
- **Auto-fix** : Corrections automatiques LOW risk (ex: clear cache, restart service)
- **Recommandation** : Suggestions MEDIUM risk (ex: upgrade dependency, adjust pricing)
- **Refactor** : Améliorations HIGH risk (ex: architecture change, budget reallocation)
- Mode validation : Safe (validation manuelle) / Assisted (suggestion) / Auto-drive (exécution auto <seuil risque)

**3. 📊 MESURE** : Impact KPI post-action
- Snapshot KPIs avant action
- Snapshot KPIs après action (1h, 24h, 7j selon criticité)
- Calcul delta : KPI improved / degraded / neutral
- Attribution : Action → Impact causal (A/B tests si possible)

**4. 🧠 APPREND** : Feedback loops multi-sources
- **Feedback humain** : Validation/Rejet action par Squad lead ou Board
- **Résultats réels** : KPIs mesurés vs prévisions agent
- **Pattern recognition** : Stockage context + action + outcome (Supabase `ai_cos_learning_events`)
- **Amélioration continue** : Ajustement confiance agent (0-100%) basé historique succès

#### Orchestration IA-CEO : Synchronisation Globale

**Rôle cognitif IA-CEO v2** :
- **Coordinator** : Synchronise feedback loops 57 agents + 5 Squads
- **Aligner** : Garantit décisions locales → servent objectifs globaux
- **Arbitrator** : Résout conflits inter-agents (ex: marketing veut budget, finance veut économies)
- **Learner** : Méta-apprentissage cross-domaines (ex: pattern "stock bas + campagne haute = rupture")

**Exemples Synchronisation** :

##### Exemple 1 : Corrections Techniques → Profit Business
```
Scenario: IA-DevOps optimise cache Redis (action technique)

1. OBSERVE:
   - IA-DevOps: Backend p95 = 280ms (dégradé vs baseline 180ms)
   - IA-CEO: Détecte impact business potentiel (conversion sensible perf)

2. PROPOSE:
   - IA-DevOps: Optimisation cache Redis TTL 5min → 15min
   - Risk: 20/100 (LOW impact, réversible)

3. MESURE (48h après déploiement):
   - Backend p95: 280ms → 165ms ✅
   - Pricing Bot (Performance Squad): Conversion +0.3% ✅
   - Revenue impact: +€4.5K/mois

4. APPREND:
   IA-CEO stocke pattern:
   - Context: "Backend p95 >250ms"
   - Action: "Cache optimization"
   - Outcome: "Conversion +0.3%, Revenue +€4.5K"
   - Confidence: 95/100 (succès mesuré)
   
   → Prochaine fois p95 >250ms: Auto-suggest cache optimization
```

##### Exemple 2 : Campagnes Marketing → Alignées Stock & Marge
```
Scenario: IA-CMO planifie campagne Black Friday "Pneus Hiver"

1. OBSERVE:
   - IA-CMO (E-Commerce Squad): Opportunité keyword +300% volume
   - Stock Forecaster: Stock actuel 450 unités (suffisant 3 mois normal)
   - Pricing Bot: Marge actuelle 37%

2. PROPOSE (Coordination E-Commerce Squad):
   - IA-CMO: Campagne Google Ads budget €5K (estimation +120 conversions)
   - Stock Forecaster: WARNING: 120 conversions × 1.5 (Black Friday) = 180 ventes
     → Stock restant: 450 - 180 = 270 unités (2 mois) = OK mais limite
   - Pricing Bot: Ajuster prix -10% → Marge 32% mais volume +40%

3. IA-CEO SYNCHRONISE (décision globale):
   - Validation: Campagne OK mais limiter budget €3.5K (éviter rupture)
   - Pricing Bot: Prix -8% (compromis marge/volume)
   - Stock Forecaster: Pre-order 200 unités Supplier B (backup)
   - Risk: 45/100 (MEDIUM - risque rupture si >prévu)

4. MESURE (2 semaines campagne):
   - Conversions: 95 (vs 84 prévu avec budget réduit) ✅
   - Stock restant: 355 unités (pas de rupture) ✅
   - Marge: 33% (vs 32% prévu) ✅
   - CA: +€18K (ROI campagne 514%)

5. APPREND:
   IA-CEO stocke pattern:
   - Context: "High volume keyword + Stock <500 unités"
   - Action: "Reduce budget + Price adjustment + Pre-order backup"
   - Outcome: "95 conversions, 0 rupture, 33% marge, ROI 514%"
   - Confidence: 88/100
   
   → Pattern réutilisable pour prochaines campagnes saisonnières
```

##### Exemple 3 : Décisions Locales → Objectifs Globaux
```
Scenario: Conflict budget Q1 2025

1. OBSERVE (3 demandes simultanées):
   - IA-CMO: Demande +€10K budget marketing (ROI prévu 250%)
   - IA-CTO: Demande +€8K upgrade infra (reduce costs -€2K/mois)
   - IA-HR: Demande +€12K recrutement (fill skill gaps)

2. IA-CEO ANALYSE (objectifs globaux):
   - OKR Q1 prioritaire: Revenue growth +15%
   - Budget disponible: €15K (pas €30K)
   - Contrainte: Runway 18 mois (pas de burn rate excessif)

3. IA-CFO/COO SIMULE scenarios:
   - Scenario A: 100% marketing (€10K)
     → Revenue +€25K, ROI 250%, mais technical debt +10%
   - Scenario B: 100% infra (€8K)
     → Cost saving €2K/mois = €24K/an, mais revenue stagnant
   - Scenario C: Mix 60% marketing (€6K) + 40% infra (€5K) + 0% HR
     → Revenue +€15K, Cost save €1.2K/mois = €14.4K/an, debt stable

4. IA-BOARD DÉCIDE:
   - Validation: Scenario C (équilibre revenue + efficiency)
   - IA-CMO: Budget €6K approuvé (focus campagnes ROI >300%)
   - IA-CTO: Budget €5K approuvé (priorité cache + monitoring)
   - IA-HR: Budget €0K Q1 (reporté Q2, recruter après revenue growth prouvé)

5. MESURE (fin Q1):
   - Revenue: +€15.2K (target +€15K) ✅
   - Cost save: €1.5K/mois (better than prévu) ✅
   - Technical debt: 75/100 (stable vs 70/100 baseline) ✅

6. APPREND:
   IA-CEO stocke pattern:
   - Context: "Budget constraint + Multiple requests"
   - Action: "Balance revenue growth + efficiency (60/40 split)"
   - Outcome: "Targets hit, debt stable, stakeholders aligned"
   - Confidence: 92/100
   
   → Future budget arbitrages: Prefer balanced approach vs all-in single domain
```

#### Architecture Technique Feedback Loops

**Tables Supabase** :
```sql
-- Nouvelle table: Historique actions agents
CREATE TABLE ai_cos_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Agent context
  agent_id TEXT NOT NULL,
  squad_id TEXT, -- NULL si agent solo
  
  -- Action proposée
  action_type TEXT NOT NULL, -- 'auto-fix' | 'recommendation' | 'refactor'
  action_description TEXT NOT NULL,
  risk_score NUMERIC NOT NULL, -- 0-100
  
  -- KPIs avant/après
  kpis_before JSONB NOT NULL,
  kpis_after JSONB,
  kpis_delta JSONB,
  
  -- Feedback
  human_feedback TEXT, -- 'approved' | 'rejected' | 'modified'
  human_feedback_reason TEXT,
  outcome TEXT NOT NULL, -- 'success' | 'failure' | 'neutral'
  
  -- Apprentissage
  confidence_before NUMERIC DEFAULT 50, -- 0-100
  confidence_after NUMERIC, -- Ajusté selon outcome
  pattern_stored BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  context JSONB NOT NULL,
  notes TEXT
);

CREATE INDEX idx_ai_cos_learning_agent ON ai_cos_learning_events(agent_id, created_at DESC);
CREATE INDEX idx_ai_cos_learning_outcome ON ai_cos_learning_events(outcome, confidence_after DESC);
```

**Package `@repo/ai-cos-learning`** (Phase 5 - Semaines 17-20) :
```typescript
// Learning engine types
interface LearningEvent {
  agentId: string;
  actionType: 'auto-fix' | 'recommendation' | 'refactor';
  actionDescription: string;
  riskScore: number;
  kpisBefore: Record<string, number>;
  kpisAfter?: Record<string, number>;
  humanFeedback?: 'approved' | 'rejected' | 'modified';
  outcome: 'success' | 'failure' | 'neutral';
  context: Record<string, any>;
}

// Pattern recognition (Phase 5 - ML simple)
interface LearnedPattern {
  contextSignature: string; // Hash du context (ex: "high_p95_backend")
  actionRecommended: string;
  successRate: number; // 0-100
  avgImpact: Record<string, number>; // KPIs delta moyen
  confidence: number; // 0-100
  occurrences: number;
}
```

#### Roadmap Feedback Loops

**Phase 1-4** : Feedback loops **manuels**
- Agents proposent actions
- Validation humaine obligatoire (Squad lead ou Board)
- Stockage outcomes dans `ai_cos_learning_events`
- Confidence ajustée manuellement

**Phase 5** : Feedback loops **semi-automatiques** (Semaines 17-20)
- Pattern recognition simple (règles heuristiques)
- Auto-approval actions LOW risk (<20/100) avec confidence >80
- ML basique (TensorFlow.js) : Prédiction success action
- Dashboard learning : `/admin/ai-cos/learning` (patterns découverts, confidence agents)

**Phase 6+** (Future - Post-20 semaines) : Feedback loops **automatiques**
- Auto-drive mode: Agents exécutent actions LOW/MEDIUM risk sans validation
- Reinforcement learning : Agents optimisent stratégies via récompenses KPIs
- Meta-learning : IA-CEO découvre patterns cross-domaines non évidents

#### Résultat : Entreprise Auto-Améliorante

**Bénéfices mesurables** :
- ✅ **Réduction temps décision** : 80% actions LOW risk auto-approuvées (Phase 5)
- ✅ **Amélioration continue KPIs** : +2-5% KPIs/trimestre via optimisations apprises
- ✅ **Réduction erreurs** : Agents apprennent de échecs, confidence ajustée
- ✅ **Alignement global** : IA-CEO synchronise décisions locales → objectifs stratégiques
- ✅ **Knowledge institutionnel** : Patterns stockés survivent turnover équipe

**Vision long-terme** :
> "Une entreprise où chaque décision (technique, business, produit) est **informée par l'historique**, **optimisée par ML**, et **alignée sur la stratégie globale** — le tout sans micro-management humain constant."

---
### 12 Nouveaux Agents Détaillés (Organisés par Pôle)


## 🎮 Modes d'Opération AI-COS

### Vue d'ensemble

Les **57 agents + 5 Squads** de l'Entreprise Augmentée opèrent selon **4 modes d'autonomie progressive**, alignés sur le cycle d'apprentissage (Observe → Propose → Mesure → Apprend). Ces modes constituent la **couche de gouvernance** qui régule l'autonomie des agents en fonction de leur maturité et du risque des actions proposées.

| Mode | Description | Usage | Autonomie | Validation |
|------|-------------|-------|-----------|------------|
| **🔒 Safe** | Corrige uniquement les problèmes 100% sûrs (doublons, CSS, refactor trivial) | CI/CD automatisé, production continue | 0% (lecture seule ou corrections triviales) | Aucune (auto-apply) |
| **🤝 Assisted** | Propose actions & scénarios, validation humaine requise avant exécution | Sprint hebdo, opérations quotidiennes | 30% (recommandation intelligente) | Humaine obligatoire (Lead Squad, CFO, Board) |
| **🚀 Auto-Drive** | Exécute corrections apprises validées par feedback (>3 itérations, confidence >85%, budget <€2K) | Après maturity prouvée (6+ mois opération) | 80% (exécution autonome sous seuils) | Humaine si budget >€2K ou risque HIGH |
| **🔮 Forecast** | Simule stratégie complète (tech, finance, SEO, UX) via Simulation Layer sans exécution | Board stratégique, planification trimestrielle | 0% (read-only, scénarios what-if) | Aucune (pas d'exécution réelle) |

**Note importante** : Le mode **Forecast** utilise la **Simulation Layer** (méta-couche cognitive, lignes 1151-1235) pour générer des scénarios prédictifs. Il ne s'agit pas d'un agent supplémentaire, mais d'un mode opératoire temporaire activé par IA-CEO lors des sessions stratégiques Board.

---

### Critères de Passage de Mode

#### 🔒 Safe → 🤝 Assisted
Conditions requises :
- ✅ **Agent déployé en production >30j** (période observation minimale)
- ✅ **0 erreurs critiques historiques** (logs Sentry, Grafana clean)
- ✅ **KPIs baseline établis** (1 mois données minimum pour mesurer impact)
- ✅ **Périmètre action défini** (scope clair, pas de drift fonctionnel)

**Validation** : Lead Squad + IA-CEO review

---

#### 🤝 Assisted → 🚀 Auto-Drive
Conditions requises (cumulative) :
- ✅ **3 itérations réussies minimum** avec validation humaine positive
- ✅ **Confidence score agent >85%** (calculé via feedback loops, historique succès)
- ✅ **Budget action <€2K** (seuil autonomie Squad défini gouvernance)
- ✅ **KPIs amélioration >5%** mesurée sur 7j post-action (impact prouvé)
- ✅ **0 rollbacks** sur 3 dernières itérations (fiabilité démontrée)
- ✅ **Approbation Board IA-COS** (décision formelle, validation CFO si financier)

**Fallback automatique Assisted si** :
- Budget action >€2K (validation CFO requise)
- Risque action = HIGH (tag manuel ou détection IA-CEO)
- Confidence score <85% (agent dégradé, nécessite re-training)

**Validation** : Board IA-COS (IA-CEO, CFO, Lead Squads concernés)

---

#### 🤝 Assisted / 🚀 Auto-Drive → 🔮 Forecast (temporaire)
Conditions requises :
- ✅ **Session Board stratégique planifiée** (IA-CEO active mode)
- ✅ **Simulation Layer opérationnelle** (méta-couche disponible Phase 3+)
- ✅ **Scénarios what-if demandés** explicitement (CEO, CFO, Board)
- ⏱️ **Durée limitée session** (2-4h max, retour automatique mode précédent)

**Mode read-only** : Aucune action exécutée en production, simulations sandbox uniquement.

**Validation** : IA-CEO activation automatique, pas d'approbation requise (pas d'exécution réelle)

---

### Gouvernance des Modes

| Scope | Mode par défaut | Qui peut activer mode supérieur | Validation requise | SLA décision |
|-------|----------------|--------------------------------|-------------------|--------------|
| **Agent individuel** (ex: Pricing Bot) | Safe | Lead Squad E-Commerce | CFO approval si Auto-Drive | <48h |
| **Squad complet** (ex: Squad Performance) | Assisted | Board IA-COS | CEO approval si Auto-Drive global | <7j |
| **Système global** (57 agents) | Assisted | IA-CEO + Board | CEO approval obligatoire | Board meeting |
| **Session Board** (IA-CEO forecast) | Forecast | IA-CEO seul | Automatique (read-only) | Instantané |

**Escalation automatique** :
- Si validation >SLA → Escalation niveau supérieur (Lead Squad → CFO → CEO)
- Si timeout validation >2x SLA → Rejet automatique action (principe prudence)

**Audit trail** :
- Toutes transitions mode enregistrées dans `ai_cos_mode_transitions` (Supabase)
- Logs : `{ agent_id, from_mode, to_mode, approved_by, timestamp, reason, context }`

---

### KPIs de Performance par Mode

| Mode | KPI Clé | Target | Alerte si | Mesure |
|------|---------|--------|-----------|--------|
| **Safe** | `safe-error-rate` | 0% | >0 erreurs/mois | Sentry logs agents mode Safe |
| **Safe** | `safe-actions-count` | >100/mois | <50 (sous-utilisation) | Actions auto-applied |
| **Assisted** | `validation-delay` | <2h | >4h (bottleneck humain) | Temps proposition → approbation |
| **Assisted** | `approval-rate` | >80% | <60% (propositions rejetées) | Actions validées / proposées |
| **Auto-Drive** | `success-rate` | >90% | <85% (rollback fréquents) | Actions réussies / exécutées |
| **Auto-Drive** | `confidence-avg` | >85% | <80% (agent non mature) | Score confiance moyen agents |
| **Auto-Drive** | `auto-actions-count` | >50/mois | <20 (sous-utilisation) | Actions autonomes exécutées |
| **Forecast** | `prediction-accuracy` | >75% ±10% | <60% (modèles imprécis) | Prédictions vs réalité 30j après |
| **Forecast** | `board-adoption-rate` | >60% | <40% (recommandations ignorées) | Scénarios approuvés / simulés |

**Dashboard KPIs** : `/admin/ai-cos/modes` (Vue consolidée 4 modes, alertes temps réel)

---

### Architecture Technique State Machine

```typescript
// backend/src/ai-cos/modes/operation-mode.service.ts

export enum OperationMode {
  SAFE = 'safe',
  ASSISTED = 'assisted',
  AUTO_DRIVE = 'auto-drive',
  FORECAST = 'forecast'
}

export interface ModeTransitionCriteria {
  safeToAssisted: {
    daysInProduction: number;        // 30
    criticalErrors: number;           // 0
    baselineDataDays: number;         // 30
  };
  assistedToAutoDrive: {
    successfulIterations: number;     // 3
    confidenceScore: number;          // 85
    maxBudgetThreshold: number;       // 2000
    kpiImprovement: number;           // 5 (%)
    zeroRollbacks: boolean;           // true
  };
}

export class OperationModeService {
  private redis: Redis;
  private supabase: SupabaseClient;

  // 🔹 VÉRIFIER ÉLIGIBILITÉ TRANSITION
  async canTransition(
    agentId: string,
    fromMode: OperationMode,
    toMode: OperationMode
  ): Promise<{ eligible: boolean; reasons: string[] }> {
    
    const agent = await this.getAgent(agentId);
    const history = await this.getAgentHistory(agentId);
    const criteria = this.getTransitionCriteria(fromMode, toMode);

    const checks = [];

    if (fromMode === OperationMode.SAFE && toMode === OperationMode.ASSISTED) {
      checks.push(
        { pass: history.daysInProduction >= 30, reason: 'Production >30j' },
        { pass: history.criticalErrors === 0, reason: '0 erreurs critiques' },
        { pass: history.baselineEstablished, reason: 'Baseline KPIs établi' }
      );
    }

    if (fromMode === OperationMode.ASSISTED && toMode === OperationMode.AUTO_DRIVE) {
      checks.push(
        { pass: history.successfulIterations >= 3, reason: '3+ itérations réussies' },
        { pass: agent.confidenceScore >= 85, reason: 'Confidence >85%' },
        { pass: history.avgBudget < 2000, reason: 'Budget moyen <2K€' },
        { pass: history.kpiImprovement >= 5, reason: 'KPIs +5%' },
        { pass: history.recentRollbacks === 0, reason: '0 rollbacks récents' }
      );
    }

    const eligible = checks.every(c => c.pass);
    const reasons = checks.filter(c => !c.pass).map(c => `❌ ${c.reason}`);

    return { eligible, reasons };
  }

  // 🔹 EXÉCUTER TRANSITION AVEC APPROBATION
  async transitionMode(
    agentId: string,
    toMode: OperationMode,
    approvedBy: string,
    reason: string
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    const eligibility = await this.canTransition(agent.mode, agent.mode, toMode);

    if (!eligibility.eligible) {
      throw new Error(`Transition inéligible: ${eligibility.reasons.join(', ')}`);
    }

    // Enregistre transition audit trail
    await this.supabase.from('ai_cos_mode_transitions').insert({
      agent_id: agentId,
      from_mode: agent.mode,
      to_mode: toMode,
      approved_by: approvedBy,
      reason,
      timestamp: new Date(),
      context: { eligibility, agent }
    });

    // Update agent mode
    await this.supabase.from('ai_cos_agents').update({ mode: toMode }).eq('id', agentId);

    // Notifie Dialogue Layer (Slack, Dashboard)
    await this.dialogueLayer.notify({
      channel: '#ai-cos-governance',
      message: `🎮 Agent **${agent.name}** : ${agent.mode} → ${toMode} (approuvé par ${approvedBy})`
    });

    // Redis cache invalidation
    await this.redis.del(`agent:${agentId}:mode`);
  }

  // 🔹 VÉRIFIER ACTION AUTORISÉE SELON MODE
  async canExecuteAction(
    agentId: string,
    action: ProposedAction
  ): Promise<{ allowed: boolean; requiresApproval: boolean }> {
    const agent = await this.getAgent(agentId);

    switch (agent.mode) {
      case OperationMode.SAFE:
        // Uniquement actions triviales (CSS, cache clear, logs)
        return {
          allowed: action.risk === 'TRIVIAL',
          requiresApproval: false
        };

      case OperationMode.ASSISTED:
        // Toutes actions permises mais approbation humaine requise
        return {
          allowed: true,
          requiresApproval: true
        };

      case OperationMode.AUTO_DRIVE:
        // Actions autonomes si budget <2K€ et risque LOW/MEDIUM
        const autoAllowed = action.budget < 2000 && ['LOW', 'MEDIUM'].includes(action.risk);
        return {
          allowed: true,
          requiresApproval: !autoAllowed
        };

      case OperationMode.FORECAST:
        // Mode read-only, aucune exécution réelle
        return {
          allowed: false,
          requiresApproval: false
        };
    }
  }
}
```

---

### Exemples de Transitions Complètes

#### Exemple 1 : Pricing Bot — Safe → Auto-Drive (6 mois)

**📅 Mois 1-2 : Mode 🔒 Safe**
```
Agent: Pricing Bot v1
Déploiement: 2025-01-15
Mode: Safe (lecture seule)

Actions:
  - Surveille prix concurrence (1500 produits, 25 concurrents)
  - Collecte élasticité prix (historique 60j)
  - Détecte anomalies (concurrent baisse prix >20%)
  - Alerte Lead Squad E-Commerce (aucune exécution autonome)

Résultat:
  ✅ 0 erreurs critiques
  ✅ Baseline établi (1500 produits × 60j données)
  ✅ 12 alertes anomalies envoyées (100% pertinentes)

Décision: Transition Safe → Assisted (approbation Lead Squad)
```

---

**📅 Mois 3-5 : Mode 🤝 Assisted**
```
Mode: Assisted (validation CFO requise)

Itération 1 (Semaine 1):
  Observation: Concurrent A baisse prix produit X -8%
  Proposition: Aligner prix -5% (€49 → €46.50)
  Simulation: Prévision +8% conversion, -3% marge
  Validation: CFO approuve ✅
  Exécution: Prix changé 2025-03-01
  Mesure (7j): +11% conversion, -2% marge ✅ Succès
  Confidence: 72% → 78%

Itération 2 (Semaine 3):
  Observation: Forte demande produit Y (stock 85%)
  Proposition: Hausse prix +10% (€120 → €132)
  Simulation: Prévision -5% conversion, +8% marge
  Validation: CFO approuve ✅
  Exécution: Prix changé 2025-03-15
  Mesure (7j): -12% conversion, +3% marge ⚠️ Impact négatif
  Rollback: Prix restauré €120 (2025-03-22)
  Confidence: 78% → 74% (pénalité échec)

Itération 3 (Semaine 5):
  Observation: Concurrent B lance promo produit Y -15%
  Proposition: Baisse prix -3% (€120 → €116.40)
  Simulation: Prévision +5% conversion, -1% marge
  Validation: CFO approuve ✅
  Exécution: Prix changé 2025-04-01
  Mesure (7j): +6% conversion, -0.5% marge ✅ Succès
  Confidence: 74% → 81%

Itération 4 (Semaine 7):
  Observation: Fin promo concurrent B, prix normalisé
  Proposition: Restaurer prix +3% (€116.40 → €120)
  Simulation: Prévision stable conversion, +1% marge
  Validation: CFO approuve ✅
  Exécution: Prix changé 2025-04-15
  Mesure (7j): +1% conversion (stable), +1.2% marge ✅ Succès
  Confidence: 81% → 87%

Bilan Mois 3-5:
  - Itérations totales: 4
  - Succès: 3/4 (75%)
  - Confidence finale: 87% (>85% ✅)
  - KPIs amélioration: +6.5% conversion moyenne (+5% target ✅)
  - Rollbacks: 1 (acceptable, apprentissage)
  - Budget moyen actions: €450 (<€2K ✅)

Décision: Éligible transition Assisted → Auto-Drive
  ✅ 3 itérations réussies
  ✅ Confidence 87% >85%
  ✅ Budget moyen €450 <€2K
  ✅ KPIs +6.5% >5%
  ⚠️ 1 rollback (toléré, dernières 3 itérations OK)

Validation: Board IA-COS 2025-05-20 → Approbation CFO ✅
```

---

**📅 Mois 6+ : Mode 🚀 Auto-Drive**
```
Mode: Auto-Drive (autonomie sous seuils)
Activation: 2025-06-01

Règles autonomie:
  ✅ Ajustements prix -5% à +5% : Exécution automatique (sans validation)
  ✅ Promos budget <€2K : Exécution automatique
  ⚠️ Changements prix >±5% : Fallback Assisted (validation CFO)
  ⚠️ Budget action >€2K : Fallback Assisted (validation CFO)
  ⚠️ Confidence <85% : Fallback Assisted (re-training requis)

Actions autonomes Mois 6 (Juin 2025):
  - 47 ajustements prix automatiques (±3% moyenne)
  - 0 rollbacks
  - +8.5% conversion moyenne (vs baseline)
  - +2.1% marge moyenne
  - Confidence stable: 87-91%

Actions avec validation CFO Mois 6:
  - 2 hausses prix >+5% (validées, succès)
  - 1 promo €2.5K (validée, ROI 220%)

Bilan Mois 6:
  ✅ Success rate: 100% (47/47 actions auto + 3/3 validées)
  ✅ Confidence moyenne: 89%
  ✅ KPIs: +8.5% conversion, +2.1% marge (surperformance vs target +5%)
  ✅ Vélocité: -70% délai validation (actions auto instantanées)

Statut: Auto-Drive maintenu (performance excellente)
```

---

#### Exemple 2 : IA-CEO Mode Forecast — Board Trimestriel Q1 2025

**📅 Session Board 2025-01-15 : Planification Q1 2025**

```
Contexte:
  - Board trimestriel stratégique (CEO, CFO, CTO, CMO)
  - Objectif: Valider investissements Q1 (budget €150K disponible)
  - IA-CEO: Active mode Forecast (durée session 2h30)

Mode Forecast activé: 09:00 - 11:30 (lecture seule, simulations sandbox)

---

🔮 Scénario 1 : Budget Marketing +20% (€30K → €36K)

Simulation Forecast (via Simulation Layer):
  - Données historiques: Q4 2024 campagnes LinkedIn, Google Ads
  - Modèle prédictif: Campaign ROI v1 (confidence 82%)
  
  Prédictions:
    • Leads estimés: +12% (+180 leads/mois)
    • Conversion leads→clients: 15% (stable vs baseline)
    • Revenue additionnel: +€28K/mois
    • ROI campagnes: 180% (€28K revenue / €6K invest additionnel)
    • Délai ROI: 45j (break-even mi-février)
  
  Risques:
    ⚠️ Saturation audience LinkedIn (déjà 3 campagnes actives)
    ⚠️ Coût par lead +8% vs Q4 (compétition accrue)
  
  Recommandation IA-CEO: ✅ GO (ROI élevé, risque acceptable)

Décision Board: ✅ APPROUVÉ
  - Budget Marketing Q1: €30K → €36K (+€6K)
  - Allocation: +€4K LinkedIn, +€2K Google Ads
  - KPI cible: +10% leads minimum (vs prédiction +12%)

---

🔮 Scénario 2 : Pricing Global -10% (stratégie volume)

Simulation Forecast (via Simulation Layer):
  - Données historiques: Élasticité prix 1500 produits (6 mois)
  - Modèle prédictif: Price Elasticity v2 (confidence 78%)
  
  Prédictions:
    • Conversion: +8% (élasticité moyenne 0.8)
    • Volume ventes: +12% (conversion + trafic)
    • Revenue: +2% (volume compense baisse prix partiellement)
    • Marge brute: -5% (compression marge critique)
    • Impact cash flow: -€18K/mois (marge réduite)
  
  Risques:
    🔴 Marge brute <30% (seuil minimum viable)
    🔴 Guerre prix concurrence (risque surenchère -15%, -20%...)
    🟠 Perception qualité (baisse prix = produit bas de gamme?)
  
  Recommandation IA-CEO: ❌ REJECT (risque marge, guerre prix)

Décision Board: ❌ REJETÉ
  - Marge brute priorité stratégique (maintien >32%)
  - Alternative retenue: Pricing dynamique sélectif (-5% top 50 produits uniquement)

---

🔮 Scénario 3 : Infra Scaling +30% (backend pods)

Simulation Forecast (via Simulation Layer):
  - Données historiques: Métriques infra Q4 2024 (latency, uptime, cost)
  - Modèle prédictif: Infra Scaling v1 (confidence 85%)
  
  Prédictions:
    • Latency p95: 280ms → 190ms (-32%)
    • Uptime: 99.85% → 99.94% (+0.09pp)
    • Coût infra: +€800/mois (+30% pods backend)
    • Incidents évités: ~2/mois (downtime économisé €3K/incident)
    • ROI: 250% (€6K évités / €2.4K invest trimestre)
  
  Risques:
    🟢 Risque faible (scaling pods Kubernetes standard)
    🟡 Sur-provisioning possible (charge réelle +15% seulement vs +30% scaling)
  
  Recommandation IA-CEO: ✅ GO (ROI élevé, latency critique UX)

Décision Board: ✅ APPROUVÉ
  - Scaling backend +30% pods (4 → 5.2 replicas moyenne)
  - Budget infra Q1: +€2.4K (€800/mois × 3 mois)
  - KPI cible: Latency p95 <200ms, Uptime >99.9%

---

🔮 Scénario 4 : SEO Investment +€50K (stratégie contenu)

Simulation Forecast (via Simulation Layer):
  - Données historiques: Croissance SEO Q3-Q4 2024 (+18% trafic organique)
  - Modèle prédictif: SEO Growth v1 (confidence 68% ⚠️ LOW)
  
  Prédictions:
    • Trafic organique: +25% (6 mois délai)
    • Conversion SEO: 2.8% (stable vs baseline)
    • Revenue additionnel: +€35K/mois (à partir M7)
    • ROI: 140% (12 mois horizon)
    • Délai break-even: 9 mois (long)
  
  Risques:
    🟠 Confidence 68% (modèle imprécis, peu données historiques SEO)
    🟠 Délai ROI 9 mois (cash flow Q1-Q2 négatif)
    🟠 Google algorithm updates (risque ranking perdu)
    🟡 Ressources humaines (rédaction contenu, nécessite +1 FTE)
  
  Recommandation IA-CEO: ⏸️ DEFER Q2 (confidence faible, délai ROI long)

Décision Board: ⏸️ DIFFÉRÉ Q2 2025
  - Investment SEO reporté après validation modèle prédictif (améliorer confidence >75%)
  - Alternative Q1: SEO technique -€15K (quick wins, délai ROI 3 mois)

---

Bilan Session Forecast 2025-01-15:

Scénarios simulés: 4
Approuvés: 2 (Marketing +€6K, Infra +€2.4K)
Rejetés: 1 (Pricing -10%)
Différés: 1 (SEO +€50K → Q2)

Budget Q1 alloué: €8.4K / €150K disponible (5.6%)
Budget restant: €141.6K (réserve initiatives opportunistes)

Prochaine session Forecast: 2025-04-15 (Board Q2)

---

Post-session 11:30:
  IA-CEO: Retour automatique mode Assisted
  Actions décidées Board → Assignées Squads:
    • Squad Expansion: Campagnes Marketing +€6K
    • Squad Resilience: Infra scaling +30% pods
    • Squad E-Commerce: Pricing dynamique -5% top 50 produits
```

---

### 💡 Bénéfices Attendus Modes d'Opération

| Bénéfice | Impact | Mesure | Horizon |
|----------|--------|--------|---------|
| **Sécurité production** | 🔴 Critical | 0 incidents agents immatures (target Q1) | Phase 1-2 |
| **Vélocité décisions** | 🔴 High | -70% délai approbations actions <€2K (Auto-Drive) | Phase 3+ |
| **Confiance Board** | 🟠 Medium | +40% adoption recommandations IA-CEO (Forecast) | Phase 4+ |
| **Apprentissage contrôlé** | 🟠 Medium | 3+ itérations validation avant autonomie (maturity gate) | Phase 2+ |
| **Gouvernance transparente** | 🟡 Low | 100% transitions mode auditées (compliance) | Phase 1+ |

---

### 💰 Impact Budget & ROI

**Développement State Machine** :

| Phase | Composant | Effort | Coût |
|-------|-----------|--------|------|
| **Phase 1** | State machine basique (Safe/Assisted) + Audit trail | 3 semaines dev | **€8K** |
| **Phase 3** | Auto-Drive logic + Confidence scoring + Fallback rules | 4 semaines dev | **€12K** |
| **Phase 4** | Forecast mode + Simulation Layer integration | 3 semaines dev | **€10K** |
| **TOTAL** | State machine complète 4 modes | 10 semaines | **€30K** |

**Note** : Budget €30K **inclus dans méta-couches €105K** → **Total révisé €135K** (vs €105K initial).

**Breakdown budget méta-couches révisé** :
- Data Brain : €60K
- Dialogue Layer : €20K
- Simulation Layer : €25K
- **State Machine Modes : €30K** ← NOUVEAU
- **TOTAL : €135K**

**ROI Modes d'Opération** :

**Gains vélocité Auto-Drive** :
- Validation humaine moyenne : 1h/action (Lead Squad/CFO review)
- Actions Auto-Drive Pricing Bot seul : ~50/mois (post maturity)
- Temps économisé : 50h/mois × €80/h = **€4K/mois** = **€48K/an**

**ROI State Machine** : €48K gains / €30K coût = **160%** (année 1)

**ROI global architecture (agents + méta-couches + modes)** :
- Gains agents : €800K
- Gains méta-couches : €300K
- Gains modes : €48K
- **Total gains : €1.148M/an**
- **Coût total : €395K** (€260K Squads + €135K méta-couches)
- **ROI : 290%** (vs 301% avant modes, légère baisse mais vélocité critique)

---

### 🚦 Risques et Mitigations Modes d'Opération

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Auto-Drive déclenché trop tôt** | 🔴 High (erreurs production coûteuses) | 🟡 Medium | ✅ Critères stricts : 3+ itérations, confidence >85%, budget <€2K, 0 rollbacks |
| **Assisted validation bottleneck** | 🟠 Medium (ralentit vélocité, frustration agents) | 🟠 Medium | ✅ SLA <2h validation, escalation auto si timeout, Dashboard approbations temps réel |
| **Forecast faux positifs stratégie** | 🟠 Medium (Board décisions erronées) | 🟡 Medium | ✅ Confidence <75% → Label "Low confidence" visible, simulations ≠ garanties |
| **Mode Safe trop restrictif** | 🟡 Low (limite innovation, agents sous-utilisés) | 🟠 Medium | ✅ Review trimestriel périmètre Safe, élargir progressif (ex: logs → cache clear → restarts) |
| **Confidence scoring imprécis** | 🟠 Medium (Auto-Drive sur agents non matures) | 🟡 Medium | ✅ Formule confidence transparente (succès / total actions), seuil conservateur 85% |
| **State machine bugs** | 🟠 Medium (agents bloqués mauvais mode) | 🟡 Medium | ✅ Tests E2E transitions, rollback mode manuel possible (admin dashboard) |

---

### 📋 Checklist Implémentation Modes d'Opération

Avant démarrage développement state machine :

- [ ] **Critères transition validés** : Board IA-COS approuve seuils (3 itérations, confidence 85%, budget €2K)
- [ ] **Gouvernance clarifiée** : SLA validation définis (<2h Assisted, <48h Safe→Assisted, <7j Assisted→Auto-Drive)
- [ ] **Schéma DB `ai_cos_mode_transitions`** : Audit trail transitions (agent_id, from/to mode, approved_by, timestamp, context)
- [ ] **KPIs Dashboard** : Vue consolidée `/admin/ai-cos/modes` (error rate, validation delay, success rate, confidence avg)
- [ ] **Formule confidence scoring** : Transparent et auditable (succès / total actions, pénalité rollbacks)
- [ ] **Fallback rules Auto-Drive** : Budget >€2K → Assisted, Confidence <85% → Assisted, Risque HIGH → Assisted
- [ ] **Tests E2E transitions** : Safe→Assisted→Auto-Drive sur Pricing Bot (agent pilote Phase 1)
- [ ] **Documentation Dialogue Layer** : Commandes CLI (`ai-cos mode status`, `ai-cos mode transition`, `ai-cos mode approve`)
- [ ] **Notifications Slack** : Alertes transitions mode, approbations pending, timeouts validation
- [ ] **Budget confirmé** : €30K state machine inclus dans méta-couches €135K (vs €105K initial)

---

### 🎯 Conclusion Modes d'Opération

Les **4 modes d'opération** (Safe, Assisted, Auto-Drive, Forecast) constituent la **couche de gouvernance** essentielle pour l'Entreprise Augmentée. Sans ces modes, l'architecture serait :
- ❌ **Risquée** : Agents autonomes sans garde-fous (erreurs production coûteuses)
- ❌ **Inflexible** : Pas d'adaptation maturity agent (tous agents traités identiques)
- ❌ **Opaque** : Board sans visibilité confiance agents (décisions aveugles)

**Avec modes d'opération** :
- ✅ **Progression sécurisée** : Safe → Assisted → Auto-Drive force maturity proof (3+ itérations, confidence >85%)
- ✅ **Vélocité contrôlée** : Auto-Drive économise 70% délai validation actions <€2K (€48K/an gain)
- ✅ **Stratégie data-driven** : Mode Forecast (via Simulation Layer) donne Board visibilité impacts décisions
- ✅ **Gouvernance transparente** : Audit trail complet transitions mode (compliance, confiance humaine)

**Implémentation recommandée** :
- **Phase 1-2** : Safe + Assisted (agents immatures, validation humaine obligatoire)
- **Phase 3** : Auto-Drive (après 6+ mois opération, agents matures prouvés)
- **Phase 4** : Forecast (Simulation Layer opérationnelle, sessions Board stratégiques)

**Budget** : €30K state machine (inclus méta-couches €135K), **ROI 160%** vélocité seule.

## 🧠 Méta-Couches Cognitives : L'Infrastructure du Cerveau Collectif

Au-delà des 57 agents opérationnels et des 5 Squads autonomes, l'**Entreprise Augmentée** repose sur **3 méta-couches cognitives** qui constituent l'infrastructure intelligente du système. Ces couches ne sont pas des agents supplémentaires, mais des **substrats techniques et conceptuels** qui permettent aux agents de penser, d'apprendre et de coordonner leurs actions.

### Vue d'ensemble des Méta-Couches

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎯 COUCHE DIALOGUE                           │
│  (Interfaces Humaines : CLI, Dashboard, Copilot, Slack/Email)  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Feedback & Commands
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           🧠 COUCHE SIMULATION (Sandbox What-If)                │
│  (Test scénarios pricing, campagnes, infra avant déploiement)  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Read/Write Data
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│      💾 DATA BRAIN (Cerveau de Données Unifié)                  │
│  (Supabase + Redis + Logs + API externes + Cross-domain views)  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1️⃣ Data Brain : Le Cerveau de Données Unifié

#### Problème résolu
**Avant Data Brain** : Chaque agent accède à ses propres données cloisonnées (Pricing Bot → `prices`, Marketing Agent → `campaigns`). Aucune vision cross-domain pour détecter des corrélations comme "baisse trafic SEO ⚡ alerte pricing urgent".

**Après Data Brain** : Une couche d'abstraction unifie toutes les sources de données et expose des **vues cross-domain** permettant aux agents et Squads de détecter des patterns invisibles en silo.

#### Architecture Technique

```typescript
// packages/shared/src/data-brain/index.ts

export class DataBrain {
  private supabase: SupabaseClient;
  private redis: Redis;
  private logger: Logger;

  // 🔹 SOURCES UNIFIÉES
  async getUnifiedData(query: CrossDomainQuery): Promise<UnifiedDataset> {
    // Agrège Supabase + Redis + API externes (Sentry, Grafana, CRM)
    const [dbData, cacheData, externalData] = await Promise.all([
      this.querySupabase(query.tables),
      this.redis.get(query.cacheKey),
      this.fetchExternalAPIs(query.sources)
    ]);

    return this.merge(dbData, cacheData, externalData);
  }

  // 🔹 VUES CROSS-DOMAIN
  async getBusinessHealthView(): Promise<HealthSnapshot> {
    return {
      sales: await this.getSalesKPIs(),       // Ventes/CRM
      pricing: await this.getPricingMetrics(), // Finance
      traffic: await this.getSEOMetrics(),     // Marketing
      infra: await this.getInfraHealth(),      // DevOps
      alerts: await this.getActiveAlerts()     // Risk
    };
  }

  // 🔹 INSIGHTS CROSS-DOMAIN
  async detectCorrelations(timeRange: TimeRange): Promise<Correlation[]> {
    // Détecte "baisse trafic SEO + hausse prix → baisse conversion"
    const events = await this.getUnifiedData({
      tables: ['seo_metrics', 'prices', 'orders'],
      timeRange
    });

    return this.correlationEngine.analyze(events);
  }
}
```

#### Exemples d'utilisation

**Cas 1 : Squad E-Commerce détecte anomalie conversion**
```typescript
// Squad E-Commerce appelle Data Brain
const insight = await dataBrain.detectCorrelations({ last: '7d' });

// Résultat : "Baisse conversion -12% corrélée à hausse prix +8% produit X"
// → Squad déclenche Pricing Bot + Marketing Agent pour campagne compensatoire
```

**Cas 2 : IA-CEO demande vue 360° avant Board**
```typescript
const snapshot = await dataBrain.getBusinessHealthView();

// Résultat : { sales: +5%, pricing: stable, traffic: -8% ⚠️, infra: OK, alerts: 2 }
// → IA-CEO priorise "baisse trafic SEO" dans l'agenda du Board
```

#### Roadmap Data Brain

| Phase | Composants | Effort |
|-------|-----------|--------|
| **Phase 1 (V1)** | Vues cross-domain basiques (sales, pricing, traffic) + API Supabase unifiée | 🔴 70% effort Phases 1-2 |
| **Phase 2 (V1)** | Corrélations simples (prix↔conversion, SEO↔ventes) + Dashboard Data Brain | 🔴 Critical |
| **Phase 3 (V2)** | Intégration API externes (Sentry, Grafana, CRM) + Logs unifiés | 🟡 20% effort Phase 3 |
| **Phase 4 (V2)** | Corrélations avancées (ML patterns) + Alertes proactives | 🟡 Phase 4 |
| **Phase 5 (V3)** | Prédictions cross-domain (TensorFlow.js) + Recommandations automatiques | 🟢 Phase 5 ML |

---

### 2️⃣ Dialogue Layer : L'Interface Humaine Multi-Canal

#### Problème résolu
**Avant Dialogue Layer** : Les humains doivent ouvrir 10 dashboards différents pour superviser les agents (Grafana infra, Supabase données, logs Sentry, dashboard AI-COS...). Aucune interface unifiée pour commander, interroger ou approuver les actions des agents.

**Après Dialogue Layer** : Une couche d'interfaces multi-canal permet aux humains d'interagir avec l'Entreprise Augmentée via **4 canaux unifiés** :
1. **CLI** : Commandes terminal pour DevOps/admins
2. **Dashboard Remix** : Interface web pour management/Board
3. **Copilot** : Intégration IDE pour développeurs
4. **Notifications Slack/Email** : Alertes et approbations asynchrones

#### Architecture Technique

```typescript
// backend/src/ai-cos/dialogue-layer/dialogue.service.ts

export class DialogueLayerService {
  // 🔹 COMMANDES CLI
  async handleCLICommand(command: string, args: string[]): Promise<string> {
    switch (command) {
      case 'ai-cos status':
        return this.getGlobalStatus();
      
      case 'ai-cos ask':
        // "ai-cos ask 'Pourquoi baisse conversion ?'"
        return this.askDataBrain(args[0]);
      
      case 'ai-cos approve':
        // "ai-cos approve squad-ecommerce-action-42"
        return this.approveAction(args[0]);
      
      case 'ai-cos simulate':
        // "ai-cos simulate pricing --product=X --price=+10%"
        return this.runSimulation(args);
    }
  }

  // 🔹 DASHBOARD REMIX
  async getDashboardData(view: DashboardView): Promise<DashboardPayload> {
    switch (view) {
      case 'board':
        return {
          kpis: await this.dataBrain.getBusinessHealthView(),
          pendingApprovals: await this.getApprovals({ status: 'pending' }),
          recentActions: await this.getActions({ limit: 20 })
        };
      
      case 'squad':
        return {
          squads: await this.getSquadsStatus(),
          budget: await this.getSquadsBudget(),
          okrs: await this.getSquadsOKRs()
        };
    }
  }

  // 🔹 NOTIFICATIONS SLACK/EMAIL
  async sendApprovalRequest(action: ProposedAction): Promise<void> {
    const message = `
🤖 **${action.squad}** demande approbation:
📋 Action: ${action.description}
💰 Coût: ${action.cost}€
📊 Impact estimé: ${action.estimatedImpact}

✅ Approuver: ${action.approveUrl}
❌ Rejeter: ${action.rejectUrl}
    `;

    await this.slack.send({ channel: '#ai-cos-approvals', message });
    await this.email.send({ to: 'cfo@company.com', subject: 'Approbation IA-COS', body: message });
  }
}
```

#### Exemples de workflows Dialogue Layer

**Workflow 1 : Approbation budget Squad via Slack**
```
1. Squad Expansion propose "Campagne LinkedIn 3K€"
2. Dialogue Layer → Slack #ai-cos-approvals
3. CFO clique ✅ dans Slack
4. Dialogue Layer → Squad Expansion reçoit GO
5. Marketing Agent lance campagne
```

**Workflow 2 : Interrogation Data Brain via CLI**
```bash
$ ai-cos ask "Pourquoi baisse conversion produit X ?"

🧠 Analyse Data Brain:
• Prix produit X: +12% depuis 7j
• Trafic SEO: -8% (baisse ranking mot-clé "Y")
• Concurrence: Concurrent Z a lancé promo -20%

💡 Recommandations:
1. Pricing Bot: Aligner prix sur concurrent (-10%)
2. Marketing Agent: Campagne SEO urgente mot-clé "Y"
3. Squad E-Commerce: Promo flash 48h

✅ Lancer actions ? (y/n)
```

**Workflow 3 : Dashboard Board temps réel**
```
/admin/ai-cos/board
├── 📊 KPIs Globaux (CA, Marge, Trafic, Uptime)
├── 🚨 Alertes (2 en cours: SEO -8%, Infra latence +50ms)
├── ⏳ Approbations Pending (1: Squad Expansion LinkedIn 3K€)
└── 📜 Actions Récentes (20 dernières: Pricing Bot, DevOps Agent...)
```

#### Roadmap Dialogue Layer

| Phase | Composants | Effort |
|-------|-----------|--------|
| **Phase 1 (V1)** | CLI basique (`status`, `ask`, `approve`) + Dashboard Board | 🟡 20% effort Phase 1 |
| **Phase 2 (V1)** | Notifications Slack/Email + Approbations web | 🟡 High value |
| **Phase 3 (V2)** | Copilot integration (ask Data Brain depuis VS Code) | 🟢 10% effort Phase 3 |
| **Phase 4 (V2)** | Dashboard Squad détaillé + Simulations UI | 🟢 Phase 4 |
| **Phase 5 (V3)** | Dialogue conversationnel (chatbot Slack) | 🟢 Phase 5 |

---

### 3️⃣ Simulation Layer : Le Sandbox What-If

#### Problème résolu
**Avant Simulation Layer** : Les agents proposent des actions directement en production (ex: Pricing Bot change prix ⚠️). Risque d'erreurs coûteuses sans possibilité de tester les impacts avant déploiement.

**Après Simulation Layer** : Un environnement sandbox permet de **tester les actions des agents sur des données simulées** avant validation humaine et déploiement production.

#### Architecture Technique

```typescript
// backend/src/ai-cos/simulation-layer/simulator.service.ts

export class SimulationLayerService {
  private dataBrain: DataBrain;
  private historicalData: HistoricalDataService;

  // 🔹 SIMULATION PRICING
  async simulatePricing(params: PricingSimulation): Promise<SimulationResult> {
    // 1. Clone données réelles (7 derniers jours)
    const realData = await this.dataBrain.getUnifiedData({
      tables: ['orders', 'prices', 'traffic'],
      timeRange: { last: '7d' }
    });

    // 2. Applique changement prix en sandbox
    const simulatedData = this.applyPriceChange(realData, {
      productId: params.productId,
      priceChange: params.priceChange // ex: +10%
    });

    // 3. Modèle prédictif (historique + patterns ML)
    const prediction = await this.predictImpact(simulatedData, {
      model: 'price-elasticity-v2',
      horizon: '30d'
    });

    return {
      estimatedRevenue: prediction.revenue,      // ex: -5% (élasticité)
      estimatedConversion: prediction.conversion, // ex: -12%
      confidence: prediction.confidence,          // ex: 78%
      recommendation: prediction.revenue > 0 ? 'GO' : 'REJECT'
    };
  }

  // 🔹 SIMULATION CAMPAGNE MARKETING
  async simulateCampaign(params: CampaignSimulation): Promise<SimulationResult> {
    // Clone trafic SEO + conversions historiques
    const realData = await this.historicalData.getCampaignData({
      type: params.type, // ex: 'linkedin-ads'
      timeRange: { last: '90d' }
    });

    // Modèle prédictif basé sur campagnes similaires passées
    const prediction = await this.predictImpact(realData, {
      model: 'campaign-roi-v1',
      budget: params.budget,
      target: params.target
    });

    return {
      estimatedLeads: prediction.leads,
      estimatedRevenue: prediction.revenue,
      estimatedROI: prediction.roi, // ex: 180%
      confidence: prediction.confidence,
      recommendation: prediction.roi > 150 ? 'GO' : 'REVIEW'
    };
  }

  // 🔹 SIMULATION INFRA
  async simulateInfraChange(params: InfraSimulation): Promise<SimulationResult> {
    // Simule scaling Kubernetes (ex: +2 pods)
    const currentLoad = await this.dataBrain.getInfraHealth();
    const simulatedLoad = this.applyInfraChange(currentLoad, params);

    return {
      estimatedLatency: simulatedLoad.latency,   // ex: -20ms
      estimatedCost: simulatedLoad.cost,         // ex: +50€/mois
      estimatedUptime: simulatedLoad.uptime,     // ex: 99.95% → 99.98%
      confidence: 85,
      recommendation: 'GO'
    };
  }
}
```

#### Exemples de simulations

**Simulation 1 : Pricing Bot teste hausse prix avant application**
```typescript
// Pricing Bot propose hausse +10% produit X
const simulation = await simulator.simulatePricing({
  productId: 'product-x',
  priceChange: +10
});

// Résultat : { revenue: -5%, conversion: -12%, confidence: 78%, recommendation: 'REJECT' }
// → Pricing Bot abandonne la hausse et propose baisse -5% à la place
```

**Simulation 2 : Squad Expansion teste campagne LinkedIn avant lancement**
```typescript
// Squad Expansion propose budget 3K€ LinkedIn
const simulation = await simulator.simulateCampaign({
  type: 'linkedin-ads',
  budget: 3000,
  target: 'CTOs-France'
});

// Résultat : { leads: 45, revenue: 12K€, roi: 300%, confidence: 82%, recommendation: 'GO' }
// → Squad obtient approbation CFO et lance campagne
```

**Simulation 3 : DevOps Agent teste scaling avant déploiement**
```typescript
// DevOps Agent propose +2 pods backend
const simulation = await simulator.simulateInfraChange({
  service: 'backend',
  replicas: +2
});

// Résultat : { latency: -20ms, cost: +50€/mois, uptime: 99.98%, confidence: 85%, recommendation: 'GO' }
// → DevOps Agent applique scaling
```

#### Roadmap Simulation Layer

| Phase | Composants | Effort |
|-------|-----------|--------|
| **Phase 1-2 (Skip)** | ❌ Non prioritaire (agents fonctionnent sans simulations) | ⚪ 0% effort |
| **Phase 3 (V1)** | Simulations pricing + campagnes (modèles historiques basiques) | 🟡 30% effort Phase 3 |
| **Phase 4 (V2)** | Simulations infra + A/B testing automatisé | 🟡 Phase 4 |
| **Phase 5 (V3)** | Modèles prédictifs ML (TensorFlow.js) + Confiance 90%+ | 🟢 Phase 5 ML |

---

### 💰 Budget et ROI Méta-Couches

#### Coûts estimés (infrastructure + développement)

| Méta-Couche | Phase 1-2 | Phase 3-4 | Phase 5 | Total |
|-------------|-----------|-----------|---------|-------|
| **Data Brain** | 35K€ (vues, API) | 15K€ (API ext) | 10K€ (ML) | **60K€** |
| **Dialogue Layer** | 10K€ (CLI, Dashboard) | 5K€ (Copilot) | 5K€ (Chat) | **20K€** |
| **Simulation Layer** | 0€ (skip) | 15K€ (modèles) | 10K€ (ML) | **25K€** |
| **State Machine Modes** | 8K€ (Safe/Assisted) | 12K€ (Auto-Drive) | 10K€ (Forecast) | **30K€** |
| **TOTAL** | **53K€** | **47K€** | **35K€** | **135K€** |

**Note** : Budget initial annoncé €80K, révisé à €105K après détail roadmap, puis €135K avec ajout Modes d'Opération (€30K state machine).

#### ROI attendu

**Sans Méta-Couches** (57 agents seuls) :
- Gain annuel estimé : **€800K** (automatisation, optimisations pricing/SEO)
- Coût agents : **€260K** (Squads uniquement)
- ROI : **308%**

**Avec Méta-Couches + Modes** (architecture complète) :
- Gain additionnel Data Brain : **+€150K** (corrélations, décisions data-driven)
- Gain additionnel Dialogue Layer : **+€50K** (efficacité humaine, approbations rapides)
- Gain additionnel Simulation Layer : **+€100K** (évite erreurs coûteuses pricing/campagnes)
- Gain additionnel Modes Opération : **+€48K** (vélocité Auto-Drive, -70% délai validation)
- **Gain total : €1.148M**
- **Coût total : €395K** (€260K Squads + €135K méta-couches+modes)
- **ROI : 290%** (légère baisse vs 301% mais vélocité critique)

#### Verdict ROI
✅ **Méta-Couches + Modes rentables** : Ajoutent €348K gains pour €135K coût, maintiennent ROI >290% (légère baisse acceptable pour gain vélocité +gouvernance).

---

### 🚦 Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Data Brain complexité** | 🔴 High (retard delivery) | 🟡 Medium | ✅ Roadmap progressive V1→V2→V3, MVP Phase 1 (vues basiques) |
| **Simulations faux positifs** | 🟠 Medium (mauvaises décisions) | 🟡 Medium | ✅ Confiance <80% → Approbation humaine obligatoire |
| **Dialogue Layer maintenance** | 🟠 Medium (coût récurrent) | 🟠 Medium | ✅ Focus CLI+Dashboard Phase 1, Copilot/Chat Phase 3+ |
| **Intégration API externes fragile** | 🟠 Medium (Data Brain partiel) | 🟠 Medium | ✅ Fallback données Supabase seules si API externe fail |
| **Budget dépassement** | 🟡 Low (€105K vs €80K initial) | 🟠 Medium | ✅ Phase 1-2 focus Data Brain (€45K), Phase 3+ conditionnel ROI |

---

### 📋 Checklist Implémentation

Avant de démarrer le développement des méta-couches, valider :

- [ ] **Roadmap clarifiée** : Phases 1-2 focus Data Brain V1 + Dialogue CLI/Dashboard + State Machine (Safe/Assisted)
- [ ] **Risques documentés** : Simulations confidence <80% → Approbation humaine, Auto-Drive critères stricts
- [ ] **Budget validé** : €135K total (€53K Phase 1-2, €47K Phase 3-4, €35K Phase 5) incluant Modes d'Opération €30K
- [ ] **Interfaces prioritaires** : CLI + Dashboard Phase 1, Copilot Phase 3+
- [ ] **MVP Data Brain défini** : Vues cross-domain (sales, pricing, traffic) + Corrélations simples
- [ ] **Skip Simulation Layer Phase 1-2** : Démarrage Phase 3 uniquement
- [ ] **Modes opération Phase 1** : Safe + Assisted uniquement, Auto-Drive Phase 3+, Forecast Phase 4+
- [ ] **Métriques succès** : Data Brain adoption 80% agents, Dialogue Layer usage daily, Simulations 90% accuracy, Modes success rate >90%

---

### 🎯 Conclusion Méta-Couches

Les **3 méta-couches cognitives + Modes d'Opération** transforment l'Entreprise Augmentée d'une collection d'agents cloisonnés en un **système nerveux intelligent unifié gouverné** :

1. **Data Brain** = Cerveau collectif permettant insights cross-domain (corrélations invisibles en silo)
2. **Dialogue Layer** = Interface nerveuse humaine (CLI, Dashboard, Slack) pour commander/superviser
3. **Simulation Layer** = Cortex préfrontal testant actions avant exécution (évite erreurs coûteuses)
4. **Modes Opération** = Couche gouvernance régulant autonomie agents (Safe → Assisted → Auto-Drive → Forecast)

**Approche recommandée** : **Implémentation progressive Phase 1→5**
- ✅ **Phase 1-2** : Data Brain V1 (70% effort, game changer) + Dialogue CLI/Dashboard (20% effort, high value) + State Machine Safe/Assisted
- ✅ **Phase 3-4** : API externes, Simulation Layer V1, Copilot integration, Auto-Drive mode
- ✅ **Phase 5** : ML predictions, confidence 90%+, chatbot conversationnel, Forecast mode perfectionné

**ROI** : **+€348K gains/an pour €135K investissement**, ROI maintenu **>290%** (vélocité + gouvernance).


#### 🧩 PÔLE STRATÉGIQUE (5 agents)

##### IA-CEO v2 (Enhanced Global Orchestrator) - UPGRADE

**Évolution de v1** :
- ❌ v1 : Simple consolidation KPIs, priorisation basique
- ✅ v2 : Orchestration temps réel 4 pôles, coordination inter-agents, simulation, auto-learning

**Responsabilités** :
- Coordination temps réel 26 agents répartis dans 4 pôles
- Orchestration 5 meta-agents (squads transversaux autonomes)
- Détection anomalies cross-pôles (ex: stock 📊 ↓ + campagne 📊 ↑ = coordination ⚙️)
- Simulation what-if scenarios (budget 🧩, pricing 📊, inventory 📊)
- Auto-learning from past decisions (feedback loop)
- Arbitrage conflits entre pôles/squads
- Dashboard global health 40 KPIs (vue consolidée 4 pôles)

**Capacités** :
- `orchestrate` : Coordonne actions multi-agents
- `simulate` : Run scénarios prédictifs
- `learn` : Améliore décisions via feedback
- `arbitrate` : Résout conflits priorisation

**KPIs surveillés** : ALL (40 KPIs)

**Stack technique** :
- Redis pub/sub pour coordination temps réel
- EventEmitter NestJS pour orchestration locale
- State machine pour modes opération (safe/assisted/auto-drive/forecast)
- ML simple (règles heuristiques phase 1, TensorFlow.js phase 5)

**Exemple coordination** :
```
Scénario: Stock Forecaster détecte rupture imminente pneus hiver
↓
IA-CEO v2 notifié (event: STOCK_ALERT)
↓
Coordination lancée:
  1. IA-Logistics alerte fulfillment risk (HIGH priority)
  2. IA-Supply Chain active emergency procurement
  3. IA-CMO ajuste campagnes (reduce demand temporarily)
  4. IA-Product Manager notifié (product availability issue)
  5. IA-CRM prépare messages clients proactifs
↓
Résultat: Réponse coordonnée 5 agents + 3 squads en < 5 minutes
```

##### IA-CFO v2 (Enhanced Financial Intelligence) - IMPLEMENT

**Pôle** : 🧩 Stratégique

**État** : Défini dans v1 mais **NON IMPLÉMENTÉ**

**Responsabilités** :
- Tracking coûts temps réel (cloud, ops, marketing)
- Détection anomalies dépenses (ex: +50% cloud costs unexpected)
- Simulation budgétaire (what-if: budget marketing -20%?)
- Prévision cash flow (runway, burn rate)
- ROI campagnes et initiatives
- Optimisation allocation budgets
- Invoice intelligence (délais paiement, erreurs)

**KPIs surveillés** :
- `burn-rate` : Consumption mensuelle cash (NEW)
- `runway` : Mois avant cash-out (NEW)
- `gross-margin` : Marge brute globale (NEW)
- `payment-delay` : Délai moyen paiement clients (NEW)
- `invoice-accuracy` : % factures sans erreur (NEW)
- `budget-variance` : Écart budget vs réel (NEW)
- `roi-campaigns` : ROI marketing (existing)
- `aov` : Average order value (existing)

**Capacités** :
- `analyze` : Analyse dépenses et marges
- `forecast` : Prévisions cash flow, ROI
- `recommend` : Optimisations allocation budgets
- `alert` : Anomalies coûts critiques

**Exemple action** :
```
Détection: Cloud costs +65% ce mois (anomalie)
↓
IA-CFO analyse:
  - Cause: Nouvelle instance Postgres non optimisée
  - Impact: +$800/mois
  - Recommendation: Downsize instance, enable autoscaling
↓
Action proposée (HIGH priority):
  - Risk: 15/100 (LOW)
  - Confidence: 95/100 (HIGH)
  - Expected savings: $600/mois
↓
IA-Docker Optimizer exécute (après validation)
```

#### ⚙️ PÔLE TECHNIQUE & PRODUIT (8 agents)

##### IA-Docker Optimizer - NEW

**Pôle** : ⚙️ Technique & Produit  
**Domaine** : Build Pipeline & Container Optimization

**Responsabilités** :
- Optimisation build pipeline (Buildx cache, multi-stage builds)
- Réduction taille images Docker (layer caching, pruning)
- Amélioration performance CI/CD (GitHub Actions)
- Optimisation Docker Compose (healthchecks, restart policies)
- Configuration Caddy (caching, compression, HTTP/3)
- Monitoring coûts infrastructure (VPS, storage, bandwidth)

**KPIs surveillés** :
- `docker-build-time` : Temps build CI/CD en secondes (NEW) - Cible: < 300s
- `docker-image-size` : Taille image finale en MB (NEW) - Cible: < 600MB
- `cache-hit-rate` : % hits cache Buildx (NEW) - Cible: > 70%
- `deploy-success-rate` : % déploiements réussis (NEW) - Cible: 100%
- `backend-p95` : Performance API (existing)

**Capacités** :
- `analyze` : Dockerfile layers, build metrics, compose config
- `optimize` : Remote cache, npm cache mounts, .dockerignore
- `recommend` : Multi-stage improvements, Caddy optimizations
- `monitor` : Build time trends, image size evolution

**Exemples d'optimisations détectées** :
```
1. Dockerfile optimization
   Avant: RUN npm install (8 min build, 800MB image)
   Après: RUN --mount=type=cache,target=/root/.npm npm ci (3 min, 600MB)
   Impact: -62% build time, -25% image size

2. GitHub Actions cache
   Avant: cache-from: type=local (cache perdu à chaque run)
   Après: cache-from: type=registry,ref=massdoc/cache:buildx
   Impact: -50% build time CI

3. Caddy configuration
   Détection: Pas de compression gzip activée
   Recommandation: encode gzip zstd dans Caddyfile
   Impact: -40% bandwidth, +20% vitesse pages
```

---

##### IA-QA Engineer - NEW

**Pôle** : ⚙️ Technique & Produit  
**Domaine** : Qualité Tests

**Responsabilités** :
- Optimisation stratégie tests (unit/integration/e2e balance)
- Détection flaky tests (instables)
- Performance regression detection
- Mutation testing intelligence
- Test coverage gaps analysis

**KPIs surveillés** :
- `test-flakiness` : % tests instables (NEW)
- `regression-detection` : Bugs détectés avant prod (NEW)
- `test-coverage` : Coverage global (existing)

**Capacités** :
- `analyze` : Test suite health
- `detect` : Flaky tests, gaps coverage
- `recommend` : Test strategy improvements

#### 📊 PÔLE BUSINESS & MARCHÉ (8 agents)

##### IA-CMO (Chief Marketing Officer) - NEW

**Pôle** : 📊 Business & Marché  
**Domaine** : Marketing & Growth

**Responsabilités** :
- Optimisation campagnes (email, social, paid ads)
- Tracking Customer Acquisition Cost (CAC)
- Prévision Lifetime Value (LTV)
- Orchestration A/B tests
- Content marketing ROI
- Social media intelligence

**KPIs surveillés** :
- `cac` : Customer Acquisition Cost (NEW) - **CRITICAL**
- `ltv` : Lifetime Value client (NEW) - **CRITICAL**
- `email-open-rate` : Performance email campaigns (NEW)
- `social-engagement` : ROI social media (NEW)
- `content-velocity` : Vitesse production contenu (NEW)
- `conversion-rate` : Conversion globale (existing)

**Capacités** :
- `analyze` : Campaign performance
- `forecast` : CAC/LTV trends, ROI predictions
- `recommend` : Budget allocation, targeting optimization
- `orchestrate` : A/B tests coordination

**Exemple coordination avec IA-CFO** :
```
IA-CMO détecte: CAC en hausse +15% ce mois
↓
IA-CEO coordonne analyse:
  - IA-CMO: CAC = $45 (cible: $38)
  - IA-CFO: Budget marketing constant
  - IA-CRM: LTV stable $180
↓
Simulation what-if:
  - Scénario A: Réduire budget paid ads -20% → CAC $40, revenue -8%
  - Scénario B: Optimiser targeting (AI) → CAC $36, revenue stable
↓
Décision: Scénario B approuvé
IA-CMO implémente optimisation targeting
```

---

##### IA-Product Manager - NEW

**Pôle** : ⚙️ Technique & Produit  
**Domaine** : Product Intelligence

**Responsabilités** :
- Priorisation roadmap produit (feature scoring)
- Catalog intelligence (active/inactive products)
- Time-to-market optimization
- Feature adoption tracking
- Product quality monitoring (defects, complaints)
- A/B tests produits

**KPIs surveillés** :
- `catalog-coverage` : % produits actifs utilisés (NEW)
- `time-to-market` : Durée feature → prod (NEW)
- `feature-adoption` : % users using new features (NEW)
- `product-quality` : Defects/complaints rate (NEW)

**Capacités** :
- `analyze` : Product performance, catalog health
- `recommend` : Roadmap prioritization, product optimizations
- `forecast` : Feature adoption predictions

---

##### IA-Logistics Manager - NEW

**Pôle** : 📊 Business & Marché  
**Domaine** : Fulfillment & Warehouse

**Responsabilités** :
- Optimisation fulfillment time
- Warehouse capacity planning
- Shipping accuracy tracking
- Inventory turnover optimization
- Return rate analysis
- Supplier lead time monitoring

**KPIs surveillés** :
- `fulfillment-time` : Order → ship duration (NEW) - **CRITICAL**
- `shipping-accuracy` : % livraisons correctes (NEW)
- `inventory-turnover` : Rotation stock (NEW)
- `warehouse-capacity` : % utilisation espace (NEW)
- `return-rate` : % retours produits (NEW)
- `stock-rupture` : Rupture stock (existing)

**Capacités** :
- `analyze` : Logistics operations performance
- `optimize` : Warehouse layout, fulfillment process
- `forecast` : Capacity needs, demand patterns
- `alert` : Shipping delays, capacity issues

---

##### IA-Supply Chain Optimizer - NEW

**Pôle** : 📊 Business & Marché  
**Domaine** : Procurement & Suppliers

**Responsabilités** :
- Supplier scoring et ranking
- Procurement intelligence (best time to buy)
- Supply chain risk detection (delays, quality issues)
- Multi-supplier strategy optimization
- Cost negotiation intelligence

**KPIs surveillés** :
- `supplier-reliability` : % livraisons on-time (NEW)
- `procurement-cost` : Coût achat moyen (NEW)
- `lead-time-variance` : Écart délais prévus (NEW)

**Capacités** :
- `analyze` : Supplier performance, costs
- `recommend` : Supplier selection, procurement timing
- `alert` : Supply chain risks

**Coordination avec IA-Logistics** :
```
IA-Supply Chain détecte: Supplier A délais +30% (risk)
↓
IA-CEO coordonne:
  1. IA-Supply Chain: Recommande switch Supplier B
  2. IA-Logistics: Valide impact fulfillment
  3. IA-CFO: Valide impact coûts (+8% mais reliable)
↓
Décision: Switch approuvé
IA-Supply Chain exécute changement
```

---

##### IA-Support Manager - NEW (Intégration)

**Pôle** : 📊 Business & Marché  
**Domaine** : Customer Support

**État** : AI Support existe (`backend/src/modules/support/`) mais **NON INTÉGRÉ AI-COS**

**Intégration** :
- Wrapper services existants : Smart Responses, Escalation Prediction, Workflow Optimization
- Ajout KPIs dans snapshots AI-COS
- Coordination avec Customer Squad

**Responsabilités** :
- Response time optimization
- Resolution rate tracking
- Customer satisfaction (CSAT) monitoring
- Knowledge base intelligence (auto-update FAQ)
- Ticket routing intelligence

**KPIs surveillés** :
- `response-time` : Premier temps réponse (NEW) - **CRITICAL**
- `resolution-rate` : % tickets résolus (NEW)
- `csat` : Customer satisfaction score (NEW)

**Capacités** :
- `analyze` : Support operations performance
- `recommend` : Response optimizations, FAQ updates
- `predict` : Escalation needs (existing)
- `optimize` : Workflow efficiency (existing)

---

##### IA-Content Strategist - NEW

**Pôle** : ⚙️ Technique & Produit  
**Domaine** : Content Marketing

**Responsabilités** :
- Editorial calendar optimization
- Content gap detection (missing topics)
- SEO content recommendations (intégration SEO Sentinel)
- Content performance prediction
- Topic clustering intelligence

**KPIs surveillés** :
- `content-velocity` : Articles/semaine (NEW)
- `organic-traffic-growth` : Croissance trafic organique (NEW)
- `content-engagement` : Time on page, shares (NEW)

**Capacités** :
- `analyze` : Content performance, gaps
- `recommend` : Topics, SEO optimizations
- `forecast` : Traffic predictions
- `coordinate` : Avec SEO Sentinel

#### 🌍 PÔLE EXPANSION & INNOVATION (Agents transversaux)

##### IA-HR (Talent Manager) - NEW

**Pôle** : 🧩 Stratégique (coordination 🌍 Expansion)  
**Domaine** : Human Resources

**Responsabilités** :
- Recruitment pipeline optimization
- Time-to-hire reduction
- Employee retention prediction (churn risk)
- Skill gap analysis
- Training recommendations

**KPIs surveillés** :
- `time-to-hire` : Durée recrutement (NEW)
- `employee-retention` : % turnover (NEW)
- `skill-coverage` : % compétences requises couvertes (NEW)

**Capacités** :
- `analyze` : Recruitment performance, retention
- `forecast` : Churn risk, hiring needs
- `recommend` : Training, recruitment strategies

---

##### IA-Legal & Compliance - NEW

**Pôle** : 🧩 Stratégique (coordination 🌍 Expansion)  
**Domaine** : Legal & Compliance

**Responsabilités** :
- Contract intelligence (review, risk detection)
- RGPD compliance monitoring
- Legal document generation (terms, privacy)
- Certification tracking (ISO, PCI-DSS)

**KPIs surveillés** :
- `compliance-score` : % conformité règlements (NEW)
- `contract-risk` : Risque contrats actifs (NEW)
- `cert-expiry-risk` : Certifications expirant < 90j (NEW)

**Capacités** :
- `analyze` : Compliance status, contract risks
- `detect` : Violations RGPD, legal risks
- `recommend` : Legal actions, certifications

### 5 Meta-Agents Transversaux (Squads)

**Concept** : Squads = mini-entreprises IA autonomes multi-pôles coordonnées par IA-CEO v2  
**Avantage** : Coordination horizontale flexible avec OKRs et budgets propres (pas hiérarchie rigide)

#### Gouvernance Budgétaire Squads

**Autonomie financière par seuils** :
- **< €2K** : Autonomie totale Squad lead (validation post-facto mensuelle)
- **€2K - €5K** : Validation IA-CFO/COO obligatoire (<24h)
- **> €5K** : Validation IA-BOARD (décision stratégique)

**Allocation budgétaire** :
- Budgets trimestriels définis par IA-CFO/COO
- Basés sur OKRs Squad + ROI prévu
- Réallocation possible mi-trimestre (si ROI < 80% cible)

**Reporting** :
- Mensuel : KPIs Squad vs cibles → IA-CEO
- Trimestriel : Bilan OKRs + budget vs dépenses → IA-BOARD
- Dashboard temps réel : `/admin/ai-cos/squads`

---

#### 🛒 E-Commerce Squad - Meta-Agent

**Mission** : Optimisation conversion & marge e-commerce end-to-end

**Composition (Multi-pôles)** :
- **SEO Sentinel** (lead) - 📊 Business Niveau 3
- **Pricing Bot** - 📊 Business Niveau 3
- **IA-Product Manager** - ⚙️ Tech Niveau 2
- **Stock Forecaster** - 📊 Business Niveau 3

**OKRs Q1 2025** :
- O1: Conversion globale >4% (+15% vs baseline 3.5%)
- O2: Marge nette >42% (+5% vs baseline 37%)
- O3: Trafic organique +25% (SEO dominance)

**KPIs Focus** :
- `conversion-rate` : Taux conversion global (CRITICAL)
- `gross-margin` : Marge brute produits (CRITICAL)
- `organic-traffic` : Visiteurs SEO/mois (HIGH)
- `stock-availability` : Disponibilité produits >95% (HIGH)

**Budget Alloué** : €15K/trim (SEO tools, A/B tests, pricing optimizations)

**Frontière métier** :
- ✅ Scope : Acquisition → Conversion → Marge produit → Stock disponibilité
- ❌ Hors scope : Post-achat support, fidélisation long-terme (Customer Squad)

**Coordination type** :
```
SEO Sentinel détecte: Opportunité keyword "pneus hiver 2025" (volume +300%)
↓
E-Commerce Squad coordination:
  1. SEO Sentinel: Optimise pages produits + contenus (H1, meta, backlinks)
  2. Pricing Bot: Ajuste prix compétitifs (benchmark concurrence -5%)
  3. IA-Product Manager: Priorise catégorie pneus hiver (merchandising homepage)
  4. Stock Forecaster: Valide stock suffisant (3 mois demand = 450 unités)
↓
Budget dépensé: €2.8K (SEO tools + A/B tests) → Validation Squad lead (< €5K)
↓
Résultat (2 semaines): Trafic +45%, Conversion 3.5% → 4.1%, CA catégorie +€18K
ROI Squad: (€18K revenue - €2.8K dépenses) / €2.8K = 542%
```

---

#### ⚡ Performance Squad - Meta-Agent

**Mission** : Vitesse & expérience utilisateur optimales avec impact business

**Composition (Multi-pôles)** :
- **IA-CTO** (lead) - ⚙️ Tech Niveau 2
- **IA-Designer** - ⚙️ Tech Niveau 2
- **IA-DevOps** - ⚙️ Tech Niveau 2 (Observabilité)
- **Pricing Bot** - 📊 Business Niveau 3 (mesure impact perf → conversion)

**OKRs Q1 2025** :
- O1: Backend p95 <150ms (-20% vs baseline 180ms)
- O2: Lighthouse score >92 (+5pts vs baseline 87)
- O3: Bounce rate <35% (-10% vs baseline 45%) → impact conversion

**KPIs Focus** :
- `backend-p95` : Latence backend 95e percentile (CRITICAL)
- `lighthouse-score` : Score Lighthouse global (HIGH)
- `bounce-rate` : Taux rebond pages clés (HIGH)
- `conversion-rate-perf` : Conversion attributable à perf (MEDIUM)

**Budget Alloué** : €8K/trim (CDN, caching, performance tools, A/B tests)

**Ajout Pricing Bot** : Mesure impact business performance via :
- A/B tests : Page rapide vs lente → conversion
- Attribution : Quel % conversion vient de perf optimale
- ROI calcul : Investissement perf → revenue additionnel

**Coordination type** :
```
IA-DevOps détecte: Dégradation perf API products (p95 220ms → 280ms)
↓
Performance Squad coordination:
  1. IA-CTO: Analyse root cause (query N+1 détecté, 15 queries par requête)
  2. IA-DevOps: Propose fix + optimisation cache Redis (TTL 5min)
  3. IA-Designer: Valide impact UX (temps chargement pages -30%)
  4. Pricing Bot: Mesure impact business (A/B test rapide vs lent)
↓
Budget dépensé: €1.2K (Redis upgrade) → Validation Squad lead (< €2K)
↓
Résultat (48h): 
  - Fix déployé: p95 280ms → 165ms, Lighthouse 87 → 90
  - Pricing Bot mesure: Conversion +0.3% (280ms → 165ms)
  - Revenue impact: +€4.5K/mois (conversion +0.3% sur 150K visiteurs)
  - ROI Squad: (€4.5K × 3 mois - €1.2K) / €1.2K = 1025%
```

---

#### 🌍 Expansion Squad - Meta-Agent

**Mission** : Déploiement international & partenariats stratégiques

**Composition (Multi-pôles)** :
- **IA-CMO** (lead) - 📊 Business Niveau 3 (Marketing Global)
- **IA-LEGAL** - 🧩 Board Niveau 1 (Conformité internationale)
- **IA-Product Manager** - ⚙️ Tech Niveau 2 (Adaptation produit marchés)
- **IA-Supplier** - 🌱 Support Niveau 4 (Partenariats locaux)

**OKRs Q1 2025** :
- O1: Lancer 2 nouveaux marchés (Belgique, Suisse)
- O2: 5 partenariats stratégiques signés (transporteurs, distributeurs)
- O3: CA international >15% CA total (vs 8% baseline)

**KPIs Focus** :
- `market-penetration` : Part marché nouveaux pays (CRITICAL)
- `partnerships-active` : Nombre partenariats actifs (HIGH)
- `international-revenue` : CA hors France % (CRITICAL)
- `compliance-international` : Conformité légale 100% (CRITICAL)

**Budget Alloué** : €20K/trim (legal, marketing localisé, partnerships, adaptation produit)

**Ajout IA-Product Manager** : Nécessaire pour :
- Adapter catalogue produits marché local (pneus normes belges/suisses)
- Localisation UX/UI (langue, devises, unités)
- Validation product-market fit nouveaux pays

**Coordination type** :
```
IA-CMO détecte: Demande marché Belgique (500 recherches/mois "pneus Bruxelles")
↓
Expansion Squad coordination:
  1. IA-CMO: Analyse opportunité (sizing €120K/an, concurrence 4 acteurs)
  2. IA-LEGAL: Valide conformité Belgique (TVA, RGPD, certifications)
  3. IA-Product Manager: Adapte catalogue (120 SKU normes BE, traduction FR/NL)
  4. IA-Supplier: Identifie 3 transporteurs locaux (délai <48h, coût <€9/colis)
↓
Budget dépensé: €12K (legal €3K, adaptation produit €4K, marketing €5K)
→ Validation IA-BOARD (> €5K décision stratégique)
↓
Résultat (6 semaines): 
  - Lancement Belgique: 120 commandes/mois, CA €14K/mois
  - ROI trimestre: (€14K × 3 mois - €12K) / €12K = 250%
  - Compliance: 100% (TVA belge activée, RGPD validé)
```

---

#### 🛡️ Resilience Squad - Meta-Agent

**Mission** : Robustesse système & anti-pannes (disponibilité 99.9%)

**Composition (Multi-pôles)** :
- **IA-CISO** (lead) - ⚙️ Tech Niveau 2 (Sécurité)
- **IA-DevOps** - ⚙️ Tech Niveau 2 (Infra & disponibilité)

**OKRs Q1 2025** :
- O1: 0 incident sécurité CRITICAL
- O2: Disponibilité >99.9% (downtime <43 min/mois)
- O3: MTTR (Mean Time to Recovery) <15min

**KPIs Focus** :
- `security-score` : Score sécurité global /100 (CRITICAL)
- `uptime` : Disponibilité % (CRITICAL)
- `mttr` : Temps moyen résolution incident (HIGH)
- `vulnerabilities-critical` : Nombre vulns CRITICAL (CRITICAL)

**Budget Alloué** : €12K/trim (security tools, backup, monitoring, infrastructure)

**Retrait IA-Innovation** : R&D innovation déplacé temporairement
- **Rationale** : Mismatch culture (stabilité vs expérimentation)
- **Alternative Phase 2** : Créer Squad Innovation séparée (6e Squad optionnel)
- IA-Innovation reste dans Niveau 4 Support, coordonné par IA-CEO directement

**Coordination type** :
```
Security Shield détecte: Tentative DDoS (10K req/sec, 15x trafic normal)
↓
Resilience Squad coordination:
  1. IA-CISO: Active protection Cloudflare (rate limiting 100 req/sec/IP)
  2. IA-DevOps: Scale auto instances backend (+3 nodes, capacité +150%)
↓
Budget dépensé: €0 (infra auto-scale inclus dans budget mensuel)
↓
Résultat (5min): 
  - Attaque bloquée: 95% requêtes DDoS filtrées
  - 0 downtime: Uptime maintenu 100%
  - MTTR: 5 min (détection → résolution)
  - Learning: Pattern attaque stocké pour détection future
```

---

#### 👥 Customer Squad - Meta-Agent

**Mission** : Fidélisation & satisfaction client maximale (post-achat)

**Composition (Multi-pôles)** :
- **IA-CRM** (lead) - 📊 Business Niveau 3
- **IA-Support** - 🌱 Support Niveau 4
- **IA-Designer** - ⚙️ Tech Niveau 2 (UX post-achat)

**OKRs Q1 2025** :
- O1: NPS >50 (+10pts vs baseline 40)
- O2: Churn <7% (-2pts vs baseline 9%)
- O3: CSAT support >4.6/5 (vs baseline 4.2/5)

**KPIs Focus** :
- `nps` : Net Promoter Score (CRITICAL)
- `churn-rate` : Taux attrition clients (CRITICAL)
- `csat` : Customer Satisfaction support (HIGH)
- `ltv` : Lifetime Value client (HIGH)

**Budget Alloué** : €10K/trim (CRM tools, support automation, UX tests, loyalty programs)

**Frontière métier** :
- ✅ Scope : Post-achat → Support → Fidélisation → Rétention long-terme
- ❌ Hors scope : Acquisition, conversion première commande (E-Commerce Squad)

**Coordination type** :
```
Churn Alert détecte: 15 clients premium inactifs >30j (risque €7.5K LTV)
↓
Customer Squad coordination:
  1. IA-CRM: Segmente clients (RFM analysis: Recency 0, Frequency high, Monetary high)
  2. IA-Support: Génère campagne réactivation personnalisée (email + SMS + call)
  3. IA-Designer: Optimise landing page offre fidélité (-15% + livraison offerte)
↓
Budget dépensé: €1.8K (CRM automation + SMS + call center) → Validation Squad lead (< €2K)
↓
Résultat (2 semaines): 
  - 9 clients réactivés (60% success rate)
  - +€4.5K LTV préservé (9 clients × €500 LTV moyen)
  - Churn global: 9% → 8.7%
  - ROI Squad: (€4.5K - €1.8K) / €1.8K = 150%
```

---

### Récapitulatif 5 Squads

| Squad | Lead | Agents | Budget/trim | OKR Principal | ROI Attendu |
|-------|------|--------|-------------|---------------|-------------|
| **🛒 E-Commerce** | SEO Sentinel | 4 | €15K | Conversion >4% | >400% |
| **⚡ Performance** | IA-CTO | 4 | €8K | p95 <150ms | >800% |
| **🌍 Expansion** | IA-CMO | 4 | €20K | 2 marchés | >200% |
| **🛡️ Resilience** | IA-CISO | 2 | €12K | Uptime 99.9% | Protection |
| **👥 Customer** | IA-CRM | 3 | €10K | NPS >50 | >100% |
| **TOTAL** | - | **17 agents** | **€65K/trim** | - | **€260K/an** |

**Budget annuel Squads** : €65K × 4 = **€260K/an**  
**Revenue impact estimé** : +€800K/an (ROI global 308%)

```

### 25 Nouveaux KPIs

#### Marketing KPIs (5 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `cac` | 38 | € | **CRITICAL** | IA-CMO |
| `ltv` | 180 | € | **CRITICAL** | IA-CMO |
| `email-open-rate` | 25 | % | Medium | IA-CMO |
| `social-engagement` | 150 | score/100 | Medium | IA-CMO |
| `content-velocity` | 4 | articles/semaine | Low | IA-Content |

#### Finance KPIs (6 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `burn-rate` | 50000 | €/mois | **CRITICAL** | IA-CFO |
| `runway` | 18 | mois | **CRITICAL** | IA-CFO |
| `gross-margin` | 40 | % | High | IA-CFO |
| `payment-delay` | 30 | jours | Medium | IA-CFO |
| `invoice-accuracy` | 98 | % | Medium | IA-CFO |
| `budget-variance` | 5 | % | High | IA-CFO |

#### Logistics KPIs (5 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `fulfillment-time` | 24 | heures | **CRITICAL** | IA-Logistics |
| `shipping-accuracy` | 99 | % | High | IA-Logistics |
| `inventory-turnover` | 8 | fois/an | Medium | IA-Logistics |
| `warehouse-capacity` | 75 | % | Medium | IA-Logistics |
| `return-rate` | 3 | % | High | IA-Logistics |

#### Product KPIs (4 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `catalog-coverage` | 85 | % | High | IA-Product |
| `time-to-market` | 30 | jours | High | IA-Product |
| `feature-adoption` | 60 | % | Medium | IA-Product |
| `product-quality` | 2 | defects/100 | High | IA-Product |

#### Support KPIs (3 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `response-time` | 120 | minutes | **CRITICAL** | IA-Support |
| `resolution-rate` | 85 | % | High | IA-Support |
| `csat` | 4.5 | /5 | High | IA-Support |

#### HR & Operations KPIs (2 NEW)

| KPI | Cible | Unité | Priorité | Agent |
|-----|-------|-------|----------|-------|
| `time-to-hire` | 45 | jours | Medium | IA-HR |
| `employee-retention` | 90 | % | Medium | IA-HR |

**Total KPIs** : 15 (existing) + 25 (new) = **40 KPIs**

### Stack Technique Enrichi

#### Packages (+ 3 nouveaux)

```
packages/
├── ai-cos-core/          # Existing + nouveaux types
│   ├── src/
│   │   ├── agents/       # 26 agents (14 + 12 NEW)
│   │   ├── kpis/         # 40 KPIs definitions
│   │   ├── squads/       # 5 squads (E-Commerce, Performance, Expansion, Resilience, Customer)
│   │   ├── orchestration/  # NEW - IA-CEO v2 coordination
│   │   └── simulation/   # NEW - What-if engine types
│   
├── ai-cos-kpis/          # Existing + 25 calculateurs NEW
│   ├── src/
│   │   ├── tech/         # 6 calculateurs (existing)
│   │   ├── business/     # 5 calculateurs (existing)
│   │   ├── ux/           # 3 calculateurs (existing)
│   │   ├── marketing/    # 5 calculateurs NEW
│   │   ├── finance/      # 6 calculateurs NEW
│   │   ├── logistics/    # 5 calculateurs NEW
│   │   ├── product/      # 4 calculateurs NEW
│   │   ├── support/      # 3 calculateurs NEW
│   │   └── operations/   # 2 calculateurs NEW
│   
├── ai-cos-simulation/    # NEW - Moteur what-if
│   ├── src/
│   │   ├── scenarios/    # Budget, pricing, inventory simulations
│   │   ├── predictors/   # ML simple (TensorFlow.js)
│   │   └── validators/   # Validation résultats simulations
│   
└── ai-cos-coordination/  # NEW - Orchestration inter-agents
    ├── src/
    │   ├── orchestrator/ # IA-CEO v2 coordination engine
    │   ├── events/       # Redis pub/sub, EventEmitter
    │   └── state/        # State machines modes opération
```

#### Supabase Migrations

```sql
-- Migration: 002_ai_cos_enrichment_kpis.sql

-- Ajouter 25 nouvelles colonnes KPIs
ALTER TABLE ai_cos_snapshots
  -- Marketing (5)
  ADD COLUMN cac NUMERIC,
  ADD COLUMN ltv NUMERIC,
  ADD COLUMN email_open_rate NUMERIC,
  ADD COLUMN social_engagement NUMERIC,
  ADD COLUMN content_velocity NUMERIC,
  
  -- Finance (6)
  ADD COLUMN burn_rate NUMERIC,
  ADD COLUMN runway NUMERIC,
  ADD COLUMN gross_margin NUMERIC,
  ADD COLUMN payment_delay NUMERIC,
  ADD COLUMN invoice_accuracy NUMERIC,
  ADD COLUMN budget_variance NUMERIC,
  
  -- Logistics (5)
  ADD COLUMN fulfillment_time NUMERIC,
  ADD COLUMN shipping_accuracy NUMERIC,
  ADD COLUMN inventory_turnover NUMERIC,
  ADD COLUMN warehouse_capacity NUMERIC,
  ADD COLUMN return_rate NUMERIC,
  
  -- Product (4)
  ADD COLUMN catalog_coverage NUMERIC,
  ADD COLUMN time_to_market NUMERIC,
  ADD COLUMN feature_adoption NUMERIC,
  ADD COLUMN product_quality NUMERIC,
  
  -- Support (3)
  ADD COLUMN response_time NUMERIC,
  ADD COLUMN resolution_rate NUMERIC,
  ADD COLUMN csat NUMERIC,
  
  -- HR & Operations (2)
  ADD COLUMN time_to_hire NUMERIC,
  ADD COLUMN employee_retention NUMERIC;

-- Ajouter comments
COMMENT ON COLUMN ai_cos_snapshots.cac 
  IS 'Customer Acquisition Cost en € (cible: 38€)';
COMMENT ON COLUMN ai_cos_snapshots.ltv 
  IS 'Lifetime Value client en € (cible: 180€)';
-- ... (comments pour tous les KPIs)

-- Nouvelle table: simulations what-if
CREATE TABLE ai_cos_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scenario_name TEXT NOT NULL,
  scenario_type TEXT NOT NULL, -- 'budget' | 'pricing' | 'inventory' | 'campaign'
  
  -- Input params (JSONB flexible)
  input_params JSONB NOT NULL,
  
  -- Résultats simulation
  predicted_kpis JSONB NOT NULL,
  impact_analysis JSONB NOT NULL,
  
  -- Metadata
  executed_by TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0,
  notes TEXT
);

CREATE INDEX idx_ai_cos_simulations_scenario_type 
  ON ai_cos_simulations(scenario_type, created_at DESC);

-- Nouvelle table: coordination events (Redis backup)
CREATE TABLE ai_cos_coordination_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL, -- 'STOCK_ALERT' | 'COST_ANOMALY' | 'PERFORMANCE_DEGRADATION'
  source_agent_id TEXT NOT NULL,
  target_agent_ids TEXT[] NOT NULL,
  
  -- Event data
  event_data JSONB NOT NULL,
  coordination_plan JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'coordinating' | 'completed' | 'failed'
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_cos_coordination_events_status 
  ON ai_cos_coordination_events(status, created_at DESC);
```

#### Redis Coordination Architecture

```typescript
// Redis channels pour coordination temps réel
const REDIS_CHANNELS = {
  GLOBAL_ORCHESTRATION: 'ai-cos:orchestration',
  STOCK_ALERTS: 'ai-cos:stock:alerts',
  COST_ANOMALIES: 'ai-cos:finance:anomalies',
  PERFORMANCE_DEGRADATION: 'ai-cos:performance:degradation',
  CAMPAIGN_EVENTS: 'ai-cos:marketing:campaigns',
  FULFILLMENT_ALERTS: 'ai-cos:logistics:alerts'
};

// Exemple: IA-CEO v2 écoute tous les channels
// Coordination orchestrée via pub/sub
```

## Rationale

### Pourquoi enrichir maintenant?

1. **Couverture insuffisante** : 47% modules non couverts = blind spots stratégiques
2. **Opportunités manquées** : Marketing, Finance, Logistics sans intelligence = décisions manuelles lentes
3. **Fondations solides** : AI-COS v1 prouve concept, stack validée
4. **ROI élevé** : Phase 1 (IA-CEO v2 + Finance + Marketing) = impact immédiat revenue + coûts

### Pourquoi architecture 4 pôles (vs 5 niveaux hiérarchiques)?

1. **Simplicité business** : 4 pôles métier = compréhension immédiate stakeholders (vs 5 niveaux abstraits)
2. **Alignement org** : Pôles = départements réels entreprise (Stratégique, Tech, Business, Expansion)
3. **Coordination flexible** : Squads = meta-agents horizontaux (vs hiérarchie verticale rigide)
4. **Scaling naturel** : Ajout agents dans pôles existants (pas création nouveaux niveaux)
5. **Autonomie pôles** : Chaque pôle = domaine expertise clair, décisions locales rapides

### Pourquoi 40 KPIs (vs 15)?

**Coverage holistique santé organisationnelle** :
- 15 KPIs = 30% santé org (tech + e-commerce de base)
- 40 KPIs = 90% santé org (tous domaines critiques)

**Décisions data-driven complètes** :
- Finance : Pas de `burn-rate`/`runway` = blind spot cash flow
- Marketing : Pas de `cac`/`ltv` = impossible optimiser ROI acquisition
- Logistics : Pas de `fulfillment-time` = blind spot satisfaction client

### Pourquoi intégration AI Support existant (vs rebuild)?

1. **Services existants fonctionnels** : Smart Responses, Escalation Prediction déjà en prod
2. **Gain temps** : Wrapper + KPIs = 1 semaine vs rebuild = 4 semaines
3. **Risque faible** : Pas de régression services existants
4. **Focus valeur** : Coordination avec Customer Squad = valeur business réelle

### Pourquoi IA-Docker Optimizer (pas IA-Platform Engineer)?

1. **Stack réel = Docker Compose** : Pas de Kubernetes, pas de Terraform, 1 VPS unique
2. **Quick wins identifiés** : -50% build time via remote cache, -25% image size via optimisations
3. **ROI immédiat** : Gains productivité (10h/mois) + économies CI > coût dev agent (2-3 jours)
4. **Fondations avant scaling** : Optimiser base Docker avant orchestration avancée
5. **Scope adapté** : Build pipeline + images + Caddy = domaine cohérent Phase 3

**Analyse stack actuel** :
- ✅ Multi-stage builds présents (4 stages: base, builder, installer, runner)
- ✅ Alpine base images (node:20-alpine)
- ⚠️ Build cache local uniquement (pas de remote cache = -50% perf potentielle)
- ⚠️ Image ~800MB (optimisable à ~600MB via pruning node_modules)
- ❌ Build time non mesuré (estimé 8-15 min CI)
- ❌ Pas de healthchecks compose (zero-downtime deploys impossibles)

**Alternative future** : Si besoin orchestration multi-nodes → considérer Kubernetes managed, mais pas priorité Phase 3-4.

### Pourquoi simulation Phase 5 (pas maintenant)?

1. **Complexité ML élevée** : TensorFlow.js, modèles prédictifs = 4 semaines dev + tests
2. **Dépendances données** : Simulation nécessite historique 3-6 mois KPIs
3. **ROI Phase 1-4 supérieur** : Orchestration + nouveaux agents = impact immédiat
4. **Approche progressive** : Phase 1-3 règles heuristiques, Phase 5 ML quand données suffisantes

## Consequences

### Positives ✅

- **Coverage complète** : 90% santé organisationnelle (vs 30%)
- **Décisions proactives** : Coordination temps réel empêche problèmes (vs réactif)
- **ROI mesurable** : Chaque nouveau KPI = levier optimisation
- **Scaling automatique** : Architecture 5 niveaux = ajout agents facile
- **Alignement stratégique** : Tech + Business + Produit synchronisés

### Négatives ⚠️

- **Complexité +300%** : 14 → 26 agents, 15 → 40 KPIs, 4 → 5 squads
- **Maintenance élevée** : 12 nouveaux agents à maintenir
- **Courbe apprentissage** : Équipe doit maîtriser orchestration avancée
- **Coût infrastructure** : +40% Redis usage, +20% Supabase storage
- **Temps implémentation** : 20 semaines (5 phases) vs 8 semaines v1

### Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Orchestration IA-CEO v2 trop complexe** | Moyenne | Élevé | Phase 1 : règles simples, Phase 5 : ML avancé |
| **40 KPIs = overhead performance** | Faible | Moyen | Calcul async, cache Redis aggressive, snapshots 1x/jour |
| **12 nouveaux agents = bugs coordination** | Moyenne | Élevé | Tests E2E complets, rollout progressif (1 agent/semaine) |
| **Équipe submergée maintenance** | Moyenne | Moyen | Documentation exhaustive, formation 2 jours, support dédié |
| **Simulation ML échoue Phase 5** | Moyenne | Faible | Fallback règles heuristiques, pas bloquant pour Phases 1-4 |
| **Intégration AI Support casse prod** | Faible | Élevé | Wrapper isolé, feature flag, rollback automatique |
| **Budget dépassé** | Moyenne | Moyen | Budget phases validé, stop possible après Phase 1 |

### Trade-offs Acceptés

| Trade-off | Justification |
|-----------|---------------|
| **Complexité vs Couverture** | 90% santé org vaut complexité +300% |
| **Temps implémentation vs ROI** | 20 semaines = ROI Phase 1 après 4 semaines |
| **ML avancé vs Règles simples** | Règles suffisantes Phases 1-4, ML bonus Phase 5 |
| **Rebuild vs Intégration** | Intégrer AI Support existant = -75% temps |

## Alternatives Considered

### Option A : Status Quo (Rejeter)

**Description** : Garder AI-COS v1 (14 agents, 15 KPIs)

**Avantages** :
- ✅ Pas de complexité additionnelle
- ✅ Maintenance simple

**Inconvénients** :
- ❌ 47% modules non couverts (blind spots)
- ❌ Pas d'orchestration cross-domaines
- ❌ Décisions manuelles lentes
- ❌ Opportunités business manquées (CAC, LTV, fulfillment)

**Décision** : ❌ **REJETÉ** - Insuffisant pour "Entreprise Augmentée"

---

### Option B : Agents Business Externes (Rejeter)

**Description** : Utiliser SaaS tiers (HubSpot AI, NetSuite, Salesforce Einstein)

**Avantages** :
- ✅ Pas de dev interne
- ✅ Features avancées out-of-box

**Inconvénients** :
- ❌ Pas d'intégration AI-COS (silotés)
- ❌ Coûts élevés ($500-2000/mois/outil)
- ❌ Données fragmentées (pas de coordination)
- ❌ Vendor lock-in

**Décision** : ❌ **REJETÉ** - Contredit vision orchestration centralisée

---

### Option C : Rebuild Complet AI-COS v2 (Rejeter)

**Description** : Réécrire AI-COS from scratch avec architecture 5 niveaux

**Avantages** :
- ✅ Architecture clean
- ✅ Pas de dette technique v1

**Inconvénients** :
- ❌ Temps : 30+ semaines (vs 20 semaines enrichissement)
- ❌ Risque : Régression features v1 pendant transition
- ❌ Coût : 2x budget enrichissement

**Décision** : ❌ **REJETÉ** - Pas justifié, fondations v1 solides

---

### Option D : Enrichissement Progressif (APPROUVER) ✅

**Description** : Ajouter 12 agents + 25 KPIs + orchestration sur fondations v1

**Avantages** :
- ✅ Réutilise stack existante (Supabase, Redis, NestJS)
- ✅ Rollout progressif 5 phases (stop possible si échec)
- ✅ ROI Phase 1 après 4 semaines
- ✅ Validation continue (success criteria chaque phase)

**Inconvénients** :
- ⚠️ Complexité gérée via documentation + formation

**Décision** : ✅ **APPROUVÉ** - Meilleur rapport valeur/risque/coût

## Implementation Plan

### Phase 1 - CRITICAL (Semaines 1-4)

**Focus** : IA-CEO v2 + IA-CFO + IA-CMO

**Deliverables** :
- Package `ai-cos-coordination` (IA-CEO v2 orchestration)
- IA-CFO implementation complète (6 KPIs finance)
- IA-CMO implementation (5 KPIs marketing)
- Dashboard global health 40 KPIs (frontend Remix)
- Migration Supabase 25 nouvelles colonnes KPIs
- Tests E2E workflow coordination (1 scénario)

**Success Criteria** :
- ✅ Dashboard affiche 40 KPIs temps réel
- ✅ IA-CFO détecte 1 anomalie coût (validation manuelle)
- ✅ IA-CMO optimise 1 campagne (+5% ROI min)
- ✅ IA-CEO v2 coordonne 1 scénario cross-domain validé

**Risque** : LOW - Fondations existantes solides

---

### Phase 2 - HIGH (Semaines 5-8)

**Focus** : Logistics + Product + Supply Chain + Operations Squad

**Deliverables** :
- IA-Logistics Manager (5 KPIs)
- IA-Product Manager (4 KPIs)
- IA-Supply Chain Optimizer (3 KPIs)
- Operations Excellence Squad setup
- Tests coordination 3 agents

**Success Criteria** :
- ✅ Fulfillment time -15%
- ✅ 10 produits inactifs identifiés (action recommandée)
- ✅ +5% gross margin via optimisation procurement

**Risque** : MEDIUM - Nouvelle domain complexity (logistics)

---

### Phase 3 - MEDIUM (Semaines 9-12)

**Focus** : Support + Docker Optimization + Content

**Deliverables** :
- IA-Support Manager (intégration AI existant + 3 KPIs)
- IA-Docker Optimizer (4 KPIs) - Week 10 focus
  - Dockerfile optimisé (remote cache, npm cache mount, pruning)
  - GitHub Actions workflow amélioré (registry cache)
  - docker-compose.prod.yml healthchecks
  - Script deploy avec rollback automatique
  - Dashboard Grafana metrics (build-time, image-size, cache-hit-rate)
- IA-Content Strategist (3 KPIs)
- Business Growth Squad enrichi

**Success Criteria** :
- ✅ Response time support -20%
- ✅ Docker build time CI < 300s (-50% vs baseline)
- ✅ Image size < 600MB (-25% vs baseline 800MB)
- ✅ Cache hit rate > 70% (remote cache activé)
- ✅ Zero-downtime deploys possibles (healthchecks OK)
- ✅ 1 editorial calendar SEO-optimized généré

**Risque** : LOW - Intégration + optimisation build pipeline

---

### Phase 4 - EXPANSION (Semaines 13-16)

**Focus** : HR + Legal + QA

**Deliverables** :
- IA-HR (2 KPIs)
- IA-Legal & Compliance (3 KPIs)
- IA-QA Engineer (3 KPIs)

**Success Criteria** :
- ✅ Time-to-hire -25%
- ✅ 1 compliance gap détecté + recommandation fix
- ✅ 5 flaky tests identifiés + fixés

**Risque** : LOW - Support functions

---

### Phase 5 - ADVANCED (Semaines 17-20)

**Focus** : Simulation + Auto-Learning

**Deliverables** :
- Package `ai-cos-simulation` (moteur what-if)
- Feedback loop auto-learning IA-CEO v2
- Prédictions KPIs (TensorFlow.js simple)
- Dashboard simulations

**Success Criteria** :
- ✅ 10 scénarios what-if exécutés (budget, pricing, inventory)
- ✅ IA-CEO auto-approve 80% actions LOW risk (vs 0%)
- ✅ 5 KPIs avec trend predictions (ex: "CAC +10% next month")

**Risque** : HIGH - ML complexity, acceptable car non-bloquant

---

### Roadmap Visuel

```
Semaines  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
         ╠══════════╬══════════╬══════════╬══════════╬══════════╬══╣
Phase 1  ███████████▓                                                 IA-CEO v2 + Finance + Marketing
Phase 2                ████████▓                                      Logistics + Product + Supply
Phase 3                           ███████▓                            Support + Platform + Content
Phase 4                                      ███████░                 HR + Legal + QA
Phase 5                                                ████████░      Simulation + Auto-Learning

Legend: █ Development  ▓ Testing  ░ Optional/Advanced
```

### Dependencies & Risks

**Phase 1 → Phase 2** : Orchestration IA-CEO v2 doit être stable
**Phase 2 → Phase 3** : Operations Squad doit être opérationnel
**Phase 4 indépendant** : Peut démarrer en parallèle Phase 3
**Phase 5 dépend ALL** : Nécessite historique KPIs 3 mois minimum

**Stop conditions** :
- Phase 1 success criteria non atteints → STOP
- Budget dépassé +30% → REVIEW
- Équipe surchargée → PAUSE

## Validation & Approval

### Stakeholders Required

| Rôle | Validation | Phase |
|------|-----------|-------|
| **CTO** | ✅ Architecture technique, stack | Phase 1 |
| **Product Owner** | ✅ Priorisation agents, KPIs | Phase 1 |
| **CFO** | ✅ Budget 20 semaines, ROI | Phase 1 |
| **Tech Lead** | ✅ Faisabilité, risques | Phase 1 |
| **DevOps** | ✅ Infrastructure Redis/Supabase | Phase 1 |

### Approval Process

1. **Review ADR-006** (cette spec) - Semaine 0
2. **Validation gap analysis** - Confirmer 47% modules non couverts
3. **Approbation budget Phase 1** - 4 semaines, 2 devs
4. **Go/No-Go Phase 2** - Basé sur success criteria Phase 1
5. **Review mi-parcours** - Semaine 10 (après Phase 3)

---

## 📚 Annexes

### Annexe A : Glossaire

#### Acronymes Architecture

**ADR** (Architecture Decision Record)  
Document structuré capturant une décision architecturale importante, son contexte, ses conséquences et alternatives considérées. Format standard pour traçabilité décisions techniques.

**AI-COS** (AI Chief Operating System)  
Système d'exploitation intelligent orchestrant 57 agents IA + 5 Squads autonomes pour automatiser opérations entreprise (tech, business, support).

**KPI** (Key Performance Indicator)  
Indicateur clé de performance mesurable permettant d'évaluer succès d'un agent, Squad ou objectif business. Ex: conversion rate, uptime, ROI.

**ROI** (Return On Investment)  
Retour sur investissement calculé : (Gains - Coûts) / Coûts × 100. Ex: ROI 290% = €1.148M gains pour €395K investissement.

**SLA** (Service Level Agreement)  
Accord niveau de service définissant temps maximum pour action. Ex: SLA <2h validation mode Assisted = approbation humaine en moins de 2h.

**CI/CD** (Continuous Integration / Continuous Deployment)  
Pratique DevOps intégrant et déployant code automatiquement. Agents mode Safe opèrent en CI/CD (corrections automatiques sans validation).

**CAC** (Customer Acquisition Cost)  
Coût acquisition client = Dépenses marketing / Nouveaux clients. Optimisé par Squad E-Commerce + Marketing Agent.

**LTV** (Lifetime Value)  
Valeur vie client = Revenue moyen client × Durée relation moyenne. Optimisé par Squad Customer + CRM Agent.

**AOV** (Average Order Value)  
Panier moyen = Revenue total / Nombre commandes. Optimisé par Pricing Bot + Upsell Agent.

**NPS** (Net Promoter Score)  
Score satisfaction client -100 à +100 mesurant probabilité recommandation. KPI critique Squad Customer (target >40).

**OKR** (Objectives and Key Results)  
Méthode définition objectifs + résultats clés mesurables. Chaque Squad a 3 OKRs trimestriels (ex: p95 <200ms, Uptime 99.9%).

**MVP** (Minimum Viable Product)  
Version minimale produit fonctionnel. Data Brain V1 = MVP vues cross-domain (Phase 1-2).

**TTL** (Time To Live)  
Durée vie cache Redis. Optimisé par DevOps Agent (ex: cache Redis 15min → 5min selon fréquence updates).

**p95** (95th Percentile)  
Latence 95e percentile = 95% requêtes plus rapides que cette valeur. KPI critique infra (target <200ms).

#### Termes Techniques

**Squad**  
Meta-agent autonome coordonnant 2-4 agents spécialisés autour objectif commun. Ex: Squad E-Commerce (4 agents) optimise acquisition→conversion→fidélisation.

**Méta-Couche Cognitive**  
Infrastructure technique (Data Brain, Dialogue Layer, Simulation Layer) permettant agents de penser, apprendre et coordonner actions.

**Feedback Loop**  
Cycle apprentissage agent : Observe → Propose → Mesure → Apprend. Amélioration continue via validation résultats actions passées.

**Confidence Score**  
Score 0-100% mesurant fiabilité agent calculé via historique succès/échecs. Seuil >85% requis pour mode Auto-Drive.

**State Machine**  
Système transitions entre modes opération (Safe→Assisted→Auto-Drive→Forecast) selon critères maturity agent.

**Cross-Domain**  
Vision unifiée données multi-domaines (tech, business, finance). Ex: Data Brain détecte corrélation "baisse SEO + hausse prix = baisse conversion".

**Audit Trail**  
Journal traçabilité actions agents (qui, quoi, quand, pourquoi). Table `ai_cos_mode_transitions` enregistre toutes transitions mode.

**Sandbox**  
Environnement isolé test sans impact production. Simulation Layer = sandbox scénarios what-if (pricing, campagnes, infra).

**Event-Driven**  
Architecture événements déclenchant actions agents. Redis pub/sub propage événements temps réel (ex: STOCK_ALERT → IA-CEO coordonne 5 agents).

**Orchestration**  
Coordination actions multi-agents par IA-CEO. Ex: Rupture stock → alerte fulfillment + ajuste campagnes + notifie clients (5 agents <5 min).

**Auto-Scaling**  
Ajustement automatique ressources infra selon charge. DevOps Agent scale pods Kubernetes (4 → 5.2 replicas +30%).

**Rollback**  
Annulation action agent échec. Ex: Pricing Bot hausse prix +10% → conversion -12% → rollback prix initial (24h).

#### Modes d'Opération

**Safe Mode** 🔒  
Mode lecture seule ou corrections triviales (0% autonomie). Agent observe, alerte, n'exécute rien sans validation. Usage: CI/CD, agents immatures <30j production.

**Assisted Mode** 🤝  
Mode recommandation intelligente (30% autonomie). Agent propose actions, validation humaine obligatoire. Usage: Sprint hebdo, opérations quotidiennes.

**Auto-Drive Mode** 🚀  
Mode exécution autonome sous seuils (80% autonomie). Agent exécute actions si budget <€2K, confidence >85%, risque LOW/MEDIUM. Usage: Agents matures >6 mois, 3+ itérations réussies.

**Forecast Mode** 🔮  
Mode simulation stratégique (0% exécution réelle). IA-CEO simule scénarios what-if via Simulation Layer pour Board. Usage: Planification trimestrielle, décisions stratégiques.

#### Métriques Business

**Conversion Rate**  
Taux conversion = Conversions / Visiteurs × 100. KPI central Squad E-Commerce (target >3%).

**Churn Rate**  
Taux attrition clients = Clients perdus / Clients totaux × 100. KPI critique Squad Customer (target <5%/mois).

**Burn Rate**  
Consommation cash mensuelle. KPI Board IA-CFO (target €180K/mois, runway 18 mois).

**Gross Margin**  
Marge brute = (Revenue - Coût produits vendus) / Revenue × 100. KPI Board IA-CFO (target >30%).

**Lead Conversion**  
Taux conversion leads → clients. KPI Squad E-Commerce + Lead Scoring Agent (target 15%).

#### Infrastructure

**Supabase**  
Base de données PostgreSQL + Auth + Storage cloud. Backend principal AI-COS (agents, KPIs, learning events, mode transitions).

**Redis**  
Cache in-memory + pub/sub messaging. Coordination temps réel agents (événements, state machine modes, sessions).

**Remix**  
Framework React fullstack SSR. Dashboard admin AI-COS (`/admin/ai-cos/*`) + interfaces Dialogue Layer.

**NestJS**  
Framework Node.js backend modulaire. Architecture agents (services, controllers, events, guards).

**TensorFlow.js**  
Bibliothèque ML JavaScript. Predictions Phase 5 (confidence scoring, patterns recognition, forecast models).

**Docker Compose**  
Orchestration conteneurs multi-services. Stack validée (backend, frontend, Supabase, Redis, Caddy, workers).

**Caddy**  
Reverse proxy + TLS auto. Gère routing production (HTTPS, compression, rate limiting).

**Grafana**  
Dashboards monitoring infra. Health Monitor Agent collecte métriques (latency, uptime, errors).

---

### Annexe B : Diagramme Architecture Globale

#### Vue d'Ensemble "Entreprise Augmentée"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         🎯 IA-BOARD (Gouvernance)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   IA-CEO v2  │  │ IA-CFO/COO   │  │  IA-LEGAL    │  │   IA-RISK    │   │
│  │ Orchestration│  │   Finance    │  │ Compliance   │  │   Sécurité   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│  6 KPIs globaux │ Modes: Safe/Assisted/Auto-Drive/Forecast (State Machine) │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │           📊 MÉTA-COUCHES COGNITIVES                  │
        ├───────────────────────────────────────────────────────┤
        │  💾 DATA BRAIN: Vues cross-domain (sales, pricing,   │
        │     traffic, infra) + Corrélations + Insights unifiés │
        ├───────────────────────────────────────────────────────┤
        │  🎯 DIALOGUE LAYER: CLI + Dashboard + Copilot +       │
        │     Slack/Email (Interfaces humaines multi-canal)     │
        ├───────────────────────────────────────────────────────┤
        │  🧪 SIMULATION LAYER: Sandbox what-if (pricing,       │
        │     campagnes, infra) + Modèles prédictifs ML         │
        └───────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     🔧 NIVEAU 2 - TECH & PRODUIT (22 agents)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  🖥️ Code Quality (6)  │  🏗️ Infra (5)    │  🔒 Security (4) │  🎨 UX (4)   │
│  - AI Support          │  - Docker Opt.   │  - Security Mon. │  - A/B Test  │
│  - Code Review         │  - DevOps        │  - Pentest       │  - User Exp. │
│  - Perf Optimizer      │  - Database      │  - Compliance    │  - Analytics │
│  - Tech Debt           │  - CDN           │  - Backup        │  - Heatmaps  │
│  - API Designer        │  - Health Mon.   │                  │              │
│  - Dependency Manager  │                  │                  │              │
│  📱 Frontend (3): Bundle Optimizer, Accessibility Auditor, PWA Optimizer    │
│  10 KPIs tech          │  (Uptime, Latency, Cost, Vulns, UX Score...)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   💼 NIVEAU 3 - BUSINESS CORE (16 agents)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  📈 Ventes/CRM (4)   │  📣 Marketing/SEO (5) │  💰 Pricing/Finance (4)      │
│  - Lead Scoring      │  - SEO Optimizer      │  - Pricing Bot               │
│  - CRM Intelligence  │  - Campaign Manager   │  - Margin Analyzer           │
│  - Sales Forecasting │  - Content Strategy   │  - Invoice Intelligence      │
│  - Upsell Agent      │  - Ad Optimizer       │  - Payment Monitor           │
│                      │  - Social Media       │                              │
│  📦 Logistique/Stock (3) : Stock Forecaster, Fulfillment, Supply Chain     │
│  10 KPIs business      (Conversion, Margin, CAC, LTV, Stock Accuracy...)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 🌍 NIVEAU 4 - EXPANSION & SUPPORT (15 agents)               │
├─────────────────────────────────────────────────────────────────────────────┤
│  👥 RH (3)           │  🚀 Innovation (3)    │  🌱 ESG (3)                  │
│  - Recruitment       │  - Product Manager    │  - Carbon Tracker            │
│  - Onboarding        │  - Innovation Scout   │  - ESG Reporter              │
│  - Retention         │  - Tech Watch         │  - Supplier Audit            │
│  🤝 Partenaires (3)  │  🎯 Customer 360° (3)                                │
│  - Partnership Mgmt  │  - Customer Success                                  │
│  - Ecosystem Dev.    │  - Feedback Analyzer                                 │
│  - Integration API   │  - Churn Predictor                                   │
│  12 KPIs support       (NPS, Turnover, Innovation Index, ESG Score...)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🎯 5 SQUADS TRANSVERSAUX AUTONOMES                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  🛒 Squad E-Commerce (4)     │  Acquisition → Conversion → Fidélisation    │
│     SEO + Campaign + Pricing + Upsell  │  Budget: €65K/trim (autonomie €2K)│
├─────────────────────────────────────────────────────────────────────────────┤
│  ⚡ Squad Performance (4)     │  Code → Infra → Monitoring → Pricing       │
│     Tech Debt + DevOps + Health + Pricing  │  OKR: p95 <200ms, Uptime 99.9%│
├─────────────────────────────────────────────────────────────────────────────┤
│  🚀 Squad Expansion (4)       │  Produit → Innovation → Partenaires → RH   │
│     Product Mgr + Innovation + Partnership + Recruitment  │ OKR: +3 features/Q│
├─────────────────────────────────────────────────────────────────────────────┤
│  🛡️ Squad Resilience (2)      │  Sécurité + Infrastructure                 │
│     Security Mon. + Docker Optimizer  │  OKR: 0 incidents critiques        │
├─────────────────────────────────────────────────────────────────────────────┤
│  💚 Squad Customer (3)        │  Support → Feedback → Fidélisation         │
│     Customer Success + Feedback + Churn Pred.  │  OKR: NPS >40, Churn <5% │
│  14 KPIs Squads  │  Gouvernance: €2K autonomie, €2K-€5K CFO, >€5K Board    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      🔄 INTELLIGENCE COGNITIVE                              │
│  Cycle apprentissage: 👁️ OBSERVE → 🤖 PROPOSE → 📊 MESURE → 🧠 APPREND    │
│  Feedback loops: Humain + Résultats réels + Pattern recognition            │
│  Table: ai_cos_learning_events (Supabase)  │  Confidence scoring 0-100%    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Légende Architecture

**Flux données** : Board ↓ Méta-Couches ↓ Tech ↓ Business ↓ Support ↓ Squads  
**Coordination** : Redis pub/sub (événements temps réel) + Data Brain (insights cross-domain)  
**Gouvernance** : State Machine modes (Safe→Assisted→Auto-Drive→Forecast)  
**Total agents** : 57 opérationnels + 5 Squads = 62 entités intelligentes  
**Total KPIs** : 52 (6 Board + 10 Tech + 10 Business + 12 Support + 14 Squads)  
**Budget** : €395K/an (€260K Squads + €135K méta-couches+modes), ROI 290%

---

### Annexe C : Quick Reference - Cheat Sheet AI-COS

#### 🎯 Top 10 Agents Critiques (Par Impact Business)

| Agent | Domaine | KPI Principal | Mode | Impact €/an |
|-------|---------|---------------|------|-------------|
| **1. Pricing Bot** | Finance | Marge +2-5% | Auto-Drive | €180K |
| **2. SEO Optimizer** | Marketing | Trafic organique +25% | Assisted | €150K |
| **3. Campaign Manager** | Marketing | ROI campaigns 180% | Assisted | €120K |
| **4. IA-CEO v2** | Board | Coordination 57 agents | Forecast | €100K |
| **5. DevOps Agent** | Infra | Uptime 99.9% | Auto-Drive | €80K |
| **6. Lead Scoring** | Ventes | Conversion leads +15% | Assisted | €75K |
| **7. Stock Forecaster** | Logistique | Ruptures -40% | Assisted | €60K |
| **8. Churn Predictor** | Customer | Churn <5% | Assisted | €50K |
| **9. Security Monitor** | Security | 0 incidents | Safe | €45K |
| **10. Tech Debt Manager** | Code | Dette -30% | Assisted | €40K |

**Total impact Top 10** : €900K/an (78% gains totaux €1.148M)

---

#### 🎮 Modes d'Opération - Résumé

| Mode | Emoji | Autonomie | Validation | Critères | Usage |
|------|-------|-----------|------------|----------|-------|
| **Safe** | 🔒 | 0% | Aucune | <30j prod, baseline | CI/CD auto |
| **Assisted** | 🤝 | 30% | Humaine | >30j prod, 0 erreurs | Sprint hebdo |
| **Auto-Drive** | 🚀 | 80% | Si >€2K | 3+ itérations, confidence >85% | Agents matures |
| **Forecast** | 🔮 | 0% | N/A | Session Board, Simulation Layer | Board trimestre |

**Transitions** : Safe (30j) → Assisted (validation humaine) → Auto-Drive (3 itérations + confidence 85% + approbation Board)

---

#### 📊 KPIs Critiques (Top 15)

**🔴 Board (Stratégiques)**
- `global-revenue` : €1.2M/mois (target +10%/Q)
- `global-margin` : 32% (target >30%)
- `burn-rate` : €180K/mois (runway 18 mois)

**🔴 Tech (Infrastructure)**
- `uptime` : 99.9% (target >99.9%)
- `latency-p95` : <200ms (target <200ms)
- `security-incidents` : 0/mois (target 0)

**🔴 Business (Conversion)**
- `conversion-rate` : 3.2% (target >3%)
- `cac` : €45 (target <€50)
- `ltv` : €380 (target >€350)
- `aov` : €85 (target >€80)

**🟠 Support (Satisfaction)**
- `nps` : 42 (target >40)
- `churn-rate` : 4.8% (target <5%)
- `customer-satisfaction` : 4.2/5 (target >4/5)

**🟠 Squads (Autonomie)**
- `squad-budget-utilization` : 78% (target 70-85%)
- `squad-okr-achievement` : 82% (target >80%)

---

#### 💰 Budget & ROI - Synthèse

**Coûts Totaux** : €395K/an
- Squads autonomes : €260K (€65K/trim × 4Q)
- Méta-couches cognitives : €135K (Data Brain €60K + Dialogue €20K + Simulation €25K + Modes €30K)

**Gains Totaux** : €1.148M/an
- Agents automatisation : €800K (réduction coûts ops + optimisations)
- Méta-couches insights : €300K (corrélations cross-domain, décisions data-driven)
- Modes vélocité : €48K (Auto-Drive -70% délai validation)

**ROI Global** : 290% (€1.148M gains / €395K coûts)

---

#### 🚀 Phase 1 Quick Wins (Semaines 1-4)

**Priorité CRITICAL** :
1. ✅ **IA-CEO v2 upgrade** : Orchestration 57 agents, state machine modes (2 semaines)
2. ✅ **Data Brain V1** : Vues cross-domain (sales, pricing, traffic) + Corrélations (3 semaines)
3. ✅ **Pricing Bot** : Élasticité prix + Alertes concurrence (2 semaines)
4. ✅ **SEO Optimizer** : Audit technique + Recommandations (2 semaines)
5. ✅ **DevOps Agent** : Auto-scaling + Health monitoring (2 semaines)

**KPIs Phase 1** : +5% conversion, +2% marge, Uptime 99.9%, 0 incidents sécurité

---

#### 🔧 Commandes CLI Essentielles

```bash
# Status global
ai-cos status

# Interroger Data Brain
ai-cos ask "Pourquoi baisse conversion produit X ?"

# Approuver action Squad
ai-cos approve squad-ecommerce-action-42

# Simuler scénario pricing
ai-cos simulate pricing --product=X --price=+10%

# Consulter mode agent
ai-cos mode status pricing-bot

# Transition mode agent
ai-cos mode transition pricing-bot --to=auto-drive --approved-by=cfo

# Dashboard modes
ai-cos dashboard modes

# Logs agent temps réel
ai-cos logs pricing-bot --follow
```

---

#### 📞 Contacts & Escalation

**Validation approbations** :
- Actions <€2K : Lead Squad concerné (SLA <2h)
- Actions €2K-€5K : CFO (SLA <48h)
- Actions >€5K : Board IA-COS (SLA <7j)
- Incidents sécurité : CTO + IA-RISK (SLA <30min)

**Dashboards** :
- Board : `/admin/ai-cos/board`
- Squads : `/admin/ai-cos/squads`
- Modes : `/admin/ai-cos/modes`
- KPIs : `/admin/ai-cos/kpis`

**Notifications** :
- Slack : `#ai-cos-approvals`, `#ai-cos-alerts`
- Email : `ai-cos@company.com`

---

**Version** : 1.2.0 | **Date** : 2025-11-19 | **Page** : 1/1  
**Document complet** : `.spec/architecture/006-ai-cos-enrichment.md` (3791 lignes)

---

## References

- [AI-COS v1.0 ADR](./005-ai-cos-system.md)
- [AI-COS Operating System Feature](../features/ai-cos-operating-system.md)
- [AI-COS Workflow Guide](../workflows/ai-cos-workflow.md)
- [Cache Multi-Levels](./003-cache-redis-multi-levels.md)
- [Spec Kit README](../README.md)

## Change Log


### Version 1.7.0 - 2025-11-19
**Ajout section Monitoring & KPIs Globaux** (+650 lignes)
- Health Board dashboard `/admin/ai-cos/board` : agrégation 40 KPIs → Health Score Global (0-100)
- Formule pondération : Tech 25%, Business 40%, Support 20%, Squads 15%
- Workflow escalation : agent→Squad→CEO→Board avec SLA (<2h/<4h/<24h)
- 7 KPIs critiques temps réel : Code Health, Perf Backend, UX Score, Conversion, ROI, Stock, ESG
- 4 KPIs méta-monitoring : dashboard-latency, kpi-freshness, alert-response-time, stability
- 3 types alertes : reactive, prédictive, corrélation (Data Brain cross-domain)
- Intégration Modes d'Opération & Forecast (dashboards complémentaires)
- Budget développement : €16K (5 semaines), ROI 1150% (€184K gains/an)
- Budget méta-couches révisé : €135K → €151K
- ROI global architecture : 290% → 324% (€1.332M gains / €411K coût)
- 2025-11-18 : Version initiale (draft) - ADR-006 enrichissement complet
- 2025-11-18 : Version 1.1.0 - Correction IA-Platform Engineer → IA-Docker Optimizer (stack Docker Compose validé)
- 2025-11-18 : Version 1.2.0 - Architecture IA-BOARD (governance) + 4 pôles métier (opérationnel), ajout IA-RISK, merge IA-CFO/COO
- 2025-11-19 : Version 1.3.0 - Ajout Intelligence Cognitive & Feedback Loops (cycle apprentissage 4 étapes)
- 2025-11-19 : Version 1.4.0 - Ajout Méta-Couches Cognitives (Data Brain, Dialogue Layer, Simulation Layer), budget €135K
- 2025-11-19 : Version 1.5.0 - Ajout Modes d'Opération (Safe/Assisted/Auto-Drive/Forecast), state machine, gouvernance autonomie
- 2025-11-19 : Version 1.6.0 - Ajout 3 Annexes (Glossaire 26 acronymes, Diagramme Architecture ASCII, Quick Reference cheat sheet)

---

**Status** : ⏳ **En attente validation stakeholders**  
**Next Action** : Review avec CTO, PO, Tech Lead  
**Go/No-Go** : Après validation, start Phase 1 Week 1
