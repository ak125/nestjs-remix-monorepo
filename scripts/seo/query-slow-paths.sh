#!/bin/bash

# ============================================
# Top chemins lents (> seuil latence)
# ============================================

MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_KEY="masterKey"
INDEX="access_logs"

# Couleurs
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# ParamÃ¨tres
THRESHOLD=${1:-800}   # Seuil en ms (dÃ©faut: 800ms)
LIMIT=${2:-50}        # Nombre de rÃ©sultats (dÃ©faut: 50)
DAY=${3:-$(date +%Y-%m-%d)}  # Jour (dÃ©faut: aujourd'hui)

echo -e "${RED}ï¿½ï¿½ Chemins lents (> ${THRESHOLD}ms) - ${DAY}${NC}\n"

# RequÃªte Meilisearch
curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"latency_ms >= ${THRESHOLD} AND day = \\\"${DAY}\\\"\",
    \"limit\": 1000,
    \"sort\": [\"latency_ms:desc\"],
    \"attributesToRetrieve\": [
      \"path\",
      \"route\",
      \"latency_ms\",
      \"status\",
      \"method\",
      \"brand\",
      \"gamme\",
      \"country\",
      \"bot\",
      \"ts\"
    ],
    \"facets\": [\"route\", \"brand\", \"status\", \"method\"]
  }" | jq -r --arg limit "$LIMIT" '

# Calculs statistiques
def stats:
  {
    count: length,
    avg: (map(.latency_ms) | add / length | floor),
    min: (map(.latency_ms) | min),
    max: (map(.latency_ms) | max),
    p50: (map(.latency_ms) | sort | .[((length * 0.50) | floor)]),
    p95: (map(.latency_ms) | sort | .[((length * 0.95) | floor)]),
    p99: (map(.latency_ms) | sort | .[((length * 0.99) | floor)])
  };

# En-tÃªte
"â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•",
"  LATENCY   PATH                                              STATUS  METHOD  BRAND       GAMME      COUNTRY",
"â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•",

# Top N chemins les plus lents
(.hits[0:($limit | tonumber)] | .[] |
  [
    ((.latency_ms | tostring) + "ms" | ljust(9)),
    (.path // "-" | .[0:50] | ljust(50)),
    (.status | tostring | ljust(6)),
    (.method // "-" | ljust(6)),
    (.brand // "-" | .[0:11] | ljust(11)),
    (.gamme // "-" | .[0:10] | ljust(10)),
    (.country // "-")
  ] |
  "  \(.[0])  \(.[1])  \(.[2])  \(.[3])  \(.[4])  \(.[5])  \(.[6])"
),

"â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•",
"",
"ðŸ“Š STATISTIQUES GLOBALES:",
"",
("Total chemins lents: \(.estimatedTotalHits)"),
("Processing time: \(.processingTimeMs)ms"),
"",
("Latence moyenne: \(.hits | map(.latency_ms) | add / length | floor)ms"),
("Latence mÃ©diane (p50): \(.hits | map(.latency_ms) | sort | .[((length * 0.50) | floor)])ms"),
("Latence p95: \(.hits | map(.latency_ms) | sort | .[((length * 0.95) | floor)])ms"),
("Latence p99: \(.hits | map(.latency_ms) | sort | .[((length * 0.99) | floor)])ms"),
("Latence max: \(.hits | map(.latency_ms) | max)ms"),
"",
"ðŸ”¥ TOP 10 ROUTES LES PLUS LENTES (par route pattern):",
"",
([.hits | group_by(.route) | .[] | {
  route: (.[0].route // "unknown"),
  count: length,
  avg_latency: (map(.latency_ms) | add / length | floor),
  p95: (map(.latency_ms) | sort | .[((length * 0.95) | floor)]),
  max: (map(.latency_ms) | max)
}] | sort_by(-.avg_latency) | .[0:10] | .[] |
  "  \(.route | ljust(40))  Avg: \(.avg_latency)ms  P95: \(.p95)ms  Max: \(.max)ms  (\(.count) hits)"
),
"",
"ðŸš— TOP 5 BRANDS LES PLUS LENTS:",
"",
(.facetDistribution.brand | to_entries | sort_by(-.value) | .[0:5] | .[] |
  "  - \(.key): \(.value) chemins lents"
),
"",
"ðŸ“ˆ PAR STATUT HTTP:",
"",
(.facetDistribution.status | to_entries | sort_by(.key) | .[] |
  "  - \(.key): \(.value) chemins"
),
"",
"ðŸ”§ PAR MÃ‰THODE:",
"",
(.facetDistribution.method | to_entries | sort_by(-.value) | .[] |
  "  - \(.key): \(.value) chemins"
),
""
'

echo -e "\n${GREEN}âœ… Analyse terminÃ©e${NC}\n"

# Aide
cat << 'HELP'
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
USAGE:
  ./query-slow-paths.sh [THRESHOLD_MS] [LIMIT] [DAY]

EXEMPLES:
  ./query-slow-paths.sh                      # > 800ms aujourd'hui (top 50)
  ./query-slow-paths.sh 500                  # > 500ms aujourd'hui (top 50)
  ./query-slow-paths.sh 1000 100             # > 1000ms aujourd'hui (top 100)
  ./query-slow-paths.sh 800 50 2025-10-25    # > 800ms le 25 oct (top 50)
  ./query-slow-paths.sh 300 200              # > 300ms aujourd'hui (top 200)

SEUILS RECOMMANDÃ‰S:
  - 300ms  : Chemins "moyens" Ã  surveiller
  - 500ms  : Chemins "lents" Ã  optimiser
  - 800ms  : Chemins "trÃ¨s lents" (dÃ©faut)
  - 1000ms : Chemins "critiques" (1s+)
  - 2000ms : Chemins "catastrophiques" (2s+)

ACTIONS POSSIBLES:
  1. Identifier routes rÃ©currentes (pattern /pieces/:brand/:gamme)
  2. VÃ©rifier si DB queries lentes sur certaines marques
  3. Analyser si latence liÃ©e Ã  pays (GeoIP overhead?)
  4. Comparer GET vs POST (API endpoints vs pages)
  5. CorrÃ©ler avec statut 5xx (erreurs ralentissent?)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
HELP

