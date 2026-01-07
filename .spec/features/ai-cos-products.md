---
title: "AI-COS Products - Catalogue des Produits IA"
status: active
version: 1.0.0
authors: [Product Team, Business Team]
created: 2026-01-01
updated: 2026-01-01
relates-to:
  - ./ai-cos-operating-system.md
  - ./ai-cos-front-agent.md
  - ../workflows/ai-cos-index.md
tags: [products, catalogue, business-value, orchestration]
priority: high
---

# AI-COS Products

## Overview

Ce catalogue définit les **Produits IA** de l'AI-COS. Un Produit IA est une capacité métier activable sur demande, orchestrant plusieurs agents pour délivrer un résultat actionnable.

> **Différence clé** :
> - Agent = Moyen technique (comment)
> - Produit IA = Résultat métier (quoi)

## Format Standard

```yaml
Produit: [Nom]
ID: [PROD-XXX]
Catégorie: [SEO | Performance | Stock | Customer | Security | Finance]

Objectif_métier: [Valeur business en 1 phrase]

Entrées:
  - [Source 1]
  - [Source 2]

Actions_possibles:
  - Analyser
  - Diagnostiquer
  - Proposer
  - Exécuter (si validation)
  - Bloquer (si critique)

Sorties:
  - [Output 1]
  - [Output 2]

Agents_impliqués:
  - [Agent 1] (Lead)
  - [Agent 2]
  - [Agent 3]

Validation_humaine: Obligatoire | Optionnelle | Auto (si risque faible)

SLA:
  diagnostic: [Xh]
  plan_action: [Xh]
  exécution: [Xh]

Triggers:
  - Manuel (via Front-Agent)
  - Automatique (si condition)

KPIs_impactés:
  - [KPI 1]
  - [KPI 2]
```

---

## Produits IA - Catégorie SEO

### PROD-001: Diagnostic SEO Migration

```yaml
Produit: Diagnostic SEO Migration
ID: PROD-001
Catégorie: SEO

Objectif_métier: >
  Identifier les causes de non-reprise de trafic après migration
  et proposer un plan de correction priorisé.

Entrées:
  - Google Search Console (impressions, clics, positions)
  - Logs crawl (Screaming Frog, logs serveur)
  - Routes Remix (ancien → nouveau mapping)
  - Knowledge Graph SEO (structure pages)
  - Historique trafic (GA4, 90 jours)

Actions_possibles:
  - Analyser: Comparer avant/après migration
  - Diagnostiquer: Identifier causes (404, redirections, contenu)
  - Proposer: Plan de correction priorisé
  - Bloquer: Alerte si perte > 30%

Sorties:
  - Diagnostic priorisé (causes + impact %)
  - Plan d'action validable (P0/P1/P2)
  - Risques associés (financier, timing)
  - Rapport PDF exportable

Agents_impliqués:
  - SEO Sentinel (Lead)
  - IA-DevOps (logs, redirections)
  - Data Architect (KG SEO)
  - Analytics Agent (trafic)

Validation_humaine: Obligatoire

SLA:
  diagnostic: 4h
  plan_action: 8h
  exécution: Variable selon plan

Triggers:
  - Manuel: Demande via Front-Agent
  - Automatique: Si trafic -20% sur 7 jours

KPIs_impactés:
  - seo-score
  - indexed-ratio
  - organic-traffic
  - conversion-rate
```

### PROD-002: Audit Cannibalisation SEO

