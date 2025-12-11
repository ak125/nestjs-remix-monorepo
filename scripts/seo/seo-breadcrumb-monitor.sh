#!/bin/bash

# ðŸ“Š Script de Monitoring SEO - Breadcrumbs & Rich Snippets
# VÃ©rification automatique des performances SEO

echo "ðŸ” MONITORING SEO - Breadcrumbs & Rich Snippets"
echo "==============================================="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
OUTPUT_DIR="./seo-monitoring-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/breadcrumb-check-$TIMESTAMP.json"

# CrÃ©er le dossier de rapports
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}ðŸ“‹ Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Rapport: $REPORT_FILE"
echo ""

# URLs Ã  tester
declare -a URLS=(
  "/constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html"
  "/pieces/freinage/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html"
  "/pieces/filtre-a-huile"
  "/blog/guide-achat"
)

# RÃ©sultats
TOTAL=0
SUCCESS=0
WARNINGS=0
ERRORS=0

# Fonction de test d'une URL
test_url() {
  local url="$1"
  local full_url="$BASE_URL$url"
  
  echo -e "${BLUE}ðŸ” Test: $url${NC}"
  
  # RÃ©cupÃ©rer le HTML
  HTML=$(curl -s "$full_url")
  
  # 1. VÃ©rifier prÃ©sence du breadcrumb Schema.org
  if echo "$HTML" | grep -q '"@type":"BreadcrumbList"'; then
    echo -e "  ${GREEN}âœ“${NC} Schema.org BreadcrumbList trouvÃ©"
    
    # Extraire et valider le JSON-LD
    BREADCRUMB_JSON=$(echo "$HTML" | grep -oP '(?<=<script type="application/ld\+json">).*?BreadcrumbList.*?(?=</script>)' | head -1)
    
    if [ ! -z "$BREADCRUMB_JSON" ]; then
      # Valider le JSON
      if echo "$BREADCRUMB_JSON" | jq . > /dev/null 2>&1; then
        echo -e "  ${GREEN}âœ“${NC} JSON-LD valide"
        
        # Compter les Ã©lÃ©ments
        ITEM_COUNT=$(echo "$BREADCRUMB_JSON" | jq '.itemListElement | length')
        echo -e "  ${GREEN}âœ“${NC} Nombre de niveaux: $ITEM_COUNT"
        
        # VÃ©rifier que chaque position est sÃ©quentielle
        POSITIONS=$(echo "$BREADCRUMB_JSON" | jq -r '.itemListElement[].position')
        EXPECTED=1
        SEQUENTIAL=true
        for POS in $POSITIONS; do
          if [ "$POS" -ne "$EXPECTED" ]; then
            SEQUENTIAL=false
            echo -e "  ${RED}âœ—${NC} Positions non-sÃ©quentielles (attendu: $EXPECTED, trouvÃ©: $POS)"
            ((WARNINGS++))
          fi
          ((EXPECTED++))
        done
        
        if [ "$SEQUENTIAL" = true ]; then
          echo -e "  ${GREEN}âœ“${NC} Positions sÃ©quentielles"
        fi
        
        # VÃ©rifier URLs absolues
        HAS_RELATIVE=$(echo "$BREADCRUMB_JSON" | jq -r '.itemListElement[].item' | grep -c '^/')
        if [ "$HAS_RELATIVE" -gt 0 ]; then
          echo -e "  ${YELLOW}âš ${NC}  URLs relatives dÃ©tectÃ©es (devrait Ãªtre absolu)"
          ((WARNINGS++))
        else
          echo -e "  ${GREEN}âœ“${NC} URLs absolues"
        fi
        
        ((SUCCESS++))
      else
        echo -e "  ${RED}âœ—${NC} JSON-LD invalide"
        ((ERRORS++))
      fi
    fi
  else
    echo -e "  ${RED}âœ—${NC} Schema.org BreadcrumbList non trouvÃ©"
    ((ERRORS++))
  fi
  
  # 2. VÃ©rifier breadcrumb visuel HTML
  if echo "$HTML" | grep -q 'itemScope.*itemType.*BreadcrumbList'; then
    echo -e "  ${GREEN}âœ“${NC} Breadcrumb HTML avec microdonnÃ©es"
    ((SUCCESS++))
  else
    echo -e "  ${YELLOW}âš ${NC}  Breadcrumb HTML sans microdonnÃ©es"
    ((WARNINGS++))
  fi
  
  # 3. VÃ©rifier mÃ©ta tags
  if echo "$HTML" | grep -q '<meta name="robots"'; then
    ROBOTS=$(echo "$HTML" | grep -oP '(?<=<meta name="robots" content=")[^"]*')
    echo -e "  ${GREEN}âœ“${NC} Robots: $ROBOTS"
  fi
  
  # 4. VÃ©rifier canonical
  if echo "$HTML" | grep -q '<link rel="canonical"'; then
    CANONICAL=$(echo "$HTML" | grep -oP '(?<=<link rel="canonical" href=")[^"]*')
    echo -e "  ${GREEN}âœ“${NC} Canonical: $CANONICAL"
  fi
  
  echo ""
  ((TOTAL++))
}

