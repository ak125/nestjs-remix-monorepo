#!/bin/bash

# ========================================
# TESTS CURL AVANCÉS - MODULE PAIEMENTS LEGACY
# ========================================
# Tests complets pour l'API des paiements basée sur les vraies tables legacy
# Tables utilisées: ___xtr_order, ic_postback

API_BASE="http://localhost:3000"
API_PAYMENTS="${API_BASE}/api/payments"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction pour tester une réponse
test_response() {
    local response="$1"
    local expected_status="$2"
    local test_name="$3"
    
    echo "----------------------------------------"
    log_info "TEST: $test_name"
    
    # Extraire le code de statut HTTP
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "Status Code: $status_code"
    echo "Response Body:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_success "Test réussi - Status $status_code"
    else
        log_error "Test échoué - Attendu $expected_status, reçu $status_code"
    fi
    echo ""
}

# Vérifier que le serveur est démarré
check_server() {
    log_info "Vérification de la disponibilité du serveur..."
    response=$(curl -s -w "\n%{http_code}" "$API_BASE/health" 2>/dev/null || echo -e "\n000")
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" -eq 000 ]; then
        log_error "Serveur non accessible sur $API_BASE"
        log_info "Assurez-vous que le serveur NestJS est démarré avec: npm run dev"
        exit 1
    else
        log_success "Serveur accessible (Status: $status_code)"
    fi
}

echo "========================================"
echo "🚀 TESTS CURL - MODULE PAIEMENTS LEGACY"
echo "========================================"
echo "Base URL: $API_BASE"
echo "Endpoints testés: /api/payments/*"
echo "Tables legacy: ___xtr_order, ic_postback"
echo "========================================"

check_server

# ========================================
# 1. TEST DES STATISTIQUES
# ========================================
log_info "📊 SECTION 1: Tests des statistiques"

response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/stats")
test_response "$response" 200 "Récupération des statistiques de paiement"

# ========================================
# 2. CRÉATION D'UN NOUVEAU PAIEMENT
# ========================================
log_info "💳 SECTION 2: Création de paiements"

# Test avec données valides
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "125.50",
        "ord_currency": "EUR",
        "payment_gateway": "STRIPE",
        "return_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
        "callback_url": "https://example.com/callback",
        "payment_metadata": {
            "product_type": "test",
            "campaign": "curl_test"
        }
    }' \
    "$API_PAYMENTS")
test_response "$response" 201 "Création d'un paiement valide"

# Extraire l'ID du paiement créé pour les tests suivants
if [ $? -eq 0 ]; then
    CREATED_ORDER_ID=$(echo "$response" | head -n -1 | jq -r '.ord_id // empty' 2>/dev/null)
    if [ -n "$CREATED_ORDER_ID" ] && [ "$CREATED_ORDER_ID" != "null" ]; then
        log_success "Paiement créé avec ID: $CREATED_ORDER_ID"
    fi
fi

# Test avec données invalides - montant manquant
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "payment_gateway": "STRIPE"
    }' \
    "$API_PAYMENTS")
test_response "$response" 400 "Création avec données manquantes (doit échouer)"

# Test avec gateway invalide
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "99.99",
        "payment_gateway": "GATEWAY_INEXISTANTE"
    }' \
    "$API_PAYMENTS")
test_response "$response" 400 "Création avec gateway invalide (doit échouer)"

# ========================================
# 3. TESTS DE RÉCUPÉRATION DE STATUT
# ========================================
log_info "🔍 SECTION 3: Récupération de statuts"

# Test avec une commande existante (utiliser un ID de la vraie table)
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/280001/status")
test_response "$response" 200 "Récupération du statut d'une commande existante"

# Test avec ID nouvellement créé (si disponible)
if [ -n "$CREATED_ORDER_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        "$API_PAYMENTS/${CREATED_ORDER_ID}/status")
    test_response "$response" 200 "Récupération du statut du paiement créé"
fi

# Test avec ID inexistant
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/999999/status")
test_response "$response" 404 "Récupération d'un paiement inexistant (doit échouer)"

# ========================================
# 4. INITIATION DE PAIEMENT
# ========================================
log_info "🚀 SECTION 4: Initiation de paiements"

# Test d'initiation avec une commande existante
if [ -n "$CREATED_ORDER_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "payment_gateway": "CYBERPLUS",
            "return_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
            "callback_url": "https://example.com/callback"
        }' \
        "$API_PAYMENTS/${CREATED_ORDER_ID}/initiate")
    test_response "$response" 200 "Initiation du paiement créé"
fi

# Test d'initiation avec commande existante de la vraie table
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "payment_gateway": "STRIPE",
        "return_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
    }' \
    "$API_PAYMENTS/280001/initiate")
test_response "$response" 200 "Initiation avec commande legacy existante"

# Test d'initiation avec commande inexistante
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "payment_gateway": "PAYPAL"
    }' \
    "$API_PAYMENTS/999999/initiate")
