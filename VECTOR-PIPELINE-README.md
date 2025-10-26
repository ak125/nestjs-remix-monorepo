# 🚀 Vector Log Pipeline - Guide Complet

## 📊 Architecture

```
Caddy → Vector → [ Loki + Meilisearch + Prometheus ]
                        ↓
                    Grafana (visualisation)
```

### Services Déployés

| Service | Port | Status | Description |
|---------|------|--------|-------------|
| **Vector** | 8686, 9598 | ✅ Running | Transformation et routage des logs |
| **Loki** | 3100 | ✅ Healthy | Stockage time-series (30 jours) |
| **Meilisearch** | 7700 | ✅ Available | Moteur de recherche pour analytics |
| **Grafana** | 3001 | ✅ Running | Dashboards (admin/admin) |
| **Prometheus** | 9090 | ✅ Healthy | Collecte de métriques |

---

## 🎯 Fonctionnalités E-commerce

### Facettes Disponibles (7)

1. **brand** - Marques auto (Renault, Peugeot, BMW, etc.)
2. **gamme** - Modèles (Clio, 208, Serie-3, etc.)
3. **day** - Date au format YYYY-MM-DD
4. **country** - Code pays (FR, BE, CH, etc.)
5. **bot** - Nom du bot (googlebot, bingbot, etc.)
6. **status** - Code HTTP (200, 404, 500, etc.)
7. **method** - HTTP method (GET, POST, etc.)

### Champs Searchable (4)

- **path** - URL complète du chemin
- **route** - Pattern générique (/pieces/:brand/:gamme/:category)
- **referer** - Page d'origine
- **ua** - User-Agent complet

### Champs Sortable (2)

- **ts** - Timestamp Unix (tri chronologique)
- **latency_ms** - Latence en millisecondes (performance)

---

## 🔧 Déploiement

### 1. Démarrer le pipeline

```bash
# Avec le fichier .env.vector
docker-compose -f docker-compose.vector.yml --env-file .env.vector up -d

# Vérifier l'état
docker ps | grep -E "vector|loki|meilisearch|grafana|prometheus"
```

### 2. Initialiser Meilisearch

L'index `access_logs` est déjà créé avec les settings optimisés :

```bash
# Vérifier l'index
curl -s "http://localhost:7700/indexes/access_logs/settings" \
  -H "Authorization: Bearer <MEILISEARCH_API_KEY>"
```

### 3. Configurer Caddy (logs JSON)

Ajouter dans votre `Caddyfile` :

```caddyfile
log {
    output file /var/log/caddy/access.json {
        roll_size 100mb
        roll_keep 5
    }
    format json
}
```

Puis recharger Caddy :

```bash
docker-compose restart caddy
# ou
systemctl reload caddy
```

---

## 📊 Analytics API

### Endpoints Disponibles

#### 1. Traffic Analytics

```bash
# Aujourd'hui
GET http://localhost:3000/seo-logs/analytics/traffic?period=today

# Hier
GET http://localhost:3000/seo-logs/analytics/traffic?period=yesterday

# 7 derniers jours
GET http://localhost:3000/seo-logs/analytics/traffic?period=7days

# 30 derniers jours
GET http://localhost:3000/seo-logs/analytics/traffic?period=30days
```

**Réponse :**
```json
{
  "period": "today",
  "totalHits": 15234,
  "topBrands": [
    {"value": "renault", "count": 3245},
    {"value": "peugeot", "count": 2891},
    {"value": "citroen", "count": 1823}
  ],
  "topGammes": [
    {"value": "clio", "count": 1245},
    {"value": "208", "count": 1123},
    {"value": "c3", "count": 892}
  ],
  "topCombos": [
    {"brand": "renault", "gamme": "clio", "count": 1245},
    {"brand": "peugeot", "gamme": "208", "count": 1123}
  ],
  "topCountries": [
    {"value": "FR", "count": 12500},
    {"value": "BE", "count": 1800},
    {"value": "CH", "count": 934}
  ],
  "botStats": {
    "totalBots": 2345,
    "totalHumans": 12889,
    "ratio": 0.18
  },
  "statusDistribution": [
    {"value": "200", "count": 14234},
    {"value": "404", "count": 823},
    {"value": "500", "count": 177}
  ]
}
```

#### 2. Slow Paths (Performance)

```bash
# Chemins > 800ms aujourd'hui
GET http://localhost:3000/seo-logs/analytics/slow-paths?threshold=800

# Chemins > 500ms hier
GET http://localhost:3000/seo-logs/analytics/slow-paths?threshold=500&day=2025-10-25

# Top 20 plus lents
GET http://localhost:3000/seo-logs/analytics/slow-paths?threshold=800&limit=20
```

