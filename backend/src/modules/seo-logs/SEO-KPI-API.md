# 📊 API SEO KPI - Guide d'utilisation

## Vue d'ensemble

L'API SEO KPI expose les métriques de crawl analysées à partir des logs Caddy stockés dans Loki. Elle permet de monitorer en temps réel l'activité des moteurs de recherche sur votre site.

**Base URL:** `/seo-logs/kpi`

---

## Endpoints

### 1. 🤖 Taux de crawl du sitemap

**GET** `/seo-logs/kpi/crawl-rate`

Calcule le pourcentage d'URLs du sitemap crawlées par les bots dans une fenêtre de temps.

#### Paramètres

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `timeWindow` | string | `72h` | Fenêtre de temps (ex: `24h`, `72h`, `7d`, `30d`) |

#### Exemple de requête

```bash
curl http://localhost:3001/seo-logs/kpi/crawl-rate?timeWindow=72h
```

#### Exemple de réponse

```json
{
  "success": true,
  "data": {
    "timeWindow": "72h",
    "sitemap": {
      "url": "https://automecanik.fr/sitemap.xml",
      "totalUrls": 5420
    },
    "crawl": {
      "crawledUrls": 4512,
      "crawlRate": 83.25,
      "status": "excellent",
      "threshold": 80
    },
    "evaluation": {
      "status": "excellent",
      "recommendation": "Excellent taux de crawl! Les moteurs de recherche indexent activement votre site."
    },
    "updatedAt": "2025-10-26T14:23:45.123Z"
  }
}
```

#### Statuts et seuils

| Taux | Statut | Signification |
|------|--------|---------------|
| ≥ 80% | `excellent` | Crawl très actif ✅ |
| 60-79% | `good` | Crawl normal 👍 |
| 40-59% | `warning` | Crawl insuffisant ⚠️ |
| < 40% | `critical` | Crawl faible ❌ |

---

### 2. 🕷️ Top des crawlers actifs

**GET** `/seo-logs/kpi/top-crawlers`

Liste les bots qui crawlent le plus activement votre site.

#### Paramètres

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `timeWindow` | string | `72h` | Fenêtre de temps |
| `limit` | number | `10` | Nombre de bots à retourner (max 50) |

#### Exemple de requête

```bash
curl http://localhost:3001/seo-logs/kpi/top-crawlers?timeWindow=7d&limit=5
```

#### Exemple de réponse

```json
{
  "success": true,
  "data": {
    "timeWindow": "7d",
    "totalCrawlers": 5,
    "totalHits": 12450,
    "crawlers": [
      {
        "rank": 1,
        "bot": "googlebot",
        "hits": 7890,
        "percentage": 63.37
      },
      {
        "rank": 2,
        "bot": "bingbot",
        "hits": 2340,
        "percentage": 18.80
      },
      {
        "rank": 3,
        "bot": "yandexbot",
        "hits": 1120,
        "percentage": 9.00
      },
      {
        "rank": 4,
        "bot": "baiduspider",
        "hits": 650,
        "percentage": 5.22
      },
      {
        "rank": 5,
        "bot": "semrushbot",
        "hits": 450,
        "percentage": 3.61
      }
    ]
  }
}
```

---

### 3. 📄 URLs les plus crawlées

**GET** `/seo-logs/kpi/most-crawled-urls`

Identifie les pages qui attirent le plus l'attention des crawlers.

#### Paramètres

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `timeWindow` | string | `72h` | Fenêtre de temps |
| `limit` | number | `20` | Nombre d'URLs à retourner |

#### Exemple de requête

```bash
curl http://localhost:3001/seo-logs/kpi/most-crawled-urls?timeWindow=24h&limit=10
```

#### Exemple de réponse

```json
{
  "success": true,
  "data": {
    "timeWindow": "24h",
    "totalUrls": 10,
    "urls": [
      {
        "rank": 1,
        "path": "/pieces/freins/renault/clio/1-5-dci",
        "crawls": 234
      },
      {
        "rank": 2,
        "path": "/pieces/plaquettes/peugeot/208/1-2-tce",
        "crawls": 189
      },
      {
        "rank": 3,
        "path": "/pieces/embrayage/volkswagen/golf/2-0-tdi",
        "crawls": 156
      }
    ]
  }
}
```

