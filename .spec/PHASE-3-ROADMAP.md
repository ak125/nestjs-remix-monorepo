---
title: "Phase 3 - Testing & API Contracts Roadmap"
status: in-progress
version: 1.0.0
authors: [Backend Team]
created: 2025-11-19
updated: 2025-11-19
tags: [phase-3, testing, api-contracts, quality, automation]
priority: high
relates-to:
  - .spec/PHASE-2-COMPLETION-SUMMARY.md
  - .spec/constitution.md
---

# 🧪 Phase 3 - Testing & API Contracts

> **Mission:** Renforcer la qualité et la maintenabilité du monorepo avec une couverture de tests complète, des contrats API formalisés et une documentation technique avancée.

**Branch:** `feat/phase-3-testing-contracts`  
**Duration Estimée:** 3-4 semaines  
**Status:** 🚀 **DÉMARRÉ** (19 Nov 2025)  
**⚠️ IMPORTANT:** Phase 3 se fait sur branche séparée, **AUCUN merge sur main** (main = production)

---

## 📊 Vue d'Ensemble

### Contexte

**Phase 2 Achievements:**
- ✅ 100% backend documentation coverage (37/37 modules)
- ✅ 28,926 lignes de specs techniques
- ✅ 187+ endpoints documentés
- ✅ 4 guides de navigation complets
- ✅ Architecture visible avec 15+ diagrammes

**Gaps Identifiés:**
- ⚠️ Tests coverage insuffisant (estimé ~40%)
- ⚠️ Pas de contrats API formels (OpenAPI/Swagger)
- ⚠️ Documentation d'architecture incomplète (C4 diagrams manquants)
- ⚠️ Monitoring et observabilité limités
- ⚠️ Absence d'outils de développement automatisés

### Objectif Phase 3

**Transformer la documentation en garanties de qualité mesurables** avec:
1. Tests automatisés (>80% coverage)
2. Contrats API validés (OpenAPI specs)
3. Architecture documentée (C4 model complet)
4. Monitoring actif (métriques, dashboards)
5. Developer tools (CLI, templates, CI/CD)

---

## 🎯 Objectifs Principaux

### 1. 🧪 Tests Coverage (Priorité: **CRITICAL**)

**Objectif:** Atteindre >80% tests coverage sur modules critiques

#### Actions Week 1: Test Infrastructure Setup

```bash
# Day 1-2: Setup Jest avec coverage reporting
cd backend
npm install --save-dev @nestjs/testing @types/jest
npm install --save-dev jest ts-jest supertest @types/supertest

# Configurer jest.config.js avec coverage
# Créer test database (Supabase test instance)
# Setup test fixtures et factories
```

#### Modules Prioritaires (Week 2-3)

**Critical Modules (85-90% coverage):**
- [ ] **Auth Module**
  - `auth.service.spec.ts` - Login, session, JWT
  - `jwt-auth.guard.spec.ts` - Guard validation
  - `admin.guard.spec.ts` - RBAC levels
  - `local-auth.guard.spec.ts` - Passport local
  
- [ ] **Payments Module**
  - `payment.service.spec.ts` - Paybox integration
  - `paybox-webhook.spec.ts` - HMAC validation
  - `payment.integration.spec.ts` - Full payment flow
  
- [ ] **Cart Module**
  - `cart.service.spec.ts` - CRUD operations
  - `cart-data.service.spec.ts` - Supabase queries
  - `cart.integration.spec.ts` - Cart workflow

**High Priority (75-80% coverage):**
- [ ] Orders Module
- [ ] Products Module  
- [ ] Admin Module
- [ ] Stock Module

#### KPIs

| Module | Target Coverage | Status | Priority |
|--------|----------------|--------|----------|
| Auth | 85% | 🔴 0% | Critical |
| Payments | 90% | 🔴 0% | Critical |
| Cart | 85% | 🔴 0% | Critical |
| Orders | 80% | 🔴 0% | High |
| Products | 75% | 🔴 0% | High |
| Admin | 80% | 🔴 0% | High |
| **GLOBAL** | **>80%** | 🔴 **~40%** | - |

#### Deliverables

