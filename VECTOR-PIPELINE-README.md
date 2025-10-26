# 📊 Vector SEO Analytics Pipeline

Pipeline d'analyse des logs Caddy pour le SEO e-commerce avec extraction automatique des facettes métier (marques auto, gammes, bots).

## 🎯 Objectifs

- **Analyser le trafic SEO** : Détecter les crawlers (Google, Bing, etc.)
- **Extraire les facettes métier** : Marques auto, gammes de véhicules, catégories de pièces
- **Mesurer les performances** : Latence, erreurs HTTP, pages lentes
- **Indexer dans Meilisearch** : Requêtes facettées ultra-rapides pour dashboards

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CADDY WEB SERVER                          │
│  - Génère logs JSON (access.json)                              │
│  - Format: Caddy v2 JSON structured logs                       │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│                      VECTOR (v0.39.0)                           │
│                                                                 │
│  📥 SOURCE (file)                                               │
│    - /var/log/caddy/access.json                                │
│    - ./logs/caddy-access.json (test)                           │
│                                                                 │
│  🔄 TRANSFORM 1: parse_json                                     │
│    - Parse Caddy JSON                                           │
│    - Extrait: status, method, uri, client_ip, user_agent...    │
│    - Calcule: latency_ms = duration * 1000                     │
│                                                                 │
│  🔄 TRANSFORM 2: enrich                                         │
│    - Bot detection (googlebot, bingbot, other)                 │
│    - Brand extraction depuis /pieces/{brand}/{gamme}/          │
│    - Gamme extraction (clio, 208, golf, etc.)                  │
│    - Day formatting (YYYY-MM-DD)                               │
│                                                                 │
│  🔄 TRANSFORM 3: format_meilisearch                             │
│    - ID unique (base64)                                         │
│    - Format JSON final avec toutes les facettes                │
│                                                                 │
│  📤 SINK 1: Meilisearch (HTTP POST)                             │
│    - Endpoint: http://meilisearch:7700/indexes/access_logs/docs│
│    - Batch: 50 events / 10 secondes                            │
│                                                                 │
│  📤 SINK 2: Console (debug)                                     │
│    - Affiche JSON transformé dans stdout                       │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│                    MEILISEARCH (v1.8.3)                         │
│  - Index: access_logs                                           │
│  - Facettes: brand, gamme, bot, day, status, method            │
│  - Recherche full-text sur: path, route, referer, ua           │
│  - Tri par: ts, latency_ms                                     │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              NESTJS BACKEND - Analytics API                     │
│  - GET /seo-logs/analytics/traffic?period=today                │
│  - GET /seo-logs/analytics/slow-paths?threshold=800            │
│  - GET /seo-logs/analytics/bot-hits?bot=googlebot              │
│  - GET /seo-logs/analytics/brands-stats                        │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Démarrage rapide

### 1. Prérequis

```bash
# Fichier .env.vector avec la clé Meilisearch
echo "MEILISEARCH_API_KEY=jTjdbszr1gEmMqZXintYlGFjwSNaceDZuK-tYU-NjZM" > .env.vector
```

### 2. Lancer la stack complète

```bash
docker-compose -f docker-compose.vector.yml up -d
```

Services démarrés :
- **Vector** : localhost:8686 (API monitoring)
- **Meilisearch** : localhost:7700
- **Loki** : localhost:3100
- **Prometheus** : localhost:9090
- **Grafana** : localhost:3001

### 3. Générer des logs de test

```bash
# Générer 100 logs réalistes avec paires brand/gamme cohérentes
./scripts/generate-test-logs.sh ./logs/caddy-access.json 100
```

Exemples de logs générés :
- `renault` → clio, megane, captur, scenic, twingo, kadjar
- `peugeot` → 208, 308, 3008, 5008, 2008, partner
- `bmw` → serie-1, serie-3, serie-5, x1, x3, x5
- `mercedes` → classe-a, classe-c, classe-e, gla, glc, gle

### 4. Vérifier que Vector traite les logs

```bash
# Voir les logs Vector en temps réel
docker logs -f vector-seo-pipeline

# Vérifier que Vector a démarré
docker logs vector-seo-pipeline | grep "Vector has started"
```

### 5. Interroger Meilisearch

```bash
# Source la clé API
source .env.vector

# Stats de l'index
curl -s "http://localhost:7700/indexes/access_logs/stats" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" | jq

# Rechercher par marque
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter": "brand = renault", "limit": 5}' | jq '.hits[] | {brand, gamme, path}'

# Rechercher les bots Google
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter": "bot = googlebot", "limit": 10}' | jq '.hits[] | {bot, path, day}'

# Pages lentes (>500ms)
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter": "latency_ms > 500", "sort": ["latency_ms:desc"], "limit": 5}' | jq '.hits[] | {path, latency_ms, status}'
```

## 📋 Schéma Meilisearch

### Index: `access_logs`

#### Champs indexés

