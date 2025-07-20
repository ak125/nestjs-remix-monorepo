#!/bin/bash

# ========================================
# TESTS CURL PERFORMANCE & CHARGE - PAIEMENTS
# ========================================
# Tests de performance, charge et stress pour l'API paiements

API_BASE="http://localhost:3000"
API_PAYMENTS="${API_BASE}/api/payments"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_perf() {
    echo -e "${CYAN}⚡ $1${NC}"
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

# Fonction pour mesurer le temps de réponse
measure_response_time() {
    local url="$1"
    local method="${2:-GET}"
    local data="$3"
    local test_name="$4"
    
    log_perf "Test de performance: $test_name"
    
    start_time=$(date +%s%3N)
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url")
    else
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$url")
    fi
    
    end_time=$(date +%s%3N)
    
    # Extraire les métriques
    body=$(echo "$response" | head -n -3)
    status_code=$(echo "$response" | tail -n 2 | head -n 1)
    curl_time=$(echo "$response" | tail -n 1)
    total_time=$((end_time - start_time))
    
    echo "Status: $status_code | Temps cURL: ${curl_time}s | Temps total: ${total_time}ms"
    
    # Analyse du contenu de la réponse pour les stats
    if echo "$body" | jq . >/dev/null 2>&1; then
        echo "Réponse JSON valide"
    else
        echo "Réponse non-JSON ou invalide"
    fi
    
    echo "----------------------------------------"
    return $status_code
}

# Fonction pour tests de charge parallèle
load_test() {
    local url="$1"
    local concurrent="$2"
    local total_requests="$3"
    local test_name="$4"
    
    log_perf "TEST DE CHARGE: $test_name"
    log_info "Requêtes: $total_requests | Concurrence: $concurrent"
    
    # Créer un fichier temporaire pour les résultats
    temp_file="/tmp/load_test_results_$$"
    
    start_time=$(date +%s)
    
    # Lancer les requêtes en parallèle
    for ((i=1; i<=total_requests; i++)); do
        ((i%concurrent == 0)) && wait  # Attendre si on atteint la limite de concurrence
        
        (
            response_time=$(curl -s -w "%{time_total}" -o /dev/null "$url")
            status_code=$(curl -s -w "%{http_code}" -o /dev/null "$url")
            echo "$status_code,$response_time" >> "$temp_file"
        ) &
    done
    
    wait  # Attendre que toutes les requêtes se terminent
    end_time=$(date +%s)
    
    # Analyser les résultats
    if [ -f "$temp_file" ]; then
        total_time=$((end_time - start_time))
        success_count=$(grep -c "^200," "$temp_file" 2>/dev/null || echo "0")
        error_count=$((total_requests - success_count))
        
        # Calculer les temps de réponse
        avg_time=$(awk -F',' '{sum+=$2; count++} END {if(count>0) print sum/count; else print 0}' "$temp_file")
        min_time=$(awk -F',' 'NR==1{min=$2} {if($2<min) min=$2} END {print min}' "$temp_file")
        max_time=$(awk -F',' '{if($2>max) max=$2} END {print max}' "$temp_file")
        
        requests_per_second=$(echo "scale=2; $total_requests / $total_time" | bc -l 2>/dev/null || echo "N/A")
        
        echo "📊 RÉSULTATS:"
        echo "   Durée totale: ${total_time}s"
        echo "   Requêtes réussies: $success_count/$total_requests"
        echo "   Requêtes échouées: $error_count"
        echo "   Req/sec: $requests_per_second"
        echo "   Temps moyen: ${avg_time}s"
        echo "   Temps min: ${min_time}s"
        echo "   Temps max: ${max_time}s"
        
        # Nettoyer
        rm -f "$temp_file"
    else
        log_error "Impossible de lire les résultats"
    fi
    
    echo "========================================"
}

echo "========================================"
echo "⚡ TESTS PERFORMANCE - MODULE PAIEMENTS"
echo "========================================"
echo "Base URL: $API_BASE"
echo "Tests: Performance, Charge, Stress"
echo "========================================"

# Vérifier que les outils nécessaires sont installés
if ! command -v bc &> /dev/null; then
    log_warning "bc n'est pas installé - certains calculs seront limités"
fi

# ========================================
# 1. TESTS DE TEMPS DE RÉPONSE INDIVIDUELS
# ========================================
log_perf "SECTION 1: Tests de temps de réponse"

measure_response_time "$API_PAYMENTS/stats" "GET" "" "Récupération des statistiques"

# Test de création d'un paiement
payment_data='{
    "ord_cst_id": "81500",
    "ord_total_ttc": "99.99",
    "ord_currency": "EUR",
    "payment_gateway": "STRIPE",
    "return_url": "https://example.com/success",
    "cancel_url": "https://example.com/cancel"
}'
measure_response_time "$API_PAYMENTS" "POST" "$payment_data" "Création d'un paiement"

measure_response_time "$API_PAYMENTS/280001/status" "GET" "" "Récupération du statut"

# ========================================
# 2. TESTS DE CHARGE LÉGÈRE
# ========================================
log_perf "SECTION 2: Tests de charge légère"

load_test "$API_PAYMENTS/stats" 5 20 "Stats - 20 requêtes, 5 concurrent"

# ========================================
# 3. TESTS DE CHARGE MODÉRÉE
# ========================================
log_perf "SECTION 3: Tests de charge modérée"

load_test "$API_PAYMENTS/stats" 10 50 "Stats - 50 requêtes, 10 concurrent"

# Test sur différents endpoints
endpoints=(
    "$API_PAYMENTS/stats:Stats"
    "$API_PAYMENTS/280001/status:Status"
    "$API_PAYMENTS/280002/status:Status_Alt"
)

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r endpoint name <<< "$endpoint_info"
    load_test "$endpoint" 8 30 "$name - 30 requêtes, 8 concurrent"
