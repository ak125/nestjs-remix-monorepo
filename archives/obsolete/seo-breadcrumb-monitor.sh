#!/bin/bash

# 📊 Script de Monitoring SEO - Breadcrumbs & Rich Snippets
# Vérification automatique des performances SEO

echo "🔍 MONITORING SEO - Breadcrumbs & Rich Snippets"
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

# Créer le dossier de rapports
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Rapport: $REPORT_FILE"
echo ""

# URLs à tester
declare -a URLS=(
  "/constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html"
  "/pieces/freinage/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html"
  "/pieces/filtre-a-huile"
  "/blog/guide-achat"
)

# Résultats
TOTAL=0
SUCCESS=0
WARNINGS=0
ERRORS=0

# Fonction de test d'une URL
test_url() {
  local url="$1"
  local full_url="$BASE_URL$url"
  
  echo -e "${BLUE}🔍 Test: $url${NC}"
  
  # Récupérer le HTML
  HTML=$(curl -s "$full_url")
  
  # 1. Vérifier présence du breadcrumb Schema.org
  if echo "$HTML" | grep -q '"@type":"BreadcrumbList"'; then
    echo -e "  ${GREEN}✓${NC} Schema.org BreadcrumbList trouvé"
    
    # Extraire et valider le JSON-LD
    BREADCRUMB_JSON=$(echo "$HTML" | grep -oP '(?<=<script type="application/ld\+json">).*?BreadcrumbList.*?(?=</script>)' | head -1)
    
    if [ ! -z "$BREADCRUMB_JSON" ]; then
      # Valider le JSON
      if echo "$BREADCRUMB_JSON" | jq . > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} JSON-LD valide"
        
        # Compter les éléments
        ITEM_COUNT=$(echo "$BREADCRUMB_JSON" | jq '.itemListElement | length')
        echo -e "  ${GREEN}✓${NC} Nombre de niveaux: $ITEM_COUNT"
        
        # Vérifier que chaque position est séquentielle
        POSITIONS=$(echo "$BREADCRUMB_JSON" | jq -r '.itemListElement[].position')
        EXPECTED=1
        SEQUENTIAL=true
        for POS in $POSITIONS; do
          if [ "$POS" -ne "$EXPECTED" ]; then
            SEQUENTIAL=false
            echo -e "  ${RED}✗${NC} Positions non-séquentielles (attendu: $EXPECTED, trouvé: $POS)"
            ((WARNINGS++))
          fi
          ((EXPECTED++))
        done
        
        if [ "$SEQUENTIAL" = true ]; then
          echo -e "  ${GREEN}✓${NC} Positions séquentielles"
        fi
        
        # Vérifier URLs absolues
        HAS_RELATIVE=$(echo "$BREADCRUMB_JSON" | jq -r '.itemListElement[].item' | grep -c '^/')
        if [ "$HAS_RELATIVE" -gt 0 ]; then
          echo -e "  ${YELLOW}⚠${NC}  URLs relatives détectées (devrait être absolu)"
          ((WARNINGS++))
        else
          echo -e "  ${GREEN}✓${NC} URLs absolues"
        fi
        
        ((SUCCESS++))
      else
        echo -e "  ${RED}✗${NC} JSON-LD invalide"
        ((ERRORS++))
      fi
    fi
  else
    echo -e "  ${RED}✗${NC} Schema.org BreadcrumbList non trouvé"
    ((ERRORS++))
  fi
  
  # 2. Vérifier breadcrumb visuel HTML
  if echo "$HTML" | grep -q 'itemScope.*itemType.*BreadcrumbList'; then
    echo -e "  ${GREEN}✓${NC} Breadcrumb HTML avec microdonnées"
    ((SUCCESS++))
  else
    echo -e "  ${YELLOW}⚠${NC}  Breadcrumb HTML sans microdonnées"
    ((WARNINGS++))
  fi
  
  # 3. Vérifier méta tags
  if echo "$HTML" | grep -q '<meta name="robots"'; then
    ROBOTS=$(echo "$HTML" | grep -oP '(?<=<meta name="robots" content=")[^"]*')
    echo -e "  ${GREEN}✓${NC} Robots: $ROBOTS"
  fi
  
  # 4. Vérifier canonical
  if echo "$HTML" | grep -q '<link rel="canonical"'; then
    CANONICAL=$(echo "$HTML" | grep -oP '(?<=<link rel="canonical" href=")[^"]*')
    echo -e "  ${GREEN}✓${NC} Canonical: $CANONICAL"
  fi
  
  echo ""
  ((TOTAL++))
}

# Tester toutes les URLs
echo -e "${BLUE}🧪 Tests des URLs${NC}"
echo "=================="
echo ""

for url in "${URLS[@]}"; do
  test_url "$url"
done

# Résumé
echo ""
echo -e "${BLUE}📊 RÉSUMÉ${NC}"
echo "=========="
echo "  Total URLs testées: $TOTAL"
echo -e "  ${GREEN}Succès: $SUCCESS${NC}"
echo -e "  ${YELLOW}Avertissements: $WARNINGS${NC}"
echo -e "  ${RED}Erreurs: $ERRORS${NC}"
echo ""

# Score de qualité
SCORE=$((SUCCESS * 100 / (TOTAL * 2)))
echo "  Score de qualité SEO: $SCORE%"
echo ""

# Recommandations
echo -e "${BLUE}💡 RECOMMANDATIONS${NC}"
echo "==================="

if [ $SCORE -ge 90 ]; then
  echo -e "${GREEN}🎉 Excellent ! Vos breadcrumbs sont optimisés pour le SEO.${NC}"
elif [ $SCORE -ge 70 ]; then
  echo -e "${YELLOW}⚠️  Bon, mais quelques améliorations sont possibles.${NC}"
else
  echo -e "${RED}❌ Attention ! Des corrections sont nécessaires.${NC}"
fi

echo ""
echo "Actions suggérées :"
echo "  1. Vérifier dans Google Search Console (3-7 jours après indexation)"
echo "  2. Tester avec: https://search.google.com/test/rich-results"
echo "  3. Valider avec: https://validator.schema.org/"
echo ""

# Générer rapport JSON
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

echo -e "${GREEN}✓ Rapport sauvegardé: $REPORT_FILE${NC}"
echo ""

# Google Search Console - Instructions
echo -e "${BLUE}📈 GOOGLE SEARCH CONSOLE - Prochaines étapes${NC}"
echo "=============================================="
echo ""
echo "1. Connectez-vous à: https://search.google.com/search-console"
echo "2. Naviguez vers: Performance → Search results"
echo "3. Filtrer par:"
echo "   - Pages avec breadcrumbs"
echo "   - Requêtes contenant nom de marque/modèle"
echo "4. Métriques à surveiller:"
echo "   - CTR (Click Through Rate) - Cible: +10-15%"
echo "   - Impressions - Cible: +20-30%"
echo "   - Position moyenne - Cible: amélioration"
echo "5. Vérifier Rich Snippets:"
echo "   - Enhancements → Breadcrumbs"
echo "   - Vérifier pages valides vs. erreurs"
echo ""

exit 0
