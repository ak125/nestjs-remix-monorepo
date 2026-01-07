# AI-COS Quality Squad

**QA, UX et accessibilité**

---

## Vue d'ensemble

Le **Quality Squad** comprend **11 agents** avec un budget total de **€184K** et un ROI annuel de **+€630K**.

### Composition

| Agent | Budget | Rôle |
|-------|--------|------|
| IA-CISO | €40K | Sécurité applicative |
| B7 | €6K | Ethics/Compliance Guard |
| IA-CPO | €35K | Produit & UX |
| MobileAccessibility | €12K | Mobile & A11y |
| F1 | €18K | BAT Runner |
| F2 | €15K | UX Copilot |
| F3 | €12K | A11y Scanner |
| F4 | €22K | E2E Automatique + Perceptual UI (M3) |
| F5 | €15K | Observabilité UX |
| M2 | €4K | Mutation Testing |
| M4 | €5K | Shadow Traffic Replay |

### Architecture Squad

```
                    ┌───────────────────────────────────────┐
                    │         QUALITY SQUAD                 │
                    │         €184K | 11 agents             │
                    └───────────────┬───────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   ┌────┴────────────┐   ┌─────────┴─────────┐   ┌────────────┴────┐
   │  Security       │   │   UX & Product    │   │   QA Testing    │
   │                 │   │                   │   │                 │
   │  IA-CISO        │   │  IA-CPO           │   │  F1 BAT Runner  │
   │  B7 Ethics      │   │  MobileA11y       │   │  F4 E2E + M3    │
   │  (€46K)         │   │  F2 UX Copilot    │   │  F5 Observ. UX  │
   │                 │   │  F3 A11y Scanner  │   │  M2 Mutation    │
   │                 │   │  (€62K)           │   │  M4 Shadow      │
   │                 │   │                   │   │  (€76K)         │
   └─────────────────┘   └───────────────────┘   └─────────────────┘
```

---

## Agent Sécurité (IA-CISO)

### Rôle Central

L'**IA-CISO** est le **Lead Resilience Squad** (6 agents), gardien de la sécurité applicative 24/7 et orchestrateur des pratiques DevSecOps pour garantir 0 vulnérabilités CRITICAL/HIGH et conformité OWASP/PCI-DSS.

**Positionnement Squad** : Security Lead - Coordonne Security Scanner, Compliance Auditor, Secrets Manager, Penetration Tester, Incident Responder
**Budget** : €40K
**ROI** : Évitement breaches -€500K/an, conformité PCI-DSS

### 7 Responsabilités Clés

#### 1. Patch Management CVE (CRITICAL)

**Veille Automatisée** :
- Monitoring NVD (National Vulnerability Database)
- GitHub Security Advisories tracking
- Snyk/OWASP Dependency Check
- CVE scoring CVSS v3 (base + temporal)

**SLA Patch** :
- CRITICAL (CVSS ≥9.0) : <24h
- HIGH (CVSS 7.0-8.9) : <72h
- MEDIUM (CVSS 4.0-6.9) : <7 jours
- LOW (CVSS <4.0) : <30 jours

**KPIs** :
- `vulns-critical` : 0 (tolérance 0)
- `vulns-high` : 0 (tolérance 0)
- `patch-coverage` : 100%

#### 2. OWASP Compliance Audit (CRITICAL)

**OWASP Top 10 2021** :
- A01 Broken Access Control : RBAC + RLS
- A02 Cryptographic Failures : bcrypt + JWT HS256
- A03 Injection : Prepared statements + validation
- A04 Insecure Design : Threat modeling
- A05 Security Misconfiguration : Helmet headers
- A06 Vulnerable Components : Snyk scanning
- A07 Authentication Failures : Rate limiting
- A08 Software Data Integrity : Signature verification
- A09 Logging Failures : Winston structured logs
- A10 Server-Side Request Forgery : URL validation

**Audit Hebdomadaire** : OWASP ZAP scan (45min) + rapport 10 catégories

**KPI** : `owasp-compliance` : 100% (10/10 catégories validées)

#### 3. Dependency Vulnerability Monitoring (CRITICAL)

**Outils** :
- npm audit (backend + frontend)
- Snyk CLI (continuous monitoring)
- GitHub Dependabot alerts
- OWASP Dependency-Check

**KPI** : `dependency-health` : 100% (0 vulns HIGH/CRITICAL)

#### 4. Incident Response Sécurité (HIGH)

**Types Incidents** :
- Intrusion detected (brute force, SQL injection)
- Data breach (exfiltration logs)
- DoS/DDoS attack (rate limiting exceeded)
- Malware detected (suspicious files)
- Insider threat (anomalous access patterns)

**MTTR Target** : <2h (detection → containment → remediation)

#### 5. Penetration Testing (MEDIUM)

**Fréquence** : Monthly automated + Quarterly manual

**Scope** :
- API endpoints (authentication, authorization, injection)
- Frontend (XSS, CSRF, clickjacking)
- Infrastructure (exposed services, misconfigurations)

#### 6. Compliance Certifications (HIGH)

**Standards** :
- **PCI-DSS v4.0** : Paiement Paybox (tokenization, TLS 1.3, logs 90 jours)
- **ISO 27001** : ISMS (policies, risk assessments, audits)
- **SOC 2 Type II** : Trust Services (security, availability, confidentiality)
- **RGPD** : Coordination IA-Legal (data protection, encryption at rest)

**KPI** : `compliance-certifications` : 100% (4/4 standards validés)

#### 7. Security Training & Awareness (MEDIUM)

**Programme** :
- Monthly security bulletins (CVE highlights, best practices)
- Quarterly workshops (OWASP, secure coding)
- Phishing simulations (monthly tests)

**KPI** : `security-training-completion` : >80% équipe

### 5 Workflows Critiques

#### Workflow 1 : CVE Patch Automatisé <24h

**Trigger** : NVD publish CVE CRITICAL (CVSS ≥9.0)

**Actions** :
1. Detection (T+0min) : Snyk webhook → IA-CISO alert
2. Analysis (T+15min) : Vérifier versions actuelles
3. Auto-Remediation (T+30min) : npm install fix version
4. Testing (T+45min) : Tests unitaires + E2E
5. PR Auto (T+60min) : Security patch PR auto-merge
6. Deploy (T+105min) : Production deployment

