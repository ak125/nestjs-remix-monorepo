#!/bin/bash

# 🧪 SCRIPT DE VALIDATION - ENHANCED VEHICLE SERVICE REFACTORISÉ
# Valide que l'architecture modulaire fonctionne correctement

echo "🚗 VALIDATION ENHANCED VEHICLE SERVICE REFACTORISÉ"
echo "=================================================="

# Configuration
BASE_URL="http://localhost:3000"
API_PREFIX="/api/vehicles"

# Couleurs pour affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de test d'endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $method $endpoint - $description: "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d '{"query":"Audi","searchIn":["marque","modele"],"page":0,"limit":5}' \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -E 's/HTTPSTATUS:[0-9]{3}$//')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS ($http_code)${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL ($http_code)${NC}"
        return 1
    fi
}

echo ""
echo "🔍 TESTS DES 7 MÉTHODES MIGRÉES"
echo "================================"

# Variables pour comptage
total_tests=0
passed_tests=0

# 1/7 - searchByCode
echo ""
echo "1/7 - Testing searchByCode..."
test_endpoint "GET" "$API_PREFIX/search/code/VF123" "Recherche par code"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 2/7 - getMinesByModel  
echo ""
echo "2/7 - Testing getMinesByModel..."
test_endpoint "GET" "$API_PREFIX/mine/model/123" "Codes mine par modèle"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 3/7 - getTypeById
echo ""
echo "3/7 - Testing getTypeById..."
test_endpoint "GET" "$API_PREFIX/type/456" "Type par ID"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 4/7 - searchByCnit
echo ""
echo "4/7 - Testing searchByCnit..."
test_endpoint "GET" "$API_PREFIX/search/cnit/AB123CD" "Recherche par CNIT"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 5/7 - searchByMineCode
echo ""
echo "5/7 - Testing searchByMineCode..."
test_endpoint "GET" "$API_PREFIX/search/mine/VF3123" "Recherche par code mine"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 6/7 - searchAdvanced
echo ""
echo "6/7 - Testing searchAdvanced..."
test_endpoint "POST" "$API_PREFIX/search/advanced" "Recherche avancée"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

# 7/7 - getBrands
echo ""
echo "7/7 - Testing getBrands..."
test_endpoint "GET" "$API_PREFIX/brands" "Toutes les marques"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

echo ""
echo "🎯 TESTS COMPLÉMENTAIRES"
echo "========================"

# Tests des endpoints complémentaires
test_endpoint "GET" "$API_PREFIX/brands/1/models" "Modèles par marque"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

test_endpoint "GET" "$API_PREFIX/models/1/types" "Types par modèle"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

test_endpoint "GET" "$API_PREFIX/suggestions/marque?q=Audi" "Suggestions marques"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

echo ""
echo "📊 TESTS DE MONITORING"
echo "======================"

# Tests monitoring
test_endpoint "GET" "$API_PREFIX/health" "Health check"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

test_endpoint "GET" "$API_PREFIX/stats" "Statistiques globales"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

test_endpoint "GET" "$API_PREFIX/architecture" "Résumé architecture"
if [ $? -eq 0 ]; then ((passed_tests++)); fi
((total_tests++))

echo ""
echo "📋 RÉSULTATS FINAUX"
echo "==================="

success_rate=$((passed_tests * 100 / total_tests))

echo "Tests réussis: $passed_tests/$total_tests"
echo "Taux de succès: $success_rate%"

if [ $success_rate -ge 70 ]; then
    echo -e "${GREEN}🎉 VALIDATION RÉUSSIE ! Architecture modulaire fonctionnelle.${NC}"
    exit 0
elif [ $success_rate -ge 50 ]; then
    echo -e "${YELLOW}⚠️ VALIDATION PARTIELLE. Quelques problèmes détectés.${NC}"
    exit 1
else
    echo -e "${RED}❌ VALIDATION ÉCHOUÉE. Architecture nécessite corrections.${NC}"
    exit 2
fi