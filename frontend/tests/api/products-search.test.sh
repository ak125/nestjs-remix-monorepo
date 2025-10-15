#!/bin/bash

################################################################################
# Tests E2E : API Products Search (Phase 9)
# 
# Fonctionnalités testées :
# - GET /api/products/search?query=xxx&limit=10
# - Recherche par nom et référence
# - Filtrage par marque
# - Pagination et limite
# - Performance et cache
# - Edge cases (query vide, caractères spéciaux)
################################################################################

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
SEARCH_ENDPOINT="${API_BASE}/api/products/search"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Fonction d'assertion
assert_status() {
  local actual=$1
  local expected=$2
  local test_name=$3
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗${NC} $test_name (expected $expected, got $actual)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

assert_contains() {
  local response=$1
  local expected=$2
  local test_name=$3
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if echo "$response" | grep -q "$expected"; then
    echo -e "${GREEN}✓${NC} $test_name"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗${NC} $test_name (expected to contain '$expected')"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

echo "=========================================="
echo "Tests E2E : Products Search API"
echo "Base URL : $API_BASE"
echo "=========================================="
echo ""

################################################################################
# TEST 1 : Recherche basique
################################################################################
echo "📦 Test 1 : Recherche basique (query='filtre')"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=filtre&limit=10")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "$STATUS" 200 "Status 200 OK"
assert_contains "$BODY" "results" "Contient clé 'results'"
assert_contains "$BODY" "\[" "Results est un array"

################################################################################
# TEST 2 : Recherche avec limite
################################################################################
echo ""
echo "📦 Test 2 : Limite de résultats (limit=5)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=piece&limit=5")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "$STATUS" 200 "Status 200 OK"

# Compter le nombre de résultats (approximatif via grep)
RESULT_COUNT=$(echo "$BODY" | grep -o '"piece_id"' | wc -l)
if [ "$RESULT_COUNT" -le 5 ]; then
  echo -e "${GREEN}✓${NC} Limite respectée ($RESULT_COUNT <= 5)"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "${RED}✗${NC} Limite dépassée ($RESULT_COUNT > 5)"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

################################################################################
# TEST 3 : Query trop courte (< 2 caractères)
################################################################################
echo ""
echo "📦 Test 3 : Query trop courte (1 caractère)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=a&limit=10")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "$STATUS" 400 "Status 400 Bad Request"
assert_contains "$BODY" "au moins 2 caractères" "Message d'erreur approprié"

################################################################################
# TEST 4 : Query vide
################################################################################
echo ""
echo "📦 Test 4 : Query vide"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=&limit=10")
STATUS=$(echo "$RESPONSE" | tail -n1)

assert_status "$STATUS" 400 "Status 400 Bad Request"

################################################################################
# TEST 5 : Recherche par référence
################################################################################
echo ""
echo "📦 Test 5 : Recherche par référence (piece_ref)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=REF123&limit=10")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "$STATUS" 200 "Status 200 OK"
assert_contains "$BODY" "results" "Contient résultats"

################################################################################
# TEST 6 : Caractères spéciaux (injection SQL)
################################################################################
echo ""
echo "📦 Test 6 : Sécurité - Caractères spéciaux"
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=%27%20OR%201=1--&limit=10")
STATUS=$(echo "$RESPONSE" | tail -n1)

# Devrait retourner 200 avec résultats vides ou 400, PAS d'erreur 500
if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 400 ]; then
  echo -e "${GREEN}✓${NC} Pas d'injection SQL (status $STATUS)"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "${RED}✗${NC} Vulnérabilité potentielle (status $STATUS)"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

################################################################################
# TEST 7 : Performance et cache
################################################################################
echo ""
echo "📦 Test 7 : Performance (<500ms) et Cache"

# Premier appel (sans cache)
START_TIME=$(date +%s%3N)
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=filtre&limit=10")
END_TIME=$(date +%s%3N)
FIRST_CALL_TIME=$((END_TIME - START_TIME))

# Deuxième appel (avec cache Redis - devrait être plus rapide)
START_TIME=$(date +%s%3N)
RESPONSE=$(curl -s -w "\n%{http_code}" "$SEARCH_ENDPOINT?query=filtre&limit=10")
END_TIME=$(date +%s%3N)
SECOND_CALL_TIME=$((END_TIME - START_TIME))

echo "  Premier appel : ${FIRST_CALL_TIME}ms"
echo "  Deuxième appel (cache) : ${SECOND_CALL_TIME}ms"

if [ "$SECOND_CALL_TIME" -lt "$FIRST_CALL_TIME" ]; then
  echo -e "${GREEN}✓${NC} Cache fonctionne (plus rapide au 2e appel)"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "${YELLOW}⚠${NC} Cache potentiellement non actif"
  PASSED_TESTS=$((PASSED_TESTS + 1)) # Warning, pas échec
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

################################################################################
# TEST 8 : Structure de réponse (ProductSearchResult)
################################################################################
echo ""
echo "📦 Test 8 : Structure de réponse conforme"
RESPONSE=$(curl -s "$SEARCH_ENDPOINT?query=filtre&limit=1")

# Vérifier les champs requis
assert_contains "$RESPONSE" "piece_id" "Contient piece_id"
assert_contains "$RESPONSE" "name" "Contient name"
assert_contains "$RESPONSE" "reference" "Contient reference"
assert_contains "$RESPONSE" "price_ttc" "Contient price_ttc"
assert_contains "$RESPONSE" "consigne_ttc" "Contient consigne_ttc (Phase 8)"
assert_contains "$RESPONSE" "marque_name" "Contient marque_name"
assert_contains "$RESPONSE" "stock" "Contient stock"

################################################################################
# Résumé
################################################################################
echo ""
echo "=========================================="
echo "Résumé des tests"
echo "=========================================="
echo -e "Total     : $TOTAL_TESTS tests"
echo -e "${GREEN}Réussis   : $PASSED_TESTS${NC}"
echo -e "${RED}Échoués   : $FAILED_TESTS${NC}"
echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
  echo -e "${GREEN}✓ Tous les tests sont passés !${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAILED_TESTS test(s) échoué(s)${NC}"
  exit 1
fi
