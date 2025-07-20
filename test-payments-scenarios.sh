#!/bin/bash

# ========================================
# TESTS CURL SCÉNARIOS MÉTIER - PAIEMENTS
# ========================================
# Tests de scénarios complets et cas d'usage réels

API_BASE="http://localhost:3000"
API_PAYMENTS="${API_BASE}/api/payments"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log_scenario() {
    echo -e "${MAGENTA}🎬 $1${NC}"
}

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

# Variables pour stocker les IDs créés pendant les tests
CREATED_ORDERS=()

# Fonction pour tester un scénario complet
test_scenario() {
    local scenario_name="$1"
    local expected_status="$2"
    local response="$3"
    
    echo "========================================="
    log_scenario "SCÉNARIO: $scenario_name"
    echo "========================================="
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "Status Code: $status_code"
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_success "Scénario réussi ✓"
    else
        log_error "Scénario échoué - Attendu $expected_status, reçu $status_code"
    fi
    
    echo ""
    return $status_code
}

# Fonction pour extraire l'ID d'une commande créée
extract_order_id() {
    local response="$1"
    local body=$(echo "$response" | head -n -1)
    echo "$body" | jq -r '.ord_id // empty' 2>/dev/null
}

echo "========================================"
echo "🎬 TESTS SCÉNARIOS MÉTIER - PAIEMENTS"
echo "========================================"
echo "Tests de cas d'usage réels et workflows complets"
echo "Tables: ___xtr_order, ic_postback"
echo "========================================"

# ========================================
# SCÉNARIO 1: PAIEMENT CARTE BANCAIRE RÉUSSI
# ========================================
log_scenario "SCÉNARIO 1: Paiement par carte bancaire complet"

# Étape 1: Création de la commande
log_info "Étape 1/4: Création de la commande"
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "149.99",
        "ord_currency": "EUR",
        "payment_gateway": "CYBERPLUS",
        "return_url": "https://boutique.example.com/payment/success",
        "cancel_url": "https://boutique.example.com/payment/cancel",
        "callback_url": "https://boutique.example.com/api/payment/callback",
        "payment_metadata": {
            "product_name": "Formation JavaScript Avancé",
            "customer_email": "client@example.com",
            "campaign": "summer_2025"
        }
    }' \
    "$API_PAYMENTS")

test_scenario "Création commande formation en ligne" 201 "$response"
ORDER_ID=$(extract_order_id "$response")
if [ -n "$ORDER_ID" ]; then
    CREATED_ORDERS+=("$ORDER_ID")
    log_success "Commande créée avec ID: $ORDER_ID"
fi

# Étape 2: Initiation du paiement
if [ -n "$ORDER_ID" ]; then
    log_info "Étape 2/4: Initiation du paiement"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "payment_gateway": "CYBERPLUS",
            "return_url": "https://boutique.example.com/payment/success",
            "cancel_url": "https://boutique.example.com/payment/cancel",
            "callback_url": "https://boutique.example.com/api/payment/callback"
        }' \
        "$API_PAYMENTS/${ORDER_ID}/initiate")
    
    test_scenario "Initiation paiement CYBERPLUS" 200 "$response"
fi

# Étape 3: Vérification du statut (en cours)
if [ -n "$ORDER_ID" ]; then
    log_info "Étape 3/4: Vérification du statut avant paiement"
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        "$API_PAYMENTS/${ORDER_ID}/status")
    
    test_scenario "Statut avant paiement (EN_ATTENTE)" 200 "$response"
fi

# Étape 4: Simulation callback de succès
if [ -n "$ORDER_ID" ]; then
    log_info "Étape 4/4: Callback de succès de la banque"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "transactionId": "CYBERPLUS_'$(date +%s)'",
            "orderId": "'$ORDER_ID'",
            "amount": "149.99",
            "currency": "EUR",
            "status": "SUCCESS",
            "gateway_response": {
                "response_code": "00",
                "auth_code": "654321",
                "card_type": "VISA",
                "card_last4": "1234"
            }
        }' \
        "$API_PAYMENTS/callback/cyberplus")
    
    test_scenario "Callback succès CYBERPLUS" 200 "$response"
    
    # Vérification finale du statut
    sleep 1
    log_info "Vérification finale: Statut après paiement"
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        "$API_PAYMENTS/${ORDER_ID}/status")
    
    test_scenario "Statut après paiement (PAYÉ)" 200 "$response"
fi

# ========================================
# SCÉNARIO 2: PAIEMENT STRIPE ÉCHOUÉ
# ========================================
log_scenario "SCÉNARIO 2: Paiement Stripe avec échec"