```yaml
Produit: Audit Cannibalisation SEO
ID: PROD-002
Catégorie: SEO

Objectif_métier: >
  Détecter les pages en concurrence interne sur les mêmes mots-clés
  et consolider le positionnement.

Entrées:
  - Google Search Console (requêtes, pages)
  - Contenu pages (H1, titles, meta)
  - Structure catégories

Actions_possibles:
  - Analyser: Mapper mots-clés → pages multiples
  - Diagnostiquer: Identifier groupes cannibalisés
  - Proposer: Fusion, redirection, ou différenciation
  - Exécuter: Redirections automatiques (après validation)

Sorties:
  - Liste pages cannibalisées
  - Recommandations par groupe
  - Impact estimé sur positions

Agents_impliqués:
  - SEO Sentinel (Lead)
  - Content Bot
  - Analytics Agent

Validation_humaine: Obligatoire

SLA:
  diagnostic: 2h
  plan_action: 4h
  exécution: 24h

Triggers:
  - Manuel: Audit mensuel
  - Automatique: Si cannibalisation > 5%

KPIs_impactés:
  - cannibalisation-rate
  - seo-score
  - organic-positions
```

---

## Produits IA - Catégorie Performance

### PROD-010: Analyse Performance Critique

```yaml
Produit: Analyse Performance Critique
ID: PROD-010
Catégorie: Performance

Objectif_métier: >
  Diagnostiquer les causes de lenteur et proposer
  des optimisations avec impact chiffré.

Entrées:
  - Core Web Vitals (LCP, FID, CLS, INP)
  - APM (Traces, spans, latences)
  - Bundle analysis (source-map-explorer)
  - Database queries (slow queries)
  - CDN logs (cache hit/miss)

Actions_possibles:
  - Analyser: Profiler pages lentes
  - Diagnostiquer: Identifier bottlenecks
  - Proposer: Optimisations classées par ROI
  - Exécuter: Fixes automatiques (cache, compression)

Sorties:
  - Waterfall analysis détaillé
  - Top 10 optimisations par impact
  - Estimation gains (ms, score Lighthouse)
  - Plan d'action priorisé

Agents_impliqués:
  - IA-DevOps (Lead)
  - CWV Optimizer
  - Database Optimizer
  - Cache Optimizer
  - Bundle Optimizer

Validation_humaine: Optionnelle (auto si risque faible)

SLA:
  diagnostic: 1h
  plan_action: 2h
  exécution: Variable

Triggers:
  - Manuel: Demande via Front-Agent
  - Automatique: Si LCP > 4s ou Lighthouse < 50

KPIs_impactés:
  - lighthouse-score
  - lcp-p75
  - backend-p95
  - frontend-p95
```

### PROD-011: Optimisation Build Time

```yaml
Produit: Optimisation Build Time
ID: PROD-011
Catégorie: Performance

Objectif_métier: >
  Réduire le temps de build CI/CD pour accélérer
  les déploiements.

Entrées:
  - GitHub Actions logs
  - Turbo cache stats
  - Docker layer analysis
  - Dependencies tree

Actions_possibles:
  - Analyser: Profiler étapes build
  - Diagnostiquer: Identifier étapes lentes
  - Proposer: Cache, parallelisation, pruning
  - Exécuter: Configuration automatique

Sorties:
  - Breakdown temps par étape
  - Recommandations optimisation
  - Estimation gain (minutes)

Agents_impliqués:
  - IA-DevOps (Lead)
  - IA-Docker Optimizer
  - Bundle Optimizer

Validation_humaine: Optionnelle

SLA:
  diagnostic: 30min
  plan_action: 1h
  exécution: 2h

Triggers:
  - Manuel: Demande dev
  - Automatique: Si build > 10min

KPIs_impactés:
  - build-time
  - deploy-frequency
```

---

## Produits IA - Catégorie Stock

### PROD-020: Prévision Rupture Stock

