#!/bin/bash
# ðŸ” Script de validation de l'ordre du catalogue
# VÃ©rifie que l'ordre est correct depuis la BDD jusqu'au frontend

set -e

echo "ðŸ” Validation de l'ordre du catalogue..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:3000}"
ERRORS=0

# 1. VÃ©rifier que le backend est dÃ©marrÃ©
echo "1ï¸âƒ£  VÃ©rification du backend..."
if ! curl -s "${API_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${RED}âŒ Backend non accessible Ã  ${API_URL}${NC}"
    echo "   Lancez d'abord: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}âœ… Backend accessible${NC}"
echo ""

# 2. RÃ©cupÃ©rer les familles depuis l'API
echo "2ï¸âƒ£  RÃ©cupÃ©ration des familles depuis l'API..."
RESPONSE=$(curl -s "${API_URL}/api/catalog/gammes/hierarchy")

if [ -z "$RESPONSE" ]; then
    echo -e "${RED}âŒ RÃ©ponse API vide${NC}"
    exit 1
fi

# Extraire les familles avec jq
FAMILIES=$(echo "$RESPONSE" | jq -r '.families[] | "\(.id)|\(.name)|\(.sort_order // "MISSING")"')

if [ -z "$FAMILIES" ]; then
    echo -e "${RED}âŒ Aucune famille trouvÃ©e dans la rÃ©ponse${NC}"
    exit 1
fi

TOTAL_FAMILIES=$(echo "$FAMILIES" | wc -l)
echo -e "${GREEN}âœ… ${TOTAL_FAMILIES} familles rÃ©cupÃ©rÃ©es${NC}"
echo ""

# 3. VÃ©rifier que sort_order existe
echo "3ï¸âƒ£  VÃ©rification de la prÃ©sence de sort_order..."
MISSING_SORT=$(echo "$FAMILIES" | grep "MISSING" || true)

if [ -n "$MISSING_SORT" ]; then
    echo -e "${RED}âŒ Certaines familles n'ont pas de sort_order :${NC}"
    echo "$MISSING_SORT" | while IFS='|' read -r id name sort; do
        echo "   - ID: $id, Nom: $name"
    done
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}âœ… Toutes les familles ont un sort_order${NC}"
fi
echo ""

# 4. VÃ©rifier que sort_order est croissant
echo "4ï¸âƒ£  VÃ©rification de l'ordre croissant de sort_order..."
SORT_ORDERS=$(echo "$FAMILIES" | cut -d'|' -f3 | grep -v "MISSING" || true)

if [ -z "$SORT_ORDERS" ]; then
    echo -e "${RED}âŒ Aucun sort_order valide trouvÃ©${NC}"
    exit 1
fi

PREV_SORT=-1
INDEX=0
IS_SORTED=true

while IFS= read -r sort_order; do
    # Extraire l'ID et le nom de la famille
    FAMILY_INFO=$(echo "$FAMILIES" | sed -n "$((INDEX + 1))p")
    ID=$(echo "$FAMILY_INFO" | cut -d'|' -f1)
    NAME=$(echo "$FAMILY_INFO" | cut -d'|' -f2)
    
    if [ "$sort_order" -le "$PREV_SORT" ]; then
        echo -e "${RED}âŒ Ordre incorrect : sort_order $sort_order <= $PREV_SORT${NC}"
        echo "   Famille: ID=$ID, Nom=\"$NAME\""
        IS_SORTED=false
        ERRORS=$((ERRORS + 1))
    fi
    
    PREV_SORT=$sort_order
    INDEX=$((INDEX + 1))
done <<< "$SORT_ORDERS"

if [ "$IS_SORTED" = true ]; then
    echo -e "${GREEN}âœ… sort_order est croissant (de 0 Ã  $PREV_SORT)${NC}"
fi
echo ""

