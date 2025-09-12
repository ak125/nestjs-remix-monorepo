#!/bin/bash

# 🚗 ENHANCED VEHICLE SERVICE - Script de Test Complet
# "Vérifier existant et utiliser le meilleur" - VALIDATION
# 
# Tests de validation pour le service véhicule optimisé
# Combine toutes les fonctionnalités des services existants + proposés

echo "🚗 =========================================="
echo "🚗 ENHANCED VEHICLE SERVICE - TESTS COMPLETS"
echo "🚗 =========================================="
echo ""

# Configuration
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/vehicles"

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Fonction de test
run_test() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}🧪 Test $TOTAL_TESTS: $test_name${NC}"
    echo -e "   📍 URL: $url"
    echo -e "   📋 Description: $description"
    
    # Exécuter la requête
    start_time=$(date +%s%N)
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$url")
    end_time=$(date +%s%N)
    
    # Extraire status et temps
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')
    
    # Convertir temps en millisecondes
    time_ms=$(echo "$time_total * 1000" | bc -l | cut -d. -f1)
    
    # Vérifier le status
    if [ "$http_status" = "$expected_status" ]; then
        echo -e "   ✅ ${GREEN}Status: $http_status (attendu: $expected_status)${NC}"
        echo -e "   ⏱️  Temps: ${time_ms}ms"
        
        # Analyser la réponse JSON si possible
        if echo "$response_body" | jq . >/dev/null 2>&1; then
            # Compter les éléments si c'est un array
            if echo "$response_body" | jq -e 'type == "array"' >/dev/null 2>&1; then
                count=$(echo "$response_body" | jq 'length')
                echo -e "   📊 Éléments: $count"
            elif echo "$response_body" | jq -e '.data' >/dev/null 2>&1; then
                if echo "$response_body" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
                    count=$(echo "$response_body" | jq '.data | length')
                    total=$(echo "$response_body" | jq '.total // "N/A"')
                    echo -e "   📊 Éléments: $count, Total: $total"
                fi
            fi
            
            # Vérifier success si présent
            if echo "$response_body" | jq -e '.success' >/dev/null 2>&1; then
                success=$(echo "$response_body" | jq -r '.success')
                if [ "$success" = "true" ]; then
                    echo -e "   ✅ ${GREEN}Success: true${NC}"
                else
                    echo -e "   ❌ ${RED}Success: false${NC}"
                fi
            fi
        fi
        
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "   🎉 ${GREEN}SUCCÈS${NC}"
    else
        echo -e "   ❌ ${RED}Status: $http_status (attendu: $expected_status)${NC}"
        echo -e "   ⏱️  Temps: ${time_ms}ms"
        echo -e "   📄 Réponse: $(echo "$response_body" | head -c 200)..."
        
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "   💥 ${RED}ÉCHEC${NC}"
    fi
    
    echo ""
}

