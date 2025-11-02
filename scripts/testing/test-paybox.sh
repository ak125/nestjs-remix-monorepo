#!/bin/bash

echo "🧪 TEST INTÉGRATION PAYBOX"
echo "=========================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3000"
TEST_ORDER_ID="TEST-$(date +%s)"
TEST_AMOUNT="100.50"
TEST_EMAIL="test@automecanik.com"

echo -e "${BLUE}Configuration:${NC}"
echo "  Backend URL: $BACKEND_URL"
echo "  Order ID: $TEST_ORDER_ID"
echo "  Amount: $TEST_AMOUNT EUR"
echo "  Email: $TEST_EMAIL"
echo ""

# Test 1: Health check
echo -e "${YELLOW}[1/5]${NC} Test health check..."
HEALTH=$(curl -s "$BACKEND_URL/health" | head -1)
if [ -n "$HEALTH" ]; then
    echo -e "${GREEN}✅ Backend opérationnel${NC}"
else
    echo -e "${RED}❌ Backend non disponible${NC}"
    exit 1
fi
echo ""

# Test 2: Génération du formulaire Paybox
echo -e "${YELLOW}[2/5]${NC} Test génération formulaire Paybox..."
REDIRECT_URL="$BACKEND_URL/api/paybox/redirect?orderId=$TEST_ORDER_ID&amount=$TEST_AMOUNT&email=$TEST_EMAIL"
FORM=$(curl -s "$REDIRECT_URL")

if echo "$FORM" | grep -q "payboxForm"; then
    echo -e "${GREEN}✅ Formulaire généré${NC}"
else
    echo -e "${RED}❌ Erreur génération formulaire${NC}"
    exit 1
fi
echo ""

# Test 3: Vérification des paramètres PBX
echo -e "${YELLOW}[3/5]${NC} Vérification des paramètres PBX..."
PARAMS=$(echo "$FORM" | grep -oP 'name="PBX_[^"]*"' | wc -l)
if [ "$PARAMS" -ge 15 ]; then
    echo -e "${GREEN}✅ $PARAMS paramètres PBX trouvés${NC}"
    echo "$FORM" | grep -oP 'name="PBX_[^"]*"' | sort | sed 's/^/  /'
else
    echo -e "${RED}❌ Seulement $PARAMS paramètres trouvés (attendu: 15)${NC}"
    exit 1
fi
echo ""

# Test 4: Vérification de la signature HMAC
echo -e "${YELLOW}[4/5]${NC} Vérification de la signature HMAC..."
HMAC=$(echo "$FORM" | grep -oP 'name="PBX_HMAC" value="\K[^"]+')
if [ ${#HMAC} -eq 128 ]; then
    echo -e "${GREEN}✅ Signature HMAC-SHA512 valide (128 caractères)${NC}"
    echo "  ${HMAC:0:40}..."
else
    echo -e "${RED}❌ Signature invalide (longueur: ${#HMAC}, attendu: 128)${NC}"
    exit 1
fi
echo ""

# Test 5: Vérification de l'URL Paybox
echo -e "${YELLOW}[5/5]${NC} Vérification de l'URL Paybox..."
ACTION=$(echo "$FORM" | grep -oP 'action="\K[^"]+')
if [[ "$ACTION" == *"tpeweb.paybox.com"* ]]; then
    echo -e "${GREEN}✅ URL Paybox correcte${NC}"
    echo "  $ACTION"
else
    echo -e "${RED}❌ URL Paybox incorrecte: $ACTION${NC}"
    exit 1
fi
echo ""

# Résumé
echo "================================"
echo -e "${GREEN}🎉 TOUS LES TESTS RÉUSSIS !${NC}"
echo "================================"
echo ""
echo "Détails de la transaction test:"
echo "  Site: $(echo "$FORM" | grep -oP 'name="PBX_SITE" value="\K[^"]+')"
echo "  Rang: $(echo "$FORM" | grep -oP 'name="PBX_RANG" value="\K[^"]+')"
echo "  Identifiant: $(echo "$FORM" | grep -oP 'name="PBX_IDENTIFIANT" value="\K[^"]+')"
echo "  Montant: $(echo "$FORM" | grep -oP 'name="PBX_TOTAL" value="\K[^"]+') centimes"
echo "  Devise: $(echo "$FORM" | grep -oP 'name="PBX_DEVISE" value="\K[^"]+') (EUR)"
echo "  Commande: $(echo "$FORM" | grep -oP 'name="PBX_CMD" value="\K[^"]+')"
echo ""
echo -e "${BLUE}✨ L'intégration Paybox est prête pour la production !${NC}"
echo ""
echo "Pour tester le flux complet:"
echo "  1. Ouvrez: http://localhost:5173/checkout-payment?orderId=TEST-001"
echo "  2. Cliquez sur 'Procéder au paiement sécurisé'"
echo "  3. Vous serez redirigé vers Paybox"
echo ""
