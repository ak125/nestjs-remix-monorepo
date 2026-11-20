# AI-COS Tech Squad

Documentation des agents du Tech Squad - Excellence technique, architecture et gouvernance code.

**Budget Total Squad** : ~€236K
**Agents** : 15 agents (IA-CTO, IA-DevOps, IA-Legal, A-CARTO, A2, A3, A4, F6, G2, G3, G7, G11, G13, G14, G18)

> Note historique (2026-11-14) : les agents d'analyse Python cités ici (A2, A3, A4, A5, A7) appartenaient à `ai-agents-python/`, prototype retiré par #1821 le 2026-10-17 à 23:44 UTC (18 octobre, heure de Paris). Code consultable dans l'historique Git. Aucun appelant trouvé le 2026-11-14 sur `main` `f5906975f` (fichiers suivis : code, scripts, workflows GitHub, fichiers Docker) ni sur la machine DEV (crontab, timers systemd, processus, conteneurs Docker). `cto-agent.service.ts` et le pont `pythonBridge` (`python-bridge.service.ts`) sont absents de l'historique des branches et tags consultés le 2026-11-14 (`git log --all`). Les workflows qui exécutent ces agents décrivent un fonctionnement prévu, pas installé.

---

## Navigation

- [ai-cos-index.md](./ai-cos-index.md) - Vue d'ensemble
- [CHANGELOG-ai-cos.md](./CHANGELOG-ai-cos.md) - Historique versions

---

## Agent Gouvernance & Compliance (IA-Legal)

### Rôle Central

L'**IA-Legal** est le **gardien de la conformité réglementaire**, protégeant l'entreprise contre les risques juridiques (amendes RGPD 4% CA, erreurs TVA UE, contrats expirés).

**3 Missions** : RGPD temps réel (100K+ clients), TVA automatique (27 pays UE), Contrats monitoring (80+ fournisseurs)

### ⚖️ MODE OPÉRATOIRE : LECTURE SEULE PAR DÉFAUT

```yaml
Statut: READ-ONLY PAR DÉFAUT
Budget: €12K | ROI: +€240K/an

Mode_Opératoire:
  - ✅ Lecture et analyse de TOUTES les données
  - ✅ Détection de risques et non-conformités
  - ✅ Génération de rapports et alertes
  - ✅ Suggestions d'actions correctives
  - ❌ AUCUNE ACTION DIRECTE SANS VALIDATION HUMAINE

Règle_cardinale: "TOUTE SUGGESTION → VALIDATION HUMAINE OBLIGATOIRE"
```

### 🎯 5 Responsabilités (READ-ONLY)

1. **RGPD** : Audit quotidien consentements, data retention, droit à l'oubli <72h → **SUGGESTION UNIQUEMENT**
2. **TVA/Fiscalité** : Validation temps réel factures, cache VIES 24h, déclarations CA3/OSS → **ALERTE SI ÉCART**
3. **Contrats** : Scan hebdomadaire 80+ fournisseurs, alertes expiration <90j → **NOTIFICATION HUMAIN**
4. **Certifications** : Tracking PCI-DSS/ISO, escalation <30j → **ESCALADE CEO**
5. **Propriété Intellectuelle** : Droits images catalogue 5000+ produits → **RAPPORT UNIQUEMENT**

### 🔄 5 Workflows Critiques (AVEC VALIDATION HUMAINE)

#### Workflow 1 : Audit RGPD (3h daily) — READ-ONLY
```typescript
const complianceScore = (
  (1 - missingConsents/100000) * 40 + // Consentements
  (dataRetention === 0 ? 1 : 0) * 30 + // Retention
  cookieCompliance * 20 + // Cookies
  encryptionScore * 10  // Sécurité
) * 100;
// Si <95% → GÉNÈRE TICKET (pas d'action directe)
// → Notification IA-RISK + IA-CEO
// → ATTENTE VALIDATION HUMAINE avant toute correction
```

#### Workflow 2 : Validation TVA (temps réel) — ALERTE UNIQUEMENT
```typescript
// Event: invoice_created
1. Vérifier mentions légales (SIRET, TVA, adresses) ✅ AUTO
2. Valider numéro TVA B2B via VIES (cache 24h) ✅ AUTO
3. Contrôler cohérence calcul TVA ✅ AUTO
4. Log validation (audit 10 ans) ✅ AUTO
5. Si erreurs → ⚠️ ALERTE IA-CFO (PAS de blocage auto)
   → Génère ticket avec analyse complète
   → CFO décide blocage ou non (validation 4h max)
```

#### Workflow 3 : Monitoring Contrats (lundis 8h) — NOTIFICATION UNIQUEMENT
```bash
npm run ai-cos:legal:monitor-contracts
# Output: Alertes <90j → NOTIFICATION Manager (24h pour répondre)
# Certifications critiques <30j → ESCALADE CEO (4h pour répondre)
# ❌ AUCUNE action automatique sur contrats
```

#### Workflow 4 : Droit à l'Oubli (<72h SLA) — VALIDATION OBLIGATOIRE
```typescript
1. Authentification forte client ✅ AUTO
2. Identifier données personnelles ✅ AUTO
3. Générer rapport d'impact + recommandation ✅ AUTO
4. ⚠️ ATTENTE VALIDATION HUMAINE (Manager pour <10 records, CFO+Legal pour >10)
5. Après validation → Anonymiser orders (conservation légale 10 ans)
6. Après validation → Supprimer customer/analytics/support
7. Générer certificat suppression CNIL → SIGNÉ par humain validateur
```

#### Workflow 5 : Simulation Risque Juridique (Mode Forecast) — AUTO
```bash
npm run ai-cos:legal:simulate-expansion --country=DE --products=electronics
# Analyse: RGPD, TVA, certifications CE, contrats
# Output: totalCost €42K, timeline 16 sem, legalRiskScore 65/100
# ✅ LECTURE SEULE - Pas d'action, juste analyse
```

### 🛡️ Matrice Validation IA-Legal

| Action | Mode | Validateur | Délai |
|--------|------|------------|-------|
| Audit/Analyse | AUTO | - | - |
| Rapport | AUTO | - | - |
| Alerte risque | AUTO | - | - |
| Anonymisation <10 | BLOQUÉ | Manager | 24h |
| Anonymisation >10 | BLOQUÉ | CFO + Legal | 48h |
| Blocage facture | BLOQUÉ | CFO | 4h |
| Suppression données | BLOQUÉ | CEO + Legal | 72h |
| Signalement CNIL | BLOQUÉ | CEO + Legal | Immédiat |

### 💡 3 Exemples Concrets (VERROUILLÉS)

**Ex 1** : Audit RGPD détecte 2400 orders >3 ans → ⚠️ GÉNÈRE TICKET recommandant anonymisation → **CFO + Legal valident sous 48h** → Anonymisation exécutée (évite amende CNIL €50K-€200K)

**Ex 2** : Validation TVA détecte facture B2B DE invalide (numéro TVA VIES + mentions manquantes) → ⚠️ ALERTE IA-CFO avec analyse → **CFO décide blocage sous 4h** → Facture bloquée si validé

