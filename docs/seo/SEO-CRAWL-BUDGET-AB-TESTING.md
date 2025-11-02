# 🧪 A/B Testing du Crawl Budget

## 📋 Concept

Système d'expérimentation pour mesurer l'impact d'**inclure/exclure/réduire** certaines familles de produits dans le sitemap sur:
- 📊 **Taux d'indexation** (via Google Search Console)
- 🤖 **Crawl rate** (pages crawlées/jour)
- 📈 **Trafic organique** (via Google Analytics)
- 🎯 **Positionnement** (ranking moyen)

## 🎯 Cas d'usage

### 1. **Exclure familles à faible valeur**
```json
{
  "name": "Test exclusion pneus anciens",
  "action": "exclude",
  "targetFamilies": ["PNEU_VIEUX", "PNEU_OCCASION"],
  "durationDays": 30
}
```
**Hypothèse**: Enlever 10 000 URLs de pneus anciens permet à Google de crawler plus de pages à forte valeur.

### 2. **Inclure nouvelles familles**
```json
{
  "name": "Test inclusion accessoires connectés",
  "action": "include",
  "targetFamilies": ["ACCESS_CONNECTE", "DIAG_BLUETOOTH"],
  "durationDays": 45
}
```
**Hypothèse**: Ajouter 2 000 URLs d'accessoires connectés augmente le trafic organique.

### 3. **Réduire familles volumineuses**
```json
{
  "name": "Test réduction gamme moteur 50%",
  "action": "reduce",
  "targetFamilies": ["PIECE_MOTEUR"],
  "reductionPercent": 50,
  "durationDays": 60
}
```
**Hypothèse**: Ne garder que les 50% de pièces moteur les plus demandées améliore la qualité du sitemap.

## 🚀 Workflow complet

### Phase 1: Création (DRAFT)
```bash
POST /seo-logs/crawl-budget/experiments
{
  "name": "Exclusion pneus anciens",
  "action": "exclude",
  "targetFamilies": ["PNEU_VIEUX"],
  "durationDays": 30
}
```
→ **Collecte baseline automatique** (30j avant)
→ Génère sitemap filtré

### Phase 2: Activation (RUNNING)
```bash
# 1. Télécharger sitemap filtré
GET /seo-logs/crawl-budget/experiments/{id}/sitemap
# Sauvegarder en sitemap-experiment.xml

# 2. Soumettre à Google Search Console
# https://search.google.com/search-console/sitemaps

# 3. Activer l'expérience
PATCH /seo-logs/crawl-budget/experiments/{id}/status
{ "status": "running" }
```

### Phase 3: Monitoring
```bash
# Métriques quotidiennes
GET /seo-logs/crawl-budget/experiments/{id}/metrics?period=7d

# Comparaison temps réel
GET /seo-logs/crawl-budget/experiments/{id}/comparison
```

### Phase 4: Analyse
```bash
# Recommandations automatiques
GET /seo-logs/crawl-budget/experiments/{id}/recommendations

# Réponse:
{
  "recommendations": [
    {
      "action": "KEEP_EXCLUSION",
      "reason": "L'indexation s'est améliorée de +12%",
      "confidence": 0.95
    }
  ]
}
```

### Phase 5: Complétion
```bash
PATCH /seo-logs/crawl-budget/experiments/{id}/status
{ "status": "completed" }
```

## 📊 Métriques collectées

### 1. Crawl Stats (Google Search Console API)
- `totalCrawledUrls`: Pages crawlées totales
- `crawlRequestsCount`: Requêtes Googlebot/jour
- `avgCrawlRate`: Taux de crawl moyen

### 2. Indexation (site: operator ou GSC API)
- `indexedUrls`: Pages indexées
- `indexationRate`: % d'URLs indexées
- `indexationTime`: Délai moyen d'indexation

### 3. Trafic (Google Analytics)
- `organicSessions`: Sessions organiques
- `organicConversions`: Conversions SEO
- `avgPosition`: Position moyenne (GSC)

### 4. Par famille
```json
{
  "familyMetrics": [
    {
      "familyCode": "PNEU_VIEUX",
      "crawledUrls": 450,
      "indexedUrls": 380,
      "avgPosition": 45.2
    }
  ]
}
```

## 🎛️ Statuts d'expérience

| Statut | Description | Actions disponibles |
|--------|-------------|---------------------|
| `DRAFT` | Créée mais non démarrée | Modifier, Activer |
| `RUNNING` | En cours | Pause, Compléter |
| `PAUSED` | Mise en pause | Reprendre, Compléter |
| `COMPLETED` | Terminée | Voir rapport final |

## 🧠 Logique de recommandations

