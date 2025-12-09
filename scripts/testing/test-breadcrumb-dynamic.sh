#!/bin/bash

# ðŸ§ª Tests cURL - Breadcrumb Dynamique avec VÃ©hicule
# Ce script teste le breadcrumb avec et sans cookie vÃ©hicule

set -euo pipefail

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TEST_URL="$BASE_URL/pieces/filtre-a-huile-12.html"
COOKIE_FILE=$(mktemp)

echo -e "${BLUE}${BOLD}ðŸ§ª Tests Breadcrumb Dynamique avec VÃ©hicule${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo -e "ðŸŒ URL de test: ${YELLOW}$TEST_URL${NC}"
echo ""

# ========================================
# TEST 1: SANS COOKIE (3 niveaux attendus)
# ========================================

echo -e "${BOLD}Test 1: Sans cookie vÃ©hicule${NC}"
echo -e "${BLUE}â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€${NC}"

echo "ðŸ“¡ RequÃªte sans cookie..."
RESPONSE_1=$(curl -s "$TEST_URL")

# Extraire breadcrumb du HTML
BREADCRUMB_HTML_1=$(echo "$RESPONSE_1" | grep -oP '<nav[^>]*itemScope[^>]*itemType="https://schema.org/BreadcrumbList"[^>]*>.*?</nav>' | head -1 || echo "")

if [[ -n "$BREADCRUMB_HTML_1" ]]; then
  echo -e "${GREEN}âœ… Breadcrumb trouvÃ© dans HTML${NC}"
  
  # Compter les items
  ITEM_COUNT_1=$(echo "$BREADCRUMB_HTML_1" | grep -o 'itemProp="name"' | wc -l)
  echo -e "ðŸ“Š Nombre de niveaux: ${YELLOW}$ITEM_COUNT_1${NC}"
  
  # Extraire noms
  NAMES_1=$(echo "$BREADCRUMB_HTML_1" | grep -oP '(?<=<span itemProp="name">)[^<]+' | tr '\n' ' â†’ ')
  echo -e "ðŸž Breadcrumb: ${YELLOW}$NAMES_1${NC}"
  
  if [[ $ITEM_COUNT_1 -eq 3 ]]; then
    echo -e "${GREEN}âœ… Nombre de niveaux correct (3)${NC}"
  else
    echo -e "${RED}âŒ Nombre de niveaux incorrect (attendu: 3, reÃ§u: $ITEM_COUNT_1)${NC}"
  fi
else
  echo -e "${RED}âŒ Breadcrumb non trouvÃ©${NC}"
fi