test_response "$response" 404 "Initiation avec commande inexistante (doit échouer)"

# ========================================
# 5. TESTS DE CALLBACKS
# ========================================
log_info "🔔 SECTION 5: Tests des callbacks de paiement"

# Callback CYBERPLUS succès
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "transactionId": "TXN_' $(date +%s) '",
        "orderId": "280001",
        "amount": "17.49",
        "currency": "EUR",
        "status": "SUCCESS",
        "gateway_response": {
            "response_code": "00",
            "auth_code": "123456"
        }
    }' \
    "$API_PAYMENTS/callback/cyberplus")
test_response "$response" 200 "Callback CYBERPLUS succès"

# Callback STRIPE succès
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "transactionId": "pi_test_' $(date +%s) '",
        "orderId": "280002",
        "amount": "196.13",
        "currency": "EUR",
        "status": "PAID",
        "gateway_response": {
            "payment_intent": "pi_test_example",
            "charge_id": "ch_test_example"
        }
    }' \
    "$API_PAYMENTS/callback/stripe")
test_response "$response" 200 "Callback STRIPE succès"

# Callback PAYPAL avec échec
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "transactionId": "PAYPAL_' $(date +%s) '",
        "orderId": "280003",
        "amount": "105.91",
        "currency": "EUR",
        "status": "FAILED",
        "gateway_response": {
            "error_code": "INSUFFICIENT_FUNDS",
            "error_message": "Insufficient funds in account"
        }
    }' \
    "$API_PAYMENTS/callback/paypal")
test_response "$response" 200 "Callback PAYPAL échec"

# Callback avec données invalides
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "invalid_field": "invalid_value"
    }' \
    "$API_PAYMENTS/callback/stripe")
test_response "$response" 400 "Callback avec données invalides (doit échouer)"

# ========================================
# 6. TESTS AVANCÉS - RECHERCHE PAR TRANSACTION
# ========================================
log_info "🔎 SECTION 6: Recherche avancée"

# Test de recherche par ID de transaction (si on en a créé un)
SAMPLE_TXN_ID="TXN_$(date +%s)"
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/transaction/${SAMPLE_TXN_ID}")
test_response "$response" 404 "Recherche par transaction inexistante"

# ========================================
# 7. TESTS DE CALLBACKS HISTORY
# ========================================
log_info "📜 SECTION 7: Historique des callbacks"

# Récupération des callbacks pour une commande
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/280001/callbacks")
test_response "$response" 200 "Récupération de l'historique des callbacks"

# ========================================
# 8. TESTS DE STRESS ET EDGE CASES
# ========================================
log_info "⚡ SECTION 8: Tests de stress et cas limites"

# Test avec très gros montant
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "999999.99",
        "ord_currency": "EUR",
        "payment_gateway": "BANK_TRANSFER"
    }' \
    "$API_PAYMENTS")
test_response "$response" 201 "Création avec montant élevé"

# Test avec montant négatif (doit échouer)
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "-50.00",
        "payment_gateway": "STRIPE"
    }' \
    "$API_PAYMENTS")
test_response "$response" 400 "Création avec montant négatif (doit échouer)"

# Test avec caractères spéciaux dans les métadonnées
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "25.00",
        "payment_gateway": "CYBERPLUS",
        "payment_metadata": {
            "description": "Paiement avec émojis 🚀💳✅",
            "special_chars": "àéèù@#$%^&*()",
            "unicode": "测试 тест テスト"
        }
    }' \
    "$API_PAYMENTS")
test_response "$response" 201 "Création avec caractères spéciaux"

# ========================================
# 9. TESTS DE PERFORMANCE - REQUÊTES MULTIPLES
# ========================================
log_info "🏃 SECTION 9: Tests de performance"

log_info "Test de 5 requêtes statistiques simultanées..."
for i in {1..5}; do
    curl -s "$API_PAYMENTS/stats" > /dev/null &
done
wait
log_success "Requêtes simultanées terminées"

# ========================================
# 10. VÉRIFICATION FINALE DES DONNÉES
# ========================================
log_info "🔄 SECTION 10: Vérification finale"

# Vérifier que les stats ont été mises à jour
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/stats")
test_response "$response" 200 "Vérification finale des statistiques"

# Afficher un résumé des données
log_info "Extraction des métriques finales..."
final_stats=$(echo "$response" | head -n -1 | jq '.' 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "📊 STATISTIQUES FINALES:"
    echo "$final_stats"
fi

echo ""
echo "========================================"
log_success "TESTS CURL TERMINÉS !"
echo "========================================"
log_info "🎯 Tous les endpoints de l'API payments ont été testés"
log_info "📋 Vérifiez les logs ci-dessus pour les détails"
log_info "🔧 En cas d'erreurs, vérifiez que le serveur NestJS est démarré"
log_info "💾 Les données sont persistées dans les tables legacy PostgreSQL"
echo "========================================"
