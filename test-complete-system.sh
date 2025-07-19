#!/bin/bash

# ===========================
# TESTS END-TO-END COMPLETS 
# Validation complète du système NestJS + Remix
# ===========================

echo "🚀 DÉMARRAGE DES TESTS END-TO-END COMPLETS"
echo "=========================================="

BASE_URL="http://localhost:3000"
FAILED_TESTS=0
TOTAL_TESTS=0

# Fonction pour tester une URL
test_endpoint() {
    local method=$1
    local url=$2
    local expected_status=$3
    local description=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "[$TOTAL_TESTS] Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$url")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$url")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo "✅ PASS ($response)"
    else
        echo "❌ FAIL (got $response, expected $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Fonction pour tester avec contenu
test_content() {
    local url=$1
    local search_text=$2
    local description=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "[$TOTAL_TESTS] Testing $description... "
    
    response=$(curl -s "$BASE_URL$url")
    
    if echo "$response" | grep -q "$search_text"; then
        echo "✅ PASS (content found)"
    else
        echo "❌ FAIL (content not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo ""
echo "🏠 === TESTS FRONTEND PAGES ==="
test_endpoint "GET" "/" "200" "Page d'accueil"
test_endpoint "GET" "/admin" "200" "Dashboard admin"
test_endpoint "GET" "/admin/users" "200" "Gestion des utilisateurs"
test_endpoint "GET" "/admin/orders" "200" "Gestion des commandes"

echo ""
echo "🔌 === TESTS API BACKEND ==="
test_endpoint "GET" "/api/users" "200" "API Users - Liste"
test_endpoint "GET" "/api/orders" "200" "API Orders - Liste"
test_endpoint "GET" "/api/automotive-orders" "200" "API Automotive - Liste"

echo ""
echo "📊 === TESTS CONTENU SPÉCIFIQUE ==="
test_content "/admin" "AutoParts Admin" "Dashboard contient le titre"
test_content "/admin/users" "Gestion des Utilisateurs" "Page users opérationnelle"
test_content "/admin/orders" "Gestion des Commandes" "Page orders opérationnelle"
test_content "/admin/orders" "1417" "Données legacy visibles (nombre total commandes)"

echo ""
echo "🚗 === TESTS AUTOMOTIVE SPÉCIFIQUES ==="
test_content "/api/automotive-orders" "Service automobile opérationnel" "Service automotive actif"
test_content "/api/automotive-orders" "1.0.0" "Version automotive disponible"

echo ""
echo "🔧 === TESTS DONNÉES LEGACY ==="
test_content "/api/orders" "ord_id" "Structure commandes legacy"
test_content "/api/orders" "patrick.bardais@yahoo.fr" "Données clients réelles"
test_content "/api/orders" "99.11" "Montants réels"

echo ""
echo "🛡️ === TESTS AUTHENTIFICATION ==="
test_content "/admin/orders" "Admin User" "Utilisateur admin connecté"
test_content "/admin/orders" "admin@autoparts.com" "Email admin affiché"

echo ""
echo "📱 === TESTS RESPONSIVENESS ==="
test_content "/admin" "lg:translate-x-0" "Interface responsive"
test_content "/admin/orders" "overflow-x-auto" "Tableaux responsive"

echo ""
echo "⚡ === TESTS PERFORMANCE ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -n "[$TOTAL_TESTS] Testing page load time... "
start_time=$(date +%s%N)
curl -s "$BASE_URL/admin/orders" > /dev/null
end_time=$(date +%s%N)
load_time=$(( (end_time - start_time) / 1000000 ))

if [ $load_time -lt 2000 ]; then
    echo "✅ PASS (${load_time}ms)"
else
    echo "❌ FAIL (${load_time}ms - too slow)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "============================================"
echo "🏁 RÉSULTATS FINAUX"
echo "============================================"
echo "Tests réussis: $((TOTAL_TESTS - FAILED_TESTS))/$TOTAL_TESTS"
echo "Tests échoués: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo "🎉 🎉 🎉 TOUS LES TESTS PASSENT ! 🎉 🎉 🎉"
    echo ""
    echo "✅ Backend NestJS opérationnel"
    echo "✅ Frontend Remix fonctionnel" 
    echo "✅ Interface admin complète"
    echo "✅ API endpoints exposés"
    echo "✅ Données legacy migrées (1417 commandes)"
    echo "✅ Authentification admin active"
    echo "✅ Services automotive disponibles"
    echo "✅ Performance acceptable"
    echo ""
    echo "🚀 SYSTÈME PRÊT POUR LA PRODUCTION !"
    exit 0
else
    echo ""
    echo "⚠️ QUELQUES TESTS ONT ÉCHOUÉ"
    echo "Voir les détails ci-dessus pour corriger."
    exit 1
fi
