#!/bin/bash

# ============================================
# Lister tous les hits de bots
# ============================================

MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_KEY="masterKey"
INDEX="access_logs"

# Couleurs
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Paramètres (modifiables)
LIMIT=${1:-100}      # Nombre de résultats (défaut: 100)
OFFSET=${2:-0}       # Pagination (défaut: 0)
BOT_NAME=${3:-""}    # Filtrer par bot spécifique (optionnel)

echo -e "${YELLOW}🤖 Listing bot hits...${NC}\n"

# Construction du filtre
if [ -n "$BOT_NAME" ]; then
  FILTER="bot = \"${BOT_NAME}\""
  echo -e "${BLUE}Filtre: ${BOT_NAME}${NC}\n"
else
  FILTER="bot EXISTS"
  echo -e "${BLUE}Filtre: Tous les bots${NC}\n"
fi

# Requête Meilisearch
curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${FILTER}\",
    \"limit\": ${LIMIT},
    \"offset\": ${OFFSET},
    \"sort\": [\"ts:desc\"],
    \"attributesToRetrieve\": [
      \"ts\",
      \"bot\",
      \"path\",
      \"status\",
      \"method\",
      \"brand\",
      \"gamme\",
      \"country\",
      \"latency_ms\",
      \"referer\"
    ],
    \"facets\": [\"bot\", \"status\", \"brand\", \"country\"]
  }" | jq -r '

# En-tête du tableau
"════════════════════════════════════════════════════════════════════════════════════════════════════",
"  TIME        BOT              PATH                                      STATUS  LATENCY  COUNTRY",
"════════════════════════════════════════════════════════════════════════════════════════════════════",

# Lignes de données
(.hits[] | 
  [
    (.ts | tonumber | strftime("%H:%M:%S")),
    (.bot // "-" | .[0:15]),
    (.path // "-" | .[0:45]),
    (.status | tostring),
    ((.latency_ms | tostring) + "ms"),
    (.country // "-")
  ] | 
  "  \(.[0])  \(.[1] | ljust(15))  \(.[2] | ljust(45))  \(.[3] | ljust(6))  \(.[4] | ljust(7))  \(.[5])"
),

"════════════════════════════════════════════════════════════════════════════════════════════════════",
"",
"📊 STATISTIQUES:",
"",
"Total hits: \(.estimatedTotalHits)",
"Processing time: \(.processingTimeMs)ms",
"",
"🤖 Par bot:",
(.facetDistribution.bot | to_entries | sort_by(-.value) | .[] | "  - \(.key): \(.value) hits"),
"",
"🌍 Par pays:",
(.facetDistribution.country | to_entries | sort_by(-.value) | .[0:5] | .[] | "  - \(.key): \(.value) hits"),
"",
"📈 Par statut:",
(.facetDistribution.status | to_entries | sort_by(.key) | .[] | "  - \(.key): \(.value) hits"),
""
'

echo -e "\n${GREEN}✅ Requête terminée${NC}\n"

# Aide
cat << 'HELP'
═══════════════════════════════════════════════════════════════
USAGE:
  ./query-bot-hits.sh [LIMIT] [OFFSET] [BOT_NAME]

EXEMPLES:
  ./query-bot-hits.sh                    # 100 derniers hits (tous bots)
  ./query-bot-hits.sh 50                 # 50 derniers hits
  ./query-bot-hits.sh 50 100             # 50 hits à partir du 100ème
  ./query-bot-hits.sh 200 0 googlebot    # 200 hits de Googlebot uniquement
  ./query-bot-hits.sh 100 0 bingbot      # 100 hits de Bingbot

BOTS DISPONIBLES:
  googlebot, bingbot, slurp (Yahoo), duckduckbot, baiduspider,
  yandexbot, semrushbot, ahrefsbot, dotbot, mj12bot, screaming frog,
  serpstatbot, dataforseobot, petalbot, facebookexternalhit
═══════════════════════════════════════════════════════════════
HELP