```
backend/
├── src/
│   └── modules/
│       ├── auth/
│       │   └── tests/                        ✅ NEW
│       │       ├── auth.service.spec.ts
│       │       ├── guards/
│       │       │   ├── jwt-auth.guard.spec.ts
│       │       │   └── admin.guard.spec.ts
│       │       └── auth.integration.spec.ts
│       ├── payments/
│       │   └── tests/                        ✅ NEW
│       │       ├── payment.service.spec.ts
│       │       ├── webhook.spec.ts
│       │       └── payment.e2e.spec.ts
│       └── cart/
│           └── tests/                        ✅ NEW
│               ├── cart.service.spec.ts
│               └── cart.integration.spec.ts
├── test/
│   ├── fixtures/                             ✅ NEW
│   │   ├── users.fixture.ts
│   │   ├── products.fixture.ts
│   │   └── orders.fixture.ts
│   ├── factories/                            ✅ NEW
│   │   └── entity.factory.ts
│   └── helpers/                              ✅ NEW
│       └── test-utils.ts
├── jest.config.js                            ✅ UPDATED
└── coverage/                                 ✅ NEW (generated)
    └── lcov-report/index.html
```

#### Estimated Time

- **Setup:** 8 heures
- **Auth Module tests:** 12 heures
- **Payments Module tests:** 14 heures
- **Cart Module tests:** 10 heures
- **Integration tests:** 16 heures
- **Total Week 1-3:** **60 heures** (~8 jours)

---

### 2. 📋 API Contracts (Priorité: **HIGH**)

**Objectif:** Formaliser tous les endpoints avec OpenAPI 3.1 specs

#### Actions Week 1: OpenAPI Setup

```bash
# Installer @nestjs/swagger
cd backend
npm install --save @nestjs/swagger swagger-ui-express

# Configurer dans main.ts
# Setup decorators (@ApiTags, @ApiOperation, @ApiResponse)
# Exposer Swagger UI sur /api/docs
```

#### Endpoints Documentation (Week 2-3)

**Auth & Admin (45 endpoints):**
- [ ] Auth endpoints: login, logout, register, refresh
- [ ] Admin CRUD: users, products, orders, stock
- [ ] Analytics: dashboard, reports, KPIs

**E-commerce Core (109 endpoints):**
- [ ] Products: search, detail, compatibility, stock
- [ ] Cart: CRUD, promo codes, shipping
- [ ] Orders: create, track, invoice, cancel
- [ ] Payments: init, callback, status
- [ ] Checkout: validate, calculate, confirm

**Content & Analytics (35+ endpoints):**
- [ ] Blog: articles, search, categories, metadata
- [ ] AI Content: generate, providers, cache
- [ ] Analytics: events, track, buffer

#### KPIs

| Métrique | Target | Status |
|----------|--------|--------|
| **Endpoints documentés** | 187/187 (100%) | 🔴 0/187 |
| **DTOs avec @ApiProperty** | 100% | 🔴 0% |
| **Status codes définis** | 100% | 🔴 0% |
| **Examples fournis** | 80% | 🔴 0% |
| **Security schemes** | 100% | 🔴 0% |

#### Deliverables

```
backend/
├── src/
│   ├── main.ts                               ✅ UPDATED (Swagger setup)
│   └── modules/
│       ├── auth/
│       │   ├── dto/
│       │   │   ├── login.dto.ts             ✅ UPDATED (@ApiProperty)
│       │   │   └── register.dto.ts          ✅ UPDATED
│       │   └── auth.controller.ts           ✅ UPDATED (@ApiOperation)
│       └── ... (tous les modules)
├── openapi/                                  ✅ NEW
│   ├── openapi.json                         (auto-generated)
│   └── openapi.yaml                         (auto-generated)
└── docs/
    └── api/
        └── swagger-ui.html                  (served at /api/docs)
```

