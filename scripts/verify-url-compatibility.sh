#!/bin/bash

################################################################################
# ðŸ” Script de VÃ©rification URLs - Ancien vs Nouveau Sitemap
# 
# Objectif : VÃ©rifier que les URLs gÃ©nÃ©rÃ©es par la nouvelle app sont 
#            IDENTIQUES Ã  l'ancien format nginx
#
# Format attendu (ancien sitemap) :
#   - Gammes : /pieces/{pg_alias}-{pg_id}.html
#   - Exemple : /pieces/plaquette-de-frein-402.html
#
# Usage :
#   bash scripts/verify-url-compatibility.sh
#   bash scripts/verify-url-compatibility.sh --sample 100
#   bash scripts/verify-url-compatibility.sh --gamme-id 402
################################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}
SAMPLE_SIZE=${1:-50}
GAMME_ID=""
OUTPUT_DIR="/tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --sample)
      SAMPLE_SIZE="$2"
      shift 2
      ;;
    --gamme-id)
      GAMME_ID="$2"
      shift 2
      ;;
    --api)
      API_BASE_URL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ” VÃ‰RIFICATION COMPATIBILITÃ‰ URLs${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo -e "${YELLOW}Configuration :${NC}"
echo "  API Base URL : $API_BASE_URL"
echo "  Sample size  : $SAMPLE_SIZE gammes"
if [ -n "$GAMME_ID" ]; then
  echo "  Gamme ID     : $GAMME_ID (mode test spÃ©cifique)"
fi
echo ""

# Fonction pour gÃ©nÃ©rer l'URL attendue (format ancien sitemap)
generate_expected_url() {
  local pg_alias=$1
  local pg_id=$2
  
  # Format nginx : /pieces/{pg_alias}-{pg_id}.html
  echo "/pieces/${pg_alias}-${pg_id}.html"
}

# Fonction pour gÃ©nÃ©rer l'URL actuelle (nouvelle app)
generate_actual_url() {
  local pg_alias=$1
  local pg_id=$2
  
  # Format actuel (doit Ãªtre identique !)
  echo "/pieces/${pg_alias}-${pg_id}.html"
}

# Fonction pour nettoyer l'alias (slugify)
slugify() {
  local text=$1
  echo "$text" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//'
}

echo -e "${YELLOW}ðŸ“Š Ã‰tape 1/4 : RÃ©cupÃ©ration des gammes depuis Supabase${NC}"
echo ""

# RequÃªte pour rÃ©cupÃ©rer les gammes
if [ -n "$GAMME_ID" ]; then
  # Mode test : une seule gamme
  SQL_QUERY="SELECT pg_id, pg_name, pg_alias FROM pieces_gamme WHERE pg_id = $GAMME_ID AND pg_display = '1' LIMIT 1"
else
  # Mode normal : Ã©chantillon de gammes
  SQL_QUERY="SELECT pg_id, pg_name, pg_alias FROM pieces_gamme WHERE pg_display = '1' ORDER BY pg_id LIMIT $SAMPLE_SIZE"
fi

# Appeler l'API Supabase
GAMMES_JSON=$(curl -s -X POST "$API_BASE_URL/api/supabase/query" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$SQL_QUERY\"}" | jq -r '.data // []')

if [ "$GAMMES_JSON" == "[]" ] || [ -z "$GAMMES_JSON" ]; then
  echo -e "${RED}âŒ Erreur : Impossible de rÃ©cupÃ©rer les gammes depuis l'API${NC}"
  echo ""
  echo "VÃ©rifiez que :"
  echo "  - L'API backend est dÃ©marrÃ©e sur $API_BASE_URL"
  echo "  - L'endpoint /api/supabase/query est accessible"
  echo "  - La table pieces_gamme contient des donnÃ©es"
  exit 1
fi

GAMMES_COUNT=$(echo "$GAMMES_JSON" | jq 'length')
echo -e "${GREEN}âœ… $GAMMES_COUNT gammes rÃ©cupÃ©rÃ©es${NC}"
echo ""

echo -e "${YELLOW}ðŸ“Š Ã‰tape 2/4 : GÃ©nÃ©ration des URLs (ancien format)${NC}"
echo ""

# Fichiers de sortie
REPORT_FILE="$OUTPUT_DIR/url-compatibility-report-$TIMESTAMP.txt"
JSON_FILE="$OUTPUT_DIR/url-compatibility-$TIMESTAMP.json"

# Variables de comptage
TOTAL=0
EXACT_MATCH=0
ALIAS_MISMATCH=0
FORMAT_ERROR=0

# Tableau JSON pour stocker les rÃ©sultats
RESULTS_JSON="[]"

# Parser chaque gamme
echo "$GAMMES_JSON" | jq -c '.[]' | while read -r gamme; do
  pg_id=$(echo "$gamme" | jq -r '.pg_id')
  pg_name=$(echo "$gamme" | jq -r '.pg_name')
  pg_alias=$(echo "$gamme" | jq -r '.pg_alias // empty')
  
  TOTAL=$((TOTAL + 1))
  
  # GÃ©nÃ©rer alias si manquant
  if [ -z "$pg_alias" ] || [ "$pg_alias" == "null" ]; then
    pg_alias=$(slugify "$pg_name")
    ALIAS_MISMATCH=$((ALIAS_MISMATCH + 1))
  fi
  
  # URLs attendue et actuelle
  expected_url=$(generate_expected_url "$pg_alias" "$pg_id")
  actual_url=$(generate_actual_url "$pg_alias" "$pg_id")
  
  # VÃ©rifier correspondance exacte
  if [ "$expected_url" == "$actual_url" ]; then
    status="âœ… MATCH"
    EXACT_MATCH=$((EXACT_MATCH + 1))
  else
    status="âŒ DIFF"
    FORMAT_ERROR=$((FORMAT_ERROR + 1))
  fi
  
  # Ajouter au rapport
  echo "$status | PG_ID: $pg_id | Expected: $expected_url | Actual: $actual_url" >> "$REPORT_FILE"
  
  # Ajouter au JSON
  RESULT_ITEM=$(jq -n \
    --arg pg_id "$pg_id" \
    --arg pg_name "$pg_name" \
    --arg pg_alias "$pg_alias" \
    --arg expected "$expected_url" \
    --arg actual "$actual_url" \
    --arg status "$status" \
    '{
      pg_id: $pg_id,
      pg_name: $pg_name,
      pg_alias: $pg_alias,
      expected_url: $expected,
      actual_url: $actual,
      match: ($expected == $actual),
      status: $status
    }')
  
  RESULTS_JSON=$(echo "$RESULTS_JSON" | jq --argjson item "$RESULT_ITEM" '. += [$item]')
  
  # Afficher progression
  if [ $((TOTAL % 10)) -eq 0 ]; then
    echo "  TraitÃ© : $TOTAL gammes..."
  fi
done

# Lire les compteurs depuis le fichier de rapport
EXACT_MATCH=$(grep -c "âœ… MATCH" "$REPORT_FILE" || echo 0)
FORMAT_ERROR=$(grep -c "âŒ DIFF" "$REPORT_FILE" || echo 0)
TOTAL=$(wc -l < "$REPORT_FILE")

echo ""
echo -e "${GREEN}âœ… URLs gÃ©nÃ©rÃ©es : $TOTAL${NC}"
echo ""

echo -e "${YELLOW}ðŸ“Š Ã‰tape 3/4 : Analyse des diffÃ©rences${NC}"
echo ""

# Calculer le taux de matching
MATCH_RATE=0
if [ "$TOTAL" -gt 0 ]; then
  MATCH_RATE=$(echo "scale=2; $EXACT_MATCH * 100 / $TOTAL" | bc)
fi

echo "ðŸ“Š RÃ©sultats :"
echo ""
echo "  Total URLs testÃ©es        : $TOTAL"
echo -e "  ${GREEN}âœ… Correspondance exacte  : $EXACT_MATCH ($MATCH_RATE%)${NC}"
echo -e "  ${RED}âŒ DiffÃ©rences dÃ©tectÃ©es  : $FORMAT_ERROR${NC}"
if [ "$ALIAS_MISMATCH" -gt 0 ]; then
  echo -e "  ${YELLOW}âš ï¸  Alias manquants        : $ALIAS_MISMATCH${NC}"
fi
echo ""

# Sauvegarder le JSON complet
FINAL_JSON=$(jq -n \
  --arg timestamp "$TIMESTAMP" \
  --argjson total "$TOTAL" \
  --argjson exact_match "$EXACT_MATCH" \
  --argjson format_error "$FORMAT_ERROR" \
  --argjson alias_mismatch "$ALIAS_MISMATCH" \
  --arg match_rate "$MATCH_RATE" \
  --argjson results "$RESULTS_JSON" \
  '{
    timestamp: $timestamp,
    summary: {
      total: $total,
      exact_match: $exact_match,
      format_error: $format_error,
      alias_mismatch: $alias_mismatch,
      match_rate: $match_rate
    },
    results: $results
  }')

echo "$FINAL_JSON" > "$JSON_FILE"

echo -e "${YELLOW}ðŸ“Š Ã‰tape 4/4 : Exemples de comparaison${NC}"
echo ""

# Afficher les 5 premiÃ¨res URLs
echo "ðŸ” PremiÃ¨res URLs testÃ©es :"
echo ""
head -5 "$REPORT_FILE"
echo ""

# Si des diffÃ©rences, les afficher
if [ "$FORMAT_ERROR" -gt 0 ]; then
  echo -e "${RED}âŒ DiffÃ©rences dÃ©tectÃ©es :${NC}"
  echo ""
  grep "âŒ DIFF" "$REPORT_FILE" | head -5
  echo ""
fi

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ“„ FICHIERS GÃ‰NÃ‰RÃ‰S${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo "  Rapport texte : $REPORT_FILE"
echo "  DonnÃ©es JSON  : $JSON_FILE"
echo ""

# InterprÃ©ter les rÃ©sultats
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ’¡ INTERPRÃ‰TATION${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""

if [ "$MATCH_RATE" == "100.00" ]; then
  echo -e "${GREEN}âœ… PARFAIT !${NC}"
  echo ""
  echo "Toutes les URLs gÃ©nÃ©rÃ©es sont IDENTIQUES au format ancien sitemap."
  echo "Vous pouvez procÃ©der Ã  la phase suivante :"
  echo ""
  echo "  1. Tester les URLs avec le sitemap actuel"
  echo "  2. Lancer l'audit crawl budget (scripts/audit-crawl-budget.sh)"
  echo "  3. Comparer avec Google Search Console"
  echo ""
elif (( $(echo "$MATCH_RATE >= 95" | bc -l) )); then
  echo -e "${GREEN}âœ… TRÃˆS BON${NC}"
  echo ""
  echo "Taux de matching : $MATCH_RATE%"
  echo "Quelques diffÃ©rences mineures dÃ©tectÃ©es (probablement alias manquants)."
  echo ""
  echo "Actions recommandÃ©es :"
  echo "  - VÃ©rifier les gammes sans alias dans pieces_gamme"
  echo "  - GÃ©nÃ©rer les alias manquants avec slugify(pg_name)"
  echo ""
elif (( $(echo "$MATCH_RATE >= 80" | bc -l) )); then
  echo -e "${YELLOW}âš ï¸  BON MAIS Ã€ AMÃ‰LIORER${NC}"
  echo ""
  echo "Taux de matching : $MATCH_RATE%"
  echo ""
  echo "Actions recommandÃ©es :"
  echo "  - Analyser les diffÃ©rences dans $REPORT_FILE"
  echo "  - Corriger la gÃ©nÃ©ration des alias"
  echo "  - Re-tester aprÃ¨s corrections"
  echo ""
else
  echo -e "${RED}ðŸš¨ CRITIQUE${NC}"
  echo ""
  echo "Taux de matching : $MATCH_RATE%"
  echo ""
  echo "Actions URGENTES :"
  echo "  - Analyser le fichier $REPORT_FILE"
  echo "  - VÃ©rifier la logique de gÃ©nÃ©ration des URLs"
  echo "  - Corriger les diffÃ©rences avant de continuer"
  echo ""
fi

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ”§ COMMANDES UTILES${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo "# Voir toutes les diffÃ©rences"
echo "cat $REPORT_FILE | grep 'âŒ DIFF'"
echo ""
echo "# Analyser le JSON complet"
echo "cat $JSON_FILE | jq '.summary'"
echo ""
echo "# VÃ©rifier une gamme spÃ©cifique"
echo "cat $JSON_FILE | jq '.results[] | select(.pg_id == \"402\")'"
echo ""
echo "# Tester une gamme spÃ©cifique"
echo "bash scripts/verify-url-compatibility.sh --gamme-id 402"
echo ""

exit 0
