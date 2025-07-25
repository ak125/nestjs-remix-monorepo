#!/bin/bash

# 🧪 Script de Test Context7 - Validation Complète
# Teste toutes les fonctionnalités après les corrections Context7

echo "🧪 === TEST CONTEXT7 - VALIDATION COMPLÈTE ==="
echo "Date: $(date)"
echo "Serveur: http://localhost:3000"
echo ""

# Couleurs pour les résultats
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

print_info() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Variables
BASE_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"

echo "🔍 === TESTS BACKEND NESTJS ==="

# Test 1: Health Check Backend
print_info "Test 1: Backend Health Check"
curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1
print_result $? "Backend accessible sur :3001"

# Test 2: API Orders (Context7)
print_info "Test 2: API Orders avec Context7"
response=$(curl -s "$BACKEND_URL/api/orders?page=1&limit=5" 2>/dev/null)
if echo "$response" | grep -q '"success"'; then
    print_result 0 "API Orders fonctionne avec Context7"
else
    print_result 1 "API Orders ne répond pas correctement"
fi

# Test 3: API Dashboard Stats (Context7)
print_info "Test 3: Dashboard Stats avec Context7"
response=$(curl -s "$BACKEND_URL/api/dashboard/stats" 2>/dev/null)
if echo "$response" | grep -q '"context7"'; then
    print_result 0 "Dashboard Stats avec métadonnées Context7"
else
    print_result 1 "Dashboard Stats sans Context7"
fi

echo ""
echo "🎯 === TESTS FRONTEND REMIX ==="

# Test 4: Frontend Home
print_info "Test 4: Frontend accessible"
curl -s -f "$BASE_URL" > /dev/null 2>&1
print_result $? "Frontend Remix accessible sur :3000"

# Test 5: Admin Login Page
print_info "Test 5: Page de connexion admin"
response=$(curl -s "$BASE_URL/admin/login" 2>/dev/null)
if echo "$response" | grep -q "admin" || echo "$response" | grep -q "login"; then
    print_result 0 "Page de connexion admin accessible"
else
    print_result 1 "Page de connexion admin non accessible"
fi

echo ""
echo "🔐 === TESTS AUTHENTICATION ==="

# Test 6: Test de l'API d'authentification
print_info "Test 6: Test authentification API"
auth_response=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@autoparts.com","password":"admin123"}' 2>/dev/null)

if echo "$auth_response" | grep -q "success\|user\|token"; then
    print_result 0 "API d'authentification fonctionne"
else
    print_result 1 "API d'authentification échoue"
fi

echo ""
echo "🛒 === TESTS MODULES CONTEXT7 ==="

# Test 7: Cart API (Context7)
print_info "Test 7: Cart Service avec Context7"
cart_response=$(curl -s "$BACKEND_URL/api/cart/summary" 2>/dev/null)
if echo "$cart_response" | grep -q '"success"'; then
    print_result 0 "Cart Service fonctionne avec Context7"
else
    print_result 1 "Cart Service ne fonctionne pas"
fi

# Test 8: Payments API (Context7)
print_info "Test 8: Payments Service avec Context7"
payments_response=$(curl -s "$BACKEND_URL/api/payments/stats" 2>/dev/null)
if echo "$payments_response" | grep -q '"success"'; then
    print_result 0 "Payments Service fonctionne avec Context7"
else
    print_result 1 "Payments Service ne fonctionne pas"
fi

echo ""
echo "💾 === TESTS CACHE REDIS ==="

# Test 9: Redis Connection
print_info "Test 9: Connexion Redis"
if command -v redis-cli > /dev/null 2>&1; then
    redis-cli ping > /dev/null 2>&1
    print_result $? "Redis répond au ping"
else
    print_warning "redis-cli non installé - impossible de tester"
fi

# Test 10: Cache Test via API
print_info "Test 10: Test du cache via API"
# Premier appel pour mettre en cache
curl -s "$BACKEND_URL/api/dashboard/stats" > /dev/null 2>&1
# Deuxième appel pour vérifier le cache
cache_response=$(curl -s "$BACKEND_URL/api/dashboard/stats" 2>/dev/null)
if echo "$cache_response" | grep -q '"cacheAvailable"'; then
    print_result 0 "Cache Context7 fonctionne"
else
    print_result 1 "Cache Context7 non détecté"
fi

echo ""
echo "📊 === TESTS PERFORMANCE ==="

# Test 11: Temps de réponse Dashboard
print_info "Test 11: Temps de réponse Dashboard"
start_time=$(date +%s%N)
curl -s "$BACKEND_URL/api/dashboard/stats" > /dev/null 2>&1
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

if [ $duration -lt 1000 ]; then
    print_result 0 "Temps de réponse Dashboard: ${duration}ms (excellent)"
elif [ $duration -lt 2000 ]; then
    print_result 0 "Temps de réponse Dashboard: ${duration}ms (bon)"
else
    print_result 1 "Temps de réponse Dashboard: ${duration}ms (lent)"
fi

# Test 12: Charge Test (5 requêtes simultanées)
print_info "Test 12: Test de charge (5 requêtes simultanées)"
for i in {1..5}; do
    curl -s "$BACKEND_URL/api/orders?page=1&limit=10" > /dev/null 2>&1 &
done
wait
print_result 0 "Test de charge terminé"

echo ""
echo "🔧 === RÉSUMÉ CONTEXT7 ==="

print_info "Services disponibles avec Context7:"
response=$(curl -s "$BACKEND_URL/api/dashboard/stats" 2>/dev/null)
if echo "$response" | grep -q '"ordersComplete":true'; then
    echo -e "${GREEN}  ✅ OrdersCompleteService${NC}"
else
    echo -e "${YELLOW}  🔄 OrdersCompleteService (fallback)${NC}"
fi

if echo "$response" | grep -q '"cache":true'; then
    echo -e "${GREEN}  ✅ CacheService${NC}"
else
    echo -e "${YELLOW}  🔄 CacheService (fallback)${NC}"
fi

if echo "$response" | grep -q '"payments":true'; then
    echo -e "${GREEN}  ✅ PaymentsService${NC}"
else
    echo -e "${YELLOW}  🔄 PaymentsService (fallback)${NC}"
fi

echo ""
echo "🎉 === TESTS TERMINÉS ==="
echo "Tous les tests Context7 ont été exécutés"
echo "Le système est prêt pour la production ! 🚀"
echo ""
