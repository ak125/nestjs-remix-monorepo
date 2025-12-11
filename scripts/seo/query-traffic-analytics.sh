#!/bin/bash

# ============================================
# Analytics trafic par brand/gamme/country/bot
# ============================================

MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_KEY="masterKey"
INDEX="access_logs"

# Couleurs
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# ParamÃ¨tres
PERIOD=${1:-"today"}     # today, yesterday, 7days, 30days, custom
CUSTOM_DAY=${2:-""}      # Si period=custom, spÃ©cifier YYYY-MM-DD

echo -e "${CYAN}ðŸ“Š ANALYTICS TRAFIC E-COMMERCE${NC}\n"

# Calcul pÃ©riode
case $PERIOD in
  "today")
    DAY_FILTER="day = \"$(date +%Y-%m-%d)\""
    PERIOD_LABEL="Aujourd'hui ($(date +%Y-%m-%d))"
    ;;
  "yesterday")
    DAY_FILTER="day = \"$(date -d yesterday +%Y-%m-%d)\""
    PERIOD_LABEL="Hier ($(date -d yesterday +%Y-%m-%d))"
    ;;
  "7days")
    DAY_FILTER="day >= \"$(date -d '7 days ago' +%Y-%m-%d)\""
    PERIOD_LABEL="7 derniers jours"
    ;;
  "30days")
    DAY_FILTER="day >= \"$(date -d '30 days ago' +%Y-%m-%d)\""
    PERIOD_LABEL="30 derniers jours"
    ;;
  "custom")
    if [ -z "$CUSTOM_DAY" ]; then
      echo "Erreur: SpÃ©cifier un jour (YYYY-MM-DD) pour period=custom"
      exit 1
    fi
    DAY_FILTER="day = \"${CUSTOM_DAY}\""
    PERIOD_LABEL="Jour spÃ©cifique (${CUSTOM_DAY})"
    ;;
  *)
    echo "Erreur: Period invalide (today|yesterday|7days|30days|custom)"
    exit 1
    ;;
esac

echo -e "${BLUE}ðŸ“… PÃ©riode: ${PERIOD_LABEL}${NC}\n"

# ============================================
# 1. TRAFIC PAR BRAND
# ============================================
echo -e "${YELLOW}ðŸš— TOP BRANDS${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER} AND brand EXISTS\",
    \"facets\": [\"brand\"],
    \"limit\": 0
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  BRAND            HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  .facetDistribution.brand | 
  to_entries | 
  sort_by(-.value) | 
  .[0:15] |
  (map(.value) | add) as $total |
  .[] | 
  "â”‚  \(.key | ljust(15))  \(.value | tostring | ljust(8))  \(((.value / $total * 100) | floor | tostring) + "%" | ljust(10)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 2. TRAFIC PAR GAMME (TOP MODÃˆLES)
# ============================================
echo -e "\n${YELLOW}ðŸŽï¸  TOP GAMMES (MODÃˆLES)${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER} AND gamme EXISTS\",
    \"facets\": [\"gamme\"],
    \"limit\": 0
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  GAMME            HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  .facetDistribution.gamme | 
  to_entries | 
  sort_by(-.value) | 
  .[0:15] |
  (map(.value) | add) as $total |
  .[] | 
  "â”‚  \(.key | ljust(15))  \(.value | tostring | ljust(8))  \(((.value / $total * 100) | floor | tostring) + "%" | ljust(10)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 3. TRAFIC PAR PAYS
# ============================================
echo -e "\n${YELLOW}ðŸŒ DISTRIBUTION GÃ‰OGRAPHIQUE${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER} AND country EXISTS\",
    \"facets\": [\"country\"],
    \"limit\": 0
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  PAYS             HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  .facetDistribution.country | 
  to_entries | 
  sort_by(-.value) | 
  .[0:10] |
  (map(.value) | add) as $total |
  .[] | 
  "â”‚  \(.key | ljust(15))  \(.value | tostring | ljust(8))  \(((.value / $total * 100) | floor | tostring) + "%" | ljust(10)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 4. MATRICE BRAND x GAMME (TOP COMBOS)
# ============================================
echo -e "\n${YELLOW}ðŸ”¥ TOP COMBINAISONS BRAND + GAMME${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER} AND brand EXISTS AND gamme EXISTS\",
    \"limit\": 1000,
    \"attributesToRetrieve\": [\"brand\", \"gamme\"]
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  BRAND + GAMME                        HITS        â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  [.hits | group_by("\(.brand)|\(.gamme)") | .[] | {
    combo: (.[0].brand + " " + .[0].gamme),
    hits: length
  }] |
  sort_by(-.hits) | 
  .[0:15] | 
  .[] | 
  "â”‚  \(.combo | ljust(35))  \(.hits | tostring | ljust(11)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 5. TRAFIC BOTS vs HUMAINS
# ============================================
echo -e "\n${YELLOW}ðŸ¤– TRAFIC BOTS vs HUMAINS${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER}\",
    \"facets\": [\"bot\"],
    \"limit\": 0
  }" | jq -r '
