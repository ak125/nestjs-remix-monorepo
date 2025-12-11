#!/bin/bash
# Init script pour Vector log pipeline

set -e

echo "ðŸš€ Initialisation Vector Log Pipeline..."

# 1. CrÃ©er les rÃ©pertoires nÃ©cessaires
echo "ðŸ“ CrÃ©ation rÃ©pertoires..."
mkdir -p geoip
mkdir -p grafana/provisioning/datasources
mkdir -p grafana/provisioning/dashboards
mkdir -p grafana/dashboards

# 2. TÃ©lÃ©charger GeoIP database (GeoLite2-City)
if [ ! -f "geoip/GeoLite2-City.mmdb" ]; then
  echo "ðŸ“¥ TÃ©lÃ©chargement GeoIP database..."
  echo "âš ï¸  Vous devez obtenir GeoLite2-City.mmdb depuis MaxMind"
  echo "    https://dev.maxmind.com/geoip/geolite2-free-geolocation-data"
  echo "    Placez le fichier dans: ./geoip/GeoLite2-City.mmdb"
else
  echo "âœ… GeoIP database dÃ©jÃ  prÃ©sente"
fi

# 3. CrÃ©er datasource Loki pour Grafana
cat > grafana/provisioning/datasources/loki.yml <<EOF
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
    version: 1
    editable: true
    jsonData:
      maxLines: 1000
      derivedFields:
        - datasourceUid: prometheus
          matcherRegex: "request_id=(\w+)"
          name: TraceID
          url: '\$\${__value.raw}'
EOF

# 4. CrÃ©er datasource Prometheus pour Grafana
cat > grafana/provisioning/datasources/prometheus.yml <<EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: false
    version: 1
    editable: true
    jsonData:
      timeInterval: 15s
EOF

# 5. CrÃ©er dashboard provisioning config
cat > grafana/provisioning/dashboards/dashboards.yml <<EOF
apiVersion: 1

providers:
  - name: 'SEO Logs'
    orgId: 1
    folder: 'SEO'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

# 6. CrÃ©er .env si n'existe pas
if [ ! -f ".env.vector" ]; then
  echo "ðŸ“ CrÃ©ation .env.vector..."
  cat > .env.vector <<EOF
# Environment
NODE_ENV=production

# Loki
LOKI_URL=http://loki:3100

# Meilisearch
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=masterKey_CHANGE_ME_IN_PRODUCTION

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin_CHANGE_ME_IN_PRODUCTION
GRAFANA_ROOT_URL=http://localhost:3001
EOF
  echo "âœ… .env.vector crÃ©Ã© (CHANGEZ LES MOTS DE PASSE!)"
else
  echo "âœ… .env.vector dÃ©jÃ  prÃ©sent"
fi

# 7. CrÃ©er index Meilisearch
echo "ðŸ“Š Configuration index Meilisearch..."
cat > init-meilisearch.sh <<'EOF'
#!/bin/bash
# Attendre que Meilisearch soit prÃªt
echo "â³ Attente Meilisearch..."
until curl -s http://localhost:7700/health > /dev/null; do
  sleep 2
done

echo "âœ… Meilisearch prÃªt"

# CrÃ©er index access_logs
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

echo "âœ… Index Meilisearch configurÃ©"
EOF

chmod +x init-meilisearch.sh

echo ""
echo "âœ… Initialisation terminÃ©e!"
echo ""
echo "ðŸ“ Prochaines Ã©tapes:"
echo "   1. TÃ©lÃ©charger GeoLite2-City.mmdb â†’ ./geoip/"
echo "   2. Ã‰diter .env.vector (changer mots de passe)"
echo "   3. Lancer: docker-compose -f docker-compose.vector.yml up -d"
echo "   4. ExÃ©cuter: ./init-meilisearch.sh (aprÃ¨s dÃ©marrage)"
echo ""
echo "ðŸŒ URLs:"
echo "   â€¢ Vector API: http://localhost:8686"
echo "   â€¢ Loki: http://localhost:3100"
echo "   â€¢ Grafana: http://localhost:3001"
echo "   â€¢ Meilisearch: http://localhost:7700"
echo "   â€¢ Prometheus: http://localhost:9090"
echo "   â€¢ Vector metrics: http://localhost:9598/metrics"
echo ""
