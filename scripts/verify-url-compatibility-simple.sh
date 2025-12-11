#!/bin/bash

################################################################################
# ðŸ” Script de VÃ©rification URLs - Version SimplifiÃ©e
# 
# Utilise directement l'API de compatibilitÃ©
#
# Usage :
#   bash scripts/verify-url-compatibility-simple.sh
#   bash scripts/verify-url-compatibility-simple.sh 100
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
OUTPUT_DIR="/tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ” VÃ‰RIFICATION COMPATIBILITÃ‰ URLs${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo -e "${YELLOW}Configuration :${NC}"
echo "  API Base URL : $API_BASE_URL"
echo "  Sample size  : $SAMPLE_SIZE gammes"
echo ""

# Test connexion API
echo -e "${YELLOW}ðŸ“Š Test connexion API...${NC}"
if ! curl -s -f "$API_BASE_URL/api/seo/url-compatibility/report" > /dev/null; then
  echo -e "${RED}âŒ Erreur : API non accessible${NC}"
  echo ""
  echo "VÃ©rifiez que :"
  echo "  - Le backend est dÃ©marrÃ© sur $API_BASE_URL"
  echo "  - Le service UrlCompatibilityService est chargÃ©"
  echo ""
  exit 1
fi
echo -e "${GREEN}âœ… API accessible${NC}"
echo ""

# RÃ©cupÃ©rer rapport complet
echo -e "${YELLOW}ðŸ“Š Ã‰tape 1/3 : RÃ©cupÃ©ration du rapport complet${NC}"
REPORT=$(curl -s "$API_BASE_URL/api/seo/url-compatibility/report")

if [ -z "$REPORT" ]; then
  echo -e "${RED}âŒ Erreur : Rapport vide${NC}"
  exit 1
fi

echo "$REPORT" > "$OUTPUT_DIR/url-report-$TIMESTAMP.json"
echo -e "${GREEN}âœ… Rapport rÃ©cupÃ©rÃ©${NC}"
echo ""

# VÃ©rification dÃ©taillÃ©e
echo -e "${YELLOW}ðŸ“Š Ã‰tape 2/3 : VÃ©rification dÃ©taillÃ©e ($SAMPLE_SIZE gammes)${NC}"
VERIFICATION=$(curl -s "$API_BASE_URL/api/seo/url-compatibility/verify?type=gammes&sampleSize=$SAMPLE_SIZE")

if [ -z "$VERIFICATION" ]; then
  echo -e "${RED}âŒ Erreur : VÃ©rification vide${NC}"
  exit 1
fi

echo "$VERIFICATION" > "$OUTPUT_DIR/url-verification-$TIMESTAMP.json"
echo -e "${GREEN}âœ… VÃ©rification terminÃ©e${NC}"
echo ""

# Extraire statistiques
echo -e "${YELLOW}ðŸ“Š Ã‰tape 3/3 : Analyse des rÃ©sultats${NC}"
echo ""

TOTAL=$(echo "$VERIFICATION" | jq -r '.data.summary.total')
EXACT_MATCH=$(echo "$VERIFICATION" | jq -r '.data.summary.exact_match')
ALIAS_MISSING=$(echo "$VERIFICATION" | jq -r '.data.summary.alias_missing')
MATCH_RATE=$(echo "$VERIFICATION" | jq -r '.data.summary.match_rate')

TOTAL_GAMMES=$(echo "$REPORT" | jq -r '.data.gammes.total')
WITH_ALIAS=$(echo "$REPORT" | jq -r '.data.gammes.with_alias')
WITHOUT_ALIAS=$(echo "$REPORT" | jq -r '.data.gammes.without_alias')

echo "ðŸ“Š STATISTIQUES GLOBALES :"
echo ""
echo "  Total gammes            : $TOTAL_GAMMES"
echo "  Avec alias              : $WITH_ALIAS"
echo "  Sans alias              : $WITHOUT_ALIAS"
echo ""

echo "ðŸ“Š RÃ‰SULTATS VÃ‰RIFICATION :"
echo ""
echo "  URLs testÃ©es            : $TOTAL"
echo -e "  ${GREEN}âœ… Correspondance exacte : $EXACT_MATCH${NC}"
if [ "$ALIAS_MISSING" -gt 0 ]; then
  echo -e "  ${YELLOW}âš ï¸  Alias manquants       : $ALIAS_MISSING${NC}"
fi
echo -e "  ${BLUE}Taux matching           : $MATCH_RATE%${NC}"
echo ""

# Afficher exemples
echo -e "${YELLOW}ðŸ” EXEMPLES D'URLs GÃ‰NÃ‰RÃ‰ES :${NC}"
echo ""
echo "$REPORT" | jq -r '.data.gammes.sample_urls[]' | head -5
echo ""

# InterprÃ©ter rÃ©sultats
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ“„ FICHIERS GÃ‰NÃ‰RÃ‰S${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo "  Rapport complet   : $OUTPUT_DIR/url-report-$TIMESTAMP.json"
echo "  VÃ©rification      : $OUTPUT_DIR/url-verification-$TIMESTAMP.json"
echo ""

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ’¡ INTERPRÃ‰TATION${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""

if [ "$MATCH_RATE" == "100" ]; then
  echo -e "${GREEN}âœ… PARFAIT !${NC}"
  echo ""
  echo "Toutes les URLs gÃ©nÃ©rÃ©es sont IDENTIQUES au format ancien sitemap."
  echo ""
  echo "Prochaines Ã©tapes :"
  echo "  1. GÃ©nÃ©rer le sitemap : curl http://localhost:3000/api/sitemap/products.xml"
  echo "  2. Lancer audit crawl budget"
  echo "  3. CrÃ©er expÃ©rience A/B"
  echo ""
elif (( $(echo "$MATCH_RATE >= 95" | bc -l) )); then
  echo -e "${GREEN}âœ… EXCELLENT${NC}"
  echo ""
  echo "Taux de matching : $MATCH_RATE%"
  echo ""
  if [ "$WITHOUT_ALIAS" -gt 0 ]; then
    echo "Actions recommandÃ©es :"
    echo "  - $WITHOUT_ALIAS gammes sans alias dÃ©tectÃ©es"
    echo "  - GÃ©nÃ©rer alias manquants (voir guide)"
  fi
  echo ""
else
  echo -e "${YELLOW}âš ï¸  BON MAIS Ã€ AMÃ‰LIORER${NC}"
  echo ""
  echo "Taux de matching : $MATCH_RATE%"
  echo ""
  echo "Actions recommandÃ©es :"
  echo "  - Analyser les diffÃ©rences dans les fichiers JSON"
  echo "  - Corriger les alias manquants"
  echo "  - Re-tester aprÃ¨s corrections"
  echo ""
fi

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ”§ COMMANDES UTILES${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo "# Voir rapport complet"
echo "cat $OUTPUT_DIR/url-report-$TIMESTAMP.json | jq"
echo ""
echo "# Voir dÃ©tails vÃ©rification"
echo "cat $OUTPUT_DIR/url-verification-$TIMESTAMP.json | jq '.data.details[0:10]'"
echo ""
echo "# Tester avec plus de gammes"
echo "bash scripts/verify-url-compatibility-simple.sh 500"
echo ""

exit 0
