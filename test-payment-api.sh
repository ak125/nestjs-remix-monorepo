#!/bin/bash

# Script de test complet pour l'API de paiement
# Usage: ./test-payment-api.sh [BASE_URL]

BASE_URL=${1:-"http://localhost:3001"}
API_URL="$BASE_URL/api/payments"

echo "=== Test API Paiements - $(date) ==="
echo "URL de base: $BASE_URL"
echo "API URL: $API_URL"
echo

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables temporaires
PAYMENT_ID=""
ORDER_ID="test-order-$(date +%s)"

# Fonction utilitaire
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Test: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        echo "Données: $data"
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X "$method" \
            "$endpoint")
    fi
    
    # Séparer la réponse du code de statut
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n1 | sed 's/HTTP_STATUS://')
    
    echo "Statut HTTP: $status"
    echo "Réponse: $body"
    
    if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
        print_success "Succès ($status)"
    elif [ "$status" -ge 400 ] && [ "$status" -lt 500 ]; then
        print_warning "Erreur client ($status)"
    else
        print_error "Erreur serveur ($status)"
    fi
    
    return $status
}

# ================================================================
# TESTS PRINCIPAUX
# ================================================================

print_section "1. Test de santé - Statistiques (endpoint simple)"
test_endpoint "GET" "$API_URL/stats" "" "Récupération des statistiques"

print_section "2. Création d'un paiement"
payment_data='{
  "orderId": "'$ORDER_ID'",
  "customerId": "cust_test_123",
  "amount": 29.99,
  "currency": "EUR",
  "description": "Test de paiement automatisé",
  "customerEmail": "test@example.com",
  "customerPhone": "+33123456789",
  "metadata": {
    "test": true,
    "automated": true
  }
}'

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payment_data" \
    "$API_URL")

body=$(echo "$response" | sed '$d')
status=$(echo "$response" | tail -n1 | sed 's/HTTP_STATUS://')

echo "Création paiement - Statut: $status"
echo "Réponse: $body"

if [ "$status" -eq 201 ]; then
    print_success "Paiement créé avec succès"
    # Extraire l'ID du paiement de la réponse JSON
    PAYMENT_ID=$(echo "$body" | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)
    echo "Payment ID extrait: $PAYMENT_ID"
else
    print_error "Échec de création du paiement"
fi

print_section "3. Consultation du paiement créé"
if [ -n "$PAYMENT_ID" ]; then
    test_endpoint "GET" "$API_URL/$PAYMENT_ID" "" "Récupération du paiement $PAYMENT_ID"
else
    print_warning "Pas d'ID de paiement - test ignoré"
fi

print_section "4. Initiation d'un paiement avec redirection"
initiate_data='{
  "orderId": "'$ORDER_ID'_initiate",
  "customerId": "cust_test_456",
  "amount": 49.99,
  "currency": "EUR",
  "gateway": "cyberplus",
  "description": "Test initiation paiement",
  "customerEmail": "initiate@example.com",
  "returnUrls": {
    "success": "'$BASE_URL'/payments/return/success",
    "cancel": "'$BASE_URL'/payments/return/cancel",
    "error": "'$BASE_URL'/payments/return/error"
  },
  "metadata": {
    "test": true,
    "type": "initiation"
  }
}'

test_endpoint "POST" "$API_URL/initiate" "$initiate_data" "Initiation de paiement avec redirection"

print_section "5. Historique des paiements d'une commande"
test_endpoint "GET" "$API_URL/order/$ORDER_ID/history" "" "Historique paiements commande $ORDER_ID"

print_section "6. Test de callback générique"
callback_data='{
  "transactionId": "test_tx_123",
  "orderId": "'$ORDER_ID'",
  "merchantId": "test_merchant",
  "status": "success",
  "responseCode": "00",
  "authorizationCode": "AUTH123",
  "amount": 29.99,
  "currency": "EUR",
  "signature": "test_signature_123",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "message": "Transaction réussie"
}'

