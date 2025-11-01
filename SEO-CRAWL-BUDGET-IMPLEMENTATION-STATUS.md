# ✅ A/B Testing Crawl Budget - Implémentation complète

## 📦 Fichiers créés

### 1. **Base de données** (Supabase)
- ✅ `backend/supabase/migrations/20251027_crawl_budget_experiments.sql`
  - Table `crawl_budget_experiments`
  - Table `crawl_budget_metrics`
  - Index de performance
  - Row Level Security (RLS)

### 2. **DTOs** (avec Zod)
- ✅ `backend/src/modules/seo-logs/dto/crawl-budget-experiment.dto.ts`
  - `CreateCrawlBudgetExperimentSchema`
  - `UpdateExperimentStatusSchema`
  - Types TypeScript inférés
  - Enums: ExperimentAction, ExperimentStatus

### 3. **Services**
- ✅ `backend/src/modules/seo-logs/services/crawl-budget-supabase.service.ts`
  - CRUD complet sur Supabase
  - createExperiment, listExperiments, getExperiment
  - updateStatus, addMetric, getMetrics
  - getStats, deleteExperiment

- ✅ `backend/src/modules/seo-logs/services/crawl-budget-integrations.service.ts`
  - `GoogleSearchConsoleService` (GSC API)
  - `GoogleAnalyticsService` (GA4 API)
  - `SitemapGeneratorService` (génération sitemaps filtrés)
  - `CrawlBudgetOrchestratorService` (orchestration complète)

### 4. **Controller**
- ✅ `backend/src/modules/seo-logs/controllers/crawl-budget-experiment.controller.ts`
  - 10 endpoints REST
  - Validation Zod intégrée
  - Gestion complète du cycle de vie des expériences

### 5. **Module**
- ✅ `backend/src/modules/seo-logs/seo-logs.module.ts` (mis à jour)
  - Tous les services ajoutés
  - Controller enregistré
  - Exports configurés

### 6. **Configuration**
- ✅ `backend/.env.crawl-budget.example`
  - Variables Supabase
  - Credentials GSC
  - Credentials GA4

### 7. **Documentation**
- ✅ `SEO-CRAWL-BUDGET-AB-TESTING.md` (guide complet)
- ✅ `SEO-CRAWL-BUDGET-QUICKSTART.md` (démarrage rapide)

## 🎯 Endpoints disponibles

| Méthode | Endpoint | Description | Status |
|---------|----------|-------------|--------|
| POST | `/seo-logs/crawl-budget/experiments` | Créer expérience | ✅ Ready |
| GET | `/seo-logs/crawl-budget/experiments` | Liste expériences | ✅ Ready |
| GET | `/seo-logs/crawl-budget/experiments/:id` | Détails expérience | ✅ Ready |
| GET | `/seo-logs/crawl-budget/experiments/:id/metrics` | Métriques | ✅ Ready |
| PATCH | `/seo-logs/crawl-budget/experiments/:id/status` | Changer statut | ✅ Ready |
| GET | `/seo-logs/crawl-budget/experiments/:id/sitemap.xml` | Sitemap filtré | ✅ Ready |
| GET | `/seo-logs/crawl-budget/experiments/:id/recommendations` | Recommandations | ✅ Ready |
| POST | `/seo-logs/crawl-budget/experiments/:id/collect-metrics` | Collecter métriques | ✅ Ready |
| GET | `/seo-logs/crawl-budget/stats` | Stats globales | ✅ Ready |

## 🚀 Prochaines étapes

### Phase 1: Setup Supabase ⏳
```bash
# 1. Exécuter migration SQL
psql -h your-project.supabase.co -U postgres -d postgres \
  -f backend/supabase/migrations/20251027_crawl_budget_experiments.sql

# 2. Configurer .env
cp backend/.env.crawl-budget.example backend/.env
# Éditer avec vos credentials Supabase
```

### Phase 2: Installer dépendances ⏳
```bash
cd backend
npm install @supabase/supabase-js
npm install googleapis @google-analytics/data
```

### Phase 3: Configurer Google Cloud ⏳
1. Créer Service Account
2. Activer APIs (Search Console + Analytics Data)
3. Télécharger credentials JSON
4. Ajouter dans .env