(.facetDistribution.bot // {} | to_entries | map(.value) | add // 0) as $bot_hits |
(.estimatedTotalHits - $bot_hits) as $human_hits |

"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  TYPE             HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
"â”‚  Humains          \($human_hits | tostring | ljust(8))  \((($human_hits / .estimatedTotalHits * 100) | floor | tostring) + "%" | ljust(10)) â”‚",
"â”‚  Bots             \($bot_hits | tostring | ljust(8))  \((($bot_hits / .estimatedTotalHits * 100) | floor | tostring) + "%" | ljust(10)) â”‚",
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜",
"",
"Top Bots:",
(.facetDistribution.bot | to_entries | sort_by(-.value) | .[0:5] | .[] | "  - \(.key): \(.value) hits")
'

# ============================================
# 6. STATUTS HTTP
# ============================================
echo -e "\n${YELLOW}ðŸ“ˆ DISTRIBUTION STATUTS HTTP${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER}\",
    \"facets\": [\"status\"],
    \"limit\": 0
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  STATUS           HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  .facetDistribution.status | 
  to_entries | 
  sort_by(.key | tonumber) |
  (map(.value) | add) as $total |
  .[] | 
  "â”‚  \(.key | ljust(15))  \(.value | tostring | ljust(8))  \(((.value / $total * 100) | floor | tostring) + "%" | ljust(10)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 7. MÃ‰THODES HTTP
# ============================================
echo -e "\n${YELLOW}ðŸ”§ DISTRIBUTION MÃ‰THODES HTTP${NC}"

curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
  -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"${DAY_FILTER}\",
    \"facets\": [\"method\"],
    \"limit\": 0
  }" | jq -r '
"â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
"â”‚  METHOD           HITS      % TRAFIC    â”‚",
"â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
(
  .facetDistribution.method | 
  to_entries | 
  sort_by(-.value) |
  (map(.value) | add) as $total |
  .[] | 
  "â”‚  \(.key | ljust(15))  \(.value | tostring | ljust(8))  \(((.value / $total * 100) | floor | tostring) + "%" | ljust(10)) â”‚"
),
"â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
'

# ============================================
# 8. TENDANCE JOURNALIÃˆRE (si pÃ©riode > 1 jour)
# ============================================
if [[ "$PERIOD" == "7days" ]] || [[ "$PERIOD" == "30days" ]]; then
  echo -e "\n${YELLOW}ðŸ“Š TENDANCE PAR JOUR${NC}"
  
  curl -s "${MEILISEARCH_URL}/indexes/${INDEX}/search" \
    -H "Authorization: Bearer ${MEILISEARCH_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"filter\": \"${DAY_FILTER}\",
      \"facets\": [\"day\"],
      \"limit\": 0
    }" | jq -r '
  "â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”",
  "â”‚  DATE           HITS          â”‚",
  "â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤",
  (
    .facetDistribution.day | 
    to_entries | 
    sort_by(.key) |
    .[] | 
    "â”‚  \(.key)      \(.value | tostring | ljust(12)) â”‚"
  ),
  "â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
  '
fi

echo -e "\n${GREEN}âœ… Analytics terminÃ©es${NC}\n"

# Aide
cat << 'HELP'
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
USAGE:
  ./query-traffic-analytics.sh [PERIOD] [CUSTOM_DAY]

PÃ‰RIODES:
  today      - Aujourd'hui (dÃ©faut)
  yesterday  - Hier
  7days      - 7 derniers jours
  30days     - 30 derniers jours
  custom     - Jour spÃ©cifique (nÃ©cessite CUSTOM_DAY)

EXEMPLES:
  ./query-traffic-analytics.sh                    # Aujourd'hui
  ./query-traffic-analytics.sh yesterday          # Hier
  ./query-traffic-analytics.sh 7days              # 7 jours
  ./query-traffic-analytics.sh 30days             # 30 jours
  ./query-traffic-analytics.sh custom 2025-10-20  # 20 octobre 2025

ANALYTICS FOURNIES:
  1. ðŸš— Top brands (Renault, Peugeot, BMW...)
  2. ðŸŽï¸  Top gammes (Clio, 208, Serie 3...)
  3. ðŸŒ Distribution gÃ©ographique (FR, BE, CH...)
  4. ðŸ”¥ Top combinaisons brand + gamme
  5. ðŸ¤– Trafic bots vs humains
  6. ðŸ“ˆ Distribution statuts HTTP
  7. ðŸ”§ Distribution mÃ©thodes HTTP
  8. ðŸ“Š Tendance journaliÃ¨re (si 7j/30j)

INSIGHTS BUSINESS:
  - Identifier produits stars pour stock
  - Optimiser SEO sur brands/gammes populaires
  - Cibler campagnes marketing par pays
  - DÃ©tecter erreurs 404 par produit
  - Analyser comportement bots SEO
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
HELP