**Ex 3** : Monitoring détecte certification PCI-DSS expire 25j → ⚠️ ESCALADE CEO Board avec rapport → **CEO valide budget €8K renouvellement sous 4h** → Renouvellement lancé après validation

### 🔧 Implémentation

```typescript
// backend/src/modules/ai-cos/agents/legal-compliance.service.ts
@Injectable()
export class LegalComplianceAgentService {
  async auditGDPRCompliance(): Promise<ComplianceReport> { /*...*/ }
  async validateInvoiceLegal(invoiceId: string): Promise<InvoiceLegalValidation> { /*...*/ }
  async monitorContractsExpiry(): Promise<ContractAlert[]> { /*...*/ }
  async processRightToBeForgotten(customerId: string): Promise<DeletionCertificate> { /*...*/ }
  async simulateLegalRisk(scenario: ExpansionScenario): Promise<LegalRiskAssessment> { /*...*/ }
}
```

### 🤝 Coordination Board

**IA-CEO** : Rapport hebdomadaire section "🔒 Risques Légaux" (top 3 + KPIs compliance-score/contract-risk/cert-status)

**IA-CFO** : Validation légale budgets >€10K, audit TVA anomalies

**IA-RISK** : Alimentation `legal_risk` score, escalation menaces >70/100

---

## Agent Tech Excellence (IA-CTO)

### Rôle Central

L'**IA-CTO** est le **gardien de l'excellence technique**, gouvernant la qualité code et coordonnant le Tech Squad (22 agents) pour équilibrer vélocité business et santé technique long terme.

**Positionnement Board** : Arbitre décisions tech stratégiques (refactoring vs features, upgrades majeurs, budget tech >€10K)
**Budget** : €35K

### 🎯 7 Responsabilités Clés

#### 1. Surveillance Dette Technique (CRITICAL)

**KPI** : `maintenabilité` (cible >90/100)

**Calcul** :
```typescript
maintenabilité =
  deadCodeScore * 0.30 +      // Fichiers non utilisés
  massiveFilesScore * 0.25 +  // Fichiers >500 lignes
  duplicationsScore * 0.25 +  // Violations DRY
  complexityScore * 0.20      // Complexité cyclomatique
```

**Seuils** :
- 🟢 >90 = Excellent
- 🟡 85-90 = Attention (refactoring recommandé)
- 🔴 <85 = Critique (escalation Board)

#### 2. Code Reviews Automatisés

**Validations PR** :
- ✅ ESLint : 0 erreurs (max-warnings 0)
- ✅ TypeScript : 100% type-safe (strict mode)
- ✅ Tests : >85% coverage (diff-coverage >80%)
- ✅ Complexité : Fonctions <15 cyclomatique
- ✅ Security : npm audit 0 vulns HIGH/CRITICAL

**Score PR** : 0-100 (blocking merge si <75)

#### 3. Refactoring & Code Smells

**Détection** :
- Fonctions >50 lignes
- Classes >300 lignes
- Complexité cyclomatique >15
- Profondeur nidification >4

**Priorisation ROI** : (Debt Cost - Refactoring Cost) / Refactoring Cost × 100

#### 4. Upgrades Dépendances

**Monitoring** :
- npm audit (vulnerabilities HIGH/CRITICAL)
- Deprecated APIs (Node.js, React, NestJS)
- Breaking changes frameworks majeurs
- Versions LTS (Node 20 → 22 migration planning)

**Priorisation** : Sécurité > Breaking > Features

#### 5. Duplications & DRY

**Détection** : Agent Python A3 (min 6 tokens dupliqués)

**Actions** :
- Extraction fonctions utilitaires
- Création packages partagés `@repo/*`
- Documentation anti-patterns

#### 6. Patterns Architecture

**Enforcement** :
- CQRS backend (Commands/Queries)
- Repository pattern (abstractions DB)
- Event-driven (Redis pub/sub)
- Validation Zod (schemas partagés)

**Review** : ADR (Architecture Decision Records) pour décisions majeures

#### 7. CI/CD Quality Gates

**Gates Obligatoires** :
1. TypeScript strict (0 erreurs)
2. ESLint (max-warnings 0)
3. Prettier check
4. Tests >85% coverage
5. Security audit
6. Build time <4min

**Action** : Bloquer merge si gates KO

### 🔄 5 Workflows Critiques

#### Workflow 1 : Audit Hebdomadaire Dette Technique

**Trigger** : Cron lundis 9h

**Actions** :
1. Exécuter agents Python (A2/A3/A4/A5/A7)
2. Calculer KPI `maintenabilité`
3. Prioriser actions refactoring (ROI >150%)
4. Créer issues GitHub (label `tech-debt`)
5. Notifier Slack #tech-channel

**Output** :
```
📊 DETTE TECHNIQUE S47

Maintenabilité : 88/100 🟢 (+2 vs S46)

🔴 Critique (3)
├─ catalog.service.ts (1200 lignes)
├─ catalog.tsx (850 lignes, complexité 28)
└─ 12 fichiers dead code (3400 lignes)

✅ Actions Recommandées
1. Split catalog.service (€8K ROI, 3j)
2. Delete dead code (€0, 1h auto)
3. Extract 5 duplications (€2K ROI, 2j)

ROI Moyen : 904% 🚀
```

**Escalation** : Maintenabilité <85 → IA-CEO + Board

#### Workflow 2 : Code Review PR Automatique

**Trigger** : PR created/updated (temps réel)

**Validations** :
```typescript
const prScore =
  lintPassed * 15 +
  typesPassed * 20 +
  testsPassed * 25 +
  complexityPassed * 15 +
  duplicationsPassed * 10 +
  performancePassed * 10 +
  securityPassed * 5;
// Max 100 points
```

**Output GitHub Comment** :
```
🤖 IA-CTO Code Review

✅ PASSED (8/8 checks)

Score PR : 96/100 🟢

💚 Recommandation : APPROVE
```

**Escalation** : Score <75 → Bloquer merge + refactoring requis

#### Workflow 3 : Upgrades Dépendances Mensuelles

**Trigger** : Cron 1er de chaque mois 10h

**Actions** :
1. npm audit --audit-level high
2. Check deprecated APIs
3. Identifier breaking changes
4. Simuler upgrades (sandbox)
5. Créer PRs (P0 urgent)

#### Workflow 4 : Refactoring ROI Trimestriel

**Trigger** : Planification Board Q+1

**Actions** :
1. Identifier fichiers critiques (complexité + taille)
2. Calculer Tech Debt Cost (temps maintenance perdu)
3. Estimer Refactoring Cost (jours dev)
4. Calculer ROI = (Debt - Refactoring) / Refactoring
5. Prioriser top 10 (ROI >150%)
6. Simuler impact (Mode Forecast)

#### Workflow 5 : Tech Health Dashboard Temps Réel

**Trigger** : Monitoring 24/7 (cache Redis 5min)

**Dashboard** `/admin/ai-cos/tech`

### 🔧 Implémentation