**SLA** : <24h pour CRITICAL

#### Workflow 2 : OWASP Audit Hebdomadaire

**Trigger** : Lundi 3h (GitHub Action scheduled)

**Actions** :
1. OWASP ZAP Scan (45min)
2. Analysis par catégorie OWASP Top 10
3. Auto-Fix issues communes
4. Report Slack + Dashboard Grafana

#### Workflow 3 : Incident Response Breach P0

**Trigger** : WAF detect brute force attack (50 failed logins <5min)

**Actions** :
1. Detection : Alert
2. Auto-Containment : Block IP (iptables + Cloudflare WAF)
3. Analysis : Logs analysis
4. Remediation : Rate limiting renforcé
5. Post-Incident : Forensics + Runbook update

**MTTR Target** : <30min

#### Workflow 4 : Dependency Monitoring Quotidien

**Trigger** : GitHub Action scheduled (tous les jours 4h)

#### Workflow 5 : Compliance PCI-DSS Trimestrielle

**Trigger** : Fin trimestre (Q1, Q2, Q3, Q4)

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `vulns-critical` | 0 | Vulnérabilités critiques |
| `vulns-high` | 0 | Vulnérabilités hautes |
| `owasp-compliance` | 100% | 10/10 catégories OWASP |
| `patch-sla-critical` | <24h | SLA patch CRITICAL |
| `mttr-security` | <2h | Temps résolution incidents |

### Intégration Agents

```
IA-CISO ──► IA-CEO : Escalade incidents CRITICAL
       ├──► IA-Legal : RGPD compliance
       ├──► IA-DevOps : Security infrastructure
       ├──► IA-CTO : Secure code reviews
       └──► G4 : Security risk score
```

---

## Agent Ethics/Compliance Guard (B7)

### Rôle Central

L'**B7** (Ethics/Compliance Guard) est le **Gardien PII/RGPD/Licences** du Quality Squad. Il détecte les données personnelles en clair, vérifie la conformité des licences OSS, et audite les biais algorithmiques.

**Positionnement Squad** : Quality Squad - Compliance Agent
**Budget** : €6K
**ROI** : +€100K/an (évitement amendes RGPD)

### 4 Responsabilités Clés

#### 1. Détection PII Pré-Commit (CRITICAL)

**Patterns** : email, téléphone, IBAN, carte bancaire, IP
**Gate** : 🔴 PII en clair → commit bloqué
**KPI** : `pii-incidents` : 0

#### 2. Scan Licences OSS (HIGH)

**Autorisées** : MIT, Apache 2.0, BSD
**Bloquées** : GPL, AGPL, Propriétaire
**Gate** : 🔴 Licence non-conforme → pré-push bloqué
**KPI** : `license-violations` : 0

#### 3. Audit Biais/Équité (MEDIUM)

**Domaines** : Recommandations, pricing, recherche
**Fréquence** : Trimestrielle
**KPI** : `fairness-score` : >90%

#### 4. RGPD Runtime Checks (HIGH)

**Vérifications** : Consentement, droit à l'oubli, portabilité
**KPI** : `rgpd-compliance-score` : 100%

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `pii-incidents` | 0 | PII en production |
| `license-violations` | 0 | Licences non-conformes |
| `rgpd-compliance-score` | 100% | Conformité RGPD |
| `fairness-score` | >90% | Équité algorithmes |

### Intégration Agents

```
B7 ──► IA-CISO : Escalade sécurité
   ├──► IA-Legal : Conformité juridique
   └──► CI/CD Guardian : Gate pré-merge
```

---

## Agent Produit & UX (IA-CPO)

### Rôle Central

L'**IA-CPO** (Chief Product Officer IA) est le **Board Member** dédié excellence UX et vision produit, orchestrant l'optimisation parcours client end-to-end et la coordination cross-domaines Product/E-Commerce/Customer Squads.

**Positionnement Squad** : Board Level - 6ème membre Board IA
**Budget** : €35K
**ROI** : +€120K/an (optimisation conversion + réduction abandons)

### 7 Responsabilités Clés

#### 1. Navigation Simplification (CRITICAL)

**Objectif** : Réduire friction parcours Homepage → Produit

**Actions** :
- Breadcrumbs contextuels dynamiques
- Mega-menu catégories (réduction -2 clics)
- Search autocomplete (suggestions temps réel)
- Filtres intelligents (ML recommendations)

**KPI** : `path-to-product` : <3 clics moyens

#### 2. Parcours Client Optimization (CRITICAL)

**Funnel Analysis** :
- Homepage → Catalogue → Produit → Panier → Checkout → Paiement
- Friction detection automatique (drop-off >15%)
- Session replay analysis (Hotjar integration)

**KPIs** :
- `cart-abandonment-rate` : <25%
- `checkout-completion-time` : <2min
- `conversion-rate` : >3.5%

#### 3. A/B Testing Automation (HIGH)

**Plateforme** : Optimizely OU VWO integration

**Workflow Automatisé** :
- Hypothèse → Variants (50/50 split)
- Statistical significance (p-value <0.05)
- Winner auto-deploy (confidence >90%)
- Monitoring 48h (rollback if regression)

**Statistical Rigor** :

| Métrique | Formule | Seuil |
|----------|---------|-------|
| p-value | Test Z bilatéral | <0.05 |
| Power (1-β) | Probabilité détecter effet | >80% |
| MDE | Minimum Detectable Effect | 5% conversion |
| Sample Size | n = 2×(Zα+Zβ)²×σ²/δ² | Auto-calculé |

**Bayesian Sequential Testing** :
- Décision précoce si P(variant > control) > 95%
- Réduction durée tests -40%
- Correction Bonferroni si multi-variants

**KPIs** :
- `ab-test-velocity` : 2 tests/semaine
- `winning-rate` : >60%
- `statistical-power` : >80%
- `false-positive-rate` : <5%

**Extension Experiment Analyst (G12)** :

