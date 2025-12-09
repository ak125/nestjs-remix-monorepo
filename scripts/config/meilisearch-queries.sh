#!/bin/bash

# ============================================
# RequÃªtes Meilisearch - SEO & E-commerce
# ============================================

MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_KEY="masterKey"  # Ã€ changer en production
INDEX="access_logs"

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# 1. Toutes les 404 d'hier sur /pieces/
# ============================================
echo -e "${YELLOW}ðŸ“Š 404 d'hier sur /pieces/${NC}"

YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"status = 404 AND day = \\\"${YESTERDAY}\\\"\",
    \"q\": \"/pieces/\",
    \"limit\": 100,
    \"sort\": [\"ts:desc\"],
    \"attributesToRetrieve\": [\"path\", \"brand\", \"gamme\", \"ts\", \"referer\", \"country\"]
  }" | jq '{
    total: .estimatedTotalHits,
    processing_ms: .processingTimeMs,
    hits: .hits | map({
      path: .path,
      brand: .brand,
      gamme: .gamme,
      time: (.ts | tonumber | strftime("%H:%M:%S")),
      country: .country,
      referer: .referer
    })
  }'

# ============================================
# 2. Top 10 brands par nombre de requÃªtes (aujourd'hui)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Top 10 brands (aujourd'hui)${NC}"

TODAY=$(date +%Y-%m-%d)

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"day = \\\"${TODAY}\\\"\",
    \"facets\": [\"brand\"],
    \"limit\": 0
  }" | jq '.facetDistribution.brand | to_entries | sort_by(-.value) | .[0:10] | map({brand: .key, requests: .value})'

# ============================================
# 3. Crawling Googlebot sur Renault Clio (7 derniers jours)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Googlebot sur Renault Clio (7j)${NC}"

SEVEN_DAYS_AGO=$(date -d "7 days ago" +%Y-%m-%d)

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"bot = \\\"googlebot\\\" AND brand = \\\"renault\\\" AND gamme = \\\"clio\\\" AND day >= \\\"${SEVEN_DAYS_AGO}\\\"\",
    \"limit\": 50,
    \"sort\": [\"ts:desc\"],
    \"attributesToRetrieve\": [\"path\", \"status\", \"day\", \"latency_ms\"]
  }" | jq '{
    total: .estimatedTotalHits,
    avg_latency: (.hits | map(.latency_ms) | add / length | floor),
    hits: .hits | map({
      path: .path,
      status: .status,
      day: .day,
      latency_ms: .latency_ms
    })
  }'

# ============================================
# 4. Erreurs 5xx par brand (derniÃ¨res 24h)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Erreurs 5xx par brand (24h)${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"status >= 500 AND day >= \\\"${YESTERDAY}\\\"\",
    \"facets\": [\"brand\", \"status\"],
    \"limit\": 20,
    \"attributesToRetrieve\": [\"path\", \"brand\", \"status\", \"latency_ms\"]
  }" | jq '{
    total: .estimatedTotalHits,
    by_brand: .facetDistribution.brand,
    by_status: .facetDistribution.status,
    recent_errors: .hits | map({
      path: .path,
      brand: .brand,
      status: .status,
      latency_ms: .latency_ms
    })
  }'

# ============================================
# 5. Top 10 gammes les plus crawlÃ©es (tous bots)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Top 10 gammes crawlÃ©es par bots${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"bot EXISTS\",
    \"facets\": [\"gamme\"],
    \"limit\": 0
  }" | jq '.facetDistribution.gamme | to_entries | sort_by(-.value) | .[0:10] | map({gamme: .key, crawls: .value})'

# ============================================
# 6. Distribution gÃ©ographique pour BMW (ce mois)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Distribution pays pour BMW (ce mois)${NC}"

THIS_MONTH=$(date +%Y-%m)

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"brand = \\\"bmw\\\" AND day CONTAINS \\\"${THIS_MONTH}\\\"\",
    \"facets\": [\"country\"],
    \"limit\": 0
  }" | jq '.facetDistribution.country | to_entries | sort_by(-.value) | map({country: .key, requests: .value})'

# ============================================
# 7. Latence moyenne par brand (aujourd'hui)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Latence moyenne par brand${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"day = \\\"${TODAY}\\\" AND brand EXISTS\",
    \"facets\": [\"brand\"],
    \"limit\": 1000,
    \"attributesToRetrieve\": [\"brand\", \"latency_ms\"]
  }" | jq '[.hits | group_by(.brand) | .[] | {
    brand: .[0].brand,
    avg_latency: (map(.latency_ms) | add / length | floor),
    count: length
  }] | sort_by(-.count)'

# ============================================
# 8. Top referers pour une gamme spÃ©cifique (Peugeot 208)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Top referers pour Peugeot 208${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"brand = \\\"peugeot\\\" AND gamme = \\\"208\\\"\",
    \"limit\": 100,
    \"attributesToRetrieve\": [\"referer\"]
  }" | jq '[.hits | map(.referer) | group_by(.) | .[] | {referer: .[0], count: length}] | sort_by(-.count) | .[0:10]'

# ============================================
# 9. ActivitÃ© bots par jour (7 derniers jours)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š ActivitÃ© bots par jour (7j)${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"bot EXISTS AND day >= \\\"${SEVEN_DAYS_AGO}\\\"\",
    \"facets\": [\"day\", \"bot\"],
    \"limit\": 0
  }" | jq '{
    by_day: .facetDistribution.day,
    by_bot: (.facetDistribution.bot | to_entries | sort_by(-.value) | map({bot: .key, crawls: .value}))
  }'

# ============================================
# 10. Routes les plus lentes (p95 latence)
# ============================================
echo -e "\n${YELLOW}ðŸ“Š Routes les plus lentes (p95)${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"day = \\\"${TODAY}\\\"\",
    \"limit\": 1000,
    \"sort\": [\"latency_ms:desc\"],
    \"attributesToRetrieve\": [\"route\", \"latency_ms\", \"status\"]
  }" | jq '[.hits | group_by(.route) | .[] | {
    route: .[0].route,
    p95_latency: (map(.latency_ms) | sort | .[((length * 0.95) | floor)]),
    avg_latency: (map(.latency_ms) | add / length | floor),
    count: length
  }] | sort_by(-.p95_latency) | .[0:10]'

echo -e "\n${GREEN}âœ… RequÃªtes terminÃ©es${NC}"
