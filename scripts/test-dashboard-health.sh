#!/bin/bash

###############################################################################
# 🧪 Script de Test de Santé du Dashboard
# Valide tous les endpoints avant/après consolidation
###############################################################################

set -e

BASE_URL="http://localhost:3000"
RESULTS_FILE="dashboard-health-$(date +%Y%m%d_%H%M%S).json"

echo "🚀 Test de Santé du Dashboard - $(date)"
echo "================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

###############################################################################
# Fonction de test
###############################################################################
test_endpoint() {
    local name=$1
    local endpoint=$2
    local expected_field=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$expected_field" ]; then
            has_field=$(echo "$body" | jq "has(\"$expected_field\")")
            if [ "$has_field" = "true" ]; then
                echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
                ((PASSED++))
                return 0
            else
                echo -e "${RED}✗ FAILED${NC} (Missing field: $expected_field)"
                ((FAILED++))
                return 1
            fi
        else
            echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
            ((PASSED++))
            return 0
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

###############################################################################
# Tests des endpoints principaux
###############################################################################

echo "📊 ENDPOINTS PRINCIPAUX"
echo "------------------------"

test_endpoint "Stats Dashboard" "/api/dashboard/stats" "totalUsers"
test_endpoint "Commandes récentes" "/api/dashboard/orders/recent" "orders"
test_endpoint "Expéditions" "/api/dashboard/shipments" "success"
test_endpoint "Alertes stock" "/api/dashboard/stock/alerts" "success"
test_endpoint "Commandes dashboard" "/api/dashboard/orders" "stats"

echo ""
echo "🎯 ENDPOINTS MODULAIRES"
echo "------------------------"

test_endpoint "Module Commercial" "/api/dashboard/commercial" "ordersCount"
test_endpoint "Module Expédition" "/api/dashboard/expedition" "status"
test_endpoint "Module SEO" "/api/dashboard/seo" "status"
test_endpoint "Module Staff" "/api/dashboard/staff" "status"

echo ""
echo "📈 VALIDATION DES DONNÉES"
echo "------------------------"

# Récupérer les stats
stats=$(curl -s "$BASE_URL/api/dashboard/stats")

# Extraire les valeurs
totalUsers=$(echo "$stats" | jq -r '.totalUsers')
totalOrders=$(echo "$stats" | jq -r '.totalOrders')
totalProducts=$(echo "$stats" | jq -r '.totalProducts // 0')
totalSuppliers=$(echo "$stats" | jq -r '.totalSuppliers')
totalRevenue=$(echo "$stats" | jq -r '.totalRevenue')
completedOrders=$(echo "$stats" | jq -r '.completedOrders')
seoPages=$(echo "$stats" | jq -r '.seoStats.totalPages')

echo "👥 Utilisateurs    : $totalUsers"
echo "📦 Produits        : $totalProducts"
echo "🛒 Commandes       : $totalOrders"
echo "💰 CA Total        : ${totalRevenue}€"
echo "✅ Commandes payées: $completedOrders"
echo "🚚 Fournisseurs    : $totalSuppliers"
echo "🔍 Pages SEO       : $seoPages"

echo ""
echo "⚠️  PROBLÈMES IDENTIFIÉS"
echo "------------------------"

ISSUES=0

# Vérifier les valeurs aberrantes
if [ "$totalProducts" = "0" ] || [ "$totalProducts" = "null" ]; then
    echo -e "${YELLOW}⚠ Produits = 0 (devrait être ~409K)${NC}"
    ((ISSUES++))
fi

# Calculer taux de conversion
if [ "$totalOrders" != "0" ] && [ "$completedOrders" != "0" ]; then
    conversionRate=$(echo "scale=2; ($completedOrders * 100) / $totalOrders" | bc)
    echo "📊 Taux conversion calculé : ${conversionRate}%"
    
    # Vérifier si le taux de conversion API correspond
    apiConversionRate=$(echo "$stats" | jq -r '.conversionRate // 0')
    if [ "$apiConversionRate" = "0" ] || [ "$apiConversionRate" = "0.0" ]; then
        echo -e "${YELLOW}⚠ Taux conversion API = 0% (devrait être ~$conversionRate%)${NC}"
        ((ISSUES++))
    fi
fi

# Calculer panier moyen
if [ "$completedOrders" != "0" ]; then
    avgBasket=$(echo "scale=2; $totalRevenue / $completedOrders" | bc)
    echo "🛒 Panier moyen calculé : ${avgBasket}€"
    
    apiAvgBasket=$(echo "$stats" | jq -r '.avgOrderValue // 0')
    if [ "$apiAvgBasket" = "0" ]; then
        echo -e "${YELLOW}⚠ Panier moyen API = 0€ (devrait être ~$avgBasket€)${NC}"
        ((ISSUES++))
    fi
fi

# Vérifier SEO
seoTraffic=$(echo "$stats" | jq -r '.seoStats.organicTraffic // 0')
seoKeywords=$(echo "$stats" | jq -r '.seoStats.keywordRankings // 0')

if [ "$seoTraffic" = "0" ]; then
    echo -e "${YELLOW}⚠ Trafic organique SEO = 0 (devrait afficher des données)${NC}"
    ((ISSUES++))
fi

if [ "$seoKeywords" = "0" ]; then
    echo -e "${YELLOW}⚠ Mots-clés classés = 0 (devrait afficher des données)${NC}"
    ((ISSUES++))
fi

echo ""
echo "================================================"
echo "📊 RÉSUMÉ"
echo "================================================"
echo -e "Tests réussis    : ${GREEN}$PASSED${NC}"
echo -e "Tests échoués    : ${RED}$FAILED${NC}"
echo -e "Problèmes détectés: ${YELLOW}$ISSUES${NC}"

# Sauvegarder les résultats
cat > "$RESULTS_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "tests": {
    "passed": $PASSED,
    "failed": $FAILED,
    "issues": $ISSUES
  },
  "data": {
    "totalUsers": $totalUsers,
    "totalProducts": $totalProducts,
    "totalOrders": $totalOrders,
    "totalRevenue": $totalRevenue,
    "completedOrders": $completedOrders,
    "totalSuppliers": $totalSuppliers,
    "seoPages": $seoPages,
    "seoTraffic": $seoTraffic,
    "seoKeywords": $seoKeywords
  }
}
EOF

echo ""
echo "💾 Résultats sauvegardés dans: $RESULTS_FILE"
echo ""

# Code de sortie
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Des tests ont échoué${NC}"
    exit 1
elif [ $ISSUES -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Tests passés mais des problèmes ont été détectés${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Tous les tests sont passés${NC}"
    exit 0
fi