**Experiment Lifecycle Management** :
| Phase | Automatisation | Gate |
|-------|----------------|------|
| Draft | Validation hypothèse | Hypothesis score >70% |
| Running | Monitoring temps réel | Aucun effet négatif |
| Analysis | Stats automatiques | p-value + sample size |
| Decision | Recommandation IA | Confidence >90% |
| Rollout | Déploiement progressif | 5% → 25% → 100% |

**Segment Analysis Automation** :
- Breakdown par device (mobile/desktop)
- Breakdown par source (SEO/PPC/Direct)
- Breakdown par cohorte (new/returning)
- Détection interactions entre segments

**Experiment Velocity Tracking** :
- Experiments launched / week
- Time to decision (target <14j)
- Backlog experiments aging
- Win rate par équipe/domain

**KPIs additionnels** :
| KPI | Cible | Description |
|-----|-------|-------------|
| `experiment-velocity` | >3/sem | Tests lancés |
| `time-to-decision` | <14j | Durée moyenne |
| `segment-coverage` | >80% | Segments analysés |

#### 4. Accessibility Compliance (HIGH)

**WCAG 2.1 AA** : 100% target

**Scanner Automatisé** :
- axe-core CI/CD integration
- Audit hebdomadaire 50 pages prioritaires
- Auto-fixes : Contrast, alt-text, ARIA labels

**KPI** : `accessibility-score` : 100% WCAG AA

#### 5. Design System Maintenance (MEDIUM)

**@fafa/design-tokens** : Figma → Code sync

**KPI** : `design-system-adoption` : >80% composants

#### 6. User Research Automation (MEDIUM)

**Outils** :
- Heatmaps (Hotjar)
- Session replay (50 users/semaine)
- User testing API (UserTesting.com)
- Feedback loops (NPS → UX improvements)

**KPI** : `ux-insights-velocity` : 5 insights/semaine

#### 7. Core Web Vitals Monitoring (MEDIUM)

**Real User Monitoring** : Lighthouse CI

**Métriques** :
- LCP (Largest Contentful Paint) : <2.5s
- FID (First Input Delay) : <100ms
- CLS (Cumulative Layout Shift) : <0.1

**KPI** : `core-web-vitals-pass` : >90% pages

### 5 Workflows Critiques

#### Workflow 1 : Détection Friction Parcours

**Trigger** : `cart-abandonment-rate` >25% pendant 7 jours

**Actions** :
1. Analyse funnel (Google Analytics)
2. Session replay (50 abandons récents)
3. Proposition optimisation
4. Validation CFO budget
5. A/B Test (2 semaines)
6. Winner deploy

**SLA** : Détection → Fix déployé <14j

#### Workflow 2 : A/B Test Automation

**Trigger** : Nouveau CTA homepage (initiative marketing)

#### Workflow 3 : Accessibility Audit Weekly

**Trigger** : Cron lundis 9h

#### Workflow 4 : Core Web Vitals Alert

**Trigger** : Lighthouse CI score <85

#### Workflow 5 : Design System Sync Figma→Code

**Trigger** : Figma webhook (design tokens updated)

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `conversion-rate` | >3.5% | Taux conversion |
| `cart-abandonment-rate` | <25% | Abandon panier |
| `lighthouse-score` | >90 | Score Lighthouse |
| `accessibility-score` | 100% | WCAG AA |
| `path-to-product` | <3 clics | Clics jusqu'au produit |

### Intégration Agents

```
IA-CPO ──► IA-CEO : Product Health rapport
      ├──► IA-CFO : Validation budgets UX
      ├──► IA-CTO : Performance frontend
      ├──► Growth IA : A/B tests sync
      └──► Customer Squad : Feedback NPS
```

---

## Agent Accessibilité & Mobile-First (MobileAccessibilityAgent)

### Rôle Central

Le **MobileAccessibilityAgent** est un **Specialized Agent** de la **UX Squad**, dédié à l'excellence de l'expérience mobile et à l'accessibilité avancée (AAA).

**Positionnement Squad** : UX Squad - Specialized Agent
**Budget** : €12K (Dev €9K + BrowserStack €3K)
**ROI** : +€180K/an (Conversion mobile +12%)

### 7 Responsabilités Clés

#### 1. WCAG 2.1 AAA Compliance (CRITICAL)

**Actions** :
- Audit contraste avancé (7:1 text, 4.5:1 UI)
- Support modes daltoniens (protanopia, deuteranopia)
- Validation cognitive (navigation simplifiée, langage clair)
- Audio descriptions & transcripts

**KPI** : `wcag-aaa-score` : >95%

#### 2. Mobile Device Matrix Testing (CRITICAL)

**Infrastructure** : BrowserStack Automation

**Matrix** :
- iOS : iPhone 12, 13, 14, 15 (Safari)
- Android : Samsung S21, S22, Pixel 6, 7 (Chrome)
- Tablet : iPad Air, Galaxy Tab

**KPI** : `mobile-usability-score` : >90/100

#### 3. Touch UX Optimization (HIGH)

**Standards** :
- Tap targets : Min 44x44px (ou 48x48px Android)
- Spacing : Min 8px entre éléments interactifs
- Gestures : Swipe, pinch-to-zoom supportés

**KPI** : `tap-target-pass` : >95%

#### 4. Mobile Performance 3G/4G (HIGH)

**Contraintes** : Network throttling, CPU throttling (mid-range devices)

**Actions** :
- Bundle size monitoring (<200KB initial)
- Adaptive loading (images/vidéos selon network)
- Interaction to Next Paint (INP) mobile <200ms

**KPI** : `mobile-fcp` : <1.8s (3G Fast)

#### 5. Screen Reader Mobile (MEDIUM)

**Outils** : VoiceOver (iOS), TalkBack (Android)

**KPI** : `screen-reader-coverage` : >90%

#### 6. PWA & Offline Experience (MEDIUM)

**Fonctionnalités** :
- Service Workers (caching assets critiques)
- Mode déconnecté (catalogue browsable offline)
- Add to Home Screen (A2HS) prompt intelligent

**KPI** : `offline-availability` : 100% catalogue

#### 7. Mobile Form Optimization (MEDIUM)

**Actions** :
- Autocomplete attributes (standard HTML5)
- Claviers virtuels adaptés
- Validation inline temps réel