```yaml
Produit: Prévision Rupture Stock
ID: PROD-020
Catégorie: Stock

Objectif_métier: >
  Anticiper les ruptures de stock avant qu'elles impactent
  les ventes et déclencher les réapprovisionnements.

Entrées:
  - Historique ventes (2 ans)
  - Stock actuel (ERPNext)
  - Lead times fournisseurs
  - Saisonnalité (événements, météo)
  - Promotions planifiées

Actions_possibles:
  - Analyser: Forecast demande J+7/14/30/90
  - Diagnostiquer: Identifier SKUs à risque
  - Proposer: PO automatiques
  - Exécuter: Création PO (après validation CFO)
  - Bloquer: Alerte si rupture critique

Sorties:
  - Liste SKUs à risque (J-14)
  - Recommandations quantités
  - PO pré-remplis
  - Impact financier estimé

Agents_impliqués:
  - Stock Forecaster (Lead)
  - IA-CFO (validation budget)
  - Supplier Scorer
  - Pricing Bot (coordination promos)

Validation_humaine: Obligatoire (> €10K)

SLA:
  diagnostic: 1h
  plan_action: 2h
  exécution: 24h (PO)

Triggers:
  - Manuel: Revue hebdomadaire
  - Automatique: Si stock < safety stock

KPIs_impactés:
  - rupture-stock
  - forecast-accuracy
  - inventory-turnover
```

### PROD-021: Liquidation Surstock

```yaml
Produit: Liquidation Surstock
ID: PROD-021
Catégorie: Stock

Objectif_métier: >
  Identifier et liquider les surstocks avant
  obsolescence via promotions ciblées.

Entrées:
  - Rotation stock (> 90 jours)
  - Marge par produit
  - Historique promos
  - Capacité entrepôt

Actions_possibles:
  - Analyser: Identifier surstocks
  - Diagnostiquer: Évaluer risque obsolescence
  - Proposer: Stratégie liquidation (promo, bundle, destockage)
  - Exécuter: Activer promos (après validation)

Sorties:
  - Liste produits surstock
  - Stratégie recommandée par produit
  - Simulation impact marge
  - Plan promo

Agents_impliqués:
  - Stock Forecaster (Lead)
  - Pricing Bot
  - IA-Ads (campagnes)
  - IA-Merch (bundles)

Validation_humaine: Obligatoire

SLA:
  diagnostic: 2h
  plan_action: 4h
  exécution: 48h

Triggers:
  - Manuel: Revue mensuelle
  - Automatique: Si surstock > 20% capacité

KPIs_impactés:
  - surstock-rate
  - inventory-turnover
  - gross-margin
```

---

## Produits IA - Catégorie Customer

### PROD-030: Détection Churn Client

```yaml
Produit: Détection Churn Client
ID: PROD-030
Catégorie: Customer

Objectif_métier: >
  Identifier les clients à risque de churn et
  déclencher des actions de rétention.

Entrées:
  - Comportement achat (fréquence, récence, montant)
  - Interactions support (tickets, satisfaction)
  - Engagement email (opens, clicks)
  - NPS historique
  - Signaux web (visites, abandon panier)

Actions_possibles:
  - Analyser: Scoring propensity-to-churn
  - Diagnostiquer: Identifier causes probables
  - Proposer: Actions rétention personnalisées
  - Exécuter: Campagne rétention automatique

Sorties:
  - Liste clients à risque (score > 70%)
  - Causes probables par client
  - Actions recommandées
  - ROI estimé de la rétention

Agents_impliqués:
  - Churn Predictor (Lead)
  - IA-CRM
  - IA-Sales
  - VoC Miner

Validation_humaine: Optionnelle (auto si valeur client < €500)

SLA:
  diagnostic: 1h
  plan_action: 2h
  exécution: 24h

Triggers:
  - Manuel: Analyse hebdomadaire
  - Automatique: Si score churn > 80%

KPIs_impactés:
  - churn-rate
  - cltv
  - nps-score
  - retention-rate
```

### PROD-031: Analyse Voice of Customer