```typescript
// backend/src/modules/ai-cos/agents/cto-agent.service.ts
@Injectable()
export class CTOAgentService {

  @Cron('0 9 * * 1') // Lundis 9h
  async weeklyTechDebtAudit(): Promise<TechHealthReport> {
    const findings = await this.pythonBridge.runAnalysis();
    const maintenabilite = this.calculateMaintainability(findings);
    const actions = this.prioritizeRefactoring(findings);
    return { maintenabilite, findings, actions };
  }

  async reviewPullRequest(prNumber: number): Promise<PRReview> {
    const [lint, types, tests, complexity, security] = await Promise.all([
      this.runESLint(),
      this.runTypeScript(),
      this.runTests(),
      this.checkComplexity(),
      this.runSecurityAudit()
    ]);

    const score = this.calculatePRScore({ lint, types, tests, complexity, security });
    if (score < 75) await this.github.blockMerge(prNumber);

    return { score, checks: { lint, types, tests, complexity, security } };
  }
}
```

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `maintenabilite` | >90/100 | Score dette technique |
| `test-coverage` | >85% | Couverture tests |
| `build-time` | <4min | Temps build CI |
| `backend-p95` | <180ms | Latence API |
| `security-score` | 100/100 | Score sécurité |

---

## Agent Infrastructure & DevOps (IA-DevOps)

### Rôle Central

L'**IA-DevOps** est le **Lead Infrastructure Squad** (5 agents), gardien de la fiabilité 24/7 et orchestrateur des pratiques SRE (Site Reliability Engineering) pour garantir uptime >99.9% et MTTR <30min.

**Positionnement Squad Lead** : Coordonne Cache Optimizer, Database Optimizer, Container Orchestrator, Network Monitor + collaboration Performance/Resilience Squads
**Budget** : €45K

### 🎯 7 Responsabilités Clés

#### 1. Monitoring 24/7 (CRITICAL)

**Stack Observabilité** :
- Grafana dashboards (KPIs temps réel)
- Prometheus metrics scraping
- OpenTelemetry distributed tracing
- Health checks enrichis (latency/errors/resources)

**KPIs** :
- `uptime` : >99.9% (SLO)
- `mttr` (Mean Time To Recover) : <30min
- `alert-false-positive-rate` : <15%

#### 2. Rollback Automatique (CRITICAL)

**Capacités** :
- Détection deploy failed (health checks <80% success)
- Rollback automatique dernier tag stable
- Blue-green deployment (swap containers)
- Canary releases (5% trafic → 100% progressif)
- Circuit breaker (stop bad deploys 24h)

**SLA** : Rollback <5min, Downtime <2min

#### 3. CI/CD Pipeline Optimization

**Optimisations** :
- Registry cache GitHub Actions (layers Docker)
- Parallel builds (backend + frontend)
- Quality gates (coverage >85%, 0 vulns HIGH)
- Deploy preview environments (PR branches)

**KPI** : `build-time` actuel 4min → cible <3min (-25%)

#### 4. Cloud Cost Optimization

**Tracking** :
- Coûts temps réel (VPS, Supabase, Docker Hub, CDN)
- Budget alerting (>€500/mois → alert IA-CFO)
- Right-sizing recommendations (CPU/RAM usage)
- Unused resources cleanup (images, volumes)

**KPIs** :
- `cloud-costs` : <€500/mois
- `cost-efficiency` : €/requête <€0.001
- `resource-utilization` : CPU >60%, RAM >70%

#### 5. Incident Response (HIGH)

**Workflow Automatisé** :
1. Detection <5min (health checks, logs analysis)
2. Alert PagerDuty + Slack #incidents
3. Auto-remediation (restart container, clear cache, scale up)
4. Si échec → Escalate IA-CEO + IA-RISK
5. Post-mortem template (cause, timeline, fixes)

**SLA** : Detection → Alert <5min, Triage → Fix <30min (MTTR)

#### 6. Capacity Planning Proactif

**ML Forecasting** :
- Prédiction charge future (6-12 mois)
- Scaling recommendations (horizontal/vertical)
- Load testing automation (k6/Artillery)
- Growth projections

**KPI** : `capacity-headroom` : >30% disponible

#### 7. SRE Practices

**Principes** :
- Error budgets (0.1% errors/mois)
- Toil automation (<30% temps répétitif)
- Blameless culture (focus process)
- Reliability reviews (monthly)
- Chaos engineering (failure injection tests)

**Balance** : 50% feature work, 50% reliability work

### 🔄 5 Workflows Critiques

#### Workflow 1 : Incident Response 24/7

**Trigger** : `uptime` <99.9% OU `backend-p95` >300ms pendant >5min

**Actions** :
1. IA-DevOps détecte anomalie (health checks failed)
2. Alert PagerDuty + Slack #incidents
3. Auto-diagnostic (Logs analysis, Resource check, Service health)
4. Auto-remediation (Restart unhealthy container, Clear Redis cache, Scale up pods)
5. Si échec → Escalate IA-CEO + IA-RISK (SLA <15min)
6. Post-incident (Create post-mortem, Update runbooks, Track incident table)

**SLA** : MTTR <30min, Detection <5min

#### Workflow 2 : Rollback Automatique Déploiement

**Trigger** : Deploy completed → Health check failed (errors >0.5% OU latency >500ms)

**SLA** : Rollback <5min, Downtime <2min

#### Workflow 3 : CI/CD Pipeline Optimization

**Trigger** : `build-time` >4min OU déclenchement manuel mensuel

**Impact** : Build time -25%, Deploy velocity +30%

#### Workflow 4 : Cloud Cost Optimization

**Trigger** : `cloud-costs` >€600/mois OU fin trimestre (budget review)

**ROI** : €360/an économisé

#### Workflow 5 : Capacity Planning Proactif

**Trigger** : Début trimestre OU `resource-utilization` >80%

**Proactivité** : Évite incidents capacité Q3

### 🔧 Implémentation

```typescript
// backend/src/modules/ai-cos/agents/devops-agent.service.ts
@Injectable()
export class DevOpsAgentService {

  @Cron('*/5 * * * *') // Every 5min
  async monitorInfrastructure24x7(): Promise<InfraHealthReport> {
    const health = await Promise.all([
      this.checkBackendHealth(),
      this.checkRedisHealth(),
      this.checkPostgresHealth(),
      this.checkMeilisearchHealth()
    ]);

    const uptime = health.filter(h => h.status === 'healthy').length / health.length;

    if (uptime < 0.999) {
      await this.triggerIncidentResponse({ uptime, health });
    }

    return { uptime, health, timestamp: new Date() };
  }

  async autoRollbackDeploy(deployment: Deployment): Promise<RollbackResult> {
    await this.sleep(300000); // Warmup period (5min)
    const health = await this.checkDeploymentHealth(deployment);

    if (health.errorRate > 0.005 || health.latencyP95 > 500) {
      const lastStable = await this.getLastStableVersion();
      await this.docker.pull(lastStable);
      await this.docker.composeUp({ detach: true });
      await this.activateCircuitBreaker({ duration: 86400 });

      return { success: true, rolledBackTo: lastStable, downtime: 108 };
    }

    return { success: false, reason: 'Health check passed' };
  }
}
```

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `uptime` | >99.9% | Disponibilité SLO |
| `mttr` | <30min | Mean Time To Recover |
| `deploy-success-rate` | >95% | Déploiements réussis |
| `backend-p95` | <200ms | Latence P95 |
| `cloud-costs` | <€500/mois | Coûts infra |
| `incident-count` | <5/mois | Incidents par mois |
| `capacity-headroom` | >30% | Marge capacité |

