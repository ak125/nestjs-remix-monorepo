#!/bin/bash
# 🔍 Script de validation de l'ordre du catalogue
# Vérifie que l'ordre est correct depuis la BDD jusqu'au frontend

set -e

echo "🔍 Validation de l'ordre du catalogue..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:3000}"
ERRORS=0

# 1. Vérifier que le backend est démarré
echo "1️⃣  Vérification du backend..."
if ! curl -s "${API_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend non accessible à ${API_URL}${NC}"
    echo "   Lancez d'abord: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend accessible${NC}"
echo ""

# 2. Récupérer les familles depuis l'API
echo "2️⃣  Récupération des familles depuis l'API..."
RESPONSE=$(curl -s "${API_URL}/api/catalog/gammes/hierarchy")

if [ -z "$RESPONSE" ]; then
    echo -e "${RED}❌ Réponse API vide${NC}"
    exit 1
fi

# Extraire les familles avec jq
FAMILIES=$(echo "$RESPONSE" | jq -r '.families[] | "\(.id)|\(.name)|\(.sort_order // "MISSING")"')

if [ -z "$FAMILIES" ]; then
    echo -e "${RED}❌ Aucune famille trouvée dans la réponse${NC}"
    exit 1
fi

TOTAL_FAMILIES=$(echo "$FAMILIES" | wc -l)
echo -e "${GREEN}✅ ${TOTAL_FAMILIES} familles récupérées${NC}"
echo ""

# 3. Vérifier que sort_order existe
echo "3️⃣  Vérification de la présence de sort_order..."
MISSING_SORT=$(echo "$FAMILIES" | grep "MISSING" || true)

if [ -n "$MISSING_SORT" ]; then
    echo -e "${RED}❌ Certaines familles n'ont pas de sort_order :${NC}"
    echo "$MISSING_SORT" | while IFS='|' read -r id name sort; do
        echo "   - ID: $id, Nom: $name"
    done
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Toutes les familles ont un sort_order${NC}"
fi
echo ""

# 4. Vérifier que sort_order est croissant
echo "4️⃣  Vérification de l'ordre croissant de sort_order..."
SORT_ORDERS=$(echo "$FAMILIES" | cut -d'|' -f3 | grep -v "MISSING" || true)

if [ -z "$SORT_ORDERS" ]; then
    echo -e "${RED}❌ Aucun sort_order valide trouvé${NC}"
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
        echo -e "${RED}❌ Ordre incorrect : sort_order $sort_order <= $PREV_SORT${NC}"
        echo "   Famille: ID=$ID, Nom=\"$NAME\""
        IS_SORTED=false
        ERRORS=$((ERRORS + 1))
    fi
    
    PREV_SORT=$sort_order
    INDEX=$((INDEX + 1))
done <<< "$SORT_ORDERS"

if [ "$IS_SORTED" = true ]; then
    echo -e "${GREEN}✅ sort_order est croissant (de 0 à $PREV_SORT)${NC}"
fi
echo ""

# 5. Afficher les 5 premières familles pour vérification visuelle
echo "5️⃣  Aperçu des 5 premières familles :"
echo "$FAMILIES" | head -5 | while IFS='|' read -r id name sort; do
    printf "   %2s. %-30s (sort_order: %s)\n" "$id" "$name" "$sort"
done
echo ""

# 6. Vérifier les fichiers sources
echo "6️⃣  Vérification des fichiers sources..."

# Backend : gamme-unified.service.ts
BACKEND_FILE="backend/src/modules/catalog/services/gamme-unified.service.ts"
if [ -f "$BACKEND_FILE" ]; then
    if grep -q ".order('mf_sort', { ascending: true })" "$BACKEND_FILE"; then
        echo -e "${GREEN}✅ Backend : .order('mf_sort') présent${NC}"
    else
        echo -e "${RED}❌ Backend : .order('mf_sort') manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "sort_order: parseInt(family.mf_sort)" "$BACKEND_FILE"; then
        echo -e "${GREEN}✅ Backend : mapping sort_order présent${NC}"
    else
        echo -e "${RED}❌ Backend : mapping sort_order manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q ".sort((a, b) => a.sort_order - b.sort_order)" "$BACKEND_FILE"; then
        echo -e "${GREEN}✅ Backend : tri final présent${NC}"
    else
        echo -e "${RED}❌ Backend : tri final manquant${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Fichier backend non trouvé (probablement pas au bon endroit)${NC}"
fi

# Frontend : hierarchy.api.ts
FRONTEND_FILE="frontend/app/services/api/hierarchy.api.ts"
if [ -f "$FRONTEND_FILE" ]; then
    if grep -q "mf_sort: family.sort_order?.toString()" "$FRONTEND_FILE"; then
        echo -e "${GREEN}✅ Frontend : mapping mf_sort présent${NC}"
    else
        echo -e "${RED}❌ Frontend : mapping mf_sort incorrect ou manquant${NC}"
        echo "   Attendu: mf_sort: family.sort_order?.toString() || '0'"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Vérifier qu'il n'y a pas de tri manuel
    if grep -q "mappedFamilies.*\.sort(" "$FRONTEND_FILE"; then
        echo -e "${RED}❌ Frontend : tri manuel détecté (NE PAS RETRIER)${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ Frontend : pas de tri manuel détecté${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Fichier frontend non trouvé${NC}"
fi
echo ""

# 7. Résumé final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCÈS : L'ordre du catalogue est correct !${NC}"
    echo ""
    echo "📋 Résumé :"
    echo "   - $TOTAL_FAMILIES familles chargées"
    echo "   - sort_order croissant de 0 à $PREV_SORT"
    echo "   - Tous les fichiers sources corrects"
    echo ""
    echo -e "${BLUE}ℹ️  Pour plus d'informations, consultez CATALOGUE-ORDRE-GUIDE.md${NC}"
    exit 0
else
    echo -e "${RED}❌ ÉCHEC : $ERRORS erreur(s) détectée(s)${NC}"
    echo ""
    echo "📋 Actions recommandées :"
    echo "   1. Consultez CATALOGUE-ORDRE-GUIDE.md"
    echo "   2. Vérifiez les fichiers sources mentionnés ci-dessus"
    echo "   3. Comparez avec la branche main si nécessaire :"
    echo "      git diff main..HEAD -- backend/src/modules/catalog/services/gamme-unified.service.ts"
    echo "      git diff main..HEAD -- frontend/app/services/api/hierarchy.api.ts"
    exit 1
fi
