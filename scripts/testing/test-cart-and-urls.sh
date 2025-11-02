#!/bin/bash

# Script de test pour les problèmes de panier et URLs legacy

echo "🧪 Test des fixes - Panier et URLs Legacy"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: URL Legacy avec redirection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

LEGACY_URL="/constructeurs/audi-22/80-break-22016.html"
echo "🔗 Test: ${LEGACY_URL}"

RESPONSE=$(curl -s -I "${BASE_URL}${LEGACY_URL}" 2>&1)
STATUS=$(echo "$RESPONSE" | grep "HTTP" | head -1 | awk '{print $2}')
LOCATION=$(echo "$RESPONSE" | grep -i "Location:" | awk '{print $2}' | tr -d '\r')

echo "   Status: $STATUS"

if [ "$STATUS" == "301" ] || [ "$STATUS" == "302" ]; then
    echo -e "   ${GREEN}✅ Redirection active${NC}"
    echo "   Location: $LOCATION"
elif [ "$STATUS" == "410" ]; then
    echo -e "   ${YELLOW}⚠️  410 Gone (véhicule supprimé)${NC}"
elif [ "$STATUS" == "404" ]; then
    echo -e "   ${RED}❌ 404 Not Found (redirection pas encore active)${NC}"
    echo -e "   ${YELLOW}💡 Relancer le frontend: cd frontend && npm run dev${NC}"
else
    echo -e "   ${RED}❌ Status inattendu: $STATUS${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: API Panier (Backend)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Créer une session
COOKIE_FILE=$(mktemp)
trap "rm -f $COOKIE_FILE" EXIT

echo "🔸 Étape 1: Vider le panier"
curl -s -X DELETE "${BASE_URL}/api/cart" \
  -c "$COOKIE_FILE" \
  -b "$COOKIE_FILE" > /dev/null
echo "   ✅ Panier vidé"

echo ""
echo "🔸 Étape 2: Ajouter un produit (ID: 618770)"
ADD_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cart/add" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -b "$COOKIE_FILE" \
  -d '{"product_id": 618770, "quantity": 1}')

ADD_SUCCESS=$(echo "$ADD_RESPONSE" | grep -o '"success":true' || echo "")

if [ -n "$ADD_SUCCESS" ]; then
    echo -e "   ${GREEN}✅ Produit ajouté avec succès${NC}"
    PRODUCT_NAME=$(echo "$ADD_RESPONSE" | grep -o '"product_name":"[^"]*"' | cut -d'"' -f4)
    echo "   Produit: $PRODUCT_NAME"
else
    echo -e "   ${RED}❌ Échec de l'ajout${NC}"
    echo "$ADD_RESPONSE" | head -3
fi

echo ""
echo "🔸 Étape 3: Récupérer le panier"
CART_RESPONSE=$(curl -s "${BASE_URL}/api/cart" \
  -b "$COOKIE_FILE")

ITEM_COUNT=$(echo "$CART_RESPONSE" | grep -o '"items":\[[^]]*\]' | grep -o '{' | wc -l)
TOTAL=$(echo "$CART_RESPONSE" | grep -o '"total_ttc":"[^"]*"' | cut -d'"' -f4 || echo "0.00")

if [ "$ITEM_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Panier contient $ITEM_COUNT article(s)${NC}"
    echo "   Total: ${TOTAL}€"
else
    echo -e "   ${RED}❌ Panier vide (problème de session/cookie)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Problèmes connus"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔍 Vérification des problèmes potentiels:"
echo ""

# Vérifier Redis
if docker ps | grep -q redis; then
    echo -e "   ${GREEN}✅ Redis actif${NC}"
else
    echo -e "   ${RED}❌ Redis non actif${NC}"
    echo -e "   ${YELLOW}💡 Démarrer: docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine${NC}"
fi

# Vérifier le backend
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend actif (port 3000)${NC}"
else
    echo -e "   ${RED}❌ Backend non actif${NC}"
    echo -e "   ${YELLOW}💡 Démarrer: npm run dev${NC}"
fi

# Vérifier les cookies
SESSION_COOKIE=$(cat "$COOKIE_FILE" 2>/dev/null | grep "connect.sid" || echo "")
if [ -n "$SESSION_COOKIE" ]; then
    echo -e "   ${GREEN}✅ Cookie de session créé${NC}"
else
    echo -e "   ${YELLOW}⚠️  Pas de cookie de session${NC}"
    echo -e "   ${YELLOW}💡 Vérifier SESSION_SECRET dans .env${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RÉSUMÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    echo -e "${GREEN}✅ TOUS LES TESTS RÉUSSIS ($SCORE/$TOTAL_TESTS)${NC}"
elif [ $SCORE -gt 0 ]; then
    echo -e "${YELLOW}⚠️  TESTS PARTIELLEMENT RÉUSSIS ($SCORE/$TOTAL_TESTS)${NC}"
else
    echo -e "${RED}❌ TOUS LES TESTS ÉCHOUÉS ($SCORE/$TOTAL_TESTS)${NC}"
fi

echo ""
echo "📖 Documentation: docs/fixes/FIX-LEGACY-URLS-AND-CART.md"
echo ""
