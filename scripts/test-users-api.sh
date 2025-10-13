#!/bin/bash

# 🧪 Script de Test - API Users Consolidée
# Teste tous les endpoints de la nouvelle API

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🧪 TESTS API USERS CONSOLIDÉE                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/users"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

# ============================================================================
# FONCTION DE TEST
# ============================================================================

test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local expected_status=${4:-200}
  
  echo -n "Testing: $description ... "
  
  response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" 2>/dev/null)
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
    ((PASSED++))
    
    # Afficher un aperçu de la réponse
    if [ ! -z "$body" ]; then
      echo "   └─ Response: $(echo $body | jq -c '.' 2>/dev/null | head -c 80)..."
    fi
  else
    echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $status_code)"
    ((FAILED++))
    
    # Afficher l'erreur complète
    if [ ! -z "$body" ]; then
      echo "   └─ Error: $(echo $body | jq -c '.' 2>/dev/null)"
    fi
  fi
  
  echo ""
}

# ============================================================================
# TESTS - ENDPOINTS PUBLICS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📁 ENDPOINTS PUBLICS (sans auth)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "GET" "/test" "Endpoint de test" 200

# ============================================================================
# TESTS - ENDPOINTS UTILISATEUR (nécessitent auth)
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}👤 ENDPOINTS UTILISATEUR (auth requise)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⚠️  Ces endpoints nécessitent une authentification${NC}"
echo -e "${YELLOW}   Ils devraient retourner 401 Unauthorized sans session${NC}"
echo ""

test_endpoint "GET" "/profile" "Profil utilisateur" 401
test_endpoint "GET" "/dashboard" "Dashboard utilisateur" 401

# ============================================================================
# TESTS - ENDPOINTS ADMIN (nécessitent auth + admin)
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔐 ENDPOINTS ADMIN (auth + admin requis)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⚠️  Ces endpoints nécessitent une authentification admin${NC}"
echo -e "${YELLOW}   Ils devraient retourner 401 ou 403 sans session admin${NC}"
echo ""

test_endpoint "GET" "" "Liste des utilisateurs" 401
test_endpoint "GET" "/stats" "Statistiques globales" 401
test_endpoint "GET" "/search?q=test" "Recherche utilisateurs" 401

# ============================================================================
# TESTS - ENDPOINTS LEGACY (devraient être dépréciés)
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚠️  ENDPOINTS LEGACY (à déprécier)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing: GET /api/legacy-users ... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/legacy-users" 2>/dev/null)
status_code=$(echo "$response" | tail -n1)

if [ "$status_code" == "404" ]; then
  echo -e "${GREEN}✅ GOOD${NC} - Endpoint legacy supprimé ou désactivé"
elif [ "$status_code" == "301" ]; then
  echo -e "${YELLOW}⚠️  INFO${NC} - Redirect vers nouvelle API (OK)"
else
  echo -e "${YELLOW}⚠️  WARNING${NC} - Endpoint legacy encore actif (à migrer)"
fi
echo ""

# ============================================================================
# VÉRIFICATION DE LA STRUCTURE DES RÉPONSES
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 VÉRIFICATION STRUCTURE DES RÉPONSES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing: Structure de /api/users/test"
response=$(curl -s "$API_URL/test" 2>/dev/null)

has_success=$(echo "$response" | jq -r '.success' 2>/dev/null)
has_message=$(echo "$response" | jq -r '.message' 2>/dev/null)
has_version=$(echo "$response" | jq -r '.version' 2>/dev/null)

if [ "$has_success" == "true" ] && [ ! -z "$has_message" ] && [ ! -z "$has_version" ]; then
  echo -e "${GREEN}✅ Structure correcte${NC}"
  echo "   ├─ success: $has_success"
  echo "   ├─ message: $has_message"
  echo "   └─ version: $has_version"
else
  echo -e "${RED}❌ Structure incorrecte${NC}"
  echo "$response" | jq '.' 2>/dev/null
fi

echo ""

# ============================================================================
# STATISTIQUES FINALES
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RÉSULTATS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=0
if [ $TOTAL -gt 0 ]; then
  SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
fi

echo -e "Tests passés:  ${GREEN}$PASSED${NC}"
echo -e "Tests échoués: ${RED}$FAILED${NC}"
echo "Tests totaux:  $TOTAL"
echo ""
echo -e "Taux de réussite: ${GREEN}$SUCCESS_RATE%${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Tous les tests sont passés !${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Certains tests ont échoué.${NC}"
  echo -e "${YELLOW}   Note: Les échecs 401/403 sont normaux sans authentification.${NC}"
  exit 1
fi
