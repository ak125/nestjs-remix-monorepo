# 📊 SEO KPIs Dashboard - Implémentation

## 🎯 Objectif

Fournir 5 KPIs critiques minimum pour le monitoring SEO quotidien dans le dashboard admin.

## 📋 KPIs Implémentés

### 1. 🗺️ Sitemap → Découvertes
**Métrique:** % d'URLs découvertes via sitemap (vs crawl organique)

- **Source:** Google Search Console API + table `seo_sitemap_urls`
- **Cible:** ≥ 70%
- **Status:**
  - ✅ Success: ≥ 70%
  - ⚠️ Warning: 60-70%
  - ❌ Error: < 60%

**Calcul:**
```typescript
discovered_via_sitemap / total_urls * 100
```

---

### 2. 📈 Sitemap → Indexées
**Métrique:** % d'URLs indexées par Google (par famille)

- **Source:** Comptage tables + Google Search Console API
- **Cible:** ≥ 85%
- **Familles:**
  - Gammes (`pieces_gamme`)
  - Constructeurs (`auto_marque`)
  - Modèles (`auto_modele`)
  - Types (`auto_type`)
  - Blog (`__blog_advice`, `__blog_guide`)

**Calcul par famille:**
```typescript
indexed_count / listed_count * 100
```

---

### 3. ⏱️ TTL Crawl
**Métrique:** Délai median entre apparition sitemap et crawl Google

- **Source:** `seo_crawl_budget_experiments` + logs serveur
- **Cible:** ≤ 48h
- **Percentiles:**
  - P50 (median)
  - P75
  - P95

**Calcul:**
```typescript
median(crawl_date - sitemap_added_date)
```

---

### 4. 🚨 Erreurs Sitemap
**Métrique:** Taux d'erreurs 4xx/5xx dans URLs sitemaps

- **Source:** `seo_audit_results`
- **Cible:** < 0.2%
- **Détails:**
  - Erreurs 4xx (not found, forbidden, etc.)
  - Erreurs 5xx (server errors)
  - Breakdown par code

**Calcul:**
```typescript
(errors_4xx + errors_5xx) / total_checked * 100
```

---

### 5. 🌍 Hreflang Health
**Métrique:** % de paires hreflang réciproques valides

- **Source:** `seo_audit_results` (hreflang_errors)
- **Cible:** > 99%
- **Vérifications:**
  - Paires réciproques valides
  - Paires manquantes
  - Codes langue invalides

**Calcul:**
```typescript
(total_pairs - invalid_pairs) / total_pairs * 100
```

---

## 🏗️ Architecture Backend

### Nouveau Service: `SeoKpisService`

**Fichier:** `backend/src/modules/seo/services/seo-kpis.service.ts`

**Méthode principale:**
```typescript
async getDashboardKPIs(): Promise<SEOKPIsDashboard>
```

**Retour:**
```typescript
{
  timestamp: Date,
  sitemapDiscovery: SitemapDiscoveryKPI,
  sitemapIndexation: SitemapIndexationKPI,
  crawlTTL: CrawlTTLKPI,
  sitemapErrors: SitemapErrorsKPI,
  hreflangHealth: HreflangHealthKPI,
  overallHealth: {
    score: number,      // 0-100
    grade: 'A'|'B'|'C'|'D'|'F',
    passedKPIs: number,
    totalKPIs: number
  }
}
```

### Endpoint API

**URL:** `GET /api/seo/kpis/dashboard`

**Contrôleur:** `SeoController` (`seo.controller.ts`)