**KPI** : `mobile-form-completion` : >45%

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `mobile-usability-score` | >90 | Score usabilité mobile |
| `wcag-aaa-score` | >95% | Conformité AAA |
| `tap-target-pass` | >95% | Tap targets conformes |
| `mobile-conversion-gap` | <10% | Écart conversion mobile |
| `mobile-fcp` | <1.8s | First Contentful Paint |

### Intégration Agents

```
MobileAccessibility ──► IA-CPO : Conformité sync
                   ├──► Growth IA : Tests conversion mobile
                   ├──► IA-CTO : Core Web Vitals Mobile
                   └──► F3 : A11y desktop sync
```

---

## Agent BAT Runner (F1)

### Rôle Central

L'**F1** (BAT Runner) est un **Agent Fonctionnel du QA Squad**, expert en tests d'acceptation métier automatisés. Il exécute des scénarios BDD (Gherkin) validant les parcours utilisateur critiques.

**Positionnement Squad** : QA Squad - Agent Fonctionnel
**Budget** : €18K
**ROI** : -€60K/an (détection bugs métier avant prod)

### 5 Responsabilités Clés

#### 1. Exécution Scénarios BDD (CRITICAL)

**Framework** : Cucumber + Playwright

**Exemple scénario** :
```gherkin
Feature: Ajout au panier
  Scenario: Client ajoute pièce compatible
    Given je suis sur la fiche produit "plaquettes-brembo-206"
    And mon véhicule est "Peugeot 206 1.6 HDi 2005"
    When je clique sur "Ajouter au panier"
    Then le panier contient 1 article
    And le message "Compatible avec votre véhicule" s'affiche
```

#### 2. Coverage Parcours Critiques

| Parcours | Priorité | Scénarios |
|----------|----------|-----------|
| Recherche → Fiche → Panier | P0 | 15 |
| Panier → Checkout → Paiement | P0 | 12 |
| Compte → Historique → Retour | P1 | 8 |
| Compatibilité véhicule | P0 | 20 |
| Codes promo | P1 | 10 |

#### 3. Exécution CI/CD

**Déclencheurs** :
- PR vers main : Suite smoke (5min)
- Merge main : Suite complète (20min)
- Cron nocturne : Régression complète (45min)

#### 4. Reporting Échecs

**Output** :
```typescript
interface BATResult {
  scenario: string;
  status: 'pass' | 'fail' | 'skip';
  duration_ms: number;
  failure_reason?: string;
  screenshot_url?: string;
  video_url?: string;
}
```

#### 5. Maintenance Scénarios

- Détection scénarios flaky (>2 échecs/sem)
- Auto-update sélecteurs CSS
- Versioning scénarios avec code

#### 6. Requirements Traceability Matrix (RTM)

**Lien automatique** : Story → Code → BAT

**Matrice générée** :
| Story ID | Fichiers modifiés | BAT associés | Couverture |
|----------|-------------------|--------------|------------|
| US-1234 | cart.service.ts | cart-add.feature | 100% |
| US-1235 | checkout.tsx | checkout-*.feature | 85% |

**Gate** : 🔴 Story "Ready" sans BAT → pré-push bloqué

**KPI** : `rtm-coverage` : >90% stories couvertes

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `bat-pass-rate` | >98% | Taux de réussite tests |
| `bat-coverage` | >85% | Parcours critiques couverts |
| `bat-flaky-rate` | <5% | Tests instables |
| `bat-execution-time` | <20min | Durée suite complète |
| `rtm-coverage` | >90% | Stories avec BAT associés |

### Intégration Agents

```
F1 ──► IA-DevOps : Résultats CI/CD
   ├──► IA-CTO : Couverture métier
   ├──► F4 : Complémentarité E2E
   └──► M2 : Validation workflows métier
```

---

## Agent UX Copilot (F2)

### Rôle Central

L'**F2** (UX Copilot) est un **Agent Fonctionnel du UX Squad**, détecteur de "trous UX" : états vides, erreurs mal gérées, feedback manquant, flows incohérents.

**Positionnement Squad** : UX Squad - Agent Fonctionnel
**Budget** : €15K
**ROI** : -€40K/an (réduction abandons) + NPS +15pts

### 5 Responsabilités Clés

#### 1. Détection États Vides (CRITICAL)

**Patterns vérifiés** :
```typescript
const emptyStates = [
  'Panier vide → CTA "Continuer shopping"',
  'Recherche sans résultat → Suggestions',
  'Historique vide → Incitation 1ère commande',
  'Wishlist vide → Produits populaires'
];
```

**Scan automatique** : AST TypeScript + analyse JSX

#### 2. Audit Gestion Erreurs

| Type | Pattern attendu | Exemple |
|------|-----------------|---------|
| Réseau | Toast retry | "Connexion perdue, réessayer" |
| Validation | Inline + focus | Champ rouge + message |
| 404 | Page dédiée | Suggestions alternatives |
| 500 | Apologétique | "Erreur technique, nous sommes prévenus" |

#### 3. Analyse Feedback Utilisateur

**Éléments vérifiés** :
- Loaders pendant chargements
- Confirmation actions (ajout panier, commande)
- Progress bars multi-étapes
- Skeleton screens vs spinners

#### 4. Cohérence Navigation

**Audit** :
- Fil d'Ariane présent
- Retour arrière fonctionnel
- Deep links préservés
- États URL synchronisés

#### 5. Rapport UX Health

**Dashboard** : `/admin/ai-cos/ux-health`

**Score** :
```typescript
UX_Health = (
  empty_states_handled * 0.25 +
  error_coverage * 0.25 +
  feedback_quality * 0.25 +
  nav_consistency * 0.25
) * 100
```

#### 6. Heuristiques Nielsen (10 principes)

**Évaluation automatisée par page** :

| # | Heuristique | Vérification automatique |
|---|-------------|--------------------------|
| 1 | Visibilité état système | Loaders, progress bars présents |
| 2 | Correspondance monde réel | Vocabulaire métier cohérent |
| 3 | Contrôle utilisateur | Undo/Redo, annulation possible |
| 4 | Cohérence standards | Design system respecté |
| 5 | Prévention erreurs | Validation inline, confirmations |
| 6 | Reconnaissance > rappel | Labels visibles, auto-complete |
| 7 | Flexibilité efficacité | Raccourcis, personnalisation |
| 8 | Design minimaliste | Ratio signal/bruit optimal |
| 9 | Aide récupération erreurs | Messages clairs, solutions |
| 10 | Aide documentation | Tooltips, aide contextuelle |