```yaml
Produit: Analyse Voice of Customer
ID: PROD-031
Catégorie: Customer

Objectif_métier: >
  Synthétiser les feedbacks clients pour identifier
  les pain points prioritaires.

Entrées:
  - Avis Google/Trustpilot
  - Tickets support
  - Enquêtes NPS/CSAT
  - Commentaires réseaux sociaux
  - Enregistrements appels

Actions_possibles:
  - Analyser: NLP extraction thèmes
  - Diagnostiquer: Classifier sentiments
  - Proposer: Priorisation pain points
  - Exécuter: Rapport automatique

Sorties:
  - Word cloud thèmes
  - Sentiment par catégorie
  - Top 10 pain points
  - Recommandations produit

Agents_impliqués:
  - VoC Miner (Lead)
  - Support Bot
  - NPS Tracker
  - IA-CPO

Validation_humaine: Obligatoire (insights stratégiques)

SLA:
  diagnostic: 4h
  plan_action: 8h
  exécution: Rapport mensuel

Triggers:
  - Manuel: Mensuel
  - Automatique: Si NPS < 30

KPIs_impactés:
  - nps-score
  - csat-avg
  - review-sentiment-positive
```

---

## Produits IA - Catégorie Security

### PROD-040: Audit Sécurité Express

```yaml
Produit: Audit Sécurité Express
ID: PROD-040
Catégorie: Security

Objectif_métier: >
  Évaluer rapidement la posture de sécurité et
  identifier les vulnérabilités critiques.

Entrées:
  - npm audit
  - OWASP ZAP scan
  - Snyk analysis
  - Logs accès suspects
  - Configuration serveurs

Actions_possibles:
  - Analyser: Scan complet vulnérabilités
  - Diagnostiquer: Classifier par CVSS
  - Proposer: Patches prioritaires
  - Bloquer: Si vuln CRITICAL non patchée
  - Exécuter: Auto-patch dependencies (mineures)

Sorties:
  - Rapport vulnérabilités
  - Classification CVSS
  - Plan remediation
  - Score sécurité

Agents_impliqués:
  - IA-CISO (Lead)
  - Security Shield
  - Dependency Scanner
  - Pen Test Bot

Validation_humaine: Obligatoire (vulns HIGH/CRITICAL)

SLA:
  diagnostic: 1h
  plan_action: 2h
  exécution: 24h (CRITICAL)

Triggers:
  - Manuel: Mensuel ou avant release
  - Automatique: Si CVE CRITICAL détectée

KPIs_impactés:
  - security-score
  - vulns-critical-high
  - patch-coverage
  - owasp-compliance
```

### PROD-041: Détection Intrusion

```yaml
Produit: Détection Intrusion
ID: PROD-041
Catégorie: Security

Objectif_métier: >
  Détecter et bloquer les tentatives d'intrusion
  en temps réel.

Entrées:
  - Logs accès (fail2ban, nginx)
  - Comportement utilisateurs (anomalies)
  - Requêtes API suspectes
  - Géolocalisation connexions

Actions_possibles:
  - Analyser: Pattern matching attaques
  - Diagnostiquer: Classifier type attaque
  - Proposer: Contre-mesures
  - Bloquer: IP/user automatique
  - Exécuter: Isolation container

Sorties:
  - Alerte temps réel
  - Classification attaque
  - Actions automatiques exécutées
  - Rapport incident

Agents_impliqués:
  - Security Shield (Lead)
  - IA-CISO
  - IA-DevOps

Validation_humaine: Auto (blocage immédiat), Report obligatoire

SLA:
  diagnostic: Temps réel
  plan_action: N/A
  exécution: < 1 minute

Triggers:
  - Automatique: Toujours actif

KPIs_impactés:
  - security-score
  - mttr-security-incidents
  - incident-count
```

---

## Produits IA - Catégorie Finance

### PROD-050: Analyse Marge Produit

