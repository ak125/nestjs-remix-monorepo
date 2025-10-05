#!/bin/bash

# Script de test d'intégration pour le module Payments
# Tests toutes les routes avec la vraie base de données ic_postback

set -e

BASE_URL="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}=== Tests d'intégration - Module Payments ===${NC}\n"

# Compteurs
TOTAL=0
PASSED=0
FAILED=0

# Fonction de test
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    TOTAL=$((TOTAL + 1))
    echo -e "${YELLOW}Test ${TOTAL}: ${name}${NC}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
        PASSED=$((PASSED + 1))
        
        # Afficher un extrait de la réponse
        if command -v jq &> /dev/null; then
            echo "$body" | jq -C '.' 2>/dev/null | head -n 10 || echo "$body" | head -n 5
        else
            echo "$body" | head -n 5
        fi
    else
        echo -e "${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $http_code"
        FAILED=$((FAILED + 1))
        echo "Response: $body"
    fi
    
    echo ""
    sleep 0.5
}

# Variables pour les tests
PAYMENT_ID=""
ORDER_ID="test-order-$(date +%s)"
USER_ID="test-user-$(date +%s)"

echo -e "${BOLD}1. Tests des méthodes de paiement${NC}\n"

test_endpoint \
    "GET /api/payments/methods/available" \
    "GET" \
    "/api/payments/methods/available" \
    "" \
    "200"

test_endpoint \
    "GET /api/payments/methods/available?country=FR" \
    "GET" \
    "/api/payments/methods/available?country=FR" \
    "" \
    "200"

echo -e "${BOLD}2. Tests de création de paiement${NC}\n"

create_response=$(curl -s -X POST "${BASE_URL}/api/payments" \
    -H "Content-Type: application/json" \
    -d "{
        \"amount\": 149.99,
        \"currency\": \"EUR\",
        \"method\": \"cyberplus\",
        \"userId\": \"${USER_ID}\",
        \"orderId\": \"${ORDER_ID}\"
    }")

PAYMENT_ID=$(echo "$create_response" | jq -r '.data.id' 2>/dev/null || echo "")

if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
    echo -e "${GREEN}✓ Paiement créé avec succès${NC}"
    echo "Payment ID: $PAYMENT_ID"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ Échec de création du paiement${NC}"
    echo "Response: $create_response"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo ""

echo -e "${BOLD}3. Tests de récupération de paiement${NC}\n"

if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
    test_endpoint \
        "GET /api/payments/:id" \
        "GET" \
        "/api/payments/${PAYMENT_ID}" \
        "" \
        "200"
    
    test_endpoint \
        "GET /api/payments/reference/:ref" \
        "GET" \
        "/api/payments/reference/${PAYMENT_ID}" \
        "" \
        "200"
    
    test_endpoint \
        "GET /api/payments/order/:orderId" \
        "GET" \
        "/api/payments/order/${ORDER_ID}" \
        "" \
        "200"
fi

echo -e "${BOLD}4. Tests de mise à jour de statut${NC}\n"

if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
    test_endpoint \
        "PATCH /api/payments/:id/status" \
        "PATCH" \
        "/api/payments/${PAYMENT_ID}/status" \
        '{"status": "completed", "providerTransactionId": "TXN-123456"}' \
        "200"
fi

echo -e "${BOLD}5. Tests des callbacks${NC}\n"

test_endpoint \
    "POST /api/payments/callback/cyberplus (valid)" \
    "POST" \
    "/api/payments/callback/cyberplus" \
    '{
        "vads_trans_id": "123456",
        "vads_order_id": "'${ORDER_ID}'",
        "vads_amount": "14999",
        "vads_currency": "978",
        "vads_trans_status": "AUTHORISED",
        "vads_payment_config": "SINGLE",
        "signature": "test-signature"
    }' \
    "200"

echo -e "${BOLD}6. Tests des statistiques${NC}\n"

test_endpoint \
    "GET /api/payments/stats" \
    "GET" \
    "/api/payments/stats" \
    "" \
    "200"

test_endpoint \
    "GET /api/payments/stats avec filtres" \
    "GET" \
    "/api/payments/stats?status=completed&method=cyberplus" \
    "" \
    "200"

echo -e "${BOLD}7. Tests d'erreurs (comportement attendu)${NC}\n"

test_endpoint \
    "GET /api/payments/:id (inexistant)" \
    "GET" \
    "/api/payments/PAY-INEXISTANT-12345" \
    "" \
    "404"

test_endpoint \
    "POST /api/payments (données invalides)" \
    "POST" \
    "/api/payments" \
    '{"amount": -10}' \
    "400"

# Résumé
echo -e "${BOLD}=== Résumé des tests ===${NC}\n"
echo -e "Total: ${BOLD}${TOTAL}${NC}"
echo -e "Réussis: ${GREEN}${PASSED}${NC}"
echo -e "Échoués: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✓ Tous les tests sont passés !${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}✗ Certains tests ont échoué${NC}"
    exit 1
fi