done

# ========================================
# 4. TESTS DE CHARGE INTENSIVE
# ========================================
log_perf "SECTION 4: Tests de charge intensive"

log_warning "⚠️  Tests intensifs - peut impacter les performances du serveur"
load_test "$API_PAYMENTS/stats" 20 100 "Stats - 100 requêtes, 20 concurrent"

# ========================================
# 5. TESTS DE STRESS - CRÉATION MASSIVE
# ========================================
log_perf "SECTION 5: Tests de stress - Créations multiples"

log_info "Test de création de 10 paiements en parallèle..."
start_time=$(date +%s)

for i in {1..10}; do
    (
        payment_data='{
            "ord_cst_id": "8150'$i'",
            "ord_total_ttc": "'$((50 + i))'.99",
            "ord_currency": "EUR",
            "payment_gateway": "CYBERPLUS",
            "payment_metadata": {"test_batch": "stress_'$i'"}
        }'
        
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$payment_data" \
            "$API_PAYMENTS")
        
        status_code=$(echo "$response" | tail -n1)
        echo "Création $i: Status $status_code"
    ) &
done

wait
end_time=$(date +%s)
creation_time=$((end_time - start_time))

log_success "10 créations parallèles terminées en ${creation_time}s"

# ========================================
# 6. TESTS DE STRESS - CALLBACKS MULTIPLES
# ========================================
log_perf "SECTION 6: Tests de stress - Callbacks multiples"

log_info "Test de 15 callbacks simultanés..."
start_time=$(date +%s)

for i in {1..15}; do
    (
        callback_data='{
            "transactionId": "STRESS_TXN_'$(date +%s)'_'$i'",
            "orderId": "280001",
            "amount": "17.49",
            "currency": "EUR",
            "status": "SUCCESS",
            "gateway_response": {"test_stress": "'$i'"}
        }'
        
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$callback_data" \
            "$API_PAYMENTS/callback/cyberplus")
        
        status_code=$(echo "$response" | tail -n1)
        echo "Callback $i: Status $status_code"
    ) &
done

wait
end_time=$(date +%s)
callback_time=$((end_time - start_time))

log_success "15 callbacks parallèles terminés en ${callback_time}s"

# ========================================
# 7. TESTS DE MÉMOIRE ET RESSOURCES
# ========================================
log_perf "SECTION 7: Tests de consommation mémoire"

# Test avec payload volumineux
log_info "Test avec payload de grande taille..."

large_metadata='{"large_data":"'
for i in {1..500}; do
    large_metadata+="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
done
large_metadata+='"}'

large_payment_data='{
    "ord_cst_id": "81500",
    "ord_total_ttc": "100.00",
    "ord_currency": "EUR",
    "payment_gateway": "STRIPE",
    "payment_metadata": '$large_metadata'
}'

start_time=$(date +%s%3N)
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$large_payment_data" \
    "$API_PAYMENTS")
end_time=$(date +%s%3N)

status_code=$(echo "$response" | tail -n1)
processing_time=$((end_time - start_time))

echo "Payload volumineux: Status $status_code, Temps: ${processing_time}ms"

# ========================================
# 8. TESTS DE RÉCUPÉRATION APRÈS CHARGE
# ========================================
log_perf "SECTION 8: Tests de récupération"

log_info "Test de récupération après charge intensive..."
sleep 2

# Test de santé du système après charge
for i in {1..5}; do
    measure_response_time "$API_PAYMENTS/stats" "GET" "" "Récupération post-charge #$i"
    sleep 1
done

# ========================================
# 9. BENCHMARK COMPARATIF
# ========================================
log_perf "SECTION 9: Benchmark comparatif des endpoints"

endpoints_benchmark=(
    "$API_PAYMENTS/stats:GET:Stats"
    "$API_PAYMENTS/280001/status:GET:Status"
    "$API_PAYMENTS/280001/callbacks:GET:Callbacks"
)

echo "📊 BENCHMARK COMPARATIF:"
echo "Endpoint | Méthode | Temps | Status"
echo "---------|---------|-------|-------"

for endpoint_info in "${endpoints_benchmark[@]}"; do
    IFS=':' read -r endpoint method name <<< "$endpoint_info"
    
    start_time=$(date +%s%3N)
    response=$(curl -s -w "\n%{http_code}" "$endpoint")
    end_time=$(date +%s%3N)
    
    status_code=$(echo "$response" | tail -n1)
    response_time=$((end_time - start_time))
    
    printf "%-25s | %-7s | %5dms | %s\n" "$name" "$method" "$response_time" "$status_code"
done

# ========================================
# 10. RAPPORT FINAL
# ========================================
echo ""
echo "========================================"
log_success "TESTS DE PERFORMANCE TERMINÉS !"
echo "========================================"

log_perf "📈 RÉSUMÉ DES PERFORMANCES:"
log_info "✓ Temps de réponse individuels testés"
log_info "✓ Tests de charge légère à intensive"
log_info "✓ Tests de stress sur créations et callbacks"
log_info "✓ Tests de consommation mémoire"
log_info "✓ Tests de récupération système"
log_info "✓ Benchmark comparatif des endpoints"

echo ""
log_warning "💡 RECOMMANDATIONS:"
log_info "• Surveillez les temps de réponse > 1s"
log_info "• Implémentez une limitation de taux si nécessaire"
log_info "• Optimisez les requêtes base de données"
log_info "• Considérez la mise en cache pour les stats"
log_info "• Surveillez la mémoire avec des payloads volumineux"

echo "========================================"
log_perf "🎯 Tests de performance terminés avec succès !"
echo "========================================"
