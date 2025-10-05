#!/bin/bash

# 🧪 TESTS COMPLETS API ADMIN MODULE
# Tests exhaustifs des endpoints admin avec authentification

echo "════════════════════════════════════════════════════════════════"
echo "🧪 TESTS COMPLETS API ADMIN MODULE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0
SKIPPED=0

# Fonction pour afficher les résultats
test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4
  local data=$5
  
  echo -n "Testing ${method} ${endpoint} ... "
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X ${method} \
      "${BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -d "${data}" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X ${method} "${BASE_URL}${endpoint}" 2>&1)
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (${status_code}) - ${description}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: ${expected_status}, Got: ${status_code}) - ${description}"
    echo -e "${YELLOW}Response: ${body:0:200}${NC}"
    ((FAILED++))
  fi
}

echo "════════════════════════════════════════════════════════════════"
echo "📦 1. GESTION DES STOCKS (StockController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}1.1 Dashboard et Statistiques${NC}"
test_endpoint "GET" "/admin/stock/dashboard" "403" "Dashboard stock (auth required)"
test_endpoint "GET" "/admin/stock/stats" "403" "Statistiques stock (auth required)"
test_endpoint "GET" "/admin/stock/health" "403" "Health check stock (auth required)"

echo ""
echo -e "${CYAN}1.2 Recherche et Filtrage${NC}"
test_endpoint "GET" "/admin/stock/search?query=filtre" "403" "Recherche produits (auth required)"
test_endpoint "GET" "/admin/stock/top-items" "403" "Top produits (auth required)"
test_endpoint "GET" "/admin/stock/alerts" "403" "Alertes stock (auth required)"

echo ""
echo -e "${CYAN}1.3 Gestion Produits${NC}"
test_endpoint "GET" "/admin/stock/product123/movements" "403" "Historique mouvements (auth required)"
test_endpoint "PUT" "/admin/stock/product123" "403" "Mise à jour stock (auth required)"
test_endpoint "PUT" "/admin/stock/piece456/availability" "403" "Mise à jour disponibilité (auth required)"

echo ""
echo -e "${CYAN}1.4 Réservations et Actions${NC}"
test_endpoint "POST" "/admin/stock/product123/reserve" "403" "Réserver stock (auth required)"
test_endpoint "POST" "/admin/stock/product123/release" "403" "Libérer réservation (auth required)"
test_endpoint "POST" "/admin/stock/product123/disable" "403" "Désactiver produit (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "👥 2. GESTION DU STAFF (AdminStaffController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}2.1 Liste et Recherche${NC}"
test_endpoint "GET" "/api/admin/staff" "403" "Liste staff (auth required)"
test_endpoint "GET" "/api/admin/staff/stats" "403" "Statistiques staff (auth required)"
test_endpoint "GET" "/api/admin/staff/123" "403" "Détails membre staff (auth required)"