# 5. Afficher les 5 premiÃ¨res familles pour vÃ©rification visuelle
echo "5ï¸âƒ£  AperÃ§u des 5 premiÃ¨res familles :"
echo "$FAMILIES" | head -5 | while IFS='|' read -r id name sort; do
    printf "   %2s. %-30s (sort_order: %s)\n" "$id" "$name" "$sort"
done
echo ""

# 6. VÃ©rifier les fichiers sources
echo "6ï¸âƒ£  VÃ©rification des fichiers sources..."

# Backend : gamme-unified.service.ts
BACKEND_FILE="backend/src/modules/catalog/services/gamme-unified.service.ts"
if [ -f "$BACKEND_FILE" ]; then
    if grep -q ".order('mf_sort', { ascending: true })" "$BACKEND_FILE"; then
        echo -e "${GREEN}âœ… Backend : .order('mf_sort') prÃ©sent${NC}"
    else
        echo -e "${RED}âŒ Backend : .order('mf_sort') manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "sort_order: parseInt(family.mf_sort)" "$BACKEND_FILE"; then
        echo -e "${GREEN}âœ… Backend : mapping sort_order prÃ©sent${NC}"
    else
        echo -e "${RED}âŒ Backend : mapping sort_order manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q ".sort((a, b) => a.sort_order - b.sort_order)" "$BACKEND_FILE"; then
        echo -e "${GREEN}âœ… Backend : tri final prÃ©sent${NC}"
    else
        echo -e "${RED}âŒ Backend : tri final manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}âš ï¸  Fichier backend non trouvÃ© (probablement pas au bon endroit)${NC}"
fi

# Frontend : hierarchy.api.ts
FRONTEND_FILE="frontend/app/services/api/hierarchy.api.ts"
if [ -f "$FRONTEND_FILE" ]; then
    if grep -q "mf_sort: family.sort_order?.toString()" "$FRONTEND_FILE"; then
        echo -e "${GREEN}âœ… Frontend : mapping mf_sort prÃ©sent${NC}"
    else
        echo -e "${RED}âŒ Frontend : mapping mf_sort incorrect ou manquant${NC}"
        echo "   Attendu: mf_sort: family.sort_order?.toString() || '0'"
        ERRORS=$((ERRORS + 1))
    fi
    
    # VÃ©rifier qu'il n'y a pas de tri manuel
    if grep -q "mappedFamilies.*\.sort(" "$FRONTEND_FILE"; then
        echo -e "${RED}âŒ Frontend : tri manuel dÃ©tectÃ© (NE PAS RETRIER)${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}âœ… Frontend : pas de tri manuel dÃ©tectÃ©${NC}"
    fi
else
    echo -e "${YELLOW}âš ï¸  Fichier frontend non trouvÃ©${NC}"
fi
echo ""

# 7. RÃ©sumÃ© final
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}âœ… SUCCÃˆS : L'ordre du catalogue est correct !${NC}"
    echo ""
    echo "ðŸ“‹ RÃ©sumÃ© :"
    echo "   - $TOTAL_FAMILIES familles chargÃ©es"
    echo "   - sort_order croissant de 0 Ã  $PREV_SORT"
    echo "   - Tous les fichiers sources corrects"
    echo ""
    echo -e "${BLUE}â„¹ï¸  Pour plus d'informations, consultez CATALOGUE-ORDRE-GUIDE.md${NC}"
    exit 0
else
    echo -e "${RED}âŒ Ã‰CHEC : $ERRORS erreur(s) dÃ©tectÃ©e(s)${NC}"
    echo ""
    echo "ðŸ“‹ Actions recommandÃ©es :"
    echo "   1. Consultez CATALOGUE-ORDRE-GUIDE.md"
    echo "   2. VÃ©rifiez les fichiers sources mentionnÃ©s ci-dessus"
    echo "   3. Comparez avec la branche main si nÃ©cessaire :"
    echo "      git diff main..HEAD -- backend/src/modules/catalog/services/gamme-unified.service.ts"
    echo "      git diff main..HEAD -- frontend/app/services/api/hierarchy.api.ts"
    exit 1
fi