---

## Agent Cartographe Monorepo (A-CARTO)

### Rôle Central

L'**A-CARTO** (Cartographe Monorepo) est le **Lead Architecture du Tech Squad**, gardien de la santé structurelle du monorepo. Il cartographie les dépendances inter-packages, détecte les dérives architecturales, prévient les dépendances circulaires et surveille la taille des bundles.

**Positionnement Squad** : Tech Squad Lead Architecture
**Budget** : €48K
**ROI** : Protection architecture €200K/an (évitement dette technique, cycles de refactoring réduits)

### 🎯 5 Responsabilités Clés

#### 1. Génération Graphe Dépendances (CRITICAL)

**Fonction** : `generateDependencyGraph()`

**Capacités** :
- Analyse complète des dépendances inter-packages du monorepo
- Génération graphe visualisable D3.js (interactif) et Mermaid (documentation)
- Identification des packages: nodes, edges, poids des connexions
- Détection des clusters et modules fortement couplés

**Output** :
```typescript
interface DependencyGraph {
  packages: PackageNode[];        // Liste des packages @repo/*
  edges: DependencyEdge[];        // Connexions entre packages
  clusters: PackageCluster[];     // Regroupements logiques
  stats: {
    totalPackages: number;
    totalDependencies: number;
    avgDepsPerPackage: number;
    maxDeps: { package: string; count: number };
  };
}
```

**Visualisation** :
- `/api/ai-cos/cartographer/dependency-graph/d3` → JSON pour D3.js
- `/api/ai-cos/cartographer/dependency-graph/mermaid` → Diagramme Mermaid

#### 2. Détection Dépendances Circulaires (CRITICAL)

**Fonction** : `detectCircularDependencies()`