**Public URLs (after deploy):**
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/openapi.json`

#### Estimated Time

- **Setup:** 6 heures
- **Auth & Admin decorators:** 12 heures
- **E-commerce decorators:** 20 heures
- **Content & Analytics:** 8 heures
- **Validation & examples:** 8 heures
- **Total Week 1-3:** **54 heures** (~7 jours)

---

### 3. 🏗️ Advanced Architecture (Priorité: **MEDIUM**)

**Objectif:** Documenter architecture avec C4 model complet

#### Actions Week 2-3

**C4 Model (4 levels):**
- [ ] **Level 1: System Context** - Users, external systems, boundaries
- [ ] **Level 2: Container Diagram** - NestJS, Remix, PostgreSQL, Redis, Meilisearch
- [ ] **Level 3: Component Diagrams** - Auth, Payment, Catalog modules internals
- [ ] **Level 4: Code Diagrams** - Class diagrams, sequence diagrams

**Deployment Architecture:**
- [ ] Docker Compose topology
- [ ] Network diagram (services, ports, volumes)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring stack (Grafana, Prometheus)

#### KPIs

| Diagramme | Status | Priorité |
|-----------|--------|----------|
| System Context | 🔴 TODO | Critical |
| Container | 🔴 TODO | Critical |
| Component (Auth) | 🔴 TODO | High |
| Component (Payment) | 🔴 TODO | High |
| Deployment | 🔴 TODO | Medium |
| CI/CD Pipeline | 🔴 TODO | Medium |

#### Deliverables

```
.spec/
├── architecture/
│   ├── c4-model/                             ✅ NEW
│   │   ├── 01-system-context.md
│   │   ├── 02-container-diagram.md
│   │   ├── 03-component-auth.md
│   │   ├── 03-component-payment.md
│   │   └── 04-code-diagrams.md
│   ├── deployment/                           ✅ NEW
│   │   ├── infrastructure.md
│   │   ├── docker-compose.md
│   │   └── ci-cd-pipeline.md
│   └── decisions/                            ✅ EXISTING
│       ├── ADR-005-c4-model.md              ✅ NEW
│       └── ADR-006-monitoring-stack.md      ✅ NEW
└── diagrams/
    └── c4/                                   ✅ NEW
        ├── system-context.mmd
        ├── container.mmd
        └── components.mmd
```

#### Estimated Time

- **C4 Level 1-2:** 10 heures
- **C4 Level 3-4:** 16 heures
- **Deployment diagrams:** 8 heures
- **ADRs:** 4 heures
- **Total Week 2-3:** **38 heures** (~5 jours)

---

### 4. 📊 Performance Monitoring (Priorité: **MEDIUM**)

**Objectif:** Mesurer et monitorer performance en temps réel

#### Actions Week 3: Metrics Collection

```bash
# Setup Prometheus client
npm install --save @willsoto/nestjs-prometheus prom-client

# Exposer /metrics endpoint
# Ajouter métriques personnalisées:
# - HTTP requests (latency, status codes, paths)
# - Database queries (duration, errors)
# - Cache hits/misses (Redis, memory)
# - Business events (orders, payments, signups)
```

#### Grafana Dashboards (Week 3-4)

**Dashboards à créer:**
- [ ] NestJS Overview (requests, errors, latency p50/p95/p99)
- [ ] Database Performance (query duration, connections)
- [ ] Cache Performance (hit rate, memory usage)
- [ ] Business KPIs (orders, revenue, active users)

**Alerting Rules:**
- Error rate > 1% → Slack notification
- P95 latency > 500ms → Email alert
- Database connections > 80% → PagerDuty

#### KPIs Baseline

| Métrique | Baseline | Target | Status |
|----------|----------|--------|--------|
| **P50 latency** | ~50ms | <100ms | 🟢 OK |
| **P95 latency** | ~200ms | <300ms | 🟡 WATCH |
| **P99 latency** | ~800ms | <500ms | 🔴 NEEDS WORK |
| **Error rate** | ~0.5% | <1% | 🟢 OK |
| **Cache hit rate** | ~65% | >75% | 🟡 WATCH |

#### Deliverables

```
backend/
├── src/
│   └── common/
│       └── metrics/                          ✅ NEW
│           ├── metrics.module.ts
│           ├── metrics.service.ts
│           └── custom-metrics.ts
├── grafana/                                   ✅ NEW
│   ├── dashboards/
│   │   ├── nestjs-overview.json
│   │   ├── database-performance.json
│   │   └── business-kpis.json
│   └── provisioning/
│       └── datasources/prometheus.yaml
├── prometheus/                                ✅ NEW
│   └── prometheus.yml
└── docker-compose.monitoring.yml              ✅ NEW
```

**Monitoring URLs:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

#### Estimated Time

- **Metrics setup:** 8 heures
- **Grafana dashboards:** 10 heures
- **Alerting rules:** 4 heures
- **Total Week 3-4:** **22 heures** (~3 jours)

---

### 5. 🛠️ Developer Tools (Priorité: **LOW**)

**Objectif:** Accélérer développement avec outils automatisés

#### Actions Week 4 (Optional)

**Spec CLI:**
```bash
# CLI pour naviguer les specs
npx spec search <keyword>
npx spec validate
npx spec stats
npx spec generate module <name>
```

**VS Code Extension:**
- Snippets: controller, service, DTO, tests
- Commands: generate module, endpoint
- Spec validation intégrée

**GitHub Templates:**
- Feature PR template
- Bug report template
- ADR template

#### Deliverables

```
packages/
├── spec-cli/                                  ✅ NEW
│   ├── src/
│   │   └── commands/
│   │       ├── search.ts
│   │       ├── validate.ts
│   │       └── generate.ts
│   └── package.json
└── vscode-extension/                          ✅ NEW (optional)
    └── snippets/nestjs.json
