#!/bin/bash

################################################################################
# Script Master : Exécution complète des tests E2E
# Phase 10 : Tests E2E Automatisés
# 
# Exécute tous les tests API dans l'ordre :
# 1. Products Search (Phase 9)
# 2. Cart API (Phase 1 + 8)
# 3. Auth & Users (Phase 7)
# 
# Usage :
#   ./test-e2e-complete.sh                 # Tous les tests
#   ./test-e2e-complete.sh --fast          # Tests rapides uniquement
#   ./test-e2e-complete.sh --ci            # Mode CI/CD
################################################################################

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Options
FAST_MODE=false
CI_MODE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --fast)
      FAST_MODE=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --fast    Tests rapides uniquement (skip UI tests)"
      echo "  --ci      Mode CI/CD (strict, pas de warnings)"
      echo "  --help    Afficher cette aide"
      exit 0
      ;;
  esac
done

# Compteurs globaux
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
START_TIME=$(date +%s)

echo ""
echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                  Tests E2E Complets                        ║${NC}"
echo -e "${BOLD}${CYAN}║                     Phase 10                               ║${NC}"
echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}API Base URL :${NC} $API_BASE"
echo -e "${BLUE}Mode         :${NC} $([ "$CI_MODE" = true ] && echo "CI/CD" || echo "Local")"
echo -e "${BLUE}Fast Mode    :${NC} $([ "$FAST_MODE" = true ] && echo "Oui" || echo "Non")"
echo ""

################################################################################
# Fonction pour exécuter une suite de tests
################################################################################
run_test_suite() {
  local test_name=$1
  local test_script=$2
  local phase=$3
  
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}▶ Suite $TOTAL_SUITES/$3 : $test_name${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Exécuter le test
  if bash "$test_script"; then
    echo ""
    echo -e "${GREEN}${BOLD}✓ Suite réussie : $test_name${NC}"
    PASSED_SUITES=$((PASSED_SUITES + 1))
    return 0
  else
    echo ""
    echo -e "${RED}${BOLD}✗ Suite échouée : $test_name${NC}"
    FAILED_SUITES=$((FAILED_SUITES + 1))
    
    if [ "$CI_MODE" = true ]; then
      echo -e "${RED}Mode CI : Arrêt sur échec${NC}"
      exit 1
    fi
    return 1
  fi
}

################################################################################
# Vérifier que le serveur est accessible
################################################################################
echo -e "${YELLOW}🔍 Vérification du serveur...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/health" | grep -q "200"; then
  echo -e "${GREEN}✓ Serveur accessible à $API_BASE${NC}"
else
  echo -e "${RED}✗ Serveur inaccessible à $API_BASE${NC}"
  echo -e "${YELLOW}Assurez-vous que le backend est démarré (npm run dev)${NC}"
  exit 1
fi

################################################################################
# SUITE 1 : Products Search API (Phase 9)
################################################################################
if [ -f "$SCRIPT_DIR/tests/api/products-search.test.sh" ]; then
  run_test_suite \
    "Products Search API (Phase 9)" \
    "$SCRIPT_DIR/tests/api/products-search.test.sh" \
    "3"
else
  echo -e "${YELLOW}⚠ Test Products Search non trouvé, skipped${NC}"
fi

################################################################################
# SUITE 2 : Cart API (Phase 1 + Phase 8)
################################################################################
if [ -f "$SCRIPT_DIR/tests/api/cart.test.sh" ]; then
  run_test_suite \
    "Cart API avec Consignes (Phase 1 + 8)" \
    "$SCRIPT_DIR/tests/api/cart.test.sh" \
    "3"
else
  echo -e "${YELLOW}⚠ Test Cart non trouvé, skipped${NC}"
fi

################################################################################
# SUITE 3 : Auth & Users API (Phase 7)
################################################################################
if [ -f "$SCRIPT_DIR/tests/api/auth.test.sh" ]; then
  run_test_suite \
    "Auth & Role-Based Access (Phase 7)" \
    "$SCRIPT_DIR/tests/api/auth.test.sh" \
    "3"
else
  echo -e "${YELLOW}⚠ Test Auth non trouvé, skipped (TODO)${NC}"
fi

################################################################################
# Tests UI avec Playwright (optionnel, si pas --fast)
################################################################################
if [ "$FAST_MODE" = false ] && [ -f "$SCRIPT_DIR/playwright.config.ts" ]; then
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}▶ Tests UI Playwright (optionnel)${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${YELLOW}ℹ Tests UI Playwright disponibles mais non exécutés${NC}"
  echo -e "${YELLOW}  Pour lancer : npm run test:e2e${NC}"
fi

################################################################################
# Résumé final
################################################################################
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}             RÉSUMÉ FINAL DES TESTS E2E${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Durée totale     :${NC} ${DURATION}s"
echo -e "${BLUE}Suites exécutées :${NC} $TOTAL_SUITES"
echo -e "${GREEN}Suites réussies  :${NC} $PASSED_SUITES"
echo -e "${RED}Suites échouées  :${NC} $FAILED_SUITES"
echo ""

if [ "$FAILED_SUITES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║                ✓ TOUS LES TESTS RÉUSSIS !                 ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${GREEN}Phase 10 : Tests E2E Automatisés - ${BOLD}VALIDÉE${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║              ✗ $FAILED_SUITES SUITE(S) ÉCHOUÉE(S)                    ║${NC}"
  echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