**Score heuristique** : 0-100 par page
**KPI** : `nielsen-score` : >80/100

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `ux-health-score` | >90 | Score UX global |
| `empty-states-coverage` | 100% | États vides gérés |
| `error-handling-coverage` | 100% | Erreurs gérées |
| `user-feedback-score` | >4.5/5 | Rating micro-interactions |
| `nielsen-score` | >80 | Score heuristiques Nielsen |

### Intégration Agents

```
F2 ──► IA-CPO : Pain points UX
   ├──► IA-CRM : Correlation NPS
   ├──► Growth IA : A/B tests UX
   └──► F3 : Complémentarité A11y
```

---

## Agent A11y Scanner (F3)

### Rôle Central

L'**F3** (A11y Scanner) est un **Agent Fonctionnel du UX Squad**, expert conformité WCAG 2.1. Il audit automatiquement l'accessibilité et génère des correctifs.

**Positionnement Squad** : UX Squad - Agent Fonctionnel
**Budget** : €12K
**ROI** : Conformité légale + SEO +5% + audience +15%

### 5 Responsabilités Clés

#### 1. Scan WCAG 2.1 AA (CRITICAL)

**Outils** :
- axe-core (runtime)
- Pa11y CI (headless)
- WAVE API (externe)

**Critères audités** :
```typescript
const wcagCriteria = {
  perceivable: ['alt-text', 'color-contrast', 'captions'],
  operable: ['keyboard-nav', 'focus-visible', 'skip-links'],
  understandable: ['labels', 'error-messages', 'lang-attr'],
  robust: ['valid-html', 'aria-roles', 'parsing']
};
```

#### 2. Audit Contrastes

| Élément | Ratio min | Outil |
|---------|-----------|-------|
| Texte normal | 4.5:1 | Color Contrast Analyzer |
| Texte large | 3:1 | CSS computed |
| Graphiques | 3:1 | SVG fill analysis |
| Focus | 3:1 | outline-color |

#### 3. Test Navigation Clavier

**Vérifications** :
- Tab order logique
- Focus visible (outline 2px)
- Escape ferme modales
- Enter active boutons
- Skip to content

#### 4. Audit Screen Readers

**Tests** :
- VoiceOver (macOS)
- NVDA (Windows)
- TalkBack (Android)

**Éléments** :
- ARIA landmarks
- Heading hierarchy (h1-h6)
- Form labels
- Table headers

#### 5. Auto-Fix Suggestions

**Fixes générées** :
```typescript
interface A11yFix {
  element: string;        // "img.product-image"
  issue: string;          // "Missing alt text"
  wcag: string;           // "1.1.1"
  severity: 'A' | 'AA' | 'AAA';
  fix: string;            // "Add alt='Description'"
  auto_fixable: boolean;
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `wcag-aa-score` | 100% | Conformité AA |
| `a11y-issues-critical` | 0 | Violations critiques |
| `contrast-pass-rate` | 100% | Contrastes conformes |
| `keyboard-nav-coverage` | 100% | Navigation clavier OK |

### Intégration Agents

```
F3 ──► MobileAccessibilityAgent : Sync mobile
   ├──► IA-CPO : Roadmap A11y
   ├──► IA-Legal : Conformité légale
   └──► F6 : CSS tokens accessibles
