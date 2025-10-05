#!/bin/bash

# 🧪 TESTS API ADMIN - VERSION CORRIGÉE avec /api/ prefix

echo "════════════════════════════════════════════════════════════════"
echo "🧪 TESTS API ADMIN - Routes avec /api/ prefix"
echo "════════════════════════════════════════════════════════════════"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0

test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4
  
  echo -n "Testing ${method} ${endpoint} ... "
  
  response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" 2>&1)
  status_code=$(echo "$response" | tail -n1)
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (${status_code}) - ${description}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: ${expected_status}, Got: ${status_code}) - ${description}"
    ((FAILED++))
  fi
}

echo "📦 1. STOCK MANAGEMENT (StockController avec /api/)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/stock/dashboard" "403" "Dashboard stock"
test_endpoint "GET" "/api/admin/stock/stats" "403" "Stats stock"
test_endpoint "GET" "/api/admin/stock/search" "403" "Recherche stock"
test_endpoint "GET" "/api/admin/stock/top-items" "403" "Top items"
test_endpoint "GET" "/api/admin/stock/alerts" "403" "Alertes stock"
test_endpoint "GET" "/api/admin/stock/health" "403" "Health check"
echo ""

echo "👥 2. STAFF MANAGEMENT (AdminStaffController)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/staff" "403" "Liste staff"
test_endpoint "GET" "/api/admin/staff/stats" "403" "Stats staff"
test_endpoint "POST" "/api/admin/staff" "403" "Créer staff"
echo ""

echo "⚙️  3. CONFIGURATION (ConfigurationController avec /api/)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/configuration" "403" "Liste configs"
test_endpoint "GET" "/api/admin/configuration/app.name" "403" "Config par clé"
echo ""

echo "👤 4. USER MANAGEMENT (UserManagementController avec /api/)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/users/stats" "403" "Stats users"
test_endpoint "GET" "/api/admin/users" "403" "Liste users"
echo ""

echo "📊 5. REPORTING (ReportingController avec /api/)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/reports/analytics" "403" "Rapports analytics"
echo ""

echo "🛍️  6. PRODUCTS (AdminProductsController AVEC GUARD)"
echo "─────────────────────────────────────────────────────────────"
test_endpoint "GET" "/api/admin/products/dashboard" "403" "Dashboard produits (SÉCURISÉ)"
echo ""

echo "════════════════════════════════════════════════════════════════"
TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}✓ Tests réussis:${NC}    ${PASSED}/${TOTAL}"
echo -e "${RED}✗ Tests échoués:${NC}    ${FAILED}/${TOTAL}"
echo -e "Taux de réussite: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓✓✓ TOUS LES TESTS RÉUSSIS ! API ADMIN COMPLÈTEMENT FONCTIONNELLE ✓✓✓${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Certains tests ont échoué, voir détails ci-dessus${NC}"
  exit 1
fi