test_endpoint "POST" "$API_URL/callback/generic" "$callback_data" "Test callback générique"

print_section "7. Test de callback Cyberplus"
cyberplus_callback='{
  "vads_trans_id": "test_tx_456",
  "vads_order_id": "'$ORDER_ID'",
  "vads_site_id": "12345678",
  "vads_trans_status": "AUTHORISED",
  "vads_result": "00",
  "vads_auth_number": "AUTH456",
  "vads_amount": "2999",
  "vads_currency": "978",
  "vads_payment_certificate": "CERT789",
  "vads_card_number": "497010XXXXXX0055",
  "vads_card_brand": "VISA",
  "vads_trans_date": "'$(date -u +%Y%m%d%H%M%S)'",
  "signature": "cyberplus_signature_test"
}'

test_endpoint "POST" "$API_URL/callback/cyberplus" "$cyberplus_callback" "Test callback Cyberplus"

print_section "8. Test des pages de retour"
test_endpoint "GET" "$API_URL/return/success?transactionId=test_tx_123&orderId=$ORDER_ID" "" "Page de retour succès"
test_endpoint "GET" "$API_URL/return/cancel?transactionId=test_tx_123&orderId=$ORDER_ID" "" "Page de retour annulation"
test_endpoint "GET" "$API_URL/return/error?transactionId=test_tx_123&orderId=$ORDER_ID" "" "Page de retour erreur"

print_section "9. Test de remboursement"
if [ -n "$PAYMENT_ID" ]; then
    refund_data='{"amount": 10.00}'
    test_endpoint "POST" "$API_URL/$PAYMENT_ID/refund" "$refund_data" "Remboursement partiel"
else
    print_warning "Pas d'ID de paiement - test de remboursement ignoré"
fi

print_section "10. Statistiques finales avec période"
start_date=$(date -d "1 hour ago" -u +%Y-%m-%dT%H:%M:%SZ)
end_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)
test_endpoint "GET" "$API_URL/stats?startDate=$start_date&endDate=$end_date" "" "Statistiques avec période"

# ================================================================
# TESTS D'ERREUR ET EDGE CASES
# ================================================================

print_section "TESTS D'ERREUR"

echo -e "\n${YELLOW}Test: Paiement inexistant${NC}"
test_endpoint "GET" "$API_URL/payment_inexistant" "" "Récupération paiement inexistant"

echo -e "\n${YELLOW}Test: Données invalides${NC}"
invalid_data='{"invalid": "data"}'
test_endpoint "POST" "$API_URL" "$invalid_data" "Création avec données invalides"

echo -e "\n${YELLOW}Test: Remboursement paiement inexistant${NC}"
test_endpoint "POST" "$API_URL/payment_inexistant/refund" '{"amount": 10}' "Remboursement inexistant"

# ================================================================
# RÉSUMÉ
# ================================================================

print_section "RÉSUMÉ DES TESTS"
echo "Tests terminés à $(date)"
echo "Order ID utilisé: $ORDER_ID"
if [ -n "$PAYMENT_ID" ]; then
    echo "Payment ID créé: $PAYMENT_ID"
fi

echo -e "\n${GREEN}Points testés:${NC}"
echo "✓ Création de paiement"
echo "✓ Consultation de paiement"
echo "✓ Initiation avec redirection"
echo "✓ Historique par commande"
echo "✓ Callbacks (générique et Cyberplus)"
echo "✓ Pages de retour"
echo "✓ Remboursements"
echo "✓ Statistiques"
echo "✓ Gestion d'erreurs"

echo -e "\n${BLUE}Pour tester manuellement:${NC}"
echo "curl -X GET $API_URL/stats"
echo "curl -X POST -H 'Content-Type: application/json' -d '$payment_data' $API_URL"

echo -e "\n${YELLOW}Note: Vérifiez les logs du serveur pour plus de détails sur les erreurs${NC}"