# VÃ©rifier Schema.org JSON-LD
JSON_LD_1=$(echo "$RESPONSE_1" | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' | grep -m1 '"@type":"BreadcrumbList"' || echo "")

if [[ -n "$JSON_LD_1" ]]; then
  echo -e "${GREEN}âœ… Schema.org JSON-LD trouvÃ©${NC}"
  
  # Parser avec jq si disponible
  if command -v jq &> /dev/null; then
    SCHEMA_ITEMS_1=$(echo "$JSON_LD_1" | jq -r '.itemListElement[] | "\(.position). \(.name)"' 2>/dev/null || echo "")
    if [[ -n "$SCHEMA_ITEMS_1" ]]; then
      echo -e "${BLUE}Schema.org:${NC}"
      echo "$SCHEMA_ITEMS_1" | while read -r line; do
        echo -e "  $line"
      done
    fi
  fi
else
  echo -e "${YELLOW}âš ï¸  Schema.org JSON-LD non trouvÃ©${NC}"
fi

echo ""

# ========================================
# TEST 2: AVEC COOKIE (4 niveaux attendus)
# ========================================

echo -e "${BOLD}Test 2: Avec cookie vÃ©hicule (Renault Avantime)${NC}"
echo -e "${BLUE}â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€${NC}"

# CrÃ©er cookie vÃ©hicule
VEHICLE_DATA='{"marque_id":140,"marque_name":"Renault","marque_alias":"renault","modele_id":30125,"modele_name":"Avantime","modele_alias":"avantime","type_id":12345,"type_name":"2.0 16V","type_alias":"2-0-16v","selected_at":"2025-10-28T22:00:00.000Z"}'
COOKIE_VALUE=$(echo "$VEHICLE_DATA" | jq -sRr @uri)

echo "ðŸª Cookie crÃ©Ã©: selected_vehicle=$COOKIE_VALUE"
echo "selected_vehicle=$COOKIE_VALUE" > "$COOKIE_FILE"

echo "ðŸ“¡ RequÃªte avec cookie..."
RESPONSE_2=$(curl -s -b "$COOKIE_FILE" "$TEST_URL")

# Extraire breadcrumb du HTML
BREADCRUMB_HTML_2=$(echo "$RESPONSE_2" | grep -oP '<nav[^>]*itemScope[^>]*itemType="https://schema.org/BreadcrumbList"[^>]*>.*?</nav>' | head -1 || echo "")

if [[ -n "$BREADCRUMB_HTML_2" ]]; then
  echo -e "${GREEN}âœ… Breadcrumb trouvÃ© dans HTML${NC}"
  
  # Compter les items
  ITEM_COUNT_2=$(echo "$BREADCRUMB_HTML_2" | grep -o 'itemProp="name"' | wc -l)
  echo -e "ðŸ“Š Nombre de niveaux: ${YELLOW}$ITEM_COUNT_2${NC}"
  
  # Extraire noms
  NAMES_2=$(echo "$BREADCRUMB_HTML_2" | grep -oP '(?<=<span itemProp="name">)[^<]+' | tr '\n' ' â†’ ')
  echo -e "ðŸž Breadcrumb: ${YELLOW}$NAMES_2${NC}"
  
  if [[ $ITEM_COUNT_2 -eq 4 ]]; then
    echo -e "${GREEN}âœ… Nombre de niveaux correct (4 avec vÃ©hicule)${NC}"
    
    # VÃ©rifier que "Renault Avantime" est prÃ©sent
    if echo "$NAMES_2" | grep -q "Renault Avantime"; then
      echo -e "${GREEN}âœ… VÃ©hicule prÃ©sent dans breadcrumb${NC}"
    else
      echo -e "${RED}âŒ VÃ©hicule absent du breadcrumb${NC}"
    fi
  else
    echo -e "${RED}âŒ Nombre de niveaux incorrect (attendu: 4, reÃ§u: $ITEM_COUNT_2)${NC}"
  fi
else
  echo -e "${RED}âŒ Breadcrumb non trouvÃ©${NC}"
fi

# VÃ©rifier Badge vÃ©hicule actif
BADGE_HTML=$(echo "$RESPONSE_2" | grep -oP '<div class="[^"]*bg-blue-50[^"]*border-blue-200[^>]*>.*?Renault Avantime.*?</div>' || echo "")

if [[ -n "$BADGE_HTML" ]]; then
  echo -e "${GREEN}âœ… Badge vÃ©hicule actif trouvÃ©${NC}"
else
  echo -e "${YELLOW}âš ï¸  Badge vÃ©hicule actif non dÃ©tectÃ©${NC}"
fi

echo ""

# ========================================
# TEST 3: LOGS SERVEUR
# ========================================

echo -e "${BOLD}Test 3: VÃ©rification logs serveur${NC}"
echo -e "${BLUE}â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€${NC}"

echo "ðŸ“¡ RequÃªte avec cookie + logs..."
RESPONSE_3=$(curl -s -b "$COOKIE_FILE" "$TEST_URL" -v 2>&1)

# Chercher logs dans stdout (si serveur en mode dev)
LOGS=$(echo "$RESPONSE_3" | grep -E 'ðŸš—|ðŸž' || echo "")

if [[ -n "$LOGS" ]]; then
  echo -e "${GREEN}âœ… Logs serveur dÃ©tectÃ©s:${NC}"
  echo "$LOGS" | while read -r line; do
    echo -e "  ${BLUE}$line${NC}"
  done
else
  echo -e "${YELLOW}âš ï¸  Logs serveur non dÃ©tectÃ©s (normal si serveur en prod)${NC}"
fi

echo ""

# ========================================
# RÃ‰SUMÃ‰
# ========================================

echo -e "${BOLD}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BOLD}ðŸ“Š RÃ‰SUMÃ‰ DES TESTS${NC}"
echo -e "${BOLD}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"

echo ""
echo -e "${BLUE}Test 1 (sans cookie):${NC}"
echo -e "  Niveaux: $ITEM_COUNT_1 (attendu: 3)"
echo -e "  Breadcrumb: $NAMES_1"
if [[ $ITEM_COUNT_1 -eq 3 ]]; then
  echo -e "  ${GREEN}âœ… PASS${NC}"
else
  echo -e "  ${RED}âŒ FAIL${NC}"
fi

echo ""
echo -e "${BLUE}Test 2 (avec cookie):${NC}"
echo -e "  Niveaux: $ITEM_COUNT_2 (attendu: 4)"
echo -e "  Breadcrumb: $NAMES_2"
if [[ $ITEM_COUNT_2 -eq 4 ]] && echo "$NAMES_2" | grep -q "Renault Avantime"; then
  echo -e "  ${GREEN}âœ… PASS${NC}"
else
  echo -e "  ${RED}âŒ FAIL${NC}"
fi

echo ""

# Nettoyage
rm -f "$COOKIE_FILE"

echo -e "${GREEN}ðŸŽ‰ Tests terminÃ©s${NC}"