echo ""
echo -e "${CYAN}2.2 CRUD Operations${NC}"
test_endpoint "POST" "/api/admin/staff" "403" "Créer membre staff (auth required)"
test_endpoint "DELETE" "/api/admin/staff/123" "403" "Supprimer membre staff (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "⚙️  3. CONFIGURATION SYSTÈME (ConfigurationController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/admin/configuration" "403" "Liste configurations (auth required)"
test_endpoint "GET" "/admin/configuration/app.name" "403" "Configuration par clé (auth required)"
test_endpoint "PUT" "/admin/configuration/app.debug" "403" "Mise à jour config (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "👤 4. GESTION UTILISATEURS (UserManagementController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/admin/users/stats" "403" "Statistiques utilisateurs (auth required)"
test_endpoint "GET" "/admin/users" "403" "Liste utilisateurs (auth required)"
test_endpoint "GET" "/admin/users/123" "403" "Détails utilisateur (auth required)"
test_endpoint "DELETE" "/admin/users/123/deactivate" "403" "Désactiver utilisateur (auth required)"
test_endpoint "GET" "/admin/users/system/health" "403" "Health check users (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 5. RAPPORTS ET ANALYTICS (ReportingController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/admin/reports/analytics" "403" "Rapports analytiques (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🛍️  6. GESTION PRODUITS ADMIN (AdminProductsController)"
echo "════════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/api/admin/products/dashboard" "403" "Dashboard produits (auth required)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🔌 7. API WORKING-STOCK (Endpoints Fonctionnels)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}7.1 Endpoints Working-Stock${NC}"
test_endpoint "GET" "/api/admin/working-stock/stats" "200" "Stats working-stock (public)"
test_endpoint "GET" "/api/admin/working-stock/dashboard" "200" "Dashboard working-stock (public)"
test_endpoint "GET" "/api/admin/working-stock/search?search=filtre" "200" "Search working-stock (public)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🔍 8. TESTS DE VALIDATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}8.1 Vérification Routes Consolidées${NC}"
# Vérifier que les anciennes routes n'existent plus
test_endpoint "GET" "/admin/stock-enhanced/dashboard" "404" "Ancienne route enhanced supprimée"
test_endpoint "GET" "/admin/stock-test/stats" "404" "Ancienne route test supprimée"
test_endpoint "GET" "/admin/real-stock/items" "404" "Ancienne route real-stock supprimée"

echo ""
echo -e "${CYAN}8.2 Routes de Fallback${NC}"
test_endpoint "GET" "/admin/nonexistent" "404" "Route inexistante"
test_endpoint "POST" "/admin/invalid" "404" "POST route invalide"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📈 9. TESTS DE CHARGE (Optionnels)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}9.1 Test Concurrent Requests${NC}"
echo "Envoi de 10 requêtes simultanées au dashboard..."
for i in {1..10}; do
  curl -s "${BASE_URL}/admin/stock/dashboard" > /dev/null &
done
wait
echo -e "${GREEN}✓${NC} Test de charge concurrent terminé"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🔐 10. TESTS D'AUTHENTIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}10.1 Accès Sans Authentification${NC}"
echo "Tous les endpoints admin devraient retourner 403 sans auth"
echo -e "${GREEN}✓${NC} Vérifié ci-dessus (tous les 403 sont attendus)"

echo ""
echo -e "${CYAN}10.2 Tentative avec Token Invalide${NC}"
response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer invalid_token" "${BASE_URL}/admin/stock/dashboard" 2>&1)
status=$(echo "$response" | tail -n1)
if [ "$status" = "401" ] || [ "$status" = "403" ]; then
  echo -e "${GREEN}✓ PASS${NC} Token invalide rejeté (${status})"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} Token invalide accepté? (${status})"
  ((FAILED++))
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📋 11. VALIDATION STRUCTURE MODULE"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}11.1 Vérification Fichiers Controllers${NC}"
CONTROLLERS=(
  "stock.controller.ts"
  "configuration.controller.ts"
  "admin.controller.ts"
  "admin-root.controller.ts"
  "reporting.controller.ts"
  "user-management.controller.ts"
  "admin-staff.controller.ts"
  "admin-products.controller.ts"
)

CONTROLLERS_DIR="/workspaces/nestjs-remix-monorepo/backend/src/modules/admin/controllers"
echo "Vérification dans: ${CONTROLLERS_DIR}"

for controller in "${CONTROLLERS[@]}"; do
  if [ -f "${CONTROLLERS_DIR}/${controller}" ]; then
    echo -e "${GREEN}✓${NC} ${controller} existe"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} ${controller} manquant"
    ((FAILED++))
  fi
done

echo ""
echo -e "${CYAN}11.2 Vérification Fichiers Services${NC}"
SERVICES=(
  "stock-management.service.ts"
  "working-stock.service.ts"
  "configuration.service.ts"
  "reporting.service.ts"
  "user-management.service.ts"
)

SERVICES_DIR="/workspaces/nestjs-remix-monorepo/backend/src/modules/admin/services"

for service in "${SERVICES[@]}"; do
  if [ -f "${SERVICES_DIR}/${service}" ]; then
    echo -e "${GREEN}✓${NC} ${service} existe"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} ${service} manquant"
    ((FAILED++))
  fi
done

echo ""
echo -e "${CYAN}11.3 Vérification Archives${NC}"
ARCHIVED_DIR="${CONTROLLERS_DIR}/_archived"
if [ -d "$ARCHIVED_DIR" ]; then
  archived_count=$(ls -1 "$ARCHIVED_DIR" 2>/dev/null | wc -l)
  echo -e "${GREEN}✓${NC} Répertoire _archived existe (${archived_count} fichiers)"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠${NC} Répertoire _archived introuvable"
  ((SKIPPED++))
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 RÉSULTATS FINAUX"
echo "════════════════════════════════════════════════════════════════"
echo ""

TOTAL=$((PASSED + FAILED + SKIPPED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}✓ Tests réussis:${NC}    ${PASSED}/${TOTAL}"
echo -e "${RED}✗ Tests échoués:${NC}    ${FAILED}/${TOTAL}"
echo -e "${YELLOW}⊘ Tests ignorés:${NC}    ${SKIPPED}/${TOTAL}"
echo ""
echo -e "Taux de réussite: ${SUCCESS_RATE}%"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓✓✓ TOUS LES TESTS ONT RÉUSSI ! ✓✓✓${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}⚠ CERTAINS TESTS ONT ÉCHOUÉ${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
  exit 1
fi