**Outil** : [madge](https://github.com/pahen/madge) - Analyse statique TypeScript

**Sévérité** :
| Level | Description | Action |
|-------|-------------|--------|
| `warning` | Cycle intra-module (même package) | Log + Dashboard |
| `error` | Cycle inter-packages (2 packages) | Alerte Slack + Issue GitHub |
| `critical` | Cycle multi-packages (3+ packages) | Bloquer CI/CD + Escalade IA-CTO |

**KPI** : `circular-deps-count` = 0 (target)

#### 3. Calcul Santé Packages (CRITICAL)

**Fonction** : `calculatePackageHealth()`

**Score** : 0-100 par package, calculé avec pondération :

```typescript
packageHealth =
  dependencyScore * 0.25 +      // Nb dépendances (moins = mieux)
  outdatedScore * 0.25 +        // Dépendances outdated
  testCoverageScore * 0.25 +    // Coverage tests
  bundleSizeScore * 0.25;       // Taille bundle
```

**Seuils** :
- 🟢 ≥80 = Healthy
- 🟡 60-79 = Warning (review recommandé)
- 🔴 <60 = Critical (action requise)

**KPI** : `average-package-health` > 80%

#### 4. Détection Dérive Architecture (HIGH)

**Fonction** : `detectArchitectureDrift()`

**Baseline** : Fichier `architecture.json` définissant les règles autorisées

**Types de violations** :
| Type | Description | Exemple |
|------|-------------|---------|
| `layer` | Violation couches | frontend importe directement backend |
| `forbidden` | Import interdit | @repo/ui importe @prisma/client |
| `orphan` | Package non utilisé | @repo/legacy non importé |
| `bundle` | Dépassement taille max | frontend > 500KB |

**KPI** : `architecture-drift-count` = 0

#### 5. Analyse Tailles Bundles (MEDIUM)

**Fonction** : `analyzeBundleSizes()`

**Outil** : [source-map-explorer](https://github.com/danvk/source-map-explorer)

**Alertes** :
- 🟡 Bundle +10% vs semaine précédente → Warning
- 🔴 Bundle +20% vs semaine précédente → Blocker PR

**KPI** : `largest-bundle-size` < 500KB

### 🔄 4 Workflows SAGA Critiques

#### Workflow 1 : Daily Dependency Scan (9 steps)

**Trigger** : Cron 6h00 chaque jour

**Steps** :
```
1. scan       → Analyser tous packages du monorepo
2. graph      → Générer graphe dépendances (D3.js + Mermaid)
3. circular   → Détecter dépendances circulaires (madge)
4. health     → Calculer score santé chaque package
5. drift      → Vérifier dérive vs baseline architecture
6. report     → Générer rapport consolidé
7. save       → Persister snapshot Supabase
8. kpi        → Mettre à jour 7 KPIs Redis
9. notify     → Alerter si violations (Slack #tech-alerts)
```

**SLA** : Scan terminé < 5min

#### Workflow 2 : PR Architecture Validation (7 steps)

**Trigger** : PR opened/updated (GitHub webhook)

**Règle Merge** : Score < 75 → Bloquer merge

#### Workflow 3 : Weekly Architecture Report (8 steps)

**Trigger** : Cron lundi 9h00

#### Workflow 4 : Bundle Size Monitoring (6 steps)

**Trigger** : Build success (CI/CD post-build hook)

### 📊 7 KPIs Cartographe

| KPI | Target | Description | Priorité |
|-----|--------|-------------|----------|
| `circular-deps-count` | = 0 | Nombre dépendances circulaires | CRITICAL |
| `average-package-health` | > 80% | Score santé moyen packages | CRITICAL |
| `architecture-drift-count` | = 0 | Nombre violations baseline | HIGH |
| `largest-bundle-size` | < 500KB | Plus gros bundle (frontend) | HIGH |
| `orphan-packages` | < 5 | Packages non utilisés | MEDIUM |
| `outdated-deps` | < 10 | Dépendances non à jour | MEDIUM |
| `critical-issues` | = 0 | Issues bloquantes ouvertes | CRITICAL |

**Dashboard** : `/admin/ai-cos/cartographer`

### 🔌 API REST (18 endpoints)

**Base URL** : `/api/ai-cos/cartographer`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dependency-graph` | GET | Graphe complet JSON |
| `/dependency-graph/mermaid` | GET | Graphe format Mermaid |
| `/dependency-graph/d3` | GET | Graphe format D3.js |
| `/circular-deps` | GET | Liste dépendances circulaires |
| `/circular-deps/count` | GET | Compteur circulaires |
| `/package-health` | GET | Santé tous packages |
| `/package-health/:name` | GET | Santé package spécifique |
| `/package-health/summary` | GET | Résumé (healthy/warning/critical) |
| `/architecture-drift` | GET | Toutes violations |
| `/bundle-analysis` | GET | Analyse tailles bundles |
| `/report` | GET | Rapport complet JSON |
| `/kpis` | GET | 7 KPIs actuels |
| `/validate-pr` | POST | Valider PR |
| `/saga/trigger` | POST | Déclencher SAGA manuellement |
| `/health` | GET | Health check service |

### 📡 Event Bus (8 events)

**Channel Redis** : `ai-cos:cartographer`

| Event | Payload | Trigger |
|-------|---------|---------|
| `graph-generated` | `{ packages, edges, timestamp }` | Daily scan step 2 |
| `circular-deps-detected` | `{ cycles, severity }` | Détection cycle |
| `health-calculated` | `{ packages, avgScore }` | Daily scan step 4 |
| `drift-detected` | `{ violations, types }` | Violation baseline |
| `bundle-analyzed` | `{ sizes, bloatDetected }` | Post-build analysis |
| `report-generated` | `{ reportId, summary }` | Weekly report |
| `kpi-alert` | `{ kpi, value, threshold }` | KPI hors seuil |
| `critical-alert` | `{ type, message, escalation }` | Issue critique |

### 🔧 Configuration dependency-cruiser

**Fichier** : `.dependency-cruiserrc.js` (racine monorepo)

**13 règles** : no-circular, no-frontend-to-backend, no-backend-to-frontend, ui-restricted-imports, design-tokens-leaf, shared-types-leaf, no-relative-packages, no-unlisted-deps, no-test-in-prod, no-config-imports, themes-only-design-tokens, prisma-backend-only, supabase-server-imports

---

## Agent Chasseur Fichiers Massifs (A2)

### Rôle Central

L'**A2** (Chasseur Fichiers Massifs) est un **Agent Analyse du Tech Squad**, spécialisé dans la détection des fichiers de code dépassant les seuils de taille configurés. Il identifie les "God Classes" et fichiers monolithiques qui nuisent à la maintenabilité.

**Positionnement Squad** : Tech Squad - Agent Analyse Python
**Budget** : €12K
**ROI** : Réduction dette technique €50K/an

### 🎯 3 Responsabilités Clés

#### 1. Détection Fichiers Massifs (CRITICAL)

**Classe** : `MassiveFilesDetector`
**Fichier** : `ai-agents-python/agents/analysis/a2_massive_files.py` — prototype retiré par #1821 le 2026-10-17 à 23:44 UTC (18 octobre, heure de Paris), consultable dans l'historique Git

**Analyse multi-catégories** :
```python
patterns = [
    ('frontend/**/*.tsx', 'tsx_component', 500),      # Composants React
    ('frontend/**/routes/**/*.tsx', 'route_file', 400), # Routes Remix
    ('backend/**/services/**/*.ts', 'backend_service', 600), # Services NestJS
    ('**/*.ts', 'typescript', 350),                   # TypeScript générique
    ('**/*.js', 'javascript', 350),                   # JavaScript
]
```

#### 2. Calcul Sévérité Dynamique

**Formule** : `ratio = lines / threshold`

| Ratio | Sévérité | Action |
|-------|----------|--------|
| ≥2.0x | `critical` | Issue GitHub + Escalade IA-CTO |
| ≥1.5x | `high` | Alerte Slack + Dashboard |
| ≥1.2x | `medium` | Dashboard + Suggestion |
| >1.0x | `warning` | Log + Dashboard |

#### 3. Génération Suggestions Automatiques

**Par catégorie de fichier** :

| Catégorie | Suggestions |
|-----------|-------------|
| `tsx_component` | Extraire sous-composants, Créer hooks custom, Séparer types |
| `route_file` | Extraire loaders, Créer composants sections, Déplacer validation |
| `backend_service` | Diviser en services spécialisés, Extraire helpers, Créer sous-classes |

### ⚙️ Configuration

**Thresholds** (`config.yaml`) :
```yaml
thresholds:
  massive_files:
    tsx_component: 500      # Composants React max
    route_file: 400         # Routes Remix max
    backend_service: 600    # Services NestJS max
    typescript: 350         # TS générique max
    javascript: 350         # JS max
```

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `massive-files-count` | <10 | Nombre fichiers au-dessus seuils |
| `critical-files-count` | 0 | Fichiers ≥2x threshold |
| `avg-overage-percent` | <30% | Dépassement moyen |

### 🔗 Intégration Agents

```
A2 ──► IA-CTO : Fichiers critical escaladés
   ├──► A-CARTO : Corrélation avec package health
   └──► F1 (DeadCodeSurgeon) : Cleanup après split
```

---

## Agent Détecteur Doublons (A3)

### Rôle Central

L'**A3** (Détecteur Doublons) est un **Agent Analyse du Tech Squad**, spécialisé dans la détection des duplications de code (violations DRY). Optimisé avec Bloom filter et multiprocessing, il analyse le codebase en temps record.

**Positionnement Squad** : Tech Squad - Agent Analyse Python (Optimisé)
**Budget** : €15K
**ROI** : Réduction maintenabilité €80K/an

### 🎯 4 Responsabilités Clés

#### 1. Tokenization Parallèle (PERFORMANCE)

**Classe** : `DuplicationDetector`
**Fichier** : `ai-agents-python/agents/analysis/a3_duplications.py` — prototype retiré par #1821 le 2026-10-17 à 23:44 UTC (18 octobre, heure de Paris), consultable dans l'historique Git

**Optimisations** :
```python
# Multiprocessing pour tokenization (~4x speedup)
num_workers = min(cpu_count(), 4)
with Pool(processes=num_workers) as pool:
    results = pool.map(tokenize_file_worker, files)
```

#### 2. Bloom Filter Pré-filtrage

**Approche 2-pass optimisée** :
```
Pass 1: Identifier hashs vus 2+ fois (Bloom filter)
        → Économise mémoire en ignorant hashs uniques

Pass 2: Construire index seulement pour hashs dupliqués
        → ~10x plus rapide que version naïve
```

#### 3. Détection Duplications

**Critères** :
- Minimum 2 occurrences
- Minimum 2+ fichiers OU 2+ positions dans même fichier
- Fragment non-trivial (>30 chars, pas import/export)

#### 4. Calcul Sévérité

| Occurrences | Sévérité |
|-------------|----------|
| ≥10 | `critical` |
| ≥5 | `high` |
| ≥3 | `medium` |
| 2 | `minor` |

### ⚙️ Configuration

**Thresholds** (`config.yaml`) :
```yaml
thresholds:
  duplication:
    min_tokens: 6           # Minimum tokens pour match
    min_lines: 5            # Minimum lignes dupliquées
    similarity_threshold: 0.95  # Seuil similarité
```

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `duplication-count` | <50 | Nombre duplications détectées |
| `critical-duplications` | 0 | Duplications ≥10 occurrences |
| `duplication-rate` | <5% | % code dupliqué |

### 🔗 Intégration Agents

```
A3 ──► IA-CTO : Duplications critical escaladées
   ├──► A-CARTO : Impact sur package health
   └──► Refactoring : Extraction composants/hooks/utils
```

---

## Agent Détecteur Dead Code (A4)

### Rôle Central

L'**A4** (Détecteur Dead Code) est un **Agent Analyse du Tech Squad**, spécialisé dans la détection du code mort : fichiers non importés, non référencés, et non modifiés depuis 30+ jours.

**Positionnement Squad** : Tech Squad - Agent Analyse Python
**Budget** : €10K
**ROI** : Réduction codebase €40K/an

### 🎯 5 Responsabilités Clés

#### 1. Construction Graphe Imports (CRITICAL)

**Classe** : `DeadCodeDetector`
**Fichier** : `ai-agents-python/agents/analysis/a4_dead_code.py` — prototype retiré par #1821 le 2026-10-17 à 23:44 UTC (18 octobre, heure de Paris), consultable dans l'historique Git

**Extraction imports** (regex patterns) :
```python
patterns = [
    r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',  # import X from 'Y'
    r'import\([\'"]([^\'"]+)[\'"]\)',              # import('Y')
    r'require\([\'"]([^\'"]+)[\'"]\)'              # require('Y')
]
```

#### 2. Détection Fichiers Non Importés

**Processus** :
1. Trouver tous les fichiers TS/TSX/JS
2. Extraire tous les imports de chaque fichier
3. Identifier fichiers jamais référencés

#### 3. Exclusion Entry Points

**Fichiers toujours exclus** (ne peuvent pas être "importés") :
```python
entry_points = [
    "main.ts", "main.server.ts", "entry.client.tsx",
    "entry.server.tsx", "root.tsx", "index.ts", "index.tsx"
]
```

#### 4. Filtre Ancienneté

**Critère** : Non modifié depuis N jours (config: `untouched_days: 30`)

#### 5. Calcul Confidence Score

**Formule** : `confidence = min(1.0, days_old / 90.0)`

| Âge | Confidence | Interprétation |
|-----|------------|----------------|
| 30j | 33% | Possiblement abandonné |
| 60j | 67% | Probablement dead code |
| 90j+ | 100% | Certainement dead code |

### ⚙️ Configuration

**Thresholds** (`config.yaml`) :
```yaml
thresholds:
  dead_code:
    untouched_days: 30      # Jours sans modification
    min_confidence: 0.9     # Seuil suppression auto

auto_fix:
  dead_code: true  # Suppression automatique si confidence > 0.9
```

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `dead-code-files` | <5 | Nombre fichiers dead code |
| `dead-code-lines` | <1000 | Lignes de dead code |
| `dead-code-ratio` | <2% | % codebase non utilisé |

### 🔗 Intégration Agents

```
A4 ──► IA-CTO : Dead code count dans rapport Tech Health
   ├──► F1 (DeadCodeSurgeon) : Suppression automatique
   └──► A-CARTO : Impact sur bundle size
```

---

## Agent CSS Refactor (F6)

### Rôle Central

L'**F6** (CSS Refactor) est un **Agent Fonctionnel du Tech Squad**, expert extraction design system à partir des duplications Tailwind.

**Positionnement Squad** : Tech Squad - Agent Fonctionnel
**Budget** : €12K
**ROI** : Réduction bundle CSS -40%, maintenance -€30K/an

### 🎯 5 Responsabilités Clés

#### 1. Détection Duplications Tailwind (CRITICAL)

**Scan** :
```typescript
// Patterns dupliqués
const duplications = {
  'px-4 py-2 bg-blue-500 text-white rounded': 47,  // → btn-primary
  'flex items-center justify-between': 89,        // → flex-between
  'text-sm text-gray-600': 156,                   // → text-muted
  'border border-gray-200 rounded-lg p-4': 34     // → card-base
};
```

#### 2. Extraction Composants

**Génération** :
```css
/* @layer components */
.btn-primary {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600;
}

.card-base {
  @apply border border-gray-200 rounded-lg p-4;
}
```

#### 3. Sync Design Tokens

**Fichier** : `packages/design-tokens/tokens.json`

#### 4. Audit Bundle Size

**Métriques** :
| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| CSS total | 180KB | 95KB | -47% |
| Classes uniques | 2400 | 800 | -67% |
| @apply usage | 0 | 200 | design system |

#### 5. PR Automatiques

**Workflow** :
1. Scan duplications (cron hebdo)
2. Génération composants proposés
3. PR avec diff + preview
4. Review IA-CPO + merge

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `css-bundle-size` | <100KB | Taille bundle CSS |
| `tailwind-dedup-rate` | >80% | Classes dédupliquées |
| `design-tokens-coverage` | >90% | Tokens utilisés |
| `component-reuse-rate` | >70% | Composants réutilisés |

### 🔗 Intégration Agents

```
F6 ──► IA-CPO : Design system sync
   ├──► A3 : Duplications CSS
   ├──► F5 : Impact bundle performance
   └──► IA-CTO : Dette technique CSS
```

---

## Agent Compliance Guard OSS (G2)

### Rôle Central

L'**G2** (Compliance Guard) est un **Agent Gouvernance du Tech Squad**, gardien des licences open source et de la conformité légale du code.

**Positionnement Squad** : Tech Squad - Agent Gouvernance
**Budget** : €12K
**ROI** : Évitement litiges légaux €500K+, conformité 100%

### 🎯 5 Responsabilités Clés

#### 1. Scan Licences Dépendances (CRITICAL)

**Outils** :
- license-checker (npm)
- pip-licenses (Python)
- fossa.io (enterprise)
- snyk license

**Licences catégorisées** :
| Catégorie | Licences | Action |
|-----------|----------|--------|
| Permissive ✅ | MIT, Apache-2.0, BSD | Autorisé |
| Copyleft ⚠️ | GPL-2.0, GPL-3.0, AGPL | Review requis |
| Restrictive ❌ | Commercial, Proprietary | Blocage |
| Unknown ❓ | Sans licence | Investigation |

#### 2. Policy Enforcement

**Règles configurables** :
```yaml
license_policy:
  allowed:
    - MIT
    - Apache-2.0
    - BSD-2-Clause
    - BSD-3-Clause
    - ISC

  banned:
    - AGPL-3.0   # Contamination code
    - Commercial # Coût licence
    - UNLICENSED # Risque légal
```

#### 3. SBOM Generation (Software Bill of Materials)

**Format** : SPDX / CycloneDX

#### 4. Scan Pre-Commit

**Hook Git** :
- Vérifie nouvelles dépendances
- Bloque si licence banned
- Alerte si licence restricted
- Log audit complet

#### 5. Rapport Conformité Licences

**Dashboard** : `/admin/ai-cos/compliance-oss`

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `license-compliance-rate` | 100% | Dépendances conformes |
| `violations-critical` | 0 | Licences banned détectées |
| `sbom-coverage` | 100% | Packages avec SBOM |
| `scan-freshness` | <7j | Dernière analyse |

### 🔗 Intégration Agents

```
G2 ──► IA-Legal : Escalade violations
   ├──► IA-CTO : Review dépendances
   ├──► IA-DevOps : Pre-commit hooks
   └──► IA-CISO : Vulnérabilités CVE
```

---

## Agent ADR Auto (G3)

### Rôle Central

L'**G3** (ADR Auto) est un **Agent Gouvernance du Tech Squad**, archiviste automatique des décisions techniques. Il génère et maintient les Architecture Decision Records (ADR).

**Positionnement Squad** : Tech Squad - Agent Gouvernance
**Budget** : €10K
**ROI** : Réduction onboarding -50%, knowledge preservation +€60K/an

### 🎯 5 Responsabilités Clés

#### 1. Détection Décisions Implicites (CRITICAL)

**Sources analysées** :
- PR avec labels `architecture`, `breaking-change`, `decision`
- Commits avec patterns `feat:`, `refactor:`, `BREAKING:`
- Discussions GitHub tagged `ADR`
- Slack channels #architecture, #tech-decisions

**Patterns détectés** :
```typescript
const decisionPatterns = [
  /migr(ation|er|é)/i,
  /remplacer.*par/i,
  /choix.*entre/i,
  /décid(é|er|ons)/i,
  /adopter|abandon(ner)?/i,
  /architecture.*change/i
];
```

#### 2. Génération ADR Automatique

**Template MADR** :
```markdown
# ADR-{number}: {title}

## Status
{Proposed | Accepted | Deprecated | Superseded}

## Context
{Contexte extrait automatiquement des discussions}

## Decision
{Décision identifiée}

## Consequences
{Impacts positifs et négatifs}

## Related
- PR: #{pr_number}
- Supersedes: ADR-{old_number}
- Agents: {agents concernés}
```

#### 3. Indexation Knowledge Base

**Structure** :
```
docs/adr/
├── 0001-adopt-remix-framework.md
├── 0002-supabase-over-prisma.md
├── 0003-redis-session-store.md
└── index.md (auto-généré)
```

#### 4. Linking Décisions ↔ Code

**Annotations code** :
```typescript
/**
 * @adr ADR-0042
 * @see docs/adr/0042-use-zod-validation.md
 */
const schema = z.object({...});
```

#### 5. Rapport Santé Décisions

**Dashboard** : `/admin/ai-cos/adr`

### 📈 KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `adr-coverage` | >90% | Décisions documentées |
| `adr-freshness` | <90j | ADR mis à jour |
| `orphan-references` | 0 | Refs vers ADR supprimés |
| `decision-latency` | <7j | PR → ADR généré |

### 🔗 Intégration Agents

```
G3 ──► IA-CTO : Review décisions architecture
   ├──► A-CARTO : Impact graphe dépendances
   ├──► IA-CEO : Décisions stratégiques
   └──► IA-DevOps : CI/CD implications
```

---

## Agent API Contract Enforcer (G7)

### Rôle Central

L'**G7** (API Contract Enforcer) est le **Gardien des Contrats API** du Tech Squad. Il valide les spécifications OpenAPI/GraphQL, détecte les breaking changes avant merge, et assure la compatibilité entre versions.

**Positionnement Squad** : Tech Squad - Agent Gouvernance API
**Budget** : €8K
**ROI** : +€40K/an (breaking changes évités, downtime réduit)

### 4 Responsabilités Clés

#### 1. Validation Specs OpenAPI 3.0 (CRITICAL)

**Outils** : Spectral, OpenAPI Generator
**Vérifications** :
- Schémas valides (types, formats)
- Endpoints documentés
- Exemples cohérents
**Gate** : 🔴 Spec invalide → PR bloquée
**KPI** : `openapi-compliance` : 100%

#### 2. Contract Testing Consumer-Driven (HIGH)

**Framework** : Pact.io
**Workflow** :
- Consumer définit expectations
- Provider valide contrat
- CI vérifie compatibilité
**KPI** : `contract-test-coverage` : >80%

#### 3. Breaking Change Detection (CRITICAL)

**Détection automatique** :
- Champs supprimés
- Types modifiés
- Endpoints renommés
- Required ajoutés
**Gate** : 🔴 Breaking change sans version bump → merge bloqué
**KPI** : `breaking-changes-detected` : 100%

#### 4. Version Compatibility Check (HIGH)

**Semantic Versioning** : Validation auto MAJOR.MINOR.PATCH
**Changelog** : Génération automatique des diffs API
**KPI** : `api-version-compliance` : 100%

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `openapi-compliance` | 100% | Specs conformes |
| `contract-test-coverage` | >80% | Contrats testés |
| `breaking-changes-detected` | 100% | Détection avant prod |
| `api-version-compliance` | 100% | Versioning correct |

### Intégration Agents

```
G7 ──► IA-CTO : Review API architecture
   ├──► IA-DevOps : CI/CD gates
   ├──► G13 : Sync documentation API
   └──► G3 : ADR pour changements majeurs
```

---

## Agent Feature Flag Controller (G11)

### Rôle Central

L'**G11** (Feature Flag Controller) est le **Gestionnaire de Rollouts** du Tech Squad. Il orchestre les déploiements progressifs, gère les kill switches, et coordonne les feature toggles avec les A/B tests.

**Positionnement Squad** : Tech Squad - Agent Release Management
**Budget** : €4K
**ROI** : +€25K/an (rollbacks sécurisés, incidents évités)

### 4 Responsabilités Clés

#### 1. Feature Toggle Management (CRITICAL)

**Plateforme** : LaunchDarkly / Unleash / Custom
**Types de flags** :
- Release toggles (déploiement progressif)
- Experiment toggles (A/B tests)
- Ops toggles (kill switch)
- Permission toggles (accès features)
**KPI** : `flag-inventory` : 100% documentés

#### 2. Percentage Rollout - Canary (HIGH)

**Stratégies** :
- 1% → 5% → 25% → 50% → 100%
- Par région géographique
- Par segment utilisateur
**Monitoring** : Métriques temps réel par cohorte
**KPI** : `canary-success-rate` : >95%

#### 3. Kill Switch - Instant Disable (CRITICAL)

**Temps de réaction** : <30 secondes
**Automatisation** : Trigger sur seuils (error rate >1%, latency >500ms)
**KPI** : `kill-switch-latency` : <30s

#### 4. A/B Flag Coordination (HIGH)

**Sync avec IA-CPO** : Flags liés aux expérimentations
**Mutual exclusion** : Éviter conflits entre experiments
**KPI** : `experiment-flag-sync` : 100%

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `flag-cleanup-rate` | >90% | Flags obsolètes supprimés |
| `stale-flags` | 0 | Flags >90j sans usage |
| `canary-success-rate` | >95% | Rollouts réussis |
| `kill-switch-latency` | <30s | Temps désactivation |

### Intégration Agents

```
G11 ──► IA-CPO : Coordination A/B tests
    ├──► IA-DevOps : Deployment pipeline
    ├──► IA-CTO : Feature architecture
    └──► G10 : Chaos testing sur flags
```

---

## Agent Doc Generator (G13)

### Rôle Central

L'**G13** (Doc Generator) est l'**Automatiseur de Documentation** du Tech Squad. Il génère JSDoc/TSDoc depuis les types, maintient les README à jour, et synchronise la documentation API.

**Positionnement Squad** : Tech Squad - Agent Documentation
**Budget** : €6K
**ROI** : +€20K/an (onboarding accéléré, maintenance réduite)

### 4 Responsabilités Clés

#### 1. JSDoc Generation from Types (HIGH)

**Outils** : TypeDoc, ts-morph
**Extraction** :
- Interfaces → Documentation
- Types → Exemples
- Enums → Valeurs possibles
**KPI** : `jsdoc-coverage` : >80%

#### 2. README Auto-Update (MEDIUM)

**Sections générées** :
- Installation (depuis package.json)
- API Reference (depuis exports)
- Examples (depuis tests)
**Trigger** : Push sur main
**KPI** : `readme-freshness` : <7j

#### 3. API Documentation Sync (HIGH)

**Sources** : OpenAPI specs, GraphQL schema
**Output** : Swagger UI, GraphQL Playground
**Sync** : Automatique avec G7
**KPI** : `api-doc-sync` : 100%

#### 4. Changelog Generation (MEDIUM)

**Format** : Keep a Changelog
**Source** : Conventional Commits
**Automatisation** : semantic-release
**KPI** : `changelog-coverage` : 100% releases

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `doc-coverage` | >80% | Fonctions documentées |
| `doc-freshness` | <7j | Dernière mise à jour |
| `api-doc-sync` | 100% | Sync code ↔ doc |
| `changelog-coverage` | 100% | Releases documentées |

### Intégration Agents

```
G13 ──► G7 : Sync documentation API
    ├──► G18 : Détection drift docs
    ├──► G3 : Lien vers ADRs
    └──► IA-CTO : Standards documentation
```

---

## Agent Bus-Factor Monitor (G14)

### Rôle Central

L'**G14** (Bus-Factor Monitor) est le **Détecteur de SPOF Knowledge** du Tech Squad. Il analyse la répartition des connaissances code, identifie les contributeurs uniques, et suggère le pair programming.

**Positionnement Squad** : Tech Squad - Agent Knowledge Management
**Budget** : €3K
**ROI** : +€50K/an (risque SPOF évité, continuité assurée)

### 4 Responsabilités Clés

#### 1. Code Ownership Analysis (CRITICAL)

**Métriques git** :
- Commits par fichier/module
- Lignes modifiées par auteur
- Fréquence contributions
**Alerte** : Module avec <2 contributeurs actifs
**KPI** : `bus-factor` : >2 par module

#### 2. Single Contributor Detection (CRITICAL)

**Détection** :
- Fichiers critiques avec 1 seul auteur
- Modules entiers par 1 personne
- Absence >30j du contributeur principal
**Gate** : 🟠 Single contributor → warning review
**KPI** : `single-contributor-modules` : 0

#### 3. Knowledge Sharing Alerts (HIGH)

**Triggers** :
- Nouveau module créé → suggérer pair review
- Contributeur unique >60j → alerte manager
- Départ employé → audit impact
**KPI** : `knowledge-transfer-rate` : >90%

#### 4. Pair Programming Suggestions (MEDIUM)

**Matching** :
- Expert + Junior sur même module
- Cross-training planifié
- Rotation code reviews
**KPI** : `pairing-sessions` : >2/sem par équipe

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `bus-factor` | >2 | Contributeurs min par module |
| `knowledge-silos` | 0 | Modules isolés |
| `single-contributor-modules` | 0 | Risque SPOF |
| `knowledge-transfer-rate` | >90% | Partage effectif |

### Intégration Agents

```
G14 ──► IA-HR : Planification formations
    ├──► IA-CTO : Revue architecture ownership
    ├──► G3 : Documentation décisions
    └──► A-CARTO : Mapping dépendances
```

---

## Agent Docs Drift Detector (G18)

### Rôle Central

L'**G18** (Docs Drift) est le **Détecteur de Documentation Obsolète** du Tech Squad. Il vérifie la synchronisation code/documentation, détecte les exemples cassés, et identifie les liens morts.

**Positionnement Squad** : Tech Squad - Agent Documentation Quality
**Budget** : €4K
**ROI** : +€15K/an (maintenance réduite, onboarding amélioré)

### 4 Responsabilités Clés

#### 1. Code ↔ Doc Sync Check (CRITICAL)

**Vérifications** :
- Signatures fonctions vs JSDoc
- Paramètres documentés vs réels
- Types exportés vs documentation
**Gate** : 🟠 Drift détecté → warning PR
**KPI** : `doc-code-sync` : >95%

#### 2. Stale Documentation Alerts (HIGH)

**Critères** :
- Doc non modifiée >90j alors que code modifié
- Sections "TODO" ou "WIP" anciennes
- Versions mentionnées obsolètes
**KPI** : `stale-docs` : <5%

#### 3. Example Code Validation (HIGH)

**Tests** :
- Exemples compilent (TypeScript)
- Snippets exécutables
- Imports valides
**KPI** : `example-validity` : 100%

#### 4. Link Rot Detection (MEDIUM)

**Scan** :
- URLs externes (HTTP 200)
- Liens internes (fichiers existent)
- Ancres valides (#sections)
**KPI** : `broken-links` : 0

### KPIs

| KPI | Cible | Description |
|-----|-------|-------------|
| `doc-code-sync` | >95% | Synchronisation |
| `stale-docs` | <5% | Docs obsolètes |
| `example-validity` | 100% | Exemples fonctionnels |
| `broken-links` | 0 | Liens cassés |

### Intégration Agents

```
G18 ──► G13 : Coordination génération docs
    ├──► G7 : Sync specs API
    ├──► IA-CTO : Standards documentation
    └──► CI/CD Guardian : Gate qualité docs
```

---

## Résumé Tech Squad

| Agent | Budget | ROI | Rôle |
|-------|--------|-----|------|
| IA-Legal | €12K | +€240K/an | Conformité réglementaire |
| IA-CTO | €35K | +€395K/an | Excellence technique |
| IA-DevOps | €45K | +€129K/an | Infrastructure & SRE |
| A-CARTO | €48K | +€200K/an | Architecture monorepo |
| A2 | €12K | +€50K/an | Détection fichiers massifs |
| A3 | €15K | +€80K/an | Détection duplications |
| A4 | €10K | +€40K/an | Détection dead code |
| F6 | €12K | +€30K/an | CSS refactoring |
| G2 | €12K | +€500K+ | Compliance licences OSS |
| G3 | €10K | +€60K/an | ADR automatiques |
| G7 | €8K | +€40K/an | API Contract Enforcer |
| G11 | €4K | +€25K/an | Feature Flag Controller |
| G13 | €6K | +€20K/an | Doc Generator |
| G14 | €3K | +€50K/an | Bus-Factor Monitor |
| G18 | €4K | +€15K/an | Docs Drift Detector |

**Total Budget** : ~€236K
**Total ROI** : +€1,874K/an minimum