```

---

## Agent E2E Automatique (F4)

### Rôle Central

L'**F4** (E2E Automatique) est un **Agent Fonctionnel du QA Squad**, orchestrateur des tests end-to-end navigation utilisateur avec Playwright.

**Positionnement Squad** : QA Squad - Agent Fonctionnel
**Budget** : €20K
**ROI** : -€80K/an (détection régressions) + confiance déploiements +100%

### 5 Responsabilités Clés

#### 1. Suite E2E Playwright (CRITICAL)

**Configuration** :
```typescript
// playwright.config.ts
export default {
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile-chrome', use: devices['Pixel 5'] },
    { name: 'mobile-safari', use: devices['iPhone 12'] }
  ],
  retries: 2,
  reporter: [['html'], ['json', { outputFile: 'results.json' }]]
};
```

#### 2. Coverage Pages Critiques

| Route | Tests | Priorité |
|-------|-------|----------|
| `/` Homepage | 5 | P0 |
| `/pieces/:gamme` | 8 | P0 |
| `/panier` | 12 | P0 |
| `/checkout` | 15 | P0 |
| `/compte/*` | 10 | P1 |
| `/admin/*` | 20 | P1 |

#### 3. Visual Regression

**Outil** : Playwright Screenshots + Percy/Argos

**Comparaison** :
- Baseline : main branch
- Threshold : 0.1% pixel diff
- Review : PR comment avec diff

#### 4. Performance Assertions

**Métriques assertées** :
```typescript
await expect(page).toHavePerformance({
  LCP: { max: 2500 },
  FID: { max: 100 },
  CLS: { max: 0.1 },
  TTFB: { max: 200 }
});
```

#### 5. Reporting & Artifacts

**Artifacts générés** :
- Screenshots échecs
- Vidéos (si échec)
- Traces Playwright
- HAR network logs

### Extension Perceptual UI (M3)

**Rôle** : Tests visuels perceptuels avancés utilisant SSIM (Structural Similarity Index).

**Budget additionnel** : +€2K
**ROI** : +€15K/an (régressions visuelles subtiles détectées)

#### Tests SSIM (Structural Similarity Index)

**Principe** :
> "Détecter les changements visuels que l'œil humain perçoit."

**Avantages vs pixel-diff classique** :
| Méthode | Sensibilité | Faux positifs | Use case |
|---------|-------------|---------------|----------|
| Pixel diff | Très haute | Élevés | Screenshots identiques |
| SSIM | Perceptuelle | Faibles | UI réelle |

**Score SSIM** :
- `1.0` = Images identiques
- `≥0.99` = Différence imperceptible ✅
- `0.95-0.99` = Différence mineure 🟠
- `<0.95` = Différence notable 🔴

**Configuration** :
```typescript
// playwright.config.ts
export default {
  expect: {
    toHaveScreenshot: {
      threshold: 0.01,  // SSIM threshold
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    }
  }
};
```

#### Zones Critiques Surveillées

| Zone | Seuil SSIM | Raison |
|------|------------|--------|
| Header/Nav | ≥0.99 | Identité marque |
| CTA buttons | ≥0.99 | Conversion |
| Product cards | ≥0.98 | Catalogue |
| Checkout form | ≥0.99 | Paiement |
| Footer | ≥0.97 | Moins critique |

#### Workflow Visual Testing

```
PR ouverte → Screenshots composants → SSIM comparison → Gate
                    ↓                       ↓
              Baseline (main)         Score par zone
                                           ↓
                              ≥0.99 ✅ | 0.95-0.99 🟠 Review | <0.95 🔴 Block
```

#### Intégration Playwright

```typescript
// visual-tests/perceptual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Perceptual UI Tests', () => {
  test('Homepage hero SSIM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-section')).toHaveScreenshot(
      'hero.png',
      { threshold: 0.01 }  // SSIM ≥0.99
    );
  });

  test('Product card grid SSIM', async ({ page }) => {
    await page.goto('/pieces/freinage');
    await expect(page.locator('.product-grid')).toHaveScreenshot(
      'product-grid.png',
      { threshold: 0.02 }  // SSIM ≥0.98
    );
  });

  test('Checkout form SSIM', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('.checkout-form')).toHaveScreenshot(
      'checkout.png',
      { threshold: 0.01 }  // SSIM ≥0.99
    );
  });
});
```

#### Rapport Visual Diff

```
Visual Regression Report (SSIM)
================================
Total screenshots: 45
Passed (≥0.99): 42 ✅
Review (0.95-0.99): 2 🟠
Failed (<0.95): 1 🔴

Détails:
├── hero.png: 0.997 ✅
├── nav.png: 0.985 🟠 (font smoothing changed)
├── product-grid.png: 0.912 🔴 (card layout broken)
└── checkout.png: 1.000 ✅
```

#### KPIs Perceptual

| KPI | Cible | Description |
|-----|-------|-------------|
| `ssim-pass-rate` | >95% | Zones passant seuil |
| `ssim-avg-score` | >0.98 | Score moyen |
| `visual-regressions-caught` | 100% | Régressions détectées |
| `false-positive-rate` | <5% | Faux positifs |

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `e2e-pass-rate` | >99% | Taux réussite |
| `e2e-coverage-routes` | >90% | Routes testées |
| `visual-regression-catches` | >95% | Régressions détectées |
| `e2e-execution-time` | <15min | Suite complète |
| `ssim-pass-rate` | >95% | Tests SSIM passants |

### Intégration Agents

```
F4 ──► IA-DevOps : CI/CD pipeline
   ├──► F1 : Complémentarité BAT
   ├──► F5 : Métriques performance
   ├──► M2 : Mutation testing sync
   └──► IA-CTO : Qualité globale
```

---

## Agent Observabilité UX (F5)

### Rôle Central

L'**F5** (Observabilité UX) est un **Agent Fonctionnel du Performance Squad**, expert métriques UX temps réel : LCP, TTI, CLS, FID, INP.

**Positionnement Squad** : Performance Squad - Agent Fonctionnel
**Budget** : €15K
**ROI** : +3% conversion, -20% bounce rate

### 5 Responsabilités Clés

#### 1. Real User Monitoring (CRITICAL)

**Collecte** :
```typescript
// web-vitals integration
import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals';

const sendToAnalytics = (metric) => {
  fetch('/api/vitals', {
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      page: window.location.pathname,
      device: navigator.userAgent
    })
  });
};
```

#### 2. Segmentation Métriques

| Dimension | Segments |
|-----------|----------|
| Device | Desktop, Mobile, Tablet |
| Connection | 4G, 3G, WiFi |
| Page type | Homepage, Category, Product, Checkout |
| Region | FR, BE, CH, autres |

#### 3. Alertes Dégradation

**Seuils** :
```yaml
alerts:
  LCP:
    warning: 2500ms
    critical: 4000ms
  FID:
    warning: 100ms
    critical: 300ms
  CLS:
    warning: 0.1
    critical: 0.25
  INP:
    warning: 200ms
    critical: 500ms
```

#### 4. Correlation UX ↔ Business

**Analyses** :
- LCP élevé → Taux rebond
- CLS élevé → Abandon panier
- FID élevé → Conversion basse
- INP élevé → Engagement faible

#### 5. Dashboard Temps Réel

**Route** : `/admin/ai-cos/ux-vitals`

**Widgets** :
- Graphe Core Web Vitals 24h
- Heatmap pages lentes
- Top 10 pages à optimiser
- Comparaison semaine précédente

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `lcp-p75` | <2.5s | Largest Contentful Paint |
| `fid-p75` | <100ms | First Input Delay |
| `cls-p75` | <0.1 | Cumulative Layout Shift |
| `inp-p75` | <200ms | Interaction to Next Paint |
| `cwv-good-rate` | >75% | Pages avec CWV "Good" |

### Intégration Agents

```
F5 ──► CWV Optimizer : Lab vs RUM sync
   ├──► IA-SEO : Impact ranking
   ├──► F4 : Assertions E2E
   └──► IA-CEO : Rapport Business Impact
```

---

## Agent Mutation Testing (M2)

### Rôle Central

L'**M2** (Mutation Testing) est un **Agent Fonctionnel du QA Squad**, expert en qualité des tests unitaires. Il vérifie que les tests détectent réellement les bugs en injectant des mutations dans le code et en validant que les tests échouent.

**Positionnement Squad** : QA Squad - Agent Fonctionnel
**Budget** : €4K
**ROI** : +€25K/an (bugs détectés en amont, couverture qualitative)

### Principe Fondamental

> "Un test qui ne tue pas les mutants est un test qui ne protège pas."

**Cycle Mutation Testing** :
```
Code source → Mutants générés → Tests exécutés → Mutants tués ?
      ↓            ↓                  ↓              ↓
  Original    +1, -1, !=         Suite tests   Score mutation
```

### 5 Responsabilités Clés

#### 1. Injection Mutations Automatique (CRITICAL)

**Types de mutations** :
| Catégorie | Mutation | Exemple |
|-----------|----------|---------|
| Arithmétique | `+ → -` | `a + b` → `a - b` |
| Comparaison | `> → >=` | `x > 0` → `x >= 0` |
| Booléen | `&& → \|\|` | `a && b` → `a \|\| b` |
| Retour | `return x → return null` | Valeur retournée modifiée |
| Suppression | Statement removed | Ligne supprimée |

**Outils** :
- **Stryker Mutator** (JavaScript/TypeScript)
- **Pitest** (Java si besoin)

**KPI** : `mutation-score` : ≥80% fonctions modifiées

#### 2. Ciblage Fonctions Modifiées (HIGH)

**Scope intelligent** :
```typescript
interface MutationScope {
  mode: 'incremental' | 'full';
  target: 'modified_files' | 'all';
  threshold: number; // Score minimum requis
}

// Défaut : tester uniquement les fonctions modifiées dans la PR
const defaultScope: MutationScope = {
  mode: 'incremental',
  target: 'modified_files',
  threshold: 80
};
```

**Avantages** :
- Exécution rapide (<5min vs 30min full)
- Feedback immédiat sur PR
- Focus sur le nouveau code

#### 3. Gate CI/CD (CRITICAL)

**Intégration Pipeline** :
```yaml
# .github/workflows/mutation.yml
mutation-test:
  runs-on: ubuntu-latest
  steps:
    - name: Run Stryker
      run: npx stryker run --mutate "src/**/*.ts" --files "${{ steps.changed.outputs.files }}"

    - name: Check Score
      run: |
        SCORE=$(cat reports/mutation/mutation-score.json | jq '.mutationScore')
        if (( $(echo "$SCORE < 80" | bc -l) )); then
          echo "🔴 Mutation score $SCORE% < 80% - PR bloquée"
          exit 1
        fi