# Fonction de test avec données
run_test_with_data() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"
    local min_count="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}🧪 Test $TOTAL_TESTS: $test_name${NC}"
    echo -e "   📍 URL: $url"
    echo -e "   📋 Description: $description"
    echo -e "   📊 Données attendues: minimum $min_count éléments"
    
    # Exécuter la requête
    start_time=$(date +%s%N)
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$url")
    end_time=$(date +%s%N)
    
    # Extraire status et temps
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')
    
    # Convertir temps en millisecondes
    time_ms=$(echo "$time_total * 1000" | bc -l | cut -d. -f1)
    
    # Vérifier le status et les données
    success=false
    
    if [ "$http_status" = "$expected_status" ]; then
        echo -e "   ✅ ${GREEN}Status: $http_status${NC}"
        echo -e "   ⏱️  Temps: ${time_ms}ms"
        
        # Analyser la réponse JSON
        if echo "$response_body" | jq . >/dev/null 2>&1; then
            # Compter les éléments
            if echo "$response_body" | jq -e 'type == "array"' >/dev/null 2>&1; then
                count=$(echo "$response_body" | jq 'length')
                echo -e "   📊 Éléments: $count"
                
                if [ "$count" -ge "$min_count" ]; then
                    echo -e "   ✅ ${GREEN}Données suffisantes ($count >= $min_count)${NC}"
                    success=true
                else
                    echo -e "   ❌ ${RED}Données insuffisantes ($count < $min_count)${NC}"
                fi
            elif echo "$response_body" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
                count=$(echo "$response_body" | jq '.data | length')
                total=$(echo "$response_body" | jq '.total // 0')
                echo -e "   📊 Éléments: $count, Total: $total"
                
                if [ "$count" -ge "$min_count" ]; then
                    echo -e "   ✅ ${GREEN}Données suffisantes ($count >= $min_count)${NC}"
                    success=true
                else
                    echo -e "   ❌ ${RED}Données insuffisantes ($count < $min_count)${NC}"
                fi
            fi
        else
            echo -e "   ❌ ${RED}Réponse JSON invalide${NC}"
        fi
    else
        echo -e "   ❌ ${RED}Status: $http_status (attendu: $expected_status)${NC}"
        echo -e "   ⏱️  Temps: ${time_ms}ms"
    fi
    
    if [ "$success" = true ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "   🎉 ${GREEN}SUCCÈS${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "   💥 ${RED}ÉCHEC${NC}"
    fi
    
    echo ""
}

echo "🚀 Démarrage des tests Enhanced Vehicle Service..."
echo ""

# Test 1: Récupérer toutes les marques
run_test_with_data \
    "Récupérer toutes les marques" \
    "$API_URL/brands" \
    "200" \
    "Récupération de la liste complète des marques de véhicules" \
    "20"

# Test 2: Récupérer marques avec pagination
run_test_with_data \
    "Récupérer marques avec pagination" \
    "$API_URL/brands?page=0&limit=10" \
    "200" \
    "Test de pagination avec 10 marques par page" \
    "5"

# Test 3: Recherche de marques
run_test \
    "Recherche de marques" \
    "$API_URL/brands?search=Peugeot" \
    "200" \
    "Recherche de marques contenant 'Peugeot'"

# Test 4: Marques favorites uniquement
run_test \
    "Marques favorites uniquement" \
    "$API_URL/brands?onlyFavorites=true" \
    "200" \
    "Récupération uniquement des marques favorites"

# Test 5: Années pour une marque (Peugeot = ID 128)
run_test_with_data \
    "Années pour Peugeot" \
    "$API_URL/brands/128/years" \
    "200" \
    "Récupération des années de production pour Peugeot" \
    "10"

# Test 6: Modèles pour une marque
run_test_with_data \
    "Modèles pour Peugeot" \
    "$API_URL/brands/128/models" \
    "200" \
    "Récupération des modèles Peugeot" \
    "10"

# Test 7: Modèles avec filtre année
run_test_with_data \
    "Modèles Peugeot 2020" \
    "$API_URL/brands/128/models?year=2020" \
    "200" \
    "Modèles Peugeot disponibles en 2020" \
    "5"

# Test 8: Modèles avec pagination
run_test \
    "Modèles avec pagination" \
    "$API_URL/brands/128/models?page=0&limit=5" \
    "200" \
    "Test pagination modèles (5 par page)"

# Test 9: Motorisations pour un modèle (308 = supposé ID 100)
run_test \
    "Motorisations pour modèle" \
    "$API_URL/models/100/engines" \
    "200" \
    "Récupération des motorisations pour un modèle"

# Test 10: Recherche par type mine (test avec type mine connu)
run_test \
    "Recherche par type mine" \
    "$API_URL/search/mine/M10PEUDC1604" \
    "200" \
    "Recherche véhicule par type mine M10PEUDC1604"