```typescript
// Amélioration indexation > 5%
if (indexationRateChange > 5) {
  return "KEEP_EXCLUSION"; // Garder changement
}

// Chute trafic > 10%
if (organicSessionsChange < -10) {
  return "REVERT"; // Réintégrer familles
}

// Pas d'impact significatif
if (abs(indexationRateChange) < 2 && abs(organicSessionsChange) < 5) {
  return "NEUTRAL"; // Décision manuelle
}
```

## 📈 Exemple de résultats

### Expérience: Exclusion pneus anciens (10 000 URLs)

**Baseline (30j avant)**:
- Crawl rate: 1 200 pages/jour
- Indexation: 85 000 pages (82%)
- Trafic organique: 4 500 sessions/jour

**Pendant expérience (30j)**:
- Crawl rate: 1 450 pages/jour (**+21%**)
- Indexation: 86 200 pages (**+1.4%**)
- Trafic organique: 4 480 sessions/jour (**-0.4%**)

**Recommandation**: ✅ **KEEP_EXCLUSION** (confidence 90%)
- Le crawl budget s'est amélioré significativement
- L'indexation a légèrement augmenté
- Le trafic est resté stable (familles à faible trafic)

## 🔗 Intégration APIs

### Google Search Console API
```typescript
// Récupérer stats de crawl
GET https://searchconsole.googleapis.com/v1/urlTestingTools/mobileFriendlyTest:run
GET https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps

// Indexation stats
GET https://searchconsole.googleapis.com/v1/searchanalytics/query
```

### Google Analytics 4 API
```typescript
// Trafic organique
POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
{
  "dimensions": [{"name": "sessionSource"}],
  "metrics": [{"name": "sessions"}],
  "dimensionFilter": {
    "filter": {"fieldName": "sessionSource", "stringFilter": {"value": "google"}}
  }
}
```

## 🛠️ Implémentation technique

### Architecture
```
┌─────────────────────────────────────────┐
│  CrawlBudgetExperimentController        │
│  - POST /experiments                    │
│  - GET  /experiments/:id/metrics        │
│  - GET  /experiments/:id/comparison     │
│  - GET  /experiments/:id/sitemap        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  CrawlBudgetExperimentService           │
│  - createExperiment()                   │
│  - generateFilteredSitemap()            │
│  - collectBaselineMetrics()             │
│  - getRecommendations()                 │
└─────────────────────────────────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
┌─────────┐     ┌──────────┐
│ Prisma  │     │   APIs   │
│   DB    │     │  GSC+GA4 │
└─────────┘     └──────────┘
```

### Table Prisma (à créer)
```prisma
model CrawlBudgetExperiment {
  id              String   @id @default(uuid())
  name            String
  description     String?
  action          String   // exclude, include, reduce
  targetFamilies  String[] // Array de codes gammes
  reductionPercent Int?
  durationDays    Int      @default(30)
  status          String   @default("draft")
  baseline        Json?    // Métriques 30j avant
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  metrics CrawlBudgetMetric[]

  @@map("crawl_budget_experiments")
}

model CrawlBudgetMetric {
  id                  String   @id @default(uuid())
  experimentId        String
  date                DateTime
  totalCrawledUrls    Int
  crawlRequestsCount  Int
  avgCrawlRate        Float
  indexedUrls         Int
  indexationRate      Float
  organicSessions     Int?
  organicConversions  Int?
  familyMetrics       Json?    // Détails par famille

  experiment CrawlBudgetExperiment @relation(fields: [experimentId], references: [id])

  @@unique([experimentId, date])
  @@map("crawl_budget_metrics")
}
```

## 📅 Roadmap

- [ ] **Phase 1**: Structure de base (controller + service)
- [ ] **Phase 2**: Prisma schema + migrations
- [ ] **Phase 3**: Intégration Google Search Console API
- [ ] **Phase 4**: Collecte baseline automatique
- [ ] **Phase 5**: Génération sitemap filtré dynamique
- [ ] **Phase 6**: Google Analytics 4 API
- [ ] **Phase 7**: Recommandations ML (TensorFlow.js)
- [ ] **Phase 8**: Dashboard Grafana

## 🎓 Best practices

1. **Durée minimale**: 30 jours (laisser Google re-crawler)
2. **Une expérience à la fois**: Éviter variables confondantes
3. **Baseline solide**: Attendre stabilité avant de lancer
4. **Seuil significatif**: Ignorer variations < 5%
5. **Combiner métriques**: Ne pas se fier qu'à une seule métrique

## 📚 Références

- [Google Search Console API](https://developers.google.com/webmaster-tools)
- [Google Analytics 4 API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Sitemap Protocol](https://www.sitemaps.org/protocol.html)