### Phase 4: Implémenter vraies APIs 🚧
Actuellement, les services utilisent des **mock data**:
- `GoogleSearchConsoleService.getCrawlStats()` → Mock
- `GoogleAnalyticsService.getOrganicTraffic()` → Mock
- `SitemapGeneratorService.getAllProductUrls()` → Mock

**TODO**: Remplacer par vraies requêtes API

### Phase 5: Automatisation 🚧
- Créer job BullMQ pour collecte quotidienne métriques
- Scheduler cron pour exécution automatique
- Alertes email/Slack sur changements significatifs

### Phase 6: Dashboard 🚧
- Grafana pour visualisation des expériences
- Graphiques comparatifs baseline vs expérience
- Alertes visuelles sur recommandations

## 🧪 Test rapide

```bash
# 1. Créer une expérience
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion pneus anciens",
    "action": "exclude",
    "targetFamilies": ["PNEU_VIEUX"],
    "durationDays": 30
  }'

# 2. Vérifier les stats
curl http://localhost:3000/seo-logs/crawl-budget/stats | jq

# 3. Télécharger sitemap filtré
curl http://localhost:3000/seo-logs/crawl-budget/experiments/{id}/sitemap.xml
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  CrawlBudgetExperimentController (REST API)    │
│  - POST /experiments                            │
│  - GET  /experiments/:id/metrics                │
│  - GET  /experiments/:id/sitemap.xml            │
│  - GET  /experiments/:id/recommendations        │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  CrawlBudgetOrchestratorService                 │
│  - createExperiment(dto)                        │
│  - collectDailyMetrics(experimentId)            │
│  - getRecommendations(experimentId)             │
└─────────────────────────────────────────────────┘
          │              │              │
    ┌─────┴─────┐  ┌─────┴─────┐  ┌────┴────┐
    ▼           ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│Supabase │ │   GSC   │ │   GA4   │ │ Sitemap │
│  CRUD   │ │   API   │ │   API   │ │   Gen   │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## 📊 Exemple de flux complet

1. **Utilisateur crée expérience** → POST /experiments
2. **Service collecte baseline** → GSC + GA4 (30j avant)
3. **Service génère sitemap filtré** → Queries Supabase products
4. **Utilisateur télécharge sitemap** → GET /sitemap.xml
5. **Utilisateur soumet à GSC** → Manual ou API
6. **Service active expérience** → PATCH /status {running}
7. **Job quotidien collecte métriques** → BullMQ + GSC/GA4
8. **Service analyse résultats** → GET /recommendations
9. **Utilisateur complète expérience** → PATCH /status {completed}

## 🎓 Concepts clés

### Actions disponibles
- **EXCLUDE**: Enlever familles du sitemap (ex: pneus anciens)
- **INCLUDE**: N'inclure que certaines familles (ex: nouveaux produits)
- **REDUCE**: Garder X% des familles (ex: 50% pièces moteur les plus populaires)

### Métriques collectées
- **Crawl**: totalCrawledUrls, crawlRequestsCount, avgCrawlRate
- **Indexation**: indexedUrls, indexationRate
- **Trafic**: organicSessions, organicConversions
- **Par famille**: crawledUrls, indexedUrls, avgPosition

### Recommandations automatiques
- **KEEP_EXCLUSION**: Indexation améliorée > 5%
- **REVERT**: Trafic chuté > 10%
- **NEUTRAL**: Pas d'impact significatif (< 2%)

## ✨ Points forts de l'implémentation

✅ **Zod validation** (pas class-validator)
✅ **Supabase direct** (pas Prisma)
✅ **Architecture modulaire** (services séparés)
✅ **Mock data prêt** (pour dev sans API)
✅ **Documentation complète** (guides + exemples)
✅ **Type-safe** (TypeScript + Zod inference)
✅ **Scalable** (prêt pour cron + BullMQ)

## 🐛 Erreurs actuelles

### ❌ `relation "public.crawl_budget_experiments" does not exist`
**Cause**: Tables Supabase pas encore créées
**Solution**: Exécuter le script SQL de migration

### ✅ Validation Zod fonctionnelle
Backend démarre correctement avec Zod au lieu de class-validator

## 📚 Références

- [Supabase Client](https://supabase.com/docs/reference/javascript/introduction)
- [Google Search Console API](https://developers.google.com/webmaster-tools)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Zod](https://zod.dev/)