# Tester toutes les URLs
echo -e "${BLUE}ðŸ§ª Tests des URLs${NC}"
echo "=================="
echo ""

for url in "${URLS[@]}"; do
  test_url "$url"
done

# RÃ©sumÃ©
echo ""
echo -e "${BLUE}ðŸ“Š RÃ‰SUMÃ‰${NC}"
echo "=========="
echo "  Total URLs testÃ©es: $TOTAL"
echo -e "  ${GREEN}SuccÃ¨s: $SUCCESS${NC}"
echo -e "  ${YELLOW}Avertissements: $WARNINGS${NC}"
echo -e "  ${RED}Erreurs: $ERRORS${NC}"
echo ""

# Score de qualitÃ©
SCORE=$((SUCCESS * 100 / (TOTAL * 2)))
echo "  Score de qualitÃ© SEO: $SCORE%"
echo ""

# Recommandations
echo -e "${BLUE}ðŸ’¡ RECOMMANDATIONS${NC}"
echo "==================="

if [ $SCORE -ge 90 ]; then
  echo -e "${GREEN}ðŸŽ‰ Excellent ! Vos breadcrumbs sont optimisÃ©s pour le SEO.${NC}"
elif [ $SCORE -ge 70 ]; then
  echo -e "${YELLOW}âš ï¸  Bon, mais quelques amÃ©liorations sont possibles.${NC}"
else
  echo -e "${RED}âŒ Attention ! Des corrections sont nÃ©cessaires.${NC}"
fi

echo ""
echo "Actions suggÃ©rÃ©es :"
echo "  1. VÃ©rifier dans Google Search Console (3-7 jours aprÃ¨s indexation)"
echo "  2. Tester avec: https://search.google.com/test/rich-results"
echo "  3. Valider avec: https://validator.schema.org/"
echo ""

# GÃ©nÃ©rer rapport JSON
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "baseUrl": "$BASE_URL",
  "results": {
    "total": $TOTAL,
    "success": $SUCCESS,
    "warnings": $WARNINGS,
    "errors": $ERRORS,
    "score": $SCORE
  },
  "urls_tested": $(printf '%s\n' "${URLS[@]}" | jq -R . | jq -s .)
}
EOF

echo -e "${GREEN}âœ“ Rapport sauvegardÃ©: $REPORT_FILE${NC}"
echo ""

# Google Search Console - Instructions
echo -e "${BLUE}ðŸ“ˆ GOOGLE SEARCH CONSOLE - Prochaines Ã©tapes${NC}"
echo "=============================================="
echo ""
echo "1. Connectez-vous Ã : https://search.google.com/search-console"
echo "2. Naviguez vers: Performance â†’ Search results"
echo "3. Filtrer par:"
echo "   - Pages avec breadcrumbs"
echo "   - RequÃªtes contenant nom de marque/modÃ¨le"
echo "4. MÃ©triques Ã  surveiller:"
echo "   - CTR (Click Through Rate) - Cible: +10-15%"
echo "   - Impressions - Cible: +20-30%"
echo "   - Position moyenne - Cible: amÃ©lioration"
echo "5. VÃ©rifier Rich Snippets:"
echo "   - Enhancements â†’ Breadcrumbs"
echo "   - VÃ©rifier pages valides vs. erreurs"
echo ""

exit 0