---

## Configuration requise

### Variables d'environnement

```bash
# URL de Loki (requis)
LOKI_URL=http://loki:3100

# URL du sitemap (requis pour crawl-rate)
SITEMAP_URL=https://automecanik.fr/sitemap.xml
```

### Dépendances

- **Loki** : Doit être accessible et contenir des logs
- **Vector** : Doit envoyer les logs Caddy vers Loki
- **Label Loki requis** : `job="caddy-access"`

---

## Cas d'usage

### 1. Monitoring SEO quotidien

```bash
# Vérifier le taux de crawl sur 24h
curl http://localhost:3001/seo-logs/kpi/crawl-rate?timeWindow=24h | jq '.data.crawl.crawlRate'
```

**Alerte si < 60%** : Problème potentiel de crawlabilité

### 2. Analyse comparative

```bash
# Comparer 7j vs 30j
curl http://localhost:3001/seo-logs/kpi/crawl-rate?timeWindow=7d
curl http://localhost:3001/seo-logs/kpi/crawl-rate?timeWindow=30d
```

**Baisse >20%** : Investigate robots.txt, sitemap, performances

### 3. Validation après changement

Après mise à jour sitemap ou robots.txt :

```bash
# Baseline avant changement
curl http://localhost:3001/seo-logs/kpi/top-crawlers?timeWindow=72h > before.json

# Attendre 72h

# Mesurer l'impact
curl http://localhost:3001/seo-logs/kpi/top-crawlers?timeWindow=72h > after.json
diff before.json after.json
```

### 4. Dashboard Grafana

Créer un dashboard avec panels :

```javascript
// Panel Crawl Rate (Gauge)
fetch('/seo-logs/kpi/crawl-rate?timeWindow=72h')
  .then(r => r.json())
  .then(d => d.data.crawl.crawlRate)

// Panel Top Bots (Table)
fetch('/seo-logs/kpi/top-crawlers?limit=10')
  .then(r => r.json())
  .then(d => d.data.crawlers)
```

---

## Troubleshooting

### Erreur: "Pas de données Loki"

**Cause:** Loki ne reçoit pas les logs ou label incorrect

**Solution:**
```bash
# Vérifier que Vector envoie à Loki
docker logs vector-seo-pipeline | grep loki

# Tester Loki directement
curl -G http://localhost:3100/loki/api/v1/query \
  --data-urlencode 'query={job="caddy-access"}' | jq
```

### Erreur: "Sitemap inaccessible"

**Cause:** URL du sitemap incorrecte ou site down

**Solution:**
```bash
# Vérifier le sitemap
curl -I https://automecanik.fr/sitemap.xml

# Override temporaire
export SITEMAP_URL=https://example.com/sitemap.xml
```

### Crawl rate = 0%

**Causes possibles:**
1. Aucun bot n'a crawlé (peu probable sur 72h)
2. Logs Loki vides (vérifier Vector)
3. Filtre `bot != ""` trop strict

**Debug:**
```bash
# Compter tous les hits (bots + humains)
curl -G http://localhost:3100/loki/api/v1/query \
  --data-urlencode 'query=count_over_time({job="caddy-access"} [72h])' | jq
```

---

## Performance

### Temps de réponse typiques

| Endpoint | Fenêtre | Temps |
|----------|---------|-------|
| crawl-rate | 72h | ~2-5s |
| top-crawlers | 7d | ~1-3s |
| most-crawled-urls | 24h | ~1-2s |

**Note:** Les requêtes LogQL peuvent être lentes sur de gros volumes. Utiliser des fenêtres de temps raisonnables.

### Optimisations

1. **Caching**: Implémenter un cache Redis pour les KPI (TTL 15min)
2. **Pre-aggregation**: Calculer les KPI via cron et stocker dans DB
3. **Indexation Loki**: Vérifier la configuration des index Loki

---

## Roadmap

- [ ] Endpoint `/crawl-trends` : Évolution du taux de crawl sur 30j
- [ ] Endpoint `/bot-behavior` : Patterns de crawl par bot (heures, jours)
- [ ] Endpoint `/sitemap-freshness` : URLs modifiées vs crawlées
- [ ] Webhook: Alertes si crawl rate < threshold
- [ ] Export CSV des KPIs pour reporting
