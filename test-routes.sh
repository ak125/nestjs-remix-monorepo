#!/bin/bash

# 🔍 VALIDATION DES ROUTES BACKEND
# Vérifie quelles routes sont disponibles

echo "🔍 VALIDATION DES ROUTES DISPONIBLES"
echo "===================================="

BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}/api"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_route() {
    local route="$1"
    local description="$2"
    
    echo -ne "${BLUE}Checking ${description}...${NC} "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}${route}")
    
    case $status in
        200|201)
            echo -e "${GREEN}✅ DISPONIBLE (${status})${NC}"
            ;;
        400|401|403)
            echo -e "${YELLOW}⚠️  EXISTE (${status})${NC}"
            ;;
        404)
            echo -e "${RED}❌ NON TROUVÉ (${status})${NC}"
            ;;
        500)
            echo -e "${RED}💥 ERREUR SERVEUR (${status})${NC}"
            ;;
        *)
            echo -e "${YELLOW}? INCONNU (${status})${NC}"
            ;;
    esac
}

echo "🔧 Test connectivité serveur..."
if curl -s --connect-timeout 3 "${BASE_URL}" > /dev/null; then
    echo -e "${GREEN}✅ Serveur accessible${NC}"
else
    echo -e "${RED}❌ Serveur inaccessible${NC}"
    exit 1
fi
echo ""

echo "========================================"
echo "👥 ROUTES USERS"
echo "========================================"
check_route "/users" "GET /users"
check_route "/users/active" "GET /users/active"
check_route "/users/level/1" "GET /users/level/1"

echo ""
echo "========================================"
echo "📦 ROUTES ORDERS"
echo "========================================"
check_route "/orders" "GET /orders"
check_route "/orders/stats/general" "GET /orders/stats/general"
check_route "/orders/stats/by-status" "GET /orders/stats/by-status"
check_route "/orders/statuses/orders" "GET /orders/statuses/orders"
check_route "/orders/statuses/lines" "GET /orders/statuses/lines"

echo ""
echo "========================================"
echo "🚗 ROUTES AUTOMOTIVE"
echo "========================================"
check_route "/automotive-orders" "GET /automotive-orders"
check_route "/vehicle-data/validate-vin" "POST /vehicle-data/validate-vin"
check_route "/vehicle-data/validate-registration" "POST /vehicle-data/validate-registration"
check_route "/vehicle-data/equivalent-parts/TEST" "GET /vehicle-data/equivalent-parts"

echo ""
echo "========================================"
echo "💰 ROUTES CALCULS"
echo "========================================"
check_route "/tax-calculation/calculate" "POST /tax-calculation/calculate"
check_route "/shipping-calculation/calculate" "POST /shipping-calculation/calculate"

echo ""
echo "========================================"
echo "🔐 ROUTES AUTH"
echo "========================================"
check_route "/auth/login" "POST /auth/login"
check_route "/auth/register" "POST /auth/register"
check_route "/auth/profile" "GET /auth/profile"

echo ""
echo "========================================"
echo "📋 RÉSUMÉ"
echo "========================================"

echo "🔍 Vérification terminée !"
echo ""
echo "📊 Pour voir les données réelles :"
echo "  curl -s '${API_BASE}/orders/stats/general' | jq"
echo "  curl -s '${API_BASE}/orders/statuses/orders' | jq"
echo "  curl -s '${API_BASE}/users?limit=3' | jq"
echo ""
echo "🚀 Pour tester le frontend :"
echo "  cd frontend && npm run dev"
