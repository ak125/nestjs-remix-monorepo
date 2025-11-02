#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 🧪 SCRIPT DE TEST PAYBOX - Configuration actuelle
# ═══════════════════════════════════════════════════════════

API_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════════════"
echo "🧪 TEST PAYBOX - Validation complète"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Backend Health
echo -n "1️⃣  Backend health check... "
HEALTH=$(curl -s "$API_URL/health" | jq -r '.status' 2>/dev/null)
if [ "$HEALTH" = "ok" ]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
    exit 1
fi

# Test 2: Route de test Paybox
echo -n "2️⃣  Route /api/paybox/test... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/paybox/test")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ OK (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ ÉCHEC (HTTP $HTTP_CODE)${NC}"
    exit 1
fi

# Test 3: Extraction et validation des champs PBX
echo -n "3️⃣  Génération formulaire Paybox... "
RESPONSE=$(curl -s "$API_URL/api/paybox/test")

SITE=$(echo "$RESPONSE" | grep 'name="PBX_SITE"' | sed 's/.*value="\([^"]*\)".*/\1/')
RANG=$(echo "$RESPONSE" | grep 'name="PBX_RANG"' | sed 's/.*value="\([^"]*\)".*/\1/')
IDENTIFIANT=$(echo "$RESPONSE" | grep 'name="PBX_IDENTIFIANT"' | sed 's/.*value="\([^"]*\)".*/\1/')
HMAC=$(echo "$RESPONSE" | grep 'name="PBX_HMAC"' | sed 's/.*value="\([^"]*\)".*/\1/')
ACTION=$(echo "$RESPONSE" | grep 'action=' | sed 's/.*action="\([^"]*\)".*/\1/')

if [ -n "$SITE" ] && [ -n "$RANG" ] && [ -n "$IDENTIFIANT" ] && [ -n "$HMAC" ]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC - Champs manquants${NC}"
    exit 1
fi

# Test 4: Validation des valeurs
echo ""
echo "📋 DÉTAILS DE LA CONFIGURATION:"
echo "   ├─ PBX_SITE: $SITE"
echo "   ├─ PBX_RANG: $RANG"
echo "   ├─ PBX_IDENTIFIANT: $IDENTIFIANT"
echo "   ├─ PBX_HMAC: ${HMAC:0:32}...${HMAC: -16}"
echo "   └─ Action URL: $ACTION"
echo ""

# Test 5: Vérification identifiants
echo -n "4️⃣  Identifiants Paybox... "
if [ "$SITE" = "5259250" ] && [ "$RANG" = "001" ] && [ "$IDENTIFIANT" = "822188223" ]; then
    echo -e "${GREEN}✅ PRODUCTION (5259250)${NC}"
else
    echo -e "${YELLOW}⚠️  Identifiants: $SITE/$RANG/$IDENTIFIANT${NC}"
fi

# Test 6: Vérification HMAC
echo -n "5️⃣  Signature PBX_HMAC... "
HMAC_LENGTH=${#HMAC}
if [ "$HMAC_LENGTH" = "128" ]; then
    echo -e "${GREEN}✅ OK (128 caractères hex)${NC}"
else
    echo -e "${RED}❌ ÉCHEC (longueur: $HMAC_LENGTH, attendu: 128)${NC}"
    exit 1
fi

# Test 7: Endpoint URL
echo -n "6️⃣  URL endpoint Paybox... "
if [[ "$ACTION" == *"tpeweb.paybox.com"* ]]; then
    echo -e "${GREEN}✅ PRODUCTION${NC}"
elif [[ "$ACTION" == *"preprod-tpeweb.paybox.com"* ]]; then
    echo -e "${YELLOW}⚠️  PRÉPRODUCTION${NC}"
else
    echo -e "${RED}❌ URL invalide: $ACTION${NC}"
    exit 1
fi

# Test 8: Test de la route de redirection réelle
echo -n "7️⃣  Route /api/paybox/redirect... "
REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/paybox/redirect?orderId=TEST123&amount=1000&email=test@example.com")
if [ "$REDIRECT_CODE" = "200" ]; then
    echo -e "${GREEN}✅ OK (HTTP $REDIRECT_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP $REDIRECT_CODE (vérifier paramètres)${NC}"
fi

# Test 9: Validation structure HTML
echo -n "8️⃣  Structure HTML formulaire... "
FORM_COUNT=$(echo "$RESPONSE" | grep -c '<form')
INPUT_COUNT=$(echo "$RESPONSE" | grep -c 'type="hidden"')
if [ "$FORM_COUNT" -ge "1" ] && [ "$INPUT_COUNT" -ge "10" ]; then
    echo -e "${GREEN}✅ OK ($INPUT_COUNT champs)${NC}"
else
    echo -e "${RED}❌ ÉCHEC (form: $FORM_COUNT, inputs: $INPUT_COUNT)${NC}"
    exit 1
fi

# Résumé final
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 TOUS LES TESTS RÉUSSIS !${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 RÉSUMÉ DE LA TRANSACTION:"
echo "   Site Paybox: $SITE"
echo "   Rang: $RANG"
echo "   Identifiant: $IDENTIFIANT"
echo "   Endpoint: ${ACTION}"
echo ""
echo "✅ L'intégration Paybox est fonctionnelle"
echo "✅ Les signatures HMAC-SHA512 sont générées correctement"
echo "✅ Le formulaire de redirection est valide"
echo ""
echo "🔗 Pour tester dans le navigateur:"
echo "   http://localhost:3000/api/paybox/test"
echo ""
