#!/bin/bash

# 🧪 SCRIPT DE VALIDATION - SYSTÈME DE RECHERCHE ÉQUIPEMENTIERS
# Date: 27 août 2025
# Usage: ./validate-search-system.sh

echo "🚀 VALIDATION DU SYSTÈME DE RECHERCHE AVEC DÉTECTION D'ÉQUIPEMENTIERS"
echo "=================================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
TOTAL_TESTS=0
PASSED_TESTS=0

# Fonction pour tester un endpoint
test_endpoint() {
    local test_name="$1"
    local url="$2"
    local expected_field="$3"
    local min_expected="$4"
    
    echo -e "${BLUE}Test: $test_name${NC}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Faire la requête avec timeout
    response=$(curl -s --max-time 10 "$url" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        # Extraire la valeur du champ attendu avec jq
        value=$(echo "$response" | jq -r "$expected_field" 2>/dev/null)
        
        if [ "$value" != "null" ] && [ "$value" != "" ]; then
            if [ "$min_expected" == "0" ] || [ "$value" -ge "$min_expected" ] 2>/dev/null; then
                echo -e "  ${GREEN}✅ PASS${NC} - $expected_field: $value"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                echo -e "  ${RED}❌ FAIL${NC} - $expected_field: $value (expected >= $min_expected)"
            fi
        else
            echo -e "  ${RED}❌ FAIL${NC} - $expected_field not found or null"
        fi
    else
        echo -e "  ${RED}❌ FAIL${NC} - Request failed or empty response"
    fi
    echo ""
}

echo "🔍 Démarrage des tests de validation..."
echo ""

# Test 1: Détection de marques
test_endpoint \
    "Détection automatique de marques" \
    "$BASE_URL/api/search-enhanced/test-brand-detection" \
    ".data.detectedCount" \
    "8"

# Test 2: Recherche MANN-FILTER
test_endpoint \
    "Recherche MANN-FILTER" \
    "$BASE_URL/api/search-enhanced/products?q=mann%20filter&limit=5" \
    ".data.total" \
    "1"

# Test 3: Recherche PURFLUX
test_endpoint \
    "Recherche PURFLUX" \
    "$BASE_URL/api/search-enhanced/products?q=purflux%20filtre&limit=5" \
    ".data.total" \
    "1"

# Test 4: Recherche générale filtres
test_endpoint \
    "Recherche générale 'filtre air'" \
    "$BASE_URL/api/search-enhanced/products?q=filtre%20air&limit=10" \
    ".data.total" \
    "1"

# Test 5: Recherche complexe véhicule
test_endpoint \
    "Recherche complexe véhicule" \
    "$BASE_URL/api/search-enhanced/products?q=filtre%20air%20renault%20clio&limit=5" \
    ".data.total" \
    "1"

# Test 6: Performance test (temps de réponse)
echo -e "${BLUE}Test: Performance (temps de réponse)${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

start_time=$(date +%s%3N)
response=$(curl -s --max-time 10 "$BASE_URL/api/search-enhanced/products?q=mann%20filter&limit=5" 2>/dev/null)
end_time=$(date +%s%3N)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    response_time=$((end_time - start_time))
    if [ "$response_time" -lt 1000 ]; then  # < 1 seconde
        echo -e "  ${GREEN}✅ PASS${NC} - Temps de réponse: ${response_time}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "  ${RED}❌ FAIL${NC} - Temps de réponse: ${response_time}ms (> 1000ms)"
    fi
else
    echo -e "  ${RED}❌ FAIL${NC} - Request failed"
fi
echo ""

# Test 7: Vérification de la santé du serveur
test_endpoint \
    "Santé du serveur" \
    "$BASE_URL/health" \
    ".status" \
    "0"

# Résumé final
echo "=================================================================="
echo "📊 RÉSUMÉ DE VALIDATION"
echo "=================================================================="

success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)

echo "Tests exécutés: $TOTAL_TESTS"
echo "Tests réussis: $PASSED_TESTS"
echo "Tests échoués: $((TOTAL_TESTS - PASSED_TESTS))"
echo "Taux de réussite: $success_rate%"
echo ""

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
    echo -e "${GREEN}🎉 SYSTÈME 100% OPÉRATIONNEL !${NC}"
    echo "✅ Le système de recherche avec détection d'équipementiers fonctionne parfaitement"
    echo "✅ Tous les endpoints répondent correctement"
    echo "✅ Détection automatique des marques fonctionnelle"
    echo "✅ Performance satisfaisante"
    echo ""
    echo "🚀 Le système est prêt pour la production !"
    exit 0
else
    echo -e "${RED}⚠️  SYSTÈME PARTIELLEMENT FONCTIONNEL${NC}"
    echo "❌ $((TOTAL_TESTS - PASSED_TESTS)) test(s) ont échoué"
    echo "🔧 Vérifiez que le serveur NestJS fonctionne sur le port 3000"
    echo "🔧 Vérifiez que Meilisearch fonctionne correctement"
    echo ""
    exit 1
fi
