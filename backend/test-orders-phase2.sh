#!/bin/bash

# Script de test pour la Phase 2 - Services Orders Consolidés
# Date: 2025-10-05

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║       TEST PHASE 2 - Services Orders Consolidés                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Compteurs
PASSED=0
FAILED=0
TOTAL=0

# Fonction de test
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    TOTAL=$((TOTAL + 1))
    
    echo -e "${BLUE}Test ${TOTAL}: ${name}${NC}"
    echo "  → ${method} ${endpoint}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "${data}" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} (Status: ${status_code})"
        PASSED=$((PASSED + 1))
        
        # Afficher un aperçu de la réponse
        if [ ! -z "$body" ]; then
            echo "$body" | jq -r 'if .data then "  Data: \(.data | type)" elif .success then "  Success: \(.success)" else "  Response received" end' 2>/dev/null || echo "  Response received"
        fi
    else
        echo -e "  ${RED}✗ FAIL${NC} (Expected: ${expected_status}, Got: ${status_code})"
        FAILED=$((FAILED + 1))
        
        if [ ! -z "$body" ]; then
            echo "  Error: $body" | head -c 200
        fi
    fi
    echo ""
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 TEST 1: OrdersService (Principal)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test listing orders (orders-fusion controller)
test_endpoint \
    "Lister les commandes" \
    "GET" \
    "/api/orders-fusion?page=1&limit=10" \
    "" \
    "200"

# Test get order stats (admin controller)
test_endpoint \
    "Statistiques des commandes" \
    "GET" \
    "/api/admin/orders/stats" \
    "" \
    "200"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST 2: OrderArchiveService"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test archive stats
test_endpoint \
    "Statistiques d'archivage" \
    "GET" \
    "/order-archive/stats" \
    "" \
    "200"

# Test list archived orders
test_endpoint \
    "Lister les commandes archivées" \
    "GET" \
    "/order-archive/list?page=1&limit=10" \
    "" \
    "200"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎫 TEST 3: TicketsService (SAV)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test tickets service
test_endpoint \
    "Test service tickets" \
    "GET" \
    "/api/tickets/test" \
    "" \
    "200"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 TEST 4: OrderStatusService"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test available statuses
test_endpoint \
    "Liste des statuts disponibles" \
    "GET" \
    "/api/order-status/available" \
    "" \
    "200"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSULTATS DES TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TOUS LES TESTS RÉUSSIS !${NC}"
else
    echo -e "${RED}❌ CERTAINS TESTS ONT ÉCHOUÉ${NC}"
fi

echo ""
echo "Total:  $TOTAL tests"
echo -e "Réussis: ${GREEN}$PASSED${NC}"
echo -e "Échoués: ${RED}$FAILED${NC}"
echo ""

SUCCESS_RATE=$((PASSED * 100 / TOTAL))
echo "Taux de réussite: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Phase 2 validée - Prêt pour Phase 3 !${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Certains endpoints nécessitent une révision${NC}"
    exit 1
fi