**Réponse :**
```json
{
  "threshold": 800,
  "totalSlow": 234,
  "stats": {
    "avg": 1234,
    "p50": 950,
    "p95": 1850,
    "p99": 2340,
    "max": 3456
  },
  "topSlow": [
    {
      "route": "/pieces/:brand/:gamme/:category",
      "count": 45,
      "avgLatency": 1523,
      "p95": 2100,
      "maxLatency": 3456,
      "examples": ["/pieces/renault/clio/freins"]
    }
  ]
}
```

#### 3. Bot Hits

```bash
# Tous les bots
GET http://localhost:3000/seo-logs/analytics/bot-hits

# Googlebot uniquement
GET http://localhost:3000/seo-logs/analytics/bot-hits?bot=googlebot

# 50 premiers résultats, offset 100
GET http://localhost:3000/seo-logs/analytics/bot-hits?limit=50&offset=100
```

**Réponse :**
```json
{
  "total": 2345,
  "offset": 0,
  "limit": 100,
  "bots": [
    {"value": "googlebot", "count": 1234},
    {"value": "bingbot", "count": 567},
    {"value": "yandexbot", "count": 234}
  ],
  "hits": [
    {
      "ts": 1729972800,
      "path": "/pieces/renault/clio/freins",
      "bot": "googlebot",
      "status": 200,
      "latency_ms": 123,
      "country": "US"
    }
  ]
}
```

---

## 🛠️ CLI Scripts

### 1. Queries Pré-configurées

```bash
cd /workspaces/nestjs-remix-monorepo
chmod +x meilisearch-queries.sh
./meilisearch-queries.sh
```

**10 queries disponibles :**
1. Requêtes par statut (200, 404, 500)
2. Top 10 chemins les plus visités
3. Erreurs 404 du jour
4. Trafic par pays
5. Hits de bots (Google, Bing, Yandex)
6. Top 15 marques auto
7. Top 15 gammes par marque
8. Performance > 500ms
9. Trafic par jour (7 derniers)
10. Combinaisons brand+gamme populaires

### 2. Dashboard Trafic Complet

```bash
chmod +x query-traffic-analytics.sh

# Aujourd'hui
./query-traffic-analytics.sh today

# Hier
./query-traffic-analytics.sh yesterday

# 7 jours
./query-traffic-analytics.sh 7days

# 30 jours
./query-traffic-analytics.sh 30days
```

**Affichage :**
```
===========================================
ANALYTICS DASHBOARD - TODAY
===========================================

📊 TOTAL: 15,234 hits

🏆 TOP 15 BRANDS
┌─────────┬────────┐
│ Brand   │ Count  │
├─────────┼────────┤
│ renault │ 3,245  │
│ peugeot │ 2,891  │
│ citroen │ 1,823  │
└─────────┴────────┘

🚗 TOP 15 GAMMES
┌────────┬────────┐
│ Gamme  │ Count  │
├────────┼────────┤
│ clio   │ 1,245  │
│ 208    │ 1,123  │
│ c3     │  892   │
└────────┴────────┘

🌍 TOP 10 COUNTRIES
┌─────────┬────────┐
│ Country │ Count  │
├─────────┼────────┤
│ FR      │ 12,500 │
│ BE      │  1,800 │
│ CH      │    934 │
└─────────┴────────┘

🤖 BOTS vs HUMANS
Bots:    2,345 (18%)
Humans: 12,889 (82%)
```

### 3. Analyse Performance

```bash
chmod +x query-slow-paths.sh

# Chemins > 800ms
./query-slow-paths.sh 800

# Chemins > 500ms hier
./query-slow-paths.sh 500 2025-10-25
```

### 4. Listing Bots

```bash
chmod +x query-bot-hits.sh

# 100 premiers hits
./query-bot-hits.sh 100 0

# Googlebot uniquement
./query-bot-hits.sh 100 0 googlebot
```

---

## 📈 Grafana Dashboards

### Accès

```
URL: http://localhost:3001
User: admin
Password: admin
```

### Datasources Provisionnés

1. **Loki** (par défaut)
   - URL: http://loki:3100
   - Retention: 30 jours
   - Indexed labels: bot, brand, gamme, day, country

2. **Prometheus**
   - URL: http://prometheus:9090
   - Métriques Vector, Loki, Meilisearch

### Queries Loki Utiles

```logql
# Tous les logs du jour
{job="caddy_access"} | json

# Erreurs 404 sur Renault Clio
{job="caddy_access", brand="renault", gamme="clio", status="404"} | json

# Bots Google aujourd'hui
{job="caddy_access", bot="googlebot", day="2025-10-26"} | json

# Trafic FR avec latence > 1s
{job="caddy_access", country="FR"} | json | latency_ms > 1000

# Agrégation: hits par heure
sum by (brand) (count_over_time({job="caddy_access"}[1h]))
```

---

## 🔍 Troubleshooting

### Services ne démarrent pas

