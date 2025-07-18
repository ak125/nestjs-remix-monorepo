#!/bin/bash

# Script de test complet pour l'API Orders
# Test de toutes les fonctionnalités avec curl

echo "🚀 Tests complets de l'API Orders - Système de gestion des commandes"
echo "============================================================================="
echo ""

# Configuration
BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api/orders"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_result() {
    local test_name="$1"
    local status_code="$2"
    local expected="$3"
    
    echo -n "[$test_name] "
    if [ "$status_code" -eq "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Status: $status_code)"
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $status_code, Expected: $expected)"
    fi
}

# Fonction pour tester une endpoint
test_endpoint() {
    local method="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"
    local data="$5"
    
    echo -e "${BLUE}🔍 Test: $description${NC}"
    echo "   URL: $method $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" "$url")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT \
            -H "Content-Type: application/json" \
            -d "$data" "$url")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$url")
    fi
    
    # Séparer le body et le status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    print_result "$description" "$http_code" "$expected_status"
    
    # Afficher un extrait du body si c'est un succès
    if [ "$http_code" -eq "$expected_status" ] && [ ! -z "$body" ]; then
        echo "   📄 Réponse: $(echo "$body" | head -c 200)..."
    fi
    
    echo ""
    return $http_code
}

echo "🔧 Configuration:"
echo "   Base URL: $BASE_URL"
echo "   API Base: $API_BASE"
echo ""

# Test 1: Récupération des commandes avec pagination (par défaut)
echo -e "${YELLOW}📋 TESTS DE RÉCUPÉRATION DES COMMANDES${NC}"
echo "-------------------------------------------"

test_endpoint "GET" "$API_BASE" 200 "Récupération des commandes (page 1, limit 10)"

# Test 2: Pagination personnalisée
test_endpoint "GET" "$API_BASE?page=2&limit=5" 200 "Pagination personnalisée (page 2, limit 5)"

# Test 3: Filtres par statut
test_endpoint "GET" "$API_BASE?status=1" 200 "Filtrage par statut (statut=1)"

# Test 4: Filtres par client
test_endpoint "GET" "$API_BASE?customerId=81561" 200 "Filtrage par client (customerId=81561)"

# Test 5: Filtres par date
test_endpoint "GET" "$API_BASE?dateFrom=2023-01-01&dateTo=2024-12-31" 200 "Filtrage par plage de dates"

# Test 6: Combinaison de filtres
test_endpoint "GET" "$API_BASE?page=1&limit=3&status=1&customerId=81561" 200 "Combinaison de filtres"

echo -e "${YELLOW}🔍 TESTS DE RÉCUPÉRATION PAR ID${NC}"
echo "-----------------------------------"

# Test 7: Récupération d'une commande par ID (nous devons d'abord récupérer un ID valide)
echo -e "${BLUE}🔍 Test: Récupération d'une commande spécifique${NC}"
echo "   Récupération d'un ID de commande valide..."

# Récupérer un ID de commande valide
valid_order_id=$(curl -s "$API_BASE?limit=1" | grep -o '"ord_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$valid_order_id" ]; then
    echo "   ID trouvé: $valid_order_id"
    test_endpoint "GET" "$API_BASE/$valid_order_id" 200 "Récupération commande ID: $valid_order_id"
else
    echo -e "${RED}❌ Impossible de récupérer un ID de commande valide${NC}"
fi

# Test 8: Récupération d'une commande inexistante
test_endpoint "GET" "$API_BASE/INVALID_ORDER_ID" 404 "Récupération commande inexistante"

echo -e "${YELLOW}👤 TESTS DE RÉCUPÉRATION PAR CLIENT${NC}"
echo "--------------------------------------"

# Test 9: Récupération des commandes par client
test_endpoint "GET" "$API_BASE/customer/81561" 200 "Commandes du client 81561"

# Test 10: Client inexistant
test_endpoint "GET" "$API_BASE/customer/999999" 200 "Commandes client inexistant"

echo -e "${YELLOW}📊 TESTS DE STATISTIQUES${NC}"
echo "----------------------------"

# Test 11: Statistiques par statut
test_endpoint "GET" "$API_BASE/stats/by-status" 200 "Statistiques par statut"

# Test 12: Statistiques générales
test_endpoint "GET" "$API_BASE/stats/general" 200 "Statistiques générales"

echo -e "${YELLOW}🏷️ TESTS DE RÉCUPÉRATION DES STATUTS${NC}"
echo "--------------------------------------"

# Test 13: Récupération des statuts de commande
test_endpoint "GET" "$API_BASE/statuses/orders" 200 "Statuts de commande"

# Test 14: Récupération des statuts de ligne
test_endpoint "GET" "$API_BASE/statuses/lines" 200 "Statuts de ligne"

echo -e "${YELLOW}➕ TESTS DE CRÉATION DE COMMANDE${NC}"
echo "-----------------------------------"

# Test 15: Création d'une nouvelle commande
new_order_data='{
    "customerId": "81561",
    "totalAmount": 125.50,
    "ord_total_ht": "104.58",
    "ord_total_ttc": "125.50",
    "ord_shipping_cost": "5.00",
    "ord_cba_id": "1",
    "ord_cda_id": "1"
}'

