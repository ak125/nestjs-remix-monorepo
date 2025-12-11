#!/bin/bash
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ§ª Script de test automatisÃ© - API Paiement
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

set -e

BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}/api/payments"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ§ª TESTS AUTOMATISÃ‰S - API PAIEMENT${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "API URL: $API_URL"
echo ""

# Fonction pour tester un endpoint
test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_status="$5"
  
  ((TESTS_RUN++))
  
  echo -ne "${YELLOW}â³${NC} Test $TESTS_RUN: $name... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}âœ… PASS${NC} (HTTP $status_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}âŒ FAIL${NC} (Expected $expected_status, got $status_code)"
    echo "Response: $body"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Fonction pour extraire un ID de la rÃ©ponse JSON
extract_id() {
  echo "$1" | jq -r '.data.id' 2>/dev/null || echo ""
}

# Variables globales pour stocker les IDs crÃ©Ã©s
PAYMENT_ID=""
PAYMENT_ID_CONSIGNES=""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ SECTION 1 : ENDPOINTS DE BASE"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 1: MÃ©thodes de paiement disponibles
test_endpoint \
  "GET /methods/available" \
  "GET" \
  "${API_URL}/methods/available" \
  "" \
  "200"

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ SECTION 2 : CRÃ‰ATION DE PAIEMENTS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 2: CrÃ©er un paiement simple
response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 99.99,
    "currency": "EUR",
    "method": "CYBERPLUS",
    "userId": "test-user-autotest",
    "orderId": "ORD-AUTOTEST-001",
    "description": "Test automatisÃ©",
    "customerEmail": "autotest@test.com"
  }')

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

((TESTS_RUN++))
echo -ne "${YELLOW}â³${NC} Test $TESTS_RUN: POST /payments (crÃ©ation simple)... "

if [ "$status_code" = "201" ]; then
  PAYMENT_ID=$(extract_id "$body")
  echo -e "${GREEN}âœ… PASS${NC} (HTTP $status_code)"
  echo -e "   ${BLUE}â†’${NC} Payment ID: $PAYMENT_ID"
  ((TESTS_PASSED++))
else
  echo -e "${RED}âŒ FAIL${NC} (Expected 201, got $status_code)"
  ((TESTS_FAILED++))
fi

# Test 3: CrÃ©er un paiement avec consignes
response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/test/create-with-consignes" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-AUTOTEST-CONSIGNES"}')

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

((TESTS_RUN++))
echo -ne "${YELLOW}â³${NC} Test $TESTS_RUN: POST /test/create-with-consignes... "

if [ "$status_code" = "200" ]; then
  PAYMENT_ID_CONSIGNES=$(echo "$body" | jq -r '.payment.id' 2>/dev/null || echo "")
  echo -e "${GREEN}âœ… PASS${NC} (HTTP $status_code)"
  echo -e "   ${BLUE}â†’${NC} Payment ID: $PAYMENT_ID_CONSIGNES"
  ((TESTS_PASSED++))
else
  echo -e "${RED}âŒ FAIL${NC} (Expected 200, got $status_code)"
  ((TESTS_FAILED++))
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ SECTION 3 : CONSULTATION DE PAIEMENTS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 4: RÃ©cupÃ©rer le paiement par ID
if [ -n "$PAYMENT_ID" ]; then
  test_endpoint \
    "GET /payments/:id" \
    "GET" \
    "${API_URL}/${PAYMENT_ID}" \
    "" \
    "200"
fi

# Test 5: RÃ©cupÃ©rer les paiements d'un utilisateur
test_endpoint \
  "GET /payments/user/:userId" \
  "GET" \
  "${API_URL}/user/test-user-autotest?limit=10" \
  "" \
  "200"

# Test 6: RÃ©cupÃ©rer par commande
test_endpoint \
  "GET /payments/order/:orderId" \
  "GET" \
  "${API_URL}/order/ORD-AUTOTEST-001" \
  "" \
  "200"

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ SECTION 4 : VALIDATION DES ERREURS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 7: Montant nÃ©gatif
test_endpoint \
  "POST /payments (montant nÃ©gatif)" \
  "POST" \
  "${API_URL}" \
  '{"amount": -50, "currency": "EUR", "method": "CYBERPLUS", "userId": "test", "orderId": "INVALID-001"}' \
  "400"

# Test 8: DonnÃ©es manquantes
test_endpoint \
  "POST /payments (donnÃ©es manquantes)" \
  "POST" \
  "${API_URL}" \
  '{"amount": 100}' \
  "400"

# Test 9: Paiement introuvable
test_endpoint \
  "GET /payments/:id (inexistant)" \
  "GET" \
  "${API_URL}/PAY_INEXISTANT_123" \
  "" \
  "404"

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ SECTION 5 : SÃ‰CURITÃ‰"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 10: Callback avec signature invalide
test_endpoint \
  "POST /callback/cyberplus (signature invalide)" \
  "POST" \
  "${API_URL}/callback/cyberplus" \
  '{"transaction_id": "TXN_TEST", "order_id": "TEST", "status": "success", "signature": "invalid"}' \
  "200"

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SULTATS FINAUX"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "Tests exÃ©cutÃ©s : $TESTS_RUN"
echo -e "Tests rÃ©ussis  : ${GREEN}$TESTS_PASSED âœ…${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "Tests Ã©chouÃ©s  : ${RED}$TESTS_FAILED âŒ${NC}"
else
  echo -e "Tests Ã©chouÃ©s  : ${GREEN}0 âœ…${NC}"
fi

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  PERCENTAGE=100
  echo -e "${GREEN}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
  echo -e "${GREEN}âœ… TOUS LES TESTS SONT PASSÃ‰S ! (100%)${NC}"
  echo -e "${GREEN}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
  exit 0
else
  PERCENTAGE=$((TESTS_PASSED * 100 / TESTS_RUN))
  echo -e "${YELLOW}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
  echo -e "${YELLOW}âš ï¸  CERTAINS TESTS ONT Ã‰CHOUÃ‰ ($PERCENTAGE% de rÃ©ussite)${NC}"
  echo -e "${YELLOW}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
  exit 1
fi