```

**Gate** : 🔴 Score <80% sur fonctions modifiées → PR bloquée

#### 4. Reporting Mutants Survivants (HIGH)

**Format rapport** :
```typescript
interface MutationReport {
  total_mutants: number;
  killed: number;
  survived: number;
  timeout: number;
  no_coverage: number;
  mutation_score: number;

  survivors: Array<{
    file: string;
    line: number;
    mutation_type: string;
    original: string;
    mutated: string;
    test_files: string[];  // Tests qui auraient dû détecter
  }>;
}
```

**Action automatique** :
- PR comment avec mutants survivants
- Suggestions de tests manquants
- Lien vers code concerné

#### 5. Amélioration Continue Tests (MEDIUM)

**Analyse patterns** :
- Détection tests "assert-free" (0 assertions)
- Tests avec assertions faibles
- Code non testé (coverage 0%)

**Recommandations** :
```typescript
interface TestImprovement {
  file: string;
  function: string;
  issue: 'weak_assertion' | 'no_edge_case' | 'missing_test';
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}
```

### Workflow CI/CD

```
PR ouverte → Git diff → Fichiers modifiés → Stryker incremental
                              ↓
                   Mutations injectées (100-500)
                              ↓
                   Tests exécutés (parallélisés)
                              ↓
              Score calculé → Gate 80% → ✅ Merge ou 🔴 Block
```

**Temps exécution** :
- Incremental : 3-5 min
- Full (nightly) : 20-30 min

### Configuration Stryker

```javascript
// stryker.conf.mjs
export default {
  packageManager: 'npm',
  reporters: ['html', 'json', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 80  // Échec CI si < 80%
  },
  mutator: {
    excludedMutations: [
      'StringLiteral',  // Ignore mutations strings
    ]
  },
  files: ['src/**/*.ts', '!src/**/*.spec.ts'],
  mutate: ['src/**/*.ts', '!src/**/*.spec.ts']
};
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `mutation-score` | ≥80% | Score mutation fonctions modifiées |
| `mutants-survived` | <20% | Mutants non détectés |
| `mutation-test-time` | <5min | Temps exécution incremental |
| `weak-tests-detected` | 100% | Tests faibles identifiés |

### Intégration Agents

```
M2 ──► F1 : Complémentarité BAT (comportement vs unité)
   ├──► F4 : E2E catch survivors
   ├──► IA-CTO : Qualité code reviews
   └──► CI/CD Guardian : Gate enforcement
```

---

## Agent Shadow Traffic Replay (M4)

### Rôle Central

L'**M4** (Shadow Traffic Replay) est un **Agent Fonctionnel du QA Squad**, expert en tests de régression backend. Il rejoue du trafic production réel sur l'environnement staging pour détecter les régressions avant déploiement.

**Positionnement Squad** : QA Squad - Agent Fonctionnel
**Budget** : €5K
**ROI** : +€40K/an (régressions backend évitées, confiance déploiements)

### Principe Fondamental

> "Le meilleur test est celui qui reflète la réalité de la production."

**Architecture Shadow** :
```
Production ──────────────────────────────────►
     │
     └──► Capture trafic ──► Replay Staging ──► Diff Responses
              (1%)               (async)          (analyse)
```

### 5 Responsabilités Clés

#### 1. Capture Trafic Production (CRITICAL)

**Méthode** :
- Sampling 1% requêtes HTTP (configurable)
- Anonymisation PII automatique (RGPD)
- Stockage S3/MinIO (TTL 7 jours)

**Format capture** :
```typescript
interface CapturedRequest {
  id: string;
  timestamp: Date;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  body?: string;  // Anonymisé
  query?: Record<string, string>;

  production_response: {
    status: number;
    body: string;
    latency_ms: number;
  };
}
```

**Anonymisation** :
```typescript
const anonymize = (data: string): string => {
  return data
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, 'user@anonymized.com')
    .replace(/\b\d{10,}\b/g, '0000000000')
    .replace(/"password":\s*"[^"]+"/g, '"password": "***"')
    .replace(/"token":\s*"[^"]+"/g, '"token": "***"');
};
```

#### 2. Replay Staging (HIGH)

