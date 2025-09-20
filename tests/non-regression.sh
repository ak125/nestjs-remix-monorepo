#!/bin/bash

# 🧪 Tests de Non-Régression - État Fonctionnel Actuel
# Date: 15 août 2025
# Objectif: Vérifier que les fonctionnalités critiques marchent

echo "🧪 DÉBUT DES TESTS DE NON-RÉGRESSION"
echo "======================================"

# Configuration
BASE_URL="http://localhost:3000"
FAIL_COUNT=0
TOTAL_TESTS=0

# Fonction de test
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] Testing $name... "
    
    response=$(curl -s "$BASE_URL$url" 2>/dev/null)
    if echo "$response" | grep -q "$expected"; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        echo "   Expected: $expected"
        echo "   Got: $(echo "$response" | head -c 100)..."
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo
echo "📊 TEST 1: DONNÉES RÉELLES"
echo "-------------------------"

# Test des endpoints API critiques
test_endpoint "Legacy Users API" "/api/legacy-users" '"total":59137'
test_endpoint "Legacy Orders API" "/api/legacy-orders" '"total":1440'
test_endpoint "Orders Stats API" "/api/legacy-orders/stats" "51509"

echo
echo "🔐 TEST 2: AUTHENTIFICATION"
echo "---------------------------"

# Test des redirections d'authentification (sans cookies)
test_endpoint "Admin Auth Redirect" "/admin/users" "login"
test_endpoint "Account Auth Redirect" "/account/dashboard" "login"

echo
echo "🎛️ TEST 3: PAGES ADMIN (avec session simulée)"
echo "----------------------------------------------"

# Note: Ces tests nécessiteraient des cookies de session réels
echo "[INFO] Tests d'interface admin nécessitent authentification"
echo "[INFO] Validation manuelle recommandée avec session active"

echo
echo "📈 RÉSULTATS DES TESTS"
echo "======================"

PASS_COUNT=$((TOTAL_TESTS - FAIL_COUNT))
SUCCESS_RATE=$((PASS_COUNT * 100 / TOTAL_TESTS))

echo "✅ Tests réussis: $PASS_COUNT/$TOTAL_TESTS"
echo "❌ Tests échoués: $FAIL_COUNT/$TOTAL_TESTS"
echo "📊 Taux de réussite: $SUCCESS_RATE%"

if [ $FAIL_COUNT -eq 0 ]; then
    echo
    echo "🎉 TOUS LES TESTS CRITIQUES PASSENT!"
    echo "✅ Le système est dans un état fonctionnel"
    exit 0
else
    echo
    echo "⚠️  CERTAINS TESTS ONT ÉCHOUÉ"
    echo "🔧 Vérification nécessaire avant modifications"
    exit 1
fi