test_endpoint "POST" "$API_BASE" 201 "Création nouvelle commande" "$new_order_data"

# Récupérer l'ID de la commande créée pour les tests suivants
created_order_id=$(curl -s -X POST -H "Content-Type: application/json" -d "$new_order_data" "$API_BASE" | grep -o '"ord_id":"[^"]*' | cut -d'"' -f4)

echo -e "${YELLOW}✏️ TESTS DE MISE À JOUR${NC}"
echo "----------------------------"

if [ ! -z "$created_order_id" ]; then
    echo "   Commande créée avec ID: $created_order_id"
    
    # Test 16: Mise à jour du statut de paiement
    payment_data='{"isPaid": true}'
    test_endpoint "PUT" "$API_BASE/$created_order_id/payment" 200 "Mise à jour statut paiement" "$payment_data"
    
    # Test 17: Mise à jour du statut de commande
    status_data='{"statusId": "2"}'
    test_endpoint "PUT" "$API_BASE/$created_order_id/status" 200 "Mise à jour statut commande" "$status_data"
    
    # Test 18: Mise à jour générale de la commande
    update_data='{"ord_total_ttc": "150.00", "ord_shipping_cost": "10.00"}'
    test_endpoint "PUT" "$API_BASE/$created_order_id" 200 "Mise à jour générale commande" "$update_data"
    
else
    echo -e "${RED}❌ Impossible de créer une commande pour les tests de mise à jour${NC}"
fi

echo -e "${YELLOW}🗑️ TESTS DE SUPPRESSION${NC}"
echo "----------------------------"

if [ ! -z "$created_order_id" ]; then
    # Test 19: Suppression de la commande
    test_endpoint "DELETE" "$API_BASE/$created_order_id" 200 "Suppression commande"
    
    # Test 20: Vérification que la commande a été supprimée
    test_endpoint "GET" "$API_BASE/$created_order_id" 404 "Vérification suppression"
else
    echo -e "${RED}❌ Pas de commande à supprimer${NC}"
fi

echo -e "${YELLOW}🔒 TESTS D'ADMINISTRATION${NC}"
echo "------------------------------"

# Test 21: Récupération avec relations complètes (admin)
test_endpoint "GET" "$API_BASE/admin/all-relations?page=1&limit=2" 200 "Commandes avec relations complètes"

if [ ! -z "$valid_order_id" ]; then
    # Test 22: Commande complète par ID (admin)
    test_endpoint "GET" "$API_BASE/admin/$valid_order_id/complete" 200 "Détails complets commande"
fi

echo -e "${YELLOW}❌ TESTS D'ERREURS${NC}"
echo "-------------------"

# Test 23: Méthode non autorisée
test_endpoint "PATCH" "$API_BASE" 405 "Méthode non autorisée"

# Test 24: Données invalides pour création
invalid_data='{"invalid": "data"}'
test_endpoint "POST" "$API_BASE" 400 "Données invalides pour création" "$invalid_data"

# Test 25: Mise à jour commande inexistante
update_data='{"ord_total_ttc": "200.00"}'
test_endpoint "PUT" "$API_BASE/INVALID_ID" 404 "Mise à jour commande inexistante" "$update_data"

echo ""
echo "============================================================================="
echo -e "${GREEN}🎉 Tests terminés !${NC}"
echo ""
echo "📋 Résumé des tests effectués:"
echo "   • Récupération des commandes avec pagination"
echo "   • Filtres par statut, client, et dates"
echo "   • Récupération par ID"
echo "   • Récupération par client"
echo "   • Statistiques et statuts"
echo "   • Création de commande"
echo "   • Mise à jour (paiement, statut, données)"
echo "   • Suppression"
echo "   • Fonctionnalités d'administration"
echo "   • Gestion des erreurs"
echo ""
echo -e "${BLUE}📊 Base de données utilisée: 1417 commandes réelles${NC}"
echo -e "${BLUE}🗃️ Tables intégrées: 7 tables avec relations complètes${NC}"
echo "============================================================================="