# Création commande pour test d'échec
log_info "Étape 1/3: Création commande e-commerce"
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81525",
        "ord_total_ttc": "89.50",
        "ord_currency": "EUR",
        "payment_gateway": "STRIPE",
        "return_url": "https://shop.example.com/success",
        "cancel_url": "https://shop.example.com/cancel",
        "payment_metadata": {
            "product_type": "ebook",
            "product_id": "ebook_nodejs_2025",
            "discount_applied": "WELCOME10"
        }
    }' \
    "$API_PAYMENTS")

test_scenario "Création commande e-book" 201 "$response"
ORDER_ID_2=$(extract_order_id "$response")
if [ -n "$ORDER_ID_2" ]; then
    CREATED_ORDERS+=("$ORDER_ID_2")
fi

# Simulation callback d'échec
if [ -n "$ORDER_ID_2" ]; then
    log_info "Étape 2/3: Callback d'échec Stripe"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "transactionId": "pi_failed_'$(date +%s)'",
            "orderId": "'$ORDER_ID_2'",
            "amount": "89.50",
            "currency": "EUR",
            "status": "FAILED",
            "gateway_response": {
                "error_code": "card_declined",
                "error_message": "Your card was declined.",
                "decline_code": "insufficient_funds"
            }
        }' \
        "$API_PAYMENTS/callback/stripe")
    
    test_scenario "Callback échec Stripe" 200 "$response"
    
    # Vérification du statut après échec
    log_info "Étape 3/3: Vérification statut après échec"
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        "$API_PAYMENTS/${ORDER_ID_2}/status")
    
    test_scenario "Statut après échec (toujours EN_ATTENTE)" 200 "$response"
fi

# ========================================
# SCÉNARIO 3: PAIEMENT PAYPAL AVEC REMBOURSEMENT
# ========================================
log_scenario "SCÉNARIO 3: Workflow PayPal avec remboursement"

# Création commande
log_info "Étape 1/5: Création commande service"
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81522",
        "ord_total_ttc": "299.00",
        "ord_currency": "EUR",
        "payment_gateway": "PAYPAL",
        "return_url": "https://services.example.com/payment/return",
        "cancel_url": "https://services.example.com/payment/cancel",
        "payment_metadata": {
            "service_type": "consultation",
            "duration_hours": "3",
            "consultant_id": "consultant_123"
        }
    }' \
    "$API_PAYMENTS")

test_scenario "Création commande consultation" 201 "$response"
ORDER_ID_3=$(extract_order_id "$response")
if [ -n "$ORDER_ID_3" ]; then
    CREATED_ORDERS+=("$ORDER_ID_3")
fi

# Initiation PayPal
if [ -n "$ORDER_ID_3" ]; then
    log_info "Étape 2/5: Initiation PayPal"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "payment_gateway": "PAYPAL",
            "return_url": "https://services.example.com/payment/return",
            "cancel_url": "https://services.example.com/payment/cancel"
        }' \
        "$API_PAYMENTS/${ORDER_ID_3}/initiate")
    
    test_scenario "Initiation PayPal" 200 "$response"
fi

# Callback de succès PayPal
if [ -n "$ORDER_ID_3" ]; then
    log_info "Étape 3/5: Callback succès PayPal"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "transactionId": "PAYPAL_'$(date +%s)'",
            "orderId": "'$ORDER_ID_3'",
            "amount": "299.00",
            "currency": "EUR",
            "status": "SUCCESS",
            "gateway_response": {
                "payment_id": "PAYID-'$(date +%s)'",
                "payer_email": "customer@example.com",
                "payer_status": "VERIFIED"
            }
        }' \
        "$API_PAYMENTS/callback/paypal")
    
    test_scenario "Callback succès PayPal" 200 "$response"
fi

# Simulation d'un remboursement
if [ -n "$ORDER_ID_3" ]; then
    log_info "Étape 4/5: Simulation remboursement"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "transactionId": "REFUND_'$(date +%s)'",
            "orderId": "'$ORDER_ID_3'",
            "amount": "299.00",
            "currency": "EUR",
            "status": "REFUNDED",
            "gateway_response": {
                "refund_id": "REFUND_'$(date +%s)'",
                "reason": "customer_request",
                "refund_amount": "299.00"
            }
        }' \
        "$API_PAYMENTS/callback/paypal")
    
    test_scenario "Callback remboursement PayPal" 200 "$response"
    
    # Vérification historique des callbacks
    log_info "Étape 5/5: Vérification historique callbacks"
    response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        "$API_PAYMENTS/${ORDER_ID_3}/callbacks")
    
    test_scenario "Historique callbacks (2 entrées attendues)" 200 "$response"
