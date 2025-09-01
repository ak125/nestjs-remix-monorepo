#!/bin/bash

# 🧪 TESTS CURL POUR LE DASHBOARD COMMERCIAL
# Validation complète des APIs du système commercial

set -e

# Configuration
API_BASE="http://127.0.0.1:3000"
HEADER_INTERNAL="internal-call: true"
HEADER_JSON="Content-Type: application/json"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage des résultats
print_test() {
    local test_name="$1"
    local status="$2"
    local response="$3"
    
    echo -e "\n${BLUE}🧪 TEST: ${test_name}${NC}"
    if [ "$status" = "200" ] || [ "$status" = "201" ]; then
        echo -e "${GREEN}✅ SUCCESS (HTTP $status)${NC}"
        echo -e "${YELLOW}Response:${NC} $(echo "$response" | head -c 200)..."
    else
        echo -e "${RED}❌ FAILED (HTTP $status)${NC}"
        echo -e "${RED}Error:${NC} $response"
    fi
}

# Fonction de test générique
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -e "\n${BLUE}🔍 Testing: $url${NC}"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X "$method" \
            -H "$HEADER_INTERNAL" \
            -H "$HEADER_JSON" \
            -d "$data" \
            "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X "$method" \
            -H "$HEADER_INTERNAL" \
            "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    fi
    
    status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    print_test "$name" "$status" "$body"
    
    # Retourner 0 si succès, 1 si échec
    if [ "$status" = "200" ] || [ "$status" = "201" ]; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}🚀 DÉMARRAGE DES TESTS API COMMERCIAL${NC}"
echo -e "Base URL: $API_BASE"
echo -e "Date: $(date)"

# Compteurs
total_tests=0
passed_tests=0
failed_tests=0

# =============================================================================
# 📊 TESTS DASHBOARD PRINCIPAL
# =============================================================================

echo -e "\n${YELLOW}📊 === DASHBOARD PRINCIPAL ===${NC}"

# Test 1: Statistiques générales
total_tests=$((total_tests + 1))
if test_endpoint "Statistiques Dashboard" "$API_BASE/api/dashboard/stats"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 2: Commandes récentes
total_tests=$((total_tests + 1))
if test_endpoint "Commandes Récentes" "$API_BASE/api/dashboard/orders/recent"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 3: Statistiques des commandes
total_tests=$((total_tests + 1))
if test_endpoint "Stats Commandes" "$API_BASE/api/dashboard/orders"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 🏪 TESTS FOURNISSEURS
# =============================================================================

echo -e "\n${YELLOW}🏪 === GESTION FOURNISSEURS ===${NC}"

# Test 4: Liste des fournisseurs
total_tests=$((total_tests + 1))
if test_endpoint "Liste Fournisseurs" "$API_BASE/api/suppliers"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 5: Statistiques fournisseurs
total_tests=$((total_tests + 1))
if test_endpoint "Stats Fournisseurs" "$API_BASE/api/dashboard/suppliers"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 📦 TESTS STOCK & INVENTAIRE
# =============================================================================

echo -e "\n${YELLOW}📦 === GESTION STOCK ===${NC}"

# Test 6: Statistiques du stock
total_tests=$((total_tests + 1))
if test_endpoint "Stats Stock" "$API_BASE/api/admin/working-stock/stats"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 7: Dashboard stock
total_tests=$((total_tests + 1))
if test_endpoint "Dashboard Stock" "$API_BASE/api/admin/working-stock/dashboard?page=1&limit=10"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 8: Stock bas
total_tests=$((total_tests + 1))
if test_endpoint "Stock Bas" "$API_BASE/api/admin/working-stock/dashboard?available=false"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 👥 TESTS UTILISATEURS & CLIENTS
# =============================================================================

echo -e "\n${YELLOW}👥 === GESTION CLIENTS ===${NC}"

# Test 9: Statistiques utilisateurs
total_tests=$((total_tests + 1))
if test_endpoint "Stats Utilisateurs" "$API_BASE/api/dashboard/users"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 🔍 TESTS RECHERCHE & SEO
# =============================================================================

echo -e "\n${YELLOW}🔍 === RECHERCHE & SEO ===${NC}"

# Test 10: Stats SEO
total_tests=$((total_tests + 1))
if test_endpoint "Stats SEO" "$API_BASE/api/dashboard/seo"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# ⚡ TESTS PERFORMANCE & HEALTH CHECK
# =============================================================================

echo -e "\n${YELLOW}⚡ === PERFORMANCE & HEALTH ===${NC}"

# Test 11: Health check
total_tests=$((total_tests + 1))
if test_endpoint "Health Check" "$API_BASE/api/health" || test_endpoint "Health Check Alt" "$API_BASE/health"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 12: Test de charge - Dashboard avec filtres
total_tests=$((total_tests + 1))
if test_endpoint "Dashboard Filtré" "$API_BASE/api/dashboard/stats?filter=commercial"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 🧪 TESTS ENDPOINTS SPÉCIFIQUES RÉCUPÉRÉS
# =============================================================================

echo -e "\n${YELLOW}🎯 === ENDPOINTS OPTIMISATIONS ===${NC}"

# Test 13: Test constructeurs (récupéré des optimisations)
total_tests=$((total_tests + 1))
if test_endpoint "API Constructeurs" "$API_BASE/api/constructeurs" || test_endpoint "Manufacturers" "$API_BASE/api/manufacturers"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 14: Test glossaire (récupéré des optimisations)
total_tests=$((total_tests + 1))
if test_endpoint "API Glossaire" "$API_BASE/api/glossary"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# Test 15: Test blog/advice (récupéré des optimisations)
total_tests=$((total_tests + 1))
if test_endpoint "API Blog/Advice" "$API_BASE/api/blog/advice" || test_endpoint "API Articles" "$API_BASE/api/articles"; then
    passed_tests=$((passed_tests + 1))
else
    failed_tests=$((failed_tests + 1))
fi

# =============================================================================
# 📈 RÉSULTATS FINAUX
# =============================================================================

echo -e "\n${BLUE}📈 === RAPPORT FINAL ===${NC}"
echo -e "Total des tests: $total_tests"
echo -e "${GREEN}✅ Tests réussis: $passed_tests${NC}"
echo -e "${RED}❌ Tests échoués: $failed_tests${NC}"

success_rate=$((passed_tests * 100 / total_tests))
echo -e "${YELLOW}📊 Taux de réussite: ${success_rate}%${NC}"

if [ $failed_tests -eq 0 ]; then
    echo -e "\n${GREEN}🎉 TOUS LES TESTS SONT PASSÉS !${NC}"
    echo -e "${GREEN}✨ Votre API commercial est entièrement fonctionnelle${NC}"
    exit 0
elif [ $success_rate -ge 80 ]; then
    echo -e "\n${YELLOW}⚠️  La plupart des tests passent (${success_rate}%)${NC}"
    echo -e "${YELLOW}🔧 Quelques endpoints nécessitent de l'attention${NC}"
    exit 1
else
    echo -e "\n${RED}💥 ÉCHECS CRITIQUES DÉTECTÉS${NC}"
    echo -e "${RED}🚨 Vérifiez la configuration du serveur${NC}"
    exit 2
fi