```

#### Estimated Time

- **Spec CLI:** 12 heures
- **VS Code snippets:** 4 heures
- **GitHub templates:** 2 heures
- **Total Week 4:** **18 heures** (~2 jours)

---

## 📅 Timeline Détaillée (3-4 semaines)

### Week 1: Foundation (Nov 19-25)

| Jour | Focus | Tâches | Heures |
|------|-------|--------|--------|
| **J1** | Tests Setup | Jest config, test DB, fixtures | 8h |
| **J2** | OpenAPI Setup | Swagger module, decorators setup | 8h |
| **J3** | Unit Tests Auth | AuthService, Guards | 8h |
| **J4** | Unit Tests Payments | PaymentService, Webhooks | 8h |
| **J5** | Unit Tests Cart | CartService, validations | 8h |

**✅ Livrable Week 1:** Infrastructure tests + OpenAPI config + Auth/Payments/Cart testés

---

### Week 2: Core Implementation (Nov 26 - Dec 2)

| Jour | Focus | Tâches | Heures |
|------|-------|--------|--------|
| **J6** | Integration Tests | E-commerce flow end-to-end | 8h |
| **J7** | API Contracts | Auth & Admin (45 endpoints) | 8h |
| **J8** | API Contracts | Products, Cart, Orders (60 endpoints) | 8h |
| **J9** | C4 Diagrams | System Context + Container | 8h |
| **J10** | C4 Diagrams | Components (Auth, Payment) | 8h |

**✅ Livrable Week 2:** Tests intégration + 105 endpoints documentés + C4 Levels 1-2

---

### Week 3: Advanced Features (Dec 3-9)

| Jour | Focus | Tâches | Heures |
|------|-------|--------|--------|
| **J11** | API Contracts | Payments, Content (49 endpoints) | 8h |
| **J12** | Metrics Setup | Prometheus + custom metrics | 8h |
| **J13** | Grafana Dashboards | NestJS + DB + Cache | 8h |
| **J14** | Deployment Arch | Docker, network, CI/CD | 8h |
| **J15** | Polish & Validation | Fix tests, validate OpenAPI | 8h |

**✅ Livrable Week 3:** 187 endpoints documentés + Monitoring + Architecture

---

### Week 4: Polish & Optional Tools (Dec 10-16)

| Jour | Focus | Tâches | Heures |
|------|-------|--------|--------|
| **J16** | Testing Polish | Coverage >80%, fix flaky tests | 8h |
| **J17** | C4 Level 4 | Code diagrams, sequences | 8h |
| **J18** | Spec CLI | Search, validate commands | 8h |
| **J19** | ADRs & Docs | Architecture decisions | 8h |
| **J20** | Final Review | Validation complète Phase 3 | 8h |

**✅ Livrable Week 4:** Coverage >80% + Architecture complète + Tools (optional)

---

## 🎯 Success Criteria

### Critères Quantitatifs (Mesurables)

| Métrique | Baseline | Target | Validation |
|----------|----------|--------|------------|
| **Tests Coverage** | ~40% | >80% | `npm run test:cov` |
| **Endpoints OpenAPI** | 0/187 | 187/187 | Swagger UI accessible |
| **C4 Diagrams** | 0 | 6+ | `.spec/architecture/c4-model/` |
| **Grafana Dashboards** | 0 | 4+ | http://localhost:3001 |
| **ADRs créés** | 4 | 8+ | `.spec/architecture/decisions/` |

### Critères Qualitatifs

**Tests:**
- ✅ Tests unitaires pour modules critiques (Auth, Payments, Cart)
- ✅ Tests intégration pour workflows e-commerce complets
- ✅ CI/CD pipeline exécute tous les tests automatiquement
- ✅ Coverage reports générés et visibles

**API Contracts:**
- ✅ OpenAPI 3.1 spec complète et valide (Spectral lint)
- ✅ Swagger UI accessible et fonctionnel
- ✅ Request/response validation active en dev
- ✅ Examples curl et TypeScript fournis

**Architecture:**
- ✅ C4 model complet (4 levels)
- ✅ Deployment architecture documentée
- ✅ ADRs pour décisions majeures
- ✅ Diagrammes Mermaid lisibles et maintenables

**Monitoring:**
- ✅ Métriques collectées en temps réel (Prometheus)
- ✅ Dashboards Grafana configurés et fonctionnels
- ✅ Alertes critiques actives (Slack/Email)
- ✅ Performance baseline établie (p50/p95/p99)

---

## 📊 Budget & Resources

### Time Budget Total

| Objectif | Heures | Jours | Priorité |
|----------|--------|-------|----------|
| Tests Coverage | 60h | 8j | Critical |
| API Contracts | 54h | 7j | High |
| Advanced Architecture | 38h | 5j | Medium |
| Performance Monitoring | 22h | 3j | Medium |
| Developer Tools | 18h | 2j | Low (Optional) |
| **TOTAL** | **192h** | **~24j** | - |

**Timeline réaliste:** 3-4 semaines (à 1-2 personnes)

### Team Recommandé

- **Backend Dev** (1 person full-time): Tests, API contracts, architecture
- **DevOps** (0.5 person): Monitoring, CI/CD, infrastructure
- **Optional:** Frontend dev pour E2E tests Playwright

### Tools & Services (Coût: $0)

**Développement:**
- ✅ Jest (tests) - Open source
- ✅ @nestjs/swagger (OpenAPI) - Open source
- ✅ Supertest (API testing) - Open source
- ✅ Spectral (OpenAPI linting) - Open source

**Monitoring:**
- ✅ Prometheus (metrics) - Open source
- ✅ Grafana (dashboards) - Open source
- ✅ Docker Compose (existing)

**Documentation:**
- ✅ Mermaid (diagrams) - Open source
- ✅ Markdown (existing)

---

## 🚧 Risques & Mitigations

### Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Tests flaky** | Moyenne | Moyen | Isoler tests, mocks propres, retry logic |
| **Coverage target irréaliste** | Faible | Élevé | Prioriser modules critiques uniquement |
| **OpenAPI incomplet** | Faible | Moyen | Validation automatique en CI/CD |
| **Timeline dépassée** | Élevée | Moyen | Ajuster scope (drop tools optionnels) |
| **Prod impactée** | **Très Faible** | **Critique** | **Branche isolée, aucun merge sur main** |

### Plan B

**Si Timeline dépassée (>4 semaines):**

**Phase 3A (Must-Have - 2 semaines):**
- ✅ Tests Coverage modules critiques (Auth, Payments, Cart)
- ✅ OpenAPI specs complets (187 endpoints)
- **ETA:** 114 heures (~15 jours)

**Phase 3B (Nice-to-Have - 2 semaines):**
- Architecture C4 complète
- Monitoring stack Grafana
- Developer tools
- **ETA:** 78 heures (~10 jours)

---

## 📚 Références

### Documentation Interne

- [Phase 2 Completion Summary](./PHASE-2-COMPLETION-SUMMARY.md)
- [Constitution du Projet](./constitution.md)
- [Architecture Diagrams](./ARCHITECTURE-DIAGRAMS.md)
- [API Endpoints Index](./API-ENDPOINTS-INDEX.md)

### Standards & Best Practices

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [C4 Model](https://c4model.com/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Tools Documentation

- [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction)
- [@nestjs/testing](https://docs.nestjs.com/fundamentals/testing)
- [Grafana](https://grafana.com/docs/)
- [Prometheus](https://prometheus.io/docs/)

---

## ✅ Next Actions Immédiates

### Aujourd'hui (J1)

1. ✅ **Créer branche** `feat/phase-3-testing-contracts` (DONE)
2. ✅ **Commiter roadmap** (EN COURS)
3. [ ] **Setup Jest** avec coverage
4. [ ] **Install @nestjs/swagger**

### Demain (J2)

1. [ ] **Configure Swagger** dans main.ts
2. [ ] **Create test fixtures** (users, products, orders)
3. [ ] **First unit test** (AuthService.login)

### Cette Semaine (J3-J5)

1. [ ] **Complete Auth tests** (85% coverage)
2. [ ] **Complete Payments tests** (90% coverage)
3. [ ] **Complete Cart tests** (85% coverage)
4. [ ] **Setup CI/CD** pour tests automatiques

---

## 🎉 Expected Impact

### Developer Experience

**Before Phase 3:**
- ❌ Tests coverage ~40%
- ❌ Pas de contrats API formels
- ❌ Architecture floue
- ❌ Monitoring basique
- ❌ Régression detection manuelle

**After Phase 3:**
- ✅ Tests coverage >80%
- ✅ OpenAPI spec complète (187 endpoints)
- ✅ C4 architecture claire
- ✅ Monitoring temps réel (Grafana)
- ✅ CI/CD automatisé avec tests
- ✅ Régression prevention automatique

### Business Impact

**Quality Assurance:**
- 📈 Bug detection précoce (shift-left testing)
- 📈 Regression prevention (tests e2e bloquants)
- 📈 API compatibility garantie (OpenAPI validation)

**Velocity:**
- 🚀 Faster debugging (tests isolés)
- 🚀 Faster development (Swagger UI pour tester)
- 🚀 Faster onboarding (architecture documentée)

**Observability:**
- 📊 Real-time metrics visibles
- 📊 Performance bottlenecks identifiés
- 📊 Alerting proactif (incidents évités)

---

## ⚠️ IMPORTANT: Stratégie de Branches

### Architecture Git

```
main (PRODUCTION - INTOUCHABLE)
  │
  └─ feat/spec-kit-optimization (Phase 2 - Documentation)
       │
       └─ feat/phase-3-testing-contracts (Phase 3 - Tests & API Contracts) ← CURRENT
            │
            ├─ feat/phase-3a-auth-tests (optional: tests Auth isolés)
            ├─ feat/phase-3b-openapi (optional: OpenAPI isolé)
            └─ feat/phase-3c-monitoring (optional: Monitoring isolé)
```

### Règles Strictes

1. ❌ **JAMAIS merger sur main** directement
2. ✅ **Toujours travailler sur branches feat/**
3. ✅ **Pull Request required** pour tout merge
4. ✅ **CI/CD validation** avant merge
5. ✅ **Code review mandatory** (2 approvals minimum)

### Workflow de Merge (Futur)

**Quand Phase 3 sera complète:**

```bash
# Option A: Merge Phase 3 vers Phase 2 d'abord
git checkout feat/spec-kit-optimization
git merge feat/phase-3-testing-contracts
git push origin feat/spec-kit-optimization

# Option B: Merge Phase 2 + Phase 3 vers staging branch
git checkout -b staging
git merge feat/spec-kit-optimization
git merge feat/phase-3-testing-contracts
# Tests complets sur staging
# Deploy staging → validation
# Puis merge staging → main (avec approval)
```

---

**Status:** 🚀 **DÉMARRÉ**  
**Next Milestone:** Tests infrastructure setup (Week 1, Day 1-2)  
**ETA Completion:** Mi-décembre 2025

---

**Made with ❤️ by Backend Team**  
**Phase 3 Kickoff: November 19, 2025**  
**⚠️ Remember: main = production, work on branches only!**