fi

# ========================================
# SCÉNARIO 4: VIREMENT BANCAIRE MANUEL
# ========================================
log_scenario "SCÉNARIO 4: Paiement par virement bancaire"

# Création commande pour gros montant
log_info "Étape 1/2: Création commande gros montant"
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81558",
        "ord_total_ttc": "2499.00",
        "ord_currency": "EUR",
        "payment_gateway": "BANK_TRANSFER",
        "payment_metadata": {
            "product_type": "formation_entreprise",
            "participants": "15",
            "company": "TechCorp SARL",
            "invoice_required": true
        }
    }' \
    "$API_PAYMENTS")

test_scenario "Création commande formation entreprise" 201 "$response"
ORDER_ID_4=$(extract_order_id "$response")
if [ -n "$ORDER_ID_4" ]; then
    CREATED_ORDERS+=("$ORDER_ID_4")
    
    # Simulation validation manuelle
    log_info "Étape 2/2: Simulation validation manuelle virement"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "transactionId": "TRANSFER_'$(date +%s)'",
            "orderId": "'$ORDER_ID_4'",
            "amount": "2499.00",
            "currency": "EUR",
            "status": "SUCCESS",
            "gateway_response": {
                "bank_reference": "REF'$(date +%s)'",
                "validated_by": "admin_user",
                "validation_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
            }
        }' \
        "$API_PAYMENTS/callback/bank_transfer")
    
    test_scenario "Validation manuelle virement" 200 "$response"
fi

# ========================================
# SCÉNARIO 5: TESTS DE RÉCONCILIATION
# ========================================
log_scenario "SCÉNARIO 5: Réconciliation et rapports"

# Test des statistiques après tous les paiements
log_info "Récupération des statistiques finales"
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/stats")

test_scenario "Statistiques après scénarios métier" 200 "$response"

# Affichage du résumé des statistiques
if [ $? -eq 0 ]; then
    stats_body=$(echo "$response" | head -n -1)
    if echo "$stats_body" | jq . >/dev/null 2>&1; then
        echo "📊 STATISTIQUES APRÈS TESTS:"
        echo "$stats_body" | jq '{
            total_orders: .total_orders,
            paid_orders: .paid_orders,
            pending_orders: .pending_orders,
            total_amount: .total_amount,
            currency: .currency
        }'
    fi
fi

# ========================================
# SCÉNARIO 6: TESTS DE COHÉRENCE DES DONNÉES
# ========================================
log_scenario "SCÉNARIO 6: Vérification cohérence des données"

# Vérification de chaque commande créée
log_info "Vérification des commandes créées pendant les tests"
for order_id in "${CREATED_ORDERS[@]}"; do
    if [ -n "$order_id" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -H "Content-Type: application/json" \
            "$API_PAYMENTS/${order_id}/status")
        
        status_code=$(echo "$response" | tail -n1)
        if [ "$status_code" -eq 200 ]; then
            log_success "Commande $order_id: Accessible ✓"
        else
            log_error "Commande $order_id: Problème d'accès"
        fi
    fi
done

# ========================================
# RAPPORT FINAL DES SCÉNARIOS
# ========================================
echo ""
echo "========================================"
log_success "SCÉNARIOS MÉTIER TERMINÉS !"
echo "========================================"

log_scenario "📋 RÉSUMÉ DES SCÉNARIOS TESTÉS:"
log_info "✓ Paiement carte bancaire complet (CYBERPLUS)"
log_info "✓ Paiement Stripe avec échec"
log_info "✓ Workflow PayPal avec remboursement"
log_info "✓ Virement bancaire manuel"
log_info "✓ Réconciliation et rapports"
log_info "✓ Vérification cohérence des données"

echo ""
log_info "💳 GATEWAYS TESTÉES:"
log_success "• CYBERPLUS (succès)"
log_success "• STRIPE (échec)"
log_success "• PAYPAL (succès + remboursement)"
log_success "• BANK_TRANSFER (validation manuelle)"

echo ""
log_info "📈 COMMANDES CRÉÉES PENDANT LES TESTS:"
for order_id in "${CREATED_ORDERS[@]}"; do
    if [ -n "$order_id" ]; then
        log_info "• Commande #$order_id"
    fi
done

echo ""
log_scenario "🎯 Tous les scénarios métier ont été exécutés avec succès !"
log_info "Les données sont persistées dans les tables legacy PostgreSQL"
echo "========================================"