```yaml
Produit: Analyse Marge Produit
ID: PROD-050
Catégorie: Finance

Objectif_métier: >
  Identifier les produits à marge faible ou négative
  et proposer des ajustements.

Entrées:
  - Prix achat fournisseurs
  - Prix vente
  - Coûts logistiques
  - Frais marketing par produit
  - Volume ventes

Actions_possibles:
  - Analyser: Calcul marge nette par SKU
  - Diagnostiquer: Identifier produits non rentables
  - Proposer: Ajustement prix ou arrêt
  - Exécuter: Mise à jour prix (après validation)

Sorties:
  - Classement produits par marge
  - Recommandations prix
  - Simulation impact CA
  - Produits à déréférencer

Agents_impliqués:
  - Pricing Bot (Lead)
  - IA-CFO
  - Margin Optimizer

Validation_humaine: Obligatoire

SLA:
  diagnostic: 2h
  plan_action: 4h
  exécution: 24h

Triggers:
  - Manuel: Mensuel
  - Automatique: Si marge globale < 25%

KPIs_impactés:
  - gross-margin
  - aov
  - revenue-growth
```

### PROD-051: Prévision Cash Flow

```yaml
Produit: Prévision Cash Flow
ID: PROD-051
Catégorie: Finance

Objectif_métier: >
  Anticiper les besoins de trésorerie à 8-12 semaines
  et alerter sur les risques.

Entrées:
  - Historique encaissements
  - Échéancier fournisseurs
  - Prévisions ventes
  - Charges fixes
  - Investissements planifiés

Actions_possibles:
  - Analyser: Projection cash flow
  - Diagnostiquer: Identifier périodes critiques
  - Proposer: Actions (accélération encaissements, report charges)
  - Bloquer: Alerte si runway < 8 semaines

Sorties:
  - Prévision cash 12 semaines
  - Alertes période critique
  - Recommandations trésorerie
  - Scénarios what-if

Agents_impliqués:
  - IA-CFO (Lead)
  - Invoice Bot
  - Payment Reconciler

Validation_humaine: Obligatoire

SLA:
  diagnostic: 4h
  plan_action: 8h
  exécution: N/A (advisory)

Triggers:
  - Manuel: Hebdomadaire
  - Automatique: Si runway < 12 semaines

KPIs_impactés:
  - runway
  - burn-rate
  - payment-delay
```

---

## Résumé du Catalogue

| ID | Produit | Catégorie | Validation | SLA Diag |
|----|---------|-----------|------------|----------|
| PROD-001 | Diagnostic SEO Migration | SEO | Obligatoire | 4h |
| PROD-002 | Audit Cannibalisation SEO | SEO | Obligatoire | 2h |
| PROD-010 | Analyse Performance Critique | Performance | Optionnelle | 1h |
| PROD-011 | Optimisation Build Time | Performance | Optionnelle | 30min |
| PROD-020 | Prévision Rupture Stock | Stock | Obligatoire | 1h |
| PROD-021 | Liquidation Surstock | Stock | Obligatoire | 2h |
| PROD-030 | Détection Churn Client | Customer | Optionnelle | 1h |
| PROD-031 | Analyse Voice of Customer | Customer | Obligatoire | 4h |
| PROD-040 | Audit Sécurité Express | Security | Obligatoire | 1h |
| PROD-041 | Détection Intrusion | Security | Auto | Temps réel |
| PROD-050 | Analyse Marge Produit | Finance | Obligatoire | 2h |
| PROD-051 | Prévision Cash Flow | Finance | Obligatoire | 4h |

## Évolutions Futures

### Phase 1 (Actuel) - 12 Produits
Produits fondamentaux couvrant les 6 catégories principales.

### Phase 2 - +8 Produits
- PROD-003: Audit Backlinks
- PROD-012: Optimisation Images
- PROD-022: Analyse Saisonnalité
- PROD-032: Segmentation Client IA
- PROD-042: Compliance RGPD
- PROD-052: Analyse Pricing Concurrent
- PROD-060: Audit UX Parcours
- PROD-070: Analyse RH Turnover

### Phase 3 - +5 Produits
- Produits cross-catégories
- Intégrations partenaires
- Produits self-service

## Related Documents

- [AI-COS Front-Agent](./ai-cos-front-agent.md) - Interface utilisateur
- [AI-COS Operating System](./ai-cos-operating-system.md) - Système global
- [AI-COS Index](../workflows/ai-cos-index.md) - Navigation
