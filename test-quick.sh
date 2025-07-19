#!/bin/bash

# 🚀 TESTS RAPIDES API - Validation essentielle
# Tests des endpoints principaux avec curl

echo "🔥 TESTS API ESSENTIELS"
echo "======================="

BASE_URL="http://localhost:3000/api"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test simple
test_api() {
    local endpoint="$1"
    local description="$2"
    local method="${3:-GET}"
    
    echo -ne "${BLUE}Testing ${description}...${NC} "
    
    if [ "$method" = "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${endpoint}")
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: application/json" "${BASE_URL}${endpoint}")
    fi
    
    if [ "$status" = "200" ] || [ "$status" = "201" ]; then
        echo -e "${GREEN}✅ OK (${status})${NC}"
    else
        echo -e "${RED}❌ FAIL (${status})${NC}"
    fi
}

echo "📋 Users API"
test_api "/users?limit=3" "Liste utilisateurs"
test_api "/users/active?limit=3" "Utilisateurs actifs"
test_api "/users/level/1" "Utilisateurs niveau 1"

echo ""
echo "📦 Orders API"
test_api "/orders?limit=3" "Liste commandes"
test_api "/orders/stats/general" "Statistiques"
test_api "/orders/statuses/orders" "Statuts commandes"

echo ""
echo "🚗 Automotive API"
test_api "/vehicle-data/equivalent-parts/TEST-001" "Pièces équivalentes"

echo ""
echo "💰 Calculs"
# Ces endpoints nécessitent des données POST, on teste juste qu'ils existent
status_tax=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/tax-calculation/calculate")
status_ship=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/shipping-calculation/calculate")

echo -ne "${BLUE}Testing Calcul taxes...${NC} "
if [ "$status_tax" = "400" ]; then
    echo -e "${GREEN}✅ OK (endpoint exists)${NC}"
else
    echo -e "${RED}❌ FAIL (${status_tax})${NC}"
fi

echo -ne "${BLUE}Testing Calcul livraison...${NC} "
if [ "$status_ship" = "400" ]; then
    echo -e "${GREEN}✅ OK (endpoint exists)${NC}"
else
    echo -e "${RED}❌ FAIL (${status_ship})${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Tests rapides terminés !${NC}"
