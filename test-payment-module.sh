#!/bin/bash

# Script de test du module des paiements
echo "🚀 Test du module des paiements..."

# Configuration
API_URL="http://localhost:3001"
ADMIN_TOKEN=""

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
show_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Fonction pour tester une API
test_api() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    local description=$4
    
    echo -e "${YELLOW}🔍 Test: $description${NC}"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X $method \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -d "$data" \
            "$API_URL$endpoint" \
            -w "%{http_code}")
    else
        response=$(curl -s -X $method \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            "$API_URL$endpoint" \
            -w "%{http_code}")
    fi
    
    # Extraire le code de statut HTTP
    http_code="${response: -3}"
    body="${response%???}"
    
    echo "📥 Response Code: $http_code"
    echo "📄 Response Body: $body"
    
    # Vérifier si la réponse est valide
    if [[ "$http_code" =~ ^[23] ]]; then
        show_result 0 "$description"
        return 0
    else
        show_result 1 "$description"
        return 1
    fi
}

echo "📋 Vérification de la structure des APIs..."

# Démarrer le serveur en arrière-plan si nécessaire
echo "🔍 Vérification si le serveur est en cours d'exécution..."
if ! curl -s "$API_URL/api/health" > /dev/null 2>&1; then
    echo "⚠️  Le serveur n'est pas en cours d'exécution"
    echo "💡 Démarrez le serveur avec: npm run start:dev"
    exit 1
fi

echo "🎯 Test des endpoints des paiements..."

# Test 1: Vérifier la route de création de paiement
test_api "/api/payments" "POST" '{
    "pay_order_id": 123,
    "pay_amount": 99.99,
    "pay_currency": "EUR",
    "pay_gateway": "STRIPE",
    "pay_customer_email": "test@example.com"
}' "Création d'un paiement"

# Test 2: Vérifier la route d'initiation de paiement
test_api "/api/payments/1/initiate" "POST" '{
    "returnUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
}' "Initiation d'un paiement"

# Test 3: Vérifier la route de callback (simulation)
test_api "/api/payments/callback/stripe" "POST" '{
    "id": "pi_test_123",
    "status": "succeeded",
    "amount": 9999,
    "currency": "eur"
}' "Callback de paiement Stripe"

# Test 4: Vérifier la route de statut
test_api "/api/payments/1/status" "GET" "" "Statut d'un paiement"

# Test 5: Vérifier la route des statistiques (admin)
test_api "/api/payments/stats" "GET" "" "Statistiques des paiements"

echo ""
echo "🎉 Tests terminés !"
echo ""
echo "📖 Documentation des endpoints:"
echo "  POST   /api/payments           - Créer un nouveau paiement"
echo "  POST   /api/payments/:id/initiate - Initier un paiement"
echo "  POST   /api/payments/callback/:gateway - Recevoir les callbacks"
echo "  GET    /api/payments/:id/status - Obtenir le statut d'un paiement"
echo "  GET    /api/payments/stats     - Statistiques des paiements (admin)"
echo ""
echo "💡 Assurez-vous que les tables 'payment' et 'payment_log' existent dans Supabase"
echo "💡 Consultez le fichier create-payment-tables.sql pour créer les tables"
