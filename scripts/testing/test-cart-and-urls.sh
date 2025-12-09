#!/bin/bash

# Script de test pour les problÃ¨mes de panier et URLs legacy

echo "ðŸ§ª Test des fixes - Panier et URLs Legacy"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "TEST 1: URL Legacy avec redirection"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

LEGACY_URL="/constructeurs/audi-22/80-break-22016.html"
echo "ðŸ”— Test: ${LEGACY_URL}"

RESPONSE=$(curl -s -I "${BASE_URL}${LEGACY_URL}" 2>&1)
STATUS=$(echo "$RESPONSE" | grep "HTTP" | head -1 | awk '{print $2}')
LOCATION=$(echo "$RESPONSE" | grep -i "Location:" | awk '{print $2}' | tr -d '\r')

echo "   Status: $STATUS"

if [ "$STATUS" == "301" ] || [ "$STATUS" == "302" ]; then
    echo -e "   ${GREEN}âœ… Redirection active${NC}"
    echo "   Location: $LOCATION"
elif [ "$STATUS" == "410" ]; then
    echo -e "   ${YELLOW}âš ï¸  410 Gone (vÃ©hicule supprimÃ©)${NC}"
elif [ "$STATUS" == "404" ]; then
    echo -e "   ${RED}âŒ 404 Not Found (redirection pas encore active)${NC}"
    echo -e "   ${YELLOW}ðŸ’¡ Relancer le frontend: cd frontend && npm run dev${NC}"
else
    echo -e "   ${RED}âŒ Status inattendu: $STATUS${NC}"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "TEST 2: API Panier (Backend)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# CrÃ©er une session
COOKIE_FILE=$(mktemp)
trap "rm -f $COOKIE_FILE" EXIT

echo "ðŸ”¸ Ã‰tape 1: Vider le panier"
curl -s -X DELETE "${BASE_URL}/api/cart" \
  -c "$COOKIE_FILE" \
  -b "$COOKIE_FILE" > /dev/null
echo "   âœ… Panier vidÃ©"

echo ""
echo "ðŸ”¸ Ã‰tape 2: Ajouter un produit (ID: 618770)"
ADD_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cart/add" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -b "$COOKIE_FILE" \
  -d '{"product_id": 618770, "quantity": 1}')

ADD_SUCCESS=$(echo "$ADD_RESPONSE" | grep -o '"success":true' || echo "")

if [ -n "$ADD_SUCCESS" ]; then
    echo -e "   ${GREEN}âœ… Produit ajoutÃ© avec succÃ¨s${NC}"
    PRODUCT_NAME=$(echo "$ADD_RESPONSE" | grep -o '"product_name":"[^"]*"' | cut -d'"' -f4)
    echo "   Produit: $PRODUCT_NAME"
else
    echo -e "   ${RED}âŒ Ã‰chec de l'ajout${NC}"
    echo "$ADD_RESPONSE" | head -3
fi

echo ""
echo "ðŸ”¸ Ã‰tape 3: RÃ©cupÃ©rer le panier"
CART_RESPONSE=$(curl -s "${BASE_URL}/api/cart" \
  -b "$COOKIE_FILE")

ITEM_COUNT=$(echo "$CART_RESPONSE" | grep -o '"items":\[[^]]*\]' | grep -o '{' | wc -l)
TOTAL=$(echo "$CART_RESPONSE" | grep -o '"total_ttc":"[^"]*"' | cut -d'"' -f4 || echo "0.00")

if [ "$ITEM_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}âœ… Panier contient $ITEM_COUNT article(s)${NC}"
    echo "   Total: ${TOTAL}â‚¬"
else
    echo -e "   ${RED}âŒ Panier vide (problÃ¨me de session/cookie)${NC}"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "TEST 3: ProblÃ¨mes connus"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

echo "ðŸ” VÃ©rification des problÃ¨mes potentiels:"
echo ""

# VÃ©rifier Redis
if docker ps | grep -q redis; then
    echo -e "   ${GREEN}âœ… Redis actif${NC}"
else
    echo -e "   ${RED}âŒ Redis non actif${NC}"
    echo -e "   ${YELLOW}ðŸ’¡ DÃ©marrer: docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine${NC}"
fi

# VÃ©rifier le backend
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "   ${GREEN}âœ… Backend actif (port 3000)${NC}"
else
    echo -e "   ${RED}âŒ Backend non actif${NC}"
    echo -e "   ${YELLOW}ðŸ’¡ DÃ©marrer: npm run dev${NC}"
fi

# VÃ©rifier les cookies
SESSION_COOKIE=$(cat "$COOKIE_FILE" 2>/dev/null | grep "connect.sid" || echo "")
if [ -n "$SESSION_COOKIE" ]; then
    echo -e "   ${GREEN}âœ… Cookie de session crÃ©Ã©${NC}"
else
    echo -e "   ${YELLOW}âš ï¸  Pas de cookie de session${NC}"
    echo -e "   ${YELLOW}ðŸ’¡ VÃ©rifier SESSION_SECRET dans .env${NC}"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "RÃ‰SUMÃ‰"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Calculer le score
SCORE=0
TOTAL_TESTS=3

# Test 1: Redirection
if [ "$STATUS" == "301" ] || [ "$STATUS" == "302" ]; then
    ((SCORE++))
fi

# Test 2: Ajout panier
if [ -n "$ADD_SUCCESS" ]; then
    ((SCORE++))
fi

# Test 3: Lecture panier
if [ "$ITEM_COUNT" -gt 0 ]; then
    ((SCORE++))
fi

if [ $SCORE -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}âœ… TOUS LES TESTS RÃ‰USSIS ($SCORE/$TOTAL_TESTS)${NC}"
elif [ $SCORE -gt 0 ]; then
    echo -e "${YELLOW}âš ï¸  TESTS PARTIELLEMENT RÃ‰USSIS ($SCORE/$TOTAL_TESTS)${NC}"
else
    echo -e "${RED}âŒ TOUS LES TESTS Ã‰CHOUÃ‰S ($SCORE/$TOTAL_TESTS)${NC}"
fi

echo ""
echo "ðŸ“– Documentation: docs/fixes/FIX-LEGACY-URLS-AND-CART.md"
echo ""
