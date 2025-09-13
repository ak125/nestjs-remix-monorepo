#!/bin/bash

# Script de test pour l'API Layout
# Usage: ./test-layout-api.sh

BASE_URL="http://localhost:3000/api"
LAYOUT_URL="$BASE_URL/layout"

echo "🧪 Tests de l'API Layout Module"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -e "${BLUE}🔍 Test: $name${NC}"
    echo "URL: $url"
    
    response=$(curl -s -w "\n%{http_code}" "$url")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ SUCCESS ($status_code)${NC}"
        echo "Response: $(echo "$body" | jq -C . 2>/dev/null || echo "$body")"
    else
        echo -e "${RED}❌ FAILED (Expected: $expected_status, Got: $status_code)${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Test 1: Layout complet pour contexte public
echo -e "${YELLOW}📋 1. Tests Layout Principal${NC}"
test_endpoint "Layout public" "$LAYOUT_URL?context=public"
test_endpoint "Layout admin" "$LAYOUT_URL?context=admin&user=admin123"
test_endpoint "Layout commercial" "$LAYOUT_URL?context=commercial&user=comm456"

# Test 2: Header
echo -e "${YELLOW}📋 2. Tests Header${NC}"
test_endpoint "Header public" "$LAYOUT_URL/header?context=public"
test_endpoint "Header admin" "$LAYOUT_URL/header?context=admin&user=admin123"
test_endpoint "Header commercial" "$LAYOUT_URL/header?context=commercial&user=comm456"

# Test 3: Footer
echo -e "${YELLOW}📋 3. Tests Footer${NC}"
test_endpoint "Footer public" "$LAYOUT_URL/footer?context=public"
test_endpoint "Footer admin" "$LAYOUT_URL/footer?context=admin"
test_endpoint "Footer commercial" "$LAYOUT_URL/footer?context=commercial"

# Test 4: Recherche rapide
echo -e "${YELLOW}📋 4. Tests Recherche${NC}"
test_endpoint "Recherche vide" "$LAYOUT_URL/search?q=&context=public"
test_endpoint "Recherche produits" "$LAYOUT_URL/search?q=iphone&context=public&limit=5"
test_endpoint "Recherche admin" "$LAYOUT_URL/search?q=user&context=admin&limit=3"
test_endpoint "Données recherche" "$LAYOUT_URL/search-data?context=public"

# Test 5: Partage social
echo -e "${YELLOW}📋 5. Tests Partage Social${NC}"
test_endpoint "Liens partage" "$LAYOUT_URL/share?url=https://example.com&title=Test%20Article"
test_endpoint "Boutons partage" "$LAYOUT_URL/share-buttons?url=https://example.com&title=Test%20Article&description=Description%20test"

# Test 6: Meta tags
echo -e "${YELLOW}📋 6. Tests Meta Tags${NC}"
test_endpoint "Meta accueil" "$LAYOUT_URL/meta/home?title=Accueil&description=Page%20d'accueil"
test_endpoint "Meta produit" "$LAYOUT_URL/meta/product?title=iPhone%2015&description=Nouveau%20iPhone"
test_endpoint "Meta HTML" "$LAYOUT_URL/meta-html/home?title=Test%20Site"

# Test 7: Sections
echo -e "${YELLOW}📋 7. Tests Sections${NC}"
test_endpoint "Section header" "$LAYOUT_URL/sections/header?context=public"
test_endpoint "Section footer" "$LAYOUT_URL/sections/footer?context=public"
test_endpoint "Header personnalisé" "$LAYOUT_URL/sections/header/custom?context=admin&showActions=false"
test_endpoint "Footer personnalisé" "$LAYOUT_URL/sections/footer/custom?context=public&showNewsletter=false"

# Test 8: Recherche filtrée
echo -e "${YELLOW}📋 8. Tests Recherche Filtrée${NC}"
test_endpoint "Recherche produits" "$LAYOUT_URL/sections/search/filtered?q=test&type=product&context=public"
test_endpoint "Recherche utilisateurs" "$LAYOUT_URL/sections/search/filtered?q=admin&type=user&context=admin"

# Test 9: Tests d'erreur
echo -e "${YELLOW}📋 9. Tests d'Erreurs${NC}"
test_endpoint "URL invalide" "$LAYOUT_URL/invalid-endpoint" "404"
test_endpoint "Partage sans paramètres" "$LAYOUT_URL/share" "500"

echo -e "${GREEN}🎉 Tests terminés !${NC}"
echo ""
echo "💡 Pour des tests plus détaillés, utilisez :"
echo "   curl -v $LAYOUT_URL?context=public | jq ."
echo "   curl -X GET '$LAYOUT_URL/search?q=test&context=public' | jq ."