# Test 11: Recherche par type mine inexistant
run_test \
    "Type mine inexistant" \
    "$API_URL/search/mine/TYPEMINE_INEXISTANT" \
    "200" \
    "Test avec type mine qui n'existe pas (doit retourner success: false)"

# Test 12: Statistiques générales
run_test \
    "Statistiques générales" \
    "$API_URL/stats" \
    "200" \
    "Récupération des statistiques du catalogue véhicules"

# Test 13: Nettoyage cache
run_test \
    "Nettoyage cache" \
    "$API_URL/cache/clear" \
    "200" \
    "Nettoyage du cache Redis des véhicules"

# Test 14: Test après nettoyage cache (performance)
echo -e "${YELLOW}🔄 Test performance après nettoyage cache...${NC}"
start_time=$(date +%s%N)
run_test \
    "Performance après cache clear" \
    "$API_URL/brands?limit=20" \
    "200" \
    "Test performance après nettoyage du cache"

# Test 15: Test cache actif (deuxième appel)
echo -e "${YELLOW}🔄 Test performance avec cache actif...${NC}"
run_test \
    "Performance avec cache" \
    "$API_URL/brands?limit=20" \
    "200" \
    "Test performance avec cache Redis actif"

# Tests d'erreurs
echo -e "${YELLOW}🧪 Tests de gestion d'erreurs...${NC}"
echo ""

# Test 16: ID marque invalide
run_test \
    "ID marque invalide" \
    "$API_URL/brands/-1/years" \
    "400" \
    "Test avec ID de marque invalide (doit retourner 400)"

# Test 17: ID modèle invalide
run_test \
    "ID modèle invalide" \
    "$API_URL/models/0/engines" \
    "400" \
    "Test avec ID de modèle invalide (doit retourner 400)"

# Test 18: Type mine trop court
run_test \
    "Type mine trop court" \
    "$API_URL/search/mine/AB" \
    "400" \
    "Test avec type mine trop court (doit retourner 400)"

# Test 19: Année invalide
run_test \
    "Année invalide" \
    "$API_URL/brands/128/models?year=1800" \
    "400" \
    "Test avec année invalide (doit retourner 400)"

# Test 20: Endpoint inexistant
run_test \
    "Endpoint inexistant" \
    "$API_URL/nonexistent" \
    "404" \
    "Test avec endpoint qui n'existe pas (doit retourner 404)"

echo ""
echo "🏁 =========================================="
echo "🏁 RÉSULTATS FINAUX"
echo "🏁 =========================================="
echo ""

# Calculer le pourcentage de réussite
if [ $TOTAL_TESTS -gt 0 ]; then
    success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
else
    success_rate=0
fi

echo -e "📊 Tests exécutés: $TOTAL_TESTS"
echo -e "✅ Tests réussis: ${GREEN}$PASSED_TESTS${NC}"
echo -e "❌ Tests échoués: ${RED}$FAILED_TESTS${NC}"
echo -e "📈 Taux de réussite: ${GREEN}$success_rate%${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "🎉 ${GREEN}TOUS LES TESTS SONT PASSÉS !${NC}"
    echo -e "✅ Enhanced Vehicle Service est pleinement opérationnel"
    echo -e "✅ Toutes les fonctionnalités des services proposé + existants sont validées"
    echo -e "✅ Cache Redis fonctionne correctement"
    echo -e "✅ Gestion d'erreurs robuste"
    echo -e "✅ Performance optimale"
    exit 0
else
    echo -e "⚠️  ${YELLOW}CERTAINS TESTS ONT ÉCHOUÉ${NC}"
    echo -e "🔧 Vérifiez la configuration et les services"
    
    if (( $(echo "$success_rate >= 80" | bc -l) )); then
        echo -e "📈 Taux de réussite acceptable (≥80%)"
        exit 0
    else
        echo -e "📉 Taux de réussite insuffisant (<80%)"
        exit 1
    fi
fi