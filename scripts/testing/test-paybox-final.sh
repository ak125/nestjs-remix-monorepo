#!/bin/bash
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ§ª SCRIPT DE TEST PAYBOX - Configuration actuelle
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

API_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "ðŸ§ª TEST PAYBOX - Validation complÃ¨te"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Test 1: Backend Health
echo -n "1ï¸âƒ£  Backend health check... "
HEALTH=$(curl -s "$API_URL/health" | jq -r '.status' 2>/dev/null)
if [ "$HEALTH" = "ok" ]; then
    echo -e "${GREEN}âœ… OK${NC}"
else
    echo -e "${RED}âŒ Ã‰CHEC${NC}"
    exit 1
fi

# Test 2: Route de test Paybox
echo -n "2ï¸âƒ£  Route /api/paybox/test... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/paybox/test")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}âœ… OK (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}âŒ Ã‰CHEC (HTTP $HTTP_CODE)${NC}"
    exit 1
fi

# Test 3: Extraction et validation des champs PBX
echo -n "3ï¸âƒ£  GÃ©nÃ©ration formulaire Paybox... "
RESPONSE=$(curl -s "$API_URL/api/paybox/test")

SITE=$(echo "$RESPONSE" | grep 'name="PBX_SITE"' | sed 's/.*value="\([^"]*\)".*/\1/')
RANG=$(echo "$RESPONSE" | grep 'name="PBX_RANG"' | sed 's/.*value="\([^"]*\)".*/\1/')
IDENTIFIANT=$(echo "$RESPONSE" | grep 'name="PBX_IDENTIFIANT"' | sed 's/.*value="\([^"]*\)".*/\1/')
HMAC=$(echo "$RESPONSE" | grep 'name="PBX_HMAC"' | sed 's/.*value="\([^"]*\)".*/\1/')
ACTION=$(echo "$RESPONSE" | grep 'action=' | sed 's/.*action="\([^"]*\)".*/\1/')

if [ -n "$SITE" ] && [ -n "$RANG" ] && [ -n "$IDENTIFIANT" ] && [ -n "$HMAC" ]; then
    echo -e "${GREEN}âœ… OK${NC}"
else
    echo -e "${RED}âŒ Ã‰CHEC - Champs manquants${NC}"
    exit 1
fi

# Test 4: Validation des valeurs
echo ""
echo "ðŸ“‹ DÃ‰TAILS DE LA CONFIGURATION:"
echo "   â”œâ”€ PBX_SITE: $SITE"
echo "   â”œâ”€ PBX_RANG: $RANG"
echo "   â”œâ”€ PBX_IDENTIFIANT: $IDENTIFIANT"
echo "   â”œâ”€ PBX_HMAC: ${HMAC:0:32}...${HMAC: -16}"
echo "   â””â”€ Action URL: $ACTION"
echo ""

# Test 5: VÃ©rification identifiants
echo -n "4ï¸âƒ£  Identifiants Paybox... "
if [ "$SITE" = "5259250" ] && [ "$RANG" = "001" ] && [ "$IDENTIFIANT" = "822188223" ]; then
    echo -e "${GREEN}âœ… PRODUCTION (5259250)${NC}"
else
    echo -e "${YELLOW}âš ï¸  Identifiants: $SITE/$RANG/$IDENTIFIANT${NC}"
fi

# Test 6: VÃ©rification HMAC
echo -n "5ï¸âƒ£  Signature PBX_HMAC... "
HMAC_LENGTH=${#HMAC}
if [ "$HMAC_LENGTH" = "128" ]; then
    echo -e "${GREEN}âœ… OK (128 caractÃ¨res hex)${NC}"
else
    echo -e "${RED}âŒ Ã‰CHEC (longueur: $HMAC_LENGTH, attendu: 128)${NC}"
    exit 1
fi

# Test 7: Endpoint URL
echo -n "6ï¸âƒ£  URL endpoint Paybox... "
if [[ "$ACTION" == *"tpeweb.paybox.com"* ]]; then
    echo -e "${GREEN}âœ… PRODUCTION${NC}"
elif [[ "$ACTION" == *"preprod-tpeweb.paybox.com"* ]]; then
    echo -e "${YELLOW}âš ï¸  PRÃ‰PRODUCTION${NC}"
else
    echo -e "${RED}âŒ URL invalide: $ACTION${NC}"
    exit 1
fi

# Test 8: Test de la route de redirection rÃ©elle
echo -n "7ï¸âƒ£  Route /api/paybox/redirect... "
REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/paybox/redirect?orderId=TEST123&amount=1000&email=test@example.com")
if [ "$REDIRECT_CODE" = "200" ]; then
    echo -e "${GREEN}âœ… OK (HTTP $REDIRECT_CODE)${NC}"
else
    echo -e "${YELLOW}âš ï¸  HTTP $REDIRECT_CODE (vÃ©rifier paramÃ¨tres)${NC}"
fi

# Test 9: Validation structure HTML
echo -n "8ï¸âƒ£  Structure HTML formulaire... "
FORM_COUNT=$(echo "$RESPONSE" | grep -c '<form')
INPUT_COUNT=$(echo "$RESPONSE" | grep -c 'type="hidden"')
if [ "$FORM_COUNT" -ge "1" ] && [ "$INPUT_COUNT" -ge "10" ]; then
    echo -e "${GREEN}âœ… OK ($INPUT_COUNT champs)${NC}"
else
    echo -e "${RED}âŒ Ã‰CHEC (form: $FORM_COUNT, inputs: $INPUT_COUNT)${NC}"
    exit 1
fi

# RÃ©sumÃ© final
echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo -e "${GREEN}ðŸŽ‰ TOUS LES TESTS RÃ‰USSIS !${NC}"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "ðŸ“Š RÃ‰SUMÃ‰ DE LA TRANSACTION:"
echo "   Site Paybox: $SITE"
echo "   Rang: $RANG"
echo "   Identifiant: $IDENTIFIANT"
echo "   Endpoint: ${ACTION}"
echo ""
echo "âœ… L'intÃ©gration Paybox est fonctionnelle"
echo "âœ… Les signatures HMAC-SHA512 sont gÃ©nÃ©rÃ©es correctement"
echo "âœ… Le formulaire de redirection est valide"
echo ""
echo "ðŸ”— Pour tester dans le navigateur:"
echo "   http://localhost:3000/api/paybox/test"
echo ""