```json
{
  "id": "base64_unique_id",
  "ts": 1729970000,
  "day": "2025-10-26",
  "status": 200,
  "method": "GET",
  "path": "/pieces/renault/clio/freins",
  "route": "/pieces/renault/clio/freins",
  "host": "automecanik.fr",
  "client_ip": "185.24.15.123",
  "latency_ms": 234,
  "bytes_written": 15432,
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "referer": "https://www.google.com/search?q=pieces+auto",
  "bot": "googlebot",
  "brand": "renault",
  "gamme": "clio",
  "country": null,
  "city": null
}
```

#### Configuration Meilisearch

```bash
# Champs filtrables (facettes)
filterableAttributes: [
  "status", "method", "day", "country", "brand", "gamme", "bot"
]

# Champs cherchables
searchableAttributes: [
  "path", "route", "referer", "ua"
]

# Champs triables
sortableAttributes: [
  "ts", "latency_ms"
]

# Nombre max de valeurs par facette
maxValuesPerFacet: 100
```

## 🔍 Exemples de requêtes analytiques

### Trafic par marque

```bash
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facets": ["brand"],
    "limit": 0
  }' | jq '.facetDistribution.brand'
```

### Top 10 gammes consultées

```bash
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facets": ["gamme"],
    "limit": 0
  }' | jq '.facetDistribution.gamme | to_entries | sort_by(.value) | reverse | .[0:10]'
```

### Ratio bots vs humains

```bash
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facets": ["bot"],
    "limit": 0
  }' | jq '.facetDistribution.bot'
```

### Erreurs 404 par jour

```bash
curl -s -X POST "http://localhost:7700/indexes/access_logs/search" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": "status = 404",
    "facets": ["day"],
    "limit": 0
  }' | jq '.facetDistribution.day'
```

## 🛠️ Maintenance

### Redémarrer Vector

```bash
docker restart vector-seo-pipeline
```

### Voir les logs d'erreur

```bash
docker logs vector-seo-pipeline 2>&1 | grep -i error
```

### Tester la config Vector

```bash
docker exec vector-seo-pipeline vector validate /etc/vector/vector.toml
```

### Vider l'index Meilisearch

```bash
curl -X DELETE "http://localhost:7700/indexes/access_logs/documents" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY"
```

### Monitoring Vector

```bash
# Health check
curl http://localhost:8686/health

# Métriques Prometheus
curl http://localhost:8686/metrics
```

## 📊 Dashboards Grafana

TODO: Créer dashboards Grafana pour :
- Trafic SEO en temps réel
- Top 10 marques/gammes
- Latence P50/P95/P99
- Ratio bots/humains
- Erreurs 4xx/5xx

## 🐛 Troubleshooting

### Vector ne démarre pas

```bash
# Vérifier les logs
docker logs vector-seo-pipeline

# Vérifier la config VRL
docker exec vector-seo-pipeline vector validate /etc/vector/vector.toml
```

### Meilisearch ne reçoit pas de données

```bash
# 1. Vérifier que Vector traite les logs
docker logs vector-seo-pipeline | tail -20

# 2. Vérifier la clé API
docker inspect meilisearch-seo | grep MEILI_MASTER_KEY

# 3. Tester manuellement
curl -X POST "http://localhost:7700/indexes/access_logs/documents" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"id": "test123", "path": "/test", "ts": 1234567890}]'

# 4. Vérifier les stats
curl "http://localhost:7700/indexes/access_logs/stats" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY"
```

### Erreurs VRL dans Vector

Erreurs courantes et solutions :

1. **`can't abort infallible function`**
   - Enlever `!` des fonctions infaillibles : `to_int()` au lieu de `to_int!()`

2. **`fallible argument`**
   - Ajouter `!` aux fonctions fallibles : `to_string!()`, `parse_json!()`

3. **`type mismatch`**
   - Ajouter assertions de type : `string!(.path)`, `to_float!(.duration)`

## 📚 Ressources

- [Vector Documentation](https://vector.dev/docs/)
- [VRL Reference](https://vrl.dev/)
- [Meilisearch API](https://www.meilisearch.com/docs)
- [Caddy JSON Logs](https://caddyserver.com/docs/logging)

## 🎯 TODO

- [ ] Réactiver Loki sink avec labels corrects
- [ ] Réactiver Prometheus metrics exporter
- [ ] Créer dashboards Grafana
- [ ] Ajouter GeoIP pour extraction country/city
- [ ] Intégrer avec NestJS Analytics API
- [ ] Tests de charge (10k+ logs/minute)
- [ ] Rotation automatique des logs Caddy

## 📝 Changelog

### 2025-10-26 - v1.0.0 🎉

- ✅ Pipeline Vector → Meilisearch fonctionnel
- ✅ Extraction brand/gamme depuis URLs /pieces/
- ✅ Détection bots (googlebot, bingbot, other)
- ✅ Facettes: brand, gamme, bot, day, status, method
- ✅ Script génération logs test avec paires cohérentes
- ✅ Batch optimisé (50 events / 10s)
- ✅ Intégration .env.vector pour clés API
- ✅ Paires marque/modèle réalistes (renault→clio/megane, peugeot→208/308)