**Exemple de réponse:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-27T17:00:00.000Z",
    "sitemapDiscovery": {
      "totalUrls": 100000,
      "discoveredViaSitemap": 75000,
      "discoveredViaOther": 25000,
      "percentage": 75,
      "target": 70,
      "status": "success"
    },
    "sitemapIndexation": {
      "byFamily": {
        "gammes": { "listed": 4205, "indexed": 3868, "percentage": 92 },
        "constructeurs": { "listed": 117, "indexed": 111, "percentage": 95 },
        "modeles": { "listed": 1495, "indexed": 1316, "percentage": 88 },
        "types": { "listed": 50000, "indexed": 42000, "percentage": 84 },
        "blog": { "listed": 85, "indexed": 83, "percentage": 98 }
      },
      "overall": {
        "listed": 55902,
        "indexed": 47378,
        "percentage": 84.7
      },
      "target": 85,
      "status": "warning"
    },
    "crawlTTL": {
      "medianTTL": 24,
      "p50": 24,
      "p75": 36,
      "p95": 72,
      "sampleSize": 1000,
      "target": 48,
      "status": "success"
    },
    "sitemapErrors": {
      "totalChecked": 100000,
      "errors4xx": 120,
      "errors5xx": 30,
      "errorRate": 0.15,
      "byCode": {
        "404": 100,
        "410": 20,
        "500": 20,
        "503": 10
      },
      "target": 0.2,
      "status": "success"
    },
    "hreflangHealth": {
      "totalPairs": 10000,
      "validPairs": 9950,
      "invalidPairs": 50,
      "missingReciprocal": 35,
      "percentage": 99.5,
      "target": 99,
      "status": "success"
    },
    "overallHealth": {
      "score": 80,
      "grade": "B",
      "passedKPIs": 4,
      "totalKPIs": 5
    }
  },
  "timestamp": "2025-10-27T17:00:00.000Z"
}
```

---

## 🎨 Dashboard Frontend

### Composant: Tableau KPIs Minimal

**Fichier:** `frontend/app/routes/admin.seo.tsx`

**Section à ajouter:**

```tsx
{/* 📊 KPIs CRITIQUES - Tableau Minimal */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      📊 KPIs Critiques SEO
      <Badge variant={kpis.overallHealth.grade === 'A' ? 'success' : 'warning'}>
        Score: {kpis.overallHealth.score}/100 (Grade {kpis.overallHealth.grade})
      </Badge>
    </CardTitle>
    <CardDescription>
      {kpis.overallHealth.passedKPIs}/{kpis.overallHealth.totalKPIs} KPIs passent les seuils minimum
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      
      {/* KPI 1: Sitemap Discovery */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">🗺️ Sitemap → Découvertes</div>
          <div className="text-sm text-gray-600">
            {kpis.sitemapDiscovery.discoveredViaSitemap.toLocaleString()} URLs sur {kpis.sitemapDiscovery.totalUrls.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{kpis.sitemapDiscovery.percentage}%</div>
          <Badge variant={kpis.sitemapDiscovery.status === 'success' ? 'success' : 'warning'}>
            Cible: ≥{kpis.sitemapDiscovery.target}%
          </Badge>
        </div>
      </div>

      {/* KPI 2: Indexation */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">📈 Sitemap → Indexées</div>
          <div className="text-sm text-gray-600">
            {kpis.sitemapIndexation.overall.indexed.toLocaleString()} indexées / {kpis.sitemapIndexation.overall.listed.toLocaleString()} listées
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{kpis.sitemapIndexation.overall.percentage.toFixed(1)}%</div>
          <Badge variant={kpis.sitemapIndexation.status === 'success' ? 'success' : 'warning'}>
            Cible: ≥{kpis.sitemapIndexation.target}%
          </Badge>
        </div>
      </div>

      {/* KPI 3: TTL Crawl */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">⏱️ TTL Crawl</div>
          <div className="text-sm text-gray-600">
            Délai median: P50={kpis.crawlTTL.p50}h, P75={kpis.crawlTTL.p75}h, P95={kpis.crawlTTL.p95}h
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{kpis.crawlTTL.medianTTL}h</div>
          <Badge variant={kpis.crawlTTL.status === 'success' ? 'success' : 'warning'}>
            Cible: ≤{kpis.crawlTTL.target}h
          </Badge>
        </div>
      </div>

      {/* KPI 4: Erreurs Sitemap */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">🚨 Erreurs Sitemap</div>
          <div className="text-sm text-gray-600">
            4xx: {kpis.sitemapErrors.errors4xx}, 5xx: {kpis.sitemapErrors.errors5xx} sur {kpis.sitemapErrors.totalChecked.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{kpis.sitemapErrors.errorRate.toFixed(2)}%</div>
          <Badge variant={kpis.sitemapErrors.status === 'success' ? 'success' : 'error'}>
            Cible: <{kpis.sitemapErrors.target}%
          </Badge>
        </div>
      </div>

      {/* KPI 5: Hreflang Health */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">🌍 Hreflang Health</div>
          <div className="text-sm text-gray-600">
            {kpis.hreflangHealth.validPairs.toLocaleString()} paires valides / {kpis.hreflangHealth.totalPairs.toLocaleString()} total
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{kpis.hreflangHealth.percentage.toFixed(1)}%</div>
          <Badge variant={kpis.hreflangHealth.status === 'success' ? 'success' : 'warning'}>
            Cible: >{kpis.hreflangHealth.target}%
          </Badge>
        </div>
      </div>

    </div>
  </CardContent>
</Card>
```

---

## 🗄️ Tables Supabase Utilisées

### Existantes:
- ✅ `seo_audit_results` - Résultats audits incluant hreflang_errors
- ✅ `seo_crawl_budget_experiments` - Expériences crawl budget avec TTL
- ✅ `pieces_gamme` - Gammes de pièces (4205)
- ✅ `auto_marque` - Marques de véhicules (117)
- ✅ `auto_modele` - Modèles de véhicules (1495)
- ✅ `auto_type` - Types/motorisations
- ✅ `__blog_advice` - Articles blog conseils (85)
- ✅ `__blog_guide` - Articles blog guides (1)

### À créer:
- 🆕 `seo_sitemap_urls` - URLs avec source de découverte

```sql
CREATE TABLE seo_sitemap_urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  discovered_via TEXT, -- 'sitemap' | 'crawl' | 'backlink'
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_crawled_at TIMESTAMPTZ,
  http_status INT,
  is_indexed BOOLEAN DEFAULT false,
  sitemap_family TEXT, -- 'gammes' | 'constructeurs' | 'modeles' | 'types' | 'blog'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seo_sitemap_urls_discovered_via ON seo_sitemap_urls(discovered_via);
CREATE INDEX idx_seo_sitemap_urls_family ON seo_sitemap_urls(sitemap_family);
CREATE INDEX idx_seo_sitemap_urls_indexed ON seo_sitemap_urls(is_indexed);
```

---

## 🔄 Intégrations

### Google Search Console API
**Documentation:** https://developers.google.com/webmaster-tools/v1/api_reference_index

**Endpoints utilisés:**
- `searchanalytics.query` - Queries de recherche et découvertes
- `sitemaps.list` - Liste des sitemaps soumis
- `urlInspection.index.inspect` - Statut indexation d'une URL

**Setup:**
1. Activer API dans Google Cloud Console
2. Créer Service Account
3. Télécharger credentials JSON
4. Ajouter service account dans Search Console (Lecture)
5. Stocker credentials dans env var `GOOGLE_APPLICATION_CREDENTIALS`

---

## 📊 Monitoring & Alertes

### Seuils Critiques
- Sitemap Discovery < 60% → 🚨 Alerte critique
- Indexation < 80% → ⚠️ Warning
- TTL Crawl > 72h (P50) → 🚨 Alerte critique
- Erreurs sitemap > 0.5% → 🚨 Alerte critique
- Hreflang Health < 98% → ⚠️ Warning

### Collecte Quotidienne
**Cron job** (3h du matin UTC):
```bash
*/0 3 * * * curl http://localhost:3000/api/seo/kpis/dashboard >> /var/log/seo-kpis.log
```

---

## ✅ Checklist Déploiement

- [x] Service `SeoKpisService` créé
- [x] Endpoint `/api/seo/kpis/dashboard` ajouté
- [x] Service enregistré dans `seo.module.ts`
- [ ] Table `seo_sitemap_urls` créée
- [ ] Google Search Console API configurée
- [ ] Dashboard frontend intégré
- [ ] Tests unitaires ajoutés
- [ ] Documentation API complétée
- [ ] Monitoring & alertes configurés
- [ ] Cron job collecte quotidienne

---

## 🚀 Prochaines Étapes

1. **Phase 1 (Aujourd'hui):** ✅
   - Backend service créé
   - Endpoint API fonctionnel
   - Structure données définie

2. **Phase 2 (Cette semaine):**
   - Intégrer Google Search Console API
   - Créer table `seo_sitemap_urls`
   - Remplir données réelles

3. **Phase 3 (Mois prochain):**
   - Dashboard frontend complet
   - Graphiques d'évolution temporelle
   - Alertes automatiques Slack/Email

---

**Dernière mise à jour:** 2025-10-27  
**Auteur:** GitHub Copilot  
**Status:** ✅ Backend Implémenté - Frontend En Attente
