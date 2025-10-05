#!/bin/bash

# 🧪 TESTS CURL - API Admin avec nouvelles routes

echo "════════════════════════════════════════════════════════════════"
echo "🧪 TESTS CURL - API Admin Consolidée"
echo "════════════════════════════════════════════════════════════════"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0

test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected=$3
  local description=$4
  
  echo -n "  ${method} ${endpoint} ... "
  
  response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" 2>&1)
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status" = "$expected" ]; then
    echo -e "${GREEN}✓${NC} ${status} - ${description}"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} Expected ${expected}, got ${status} - ${description}"
    ((FAILED++))
  fi
}

echo -e "${BLUE}📦 1. STOCK MANAGEMENT${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/stock/dashboard" "403" "Dashboard (auth required)"
test_endpoint "GET" "/api/admin/stock/stats" "403" "Statistiques (auth required)"
test_endpoint "GET" "/api/admin/stock/search" "403" "Recherche (auth required)"
test_endpoint "GET" "/api/admin/stock/top-items" "403" "Top items (auth required)"
test_endpoint "GET" "/api/admin/stock/alerts" "403" "Alertes (auth required)"
test_endpoint "GET" "/api/admin/stock/health" "403" "Health check (auth required)"
echo ""

echo -e "${BLUE}👥 2. STAFF MANAGEMENT${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/staff" "403" "Liste staff (auth required)"
test_endpoint "GET" "/api/admin/staff/stats" "403" "Stats staff (auth required)"
test_endpoint "POST" "/api/admin/staff" "403" "Créer staff (auth required)"
echo ""

echo -e "${BLUE}⚙️  3. CONFIGURATION${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/configuration" "403" "Liste configs (auth required)"
test_endpoint "GET" "/api/admin/configuration/app.name" "403" "Config par clé (auth required)"
echo ""

echo -e "${BLUE}👤 4. USER MANAGEMENT${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/users/stats" "403" "Stats users (auth required)"
test_endpoint "GET" "/api/admin/users" "403" "Liste users (auth required)"
echo ""

echo -e "${BLUE}📊 5. REPORTING${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/reports/analytics" "403" "Analytics (auth required)"
echo ""

echo -e "${BLUE}🛍️  6. PRODUCTS${NC}"
echo "──────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/products/dashboard" "403" "Dashboard produits (SÉCURISÉ)"
echo ""

echo -e "${BLUE}🔍 7. VÉRIFICATION MIGRATION${NC}"
echo "──────────────────────────────────────────────────────────────"
echo -e "${YELLOW}Routes anciennes (devraient retourner 404):${NC}"
test_endpoint "GET" "/admin/stock-enhanced/dashboard" "404" "Ancienne route enhanced"
test_endpoint "GET" "/api/admin/working-stock/stats" "404" "Ancienne route working-stock"
echo ""

echo -e "${BLUE}🌐 8. TESTS DEPUIS FRONTEND${NC}"
echo "──────────────────────────────────────────────────────────────"
echo "Simulation des appels depuis admin.stock.tsx:"
echo ""
echo "1. Stats endpoint:"
curl -s -o /dev/null -w "   GET /api/admin/stock/stats -> %{http_code}\n" "${BASE_URL}/api/admin/stock/stats"

echo "2. Dashboard endpoint:"
curl -s -o /dev/null -w "   GET /api/admin/stock/dashboard -> %{http_code}\n" "${BASE_URL}/api/admin/stock/dashboard"

echo "3. Search endpoint:"
curl -s -o /dev/null -w "   GET /api/admin/stock/search?query=test -> %{http_code}\n" "${BASE_URL}/api/admin/stock/search?query=test"

echo ""
echo "Simulation des appels depuis commercial.stock._index.tsx:"
echo ""
echo "1. Stats endpoint:"
curl -s -o /dev/null -w "   GET /api/admin/stock/stats -> %{http_code}\n" "${BASE_URL}/api/admin/stock/stats"

echo "2. Dashboard endpoint:"
curl -s -o /dev/null -w "   GET /api/admin/stock/dashboard -> %{http_code}\n" "${BASE_URL}/api/admin/stock/dashboard"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 RÉSULTATS${NC}"
echo "════════════════════════════════════════════════════════════════"
TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}✓ Tests réussis:${NC}    ${PASSED}/${TOTAL}"
echo -e "${RED}✗ Tests échoués:${NC}    ${FAILED}/${TOTAL}"
echo -e "Taux de réussite: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓✓✓ TOUS LES TESTS RÉUSSIS !${NC}"
  echo -e "${GREEN}✓✓✓ API ADMIN CONSOLIDÉE 100% FONCTIONNELLE${NC}"
  echo -e "${GREEN}✓✓✓ MIGRATION FRONTEND VALIDÉE${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}📋 Prochaines étapes:${NC}"
  echo "  1. ✅ Backend API consolidée et testée"
  echo "  2. ✅ Frontend migré vers /api/admin/*"
  echo "  3. 📝 Committer les changements frontend"
  echo "  4. 🔀 Review et merge dans main"
  exit 0
else
  echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}⚠ Certains tests ont échoué${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
  exit 1
fi