**Workflow replay** :
```
PR merge → CI trigger → Staging deploy → Replay 1000 requêtes
                                              ↓
                              Comparaison responses prod vs staging
```

**Configuration** :
```yaml
shadow_replay:
  enabled: true
  sample_size: 1000
  parallel_workers: 10
  timeout_per_request: 5000
  staging_url: https://staging.automecanik.com
```

#### 3. Diff Analysis (CRITICAL)

**Niveaux de comparaison** :

| Niveau | Check | Tolérance |
|--------|-------|-----------|
| Status Code | Exact match | 0% diff |
| Response Structure | JSON keys | 5% nouveaux keys OK |
| Response Values | Semantic diff | Timestamps/IDs ignorés |
| Latency | Performance | +20% max |

**Diff intelligent** :
```typescript
interface DiffResult {
  request_id: string;
  status: 'match' | 'mismatch' | 'new_field' | 'missing_field';
  severity: 'critical' | 'warning' | 'info';

  production: any;
  staging: any;
  diff: {
    path: string;
    expected: any;
    actual: any;
  }[];
}
```

**Ignorer** :
- Timestamps (`created_at`, `updated_at`)
- IDs générés (`uuid`, `id`)
- Cache headers
- Request-specific tokens

#### 4. Gate Pré-Déploiement (CRITICAL)

**Seuils** :
```yaml
gates:
  status_code_match: 99%     # 🔴 Block si < 99%
  structure_match: 95%       # 🟠 Warning si < 95%
  latency_regression: 20%    # 🟠 Warning si > +20%
```

**Gate** : 🔴 Diff status code >1% → déploiement bloqué

**Rapport CI** :
```
Shadow Traffic Replay Report
=============================
Total replayed: 1000 requests
Status match: 998 (99.8%) ✅
Structure match: 965 (96.5%) ✅
Latency: +5% ✅

2 Mismatches détectés:
├── /api/products/123 : 200→404 (produit supprimé?)
└── /api/cart/add : JSON structure changed
    Expected: { items: [...] }
    Actual: { cartItems: [...] }
```

#### 5. Historique & Trending (MEDIUM)

**Dashboard** : `/admin/ai-cos/shadow-traffic`

**Métriques tracées** :
- Match rate par endpoint
- Latency trends
- Régressions récurrentes
- Top endpoints instables

### Workflow Complet

```
                    Production
                        │
                        ▼
            ┌───────────────────────┐
            │   Capture Middleware  │ ──► S3 (1% sampling)
            └───────────────────────┘
                                          │
     PR merge to main                     ▼
            │                    ┌─────────────────┐
            ▼                    │  Replay Queue   │
    ┌───────────────┐           └────────┬────────┘
    │ Staging Deploy│                    │
    └───────┬───────┘                    ▼
            │                   ┌─────────────────┐
            └──────────────────►│  Shadow Replay  │
                                │   (1000 req)    │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   Diff Engine   │
                                └────────┬────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                      ≥99% match    95-99% match    <95% match
                          ✅             🟠             🔴
                       Deploy        Warning         Block
```

### Implémentation Service

```typescript
// shadow-traffic.service.ts
@Injectable()
export class ShadowTrafficService {
  async replayAndCompare(
    capturedRequests: CapturedRequest[],
    stagingUrl: string
  ): Promise<ReplayReport> {
    const results: DiffResult[] = [];

    for (const req of capturedRequests) {
      const stagingResponse = await this.sendToStaging(req, stagingUrl);
      const diff = this.compareResponses(
        req.production_response,
        stagingResponse
      );
      results.push(diff);
    }

    return this.generateReport(results);
  }

  private compareResponses(
    prod: Response,
    staging: Response
  ): DiffResult {
    // Status code check
    if (prod.status !== staging.status) {
      return { status: 'mismatch', severity: 'critical', ... };
    }

    // Structure check (ignore dynamic fields)
    const structureDiff = this.diffStructure(
      prod.body,
      staging.body,
      ['id', 'created_at', 'updated_at', 'token']
    );

    return structureDiff;
  }
}
```

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `shadow-match-rate` | ≥99% | Correspondance prod/staging |
| `replay-coverage` | 100% | Endpoints critiques couverts |
| `latency-regression` | <20% | Régression performance |
| `pre-deploy-catches` | Mesure | Régressions évitées |

### Intégration Agents

```
M4 ──► IA-DevOps : Pipeline intégration
   ├──► F4 : Complémentarité E2E
   ├──► G10 Chaos : Resilience post-deploy
   └──► CI/CD Guardian : Gate enforcement
```

---

## Dashboards Quality Squad

| Route | Description |
|-------|-------------|
| `/admin/ai-cos/security` | Dashboard CISO sécurité |
| `/admin/ai-cos/product` | Dashboard CPO produit |
| `/admin/ai-cos/ux-health` | Santé UX |
| `/admin/ai-cos/ux-vitals` | Core Web Vitals |
| `/admin/ai-cos/mutation` | Mutation Testing (M2) |
| `/admin/ai-cos/shadow-traffic` | Shadow Traffic Replay (M4) |
| `/admin/ai-cos/visual-tests` | Perceptual UI / SSIM (M3) |

---

## KPIs Globaux Quality Squad

| KPI | Cible | Agent |
|-----|-------|-------|
| `lighthouse-score` | >90 | IA-CPO, F5 |
| `wcag-aa-score` | 100% | F3 |
| `security-score` | 100/100 | IA-CISO |
| `e2e-pass-rate` | >99% | F4 |
| `lcp-p75` | <2.5s | F5 |
| `bat-pass-rate` | >98% | F1 |
| `mutation-score` | ≥80% | M2 |
| `shadow-match-rate` | ≥99% | M4 |
| `ssim-pass-rate` | >95% | F4 (M3) |

---

## Liens Documentation

- [AI-COS Index](./ai-cos-index.md) - Navigation principale
- [Tech Squad](./ai-cos-tech-squad.md) - 10 agents techniques
- [Strategy Squad](./ai-cos-strategy-squad.md) - 7 agents stratégie
- [Business Squad](./ai-cos-business-squad.md) - 11 agents business
- [CHANGELOG](./CHANGELOG-ai-cos.md) - Historique versions
