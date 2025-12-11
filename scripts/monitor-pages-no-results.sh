#!/bin/bash

###############################################################################
# ðŸ›¡ï¸ MONITORING SEO - DÃ©tection Pages Sans Articles
# 
# Ce script vÃ©rifie que les pages produits retournent bien des articles
# pour Ã©viter les dÃ©sindexations SEO automatiques par le pipeline Vector
#
# Usage: ./monitor-pages-no-results.sh
###############################################################################

set -euo pipefail

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://localhost:5173}"
LOG_FILE="/tmp/seo-monitor-$(date +%Y%m%d-%H%M%S).log"
ALERT_THRESHOLD=0  # Nombre minimum de piÃ¨ces acceptables

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "ðŸ” DÃ©marrage du monitoring SEO - Pages sans articles"
echo "ðŸ“Š API: $API_BASE_URL"
echo "ðŸŒ Frontend: $FRONTEND_BASE_URL"
echo "ðŸ“ Logs: $LOG_FILE"
echo ""

# URLs critiques Ã  surveiller (format: typeId|pgId|url_frontend)
CRITICAL_URLS=(
  "19052|7|/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html"
  "55593|75|/pieces/filtres-a-huile-75/renault-23/clio-123/1-2-tce-55593.html"
  # Ajouter d'autres URLs critiques ici
)

ERRORS=0
WARNINGS=0
SUCCESS=0

for url_data in "${CRITICAL_URLS[@]}"; do
  IFS='|' read -r type_id pg_id frontend_url <<< "$url_data"
  
  echo -e "${YELLOW}VÃ©rification:${NC} typeId=$type_id, pgId=$pg_id"
  
  # 1. Test API Backend
  api_url="$API_BASE_URL/api/catalog/pieces/php-logic/$type_id/$pg_id"
  api_response=$(curl -s "$api_url" || echo '{"success":false}')
  
  piece_count=$(echo "$api_response" | jq -r '.data.count // 0' 2>/dev/null || echo "0")
  api_success=$(echo "$api_response" | jq -r '.success // false')
  
  echo "  ðŸ“¦ API Response: count=$piece_count, success=$api_success" | tee -a "$LOG_FILE"
  
  # 2. Validation
  if [[ "$api_success" == "false" ]]; then
    echo -e "  ${RED}âŒ ERREUR:${NC} API call failed pour typeId=$type_id, pgId=$pg_id" | tee -a "$LOG_FILE"
    ((ERRORS++))
    
    # Alert Vector
    cat << EOF | curl -X POST http://localhost:8686/api/logs \
      -H "Content-Type: application/json" \
      -d @- 2>/dev/null || true
{
  "level": "error",
  "message": "SEO: Page sans articles dÃ©tectÃ©e",
  "metadata": {
    "type_id": "$type_id",
    "pg_id": "$pg_id",
    "url": "$frontend_url",
    "piece_count": $piece_count,
    "risk": "dÃ©sindexation SEO",
    "service": "seo-monitor"
  }
}
EOF
    
  elif [[ "$piece_count" -le "$ALERT_THRESHOLD" ]]; then
    echo -e "  ${YELLOW}âš ï¸  WARNING:${NC} Seulement $piece_count piÃ¨ces (seuil: >$ALERT_THRESHOLD)" | tee -a "$LOG_FILE"
    ((WARNINGS++))
    
    # Alert Vector (warning)
    cat << EOF | curl -X POST http://localhost:8686/api/logs \
      -H "Content-Type: application/json" \
      -d @- 2>/dev/null || true
{
  "level": "warn",
  "message": "SEO: Page avec peu d'articles",
  "metadata": {
    "type_id": "$type_id",
    "pg_id": "$pg_id",
    "url": "$frontend_url",
    "piece_count": $piece_count,
    "threshold": $ALERT_THRESHOLD,
    "service": "seo-monitor"
  }
}
EOF
    
  else
    echo -e "  ${GREEN}âœ… OK:${NC} $piece_count piÃ¨ces trouvÃ©es" | tee -a "$LOG_FILE"
    ((SUCCESS++))
  fi
  
  echo ""
done

# RÃ©sumÃ©
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SUMÃ‰ DU MONITORING"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo -e "${GREEN}âœ… SuccÃ¨s:${NC} $SUCCESS"
echo -e "${YELLOW}âš ï¸  Warnings:${NC} $WARNINGS"
echo -e "${RED}âŒ Erreurs:${NC} $ERRORS"
echo "ðŸ“ Logs dÃ©taillÃ©s: $LOG_FILE"
echo ""

# Code de sortie
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}âŒ Ã‰CHEC: $ERRORS page(s) sans articles dÃ©tectÃ©e(s)${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}âš ï¸  ATTENTION: $WARNINGS page(s) avec peu d'articles${NC}"
  exit 0
else
  echo -e "${GREEN}âœ… SUCCÃˆS: Toutes les pages retournent des articles${NC}"
  exit 0
fi
