#!/bin/bash
# Attendre que Meilisearch soit prêt
echo "⏳ Attente Meilisearch..."
until curl -s http://localhost:7700/health > /dev/null; do
  sleep 2
done

echo "✅ Meilisearch prêt"

# Créer index access_logs
curl -X POST 'http://localhost:7700/indexes' \
  -H 'Authorization: Bearer masterKey' \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "uid": "access_logs",
    "primaryKey": "id"
  }'

# Configurer settings
curl -X PATCH 'http://localhost:7700/indexes/access_logs/settings' \
  -H 'Authorization: Bearer masterKey' \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "searchableAttributes": [
      "path",
      "route",
      "referer",
      "ua"
    ],
    "filterableAttributes": [
      "status",
      "method",
      "day",
      "country",
      "brand",
      "gamme",
      "bot"
    ],
    "sortableAttributes": [
      "ts",
      "latency_ms"
    ],
    "rankingRules": [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness"
    ],
    "displayedAttributes": [
      "*"
    ],
    "faceting": {
      "maxValuesPerFacet": 100
    }
  }'

echo "✅ Index Meilisearch configuré"