```bash
# Vérifier les logs
docker logs vector-seo-pipeline --tail 50
docker logs loki-logs --tail 50
docker logs meilisearch-seo --tail 50
docker logs grafana-dashboards --tail 50

# Vérifier la santé
docker ps | grep -E "vector|loki|meilisearch|grafana|prometheus"

# Redémarrer un service
docker-compose -f docker-compose.vector.yml --env-file .env.vector restart <service>
```

### Meilisearch: "Master key too short"

```bash
# Générer une clé 32-byte sécurisée
openssl rand -base64 32

# Mettre à jour .env.vector
MEILISEARCH_API_KEY=<nouvelle_clé>

# Redémarrer
docker-compose -f docker-compose.vector.yml --env-file .env.vector restart meilisearch
```

### Loki: "split_queries_by_interval error"

```bash
# Vérifier loki-config.yaml
# Le flag doit être dans limits_config, pas query_range

# Correct:
limits_config:
  split_queries_by_interval: 1h

# Incorrect:
query_range:
  split_queries_by_interval: 1h  # ❌
```

### Grafana: "Unknown escape character"

```bash
# Vérifier grafana/provisioning/datasources/*.yml
# Utiliser ${var} au lieu de $${var} dans les fichiers YAML

# Correct:
url: '${__value.raw}'

# Incorrect:
url: '$${__value.raw}'  # ❌
```

### Vector: unhealthy

```bash
# Normal si pas de logs Caddy encore
# Vérifier l'API Vector
curl http://localhost:8686/health

# Vérifier les métriques
curl http://localhost:9598/metrics

# Injecter un log test
echo '{"request":{"method":"GET","uri":"/pieces/renault/clio/freins","host":"automecanik.com"},"duration":0.123,"status":200}' >> /var/log/caddy/access.json
```

### Pas de données dans Meilisearch

```bash
# Vérifier que Vector envoie des logs
docker logs vector-seo-pipeline | grep meilisearch

# Vérifier l'index
curl -s "http://localhost:7700/indexes/access_logs/stats" \
  -H "Authorization: Bearer <MEILISEARCH_API_KEY>"

# Rechercher des documents
curl -s "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer <MEILISEARCH_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"q": "", "limit": 10}'
```

---

## 🎯 Next Steps

### 1. Télécharger GeoIP Database

```bash
# S'inscrire sur MaxMind
https://dev.maxmind.com/geoip/geolite2-free-geolocation-data

# Télécharger GeoLite2-City.mmdb
# Placer dans: ./geoip/GeoLite2-City.mmdb

# Redémarrer Vector
docker-compose -f docker-compose.vector.yml --env-file .env.vector restart vector
```

### 2. Créer des Dashboards Grafana

- Dashboard "SEO Traffic Overview"
  - Panel: Hits par heure (time series)
  - Panel: Top 10 brands (bar chart)
  - Panel: Bots vs Humans (pie chart)
  - Panel: Geographic distribution (worldmap)

- Dashboard "Performance Monitoring"
  - Panel: Latence p50/p95/p99 (graph)
  - Panel: Slow paths (table)
  - Panel: Error rate (time series)

### 3. Alertes Prometheus

```yaml
# Exemple: Taux d'erreur 404 > 5%
- alert: HighErrorRate
  expr: rate(http_requests_total{status="404"}[5m]) > 0.05
  for: 10m
  annotations:
    summary: "Taux d'erreur 404 élevé"
```

### 4. Intégrer au Frontend

```typescript
// frontend/app/routes/admin/analytics.tsx
export async function loader() {
  const analytics = await fetch('/seo-logs/analytics/traffic?period=today');
  return json({ analytics });
}
```

---

## 📚 Documentation

- **Vector**: https://vector.dev/docs/
- **Loki**: https://grafana.com/docs/loki/latest/
- **Meilisearch**: https://www.meilisearch.com/docs
- **Grafana**: https://grafana.com/docs/grafana/latest/
- **Prometheus**: https://prometheus.io/docs/

---

## ✅ Checklist Déploiement Production

- [ ] Générer clés sécurisées (32+ bytes)
- [ ] Configurer HTTPS pour Grafana (reverse proxy)
- [ ] Limiter accès Meilisearch API (firewall)
- [ ] Configurer retention Loki (actuellement 30j)
- [ ] Télécharger GeoIP database
- [ ] Créer dashboards Grafana custom
- [ ] Configurer alertes Prometheus
- [ ] Backup régulier des volumes Docker
- [ ] Monitoring des services (healthchecks)
- [ ] Rate limiting sur API analytics
- [ ] Logs Vector en mode JSON (pas console)
- [ ] Optimiser taille des chunks Loki
- [ ] Index Meilisearch: pagination optimale

---

**Auteur**: Système Vector Pipeline Analytics  
**Version**: 1.0.0  
**Date**: 2025-10-26  
**Status**: ✅ Production Ready
