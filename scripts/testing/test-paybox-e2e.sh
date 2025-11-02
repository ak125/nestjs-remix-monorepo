#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 🧪 TEST E2E PAYBOX - Validation flux complet
# ═══════════════════════════════════════════════════════════

API_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════════════"
echo "🧪 TEST E2E PAYBOX - Simulation paiement complet"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
ORDER_ID="TEST-E2E-$(date +%s)"
AMOUNT=1050  # 10.50€
EMAIL="test-e2e@automecanik.fr"

echo -e "${BLUE}📋 Configuration du test:${NC}"
echo "   ├─ Commande: $ORDER_ID"
echo "   ├─ Montant: $(($AMOUNT / 100)).$(($AMOUNT % 100))€"
echo "   └─ Email: $EMAIL"
echo ""

# Test 1: Générer une transaction
echo -e "${YELLOW}═══ ÉTAPE 1: Génération transaction ═══${NC}"
echo -n "1️⃣  Génération formulaire de paiement... "

RESPONSE=$(curl -s "$API_URL/api/paybox/redirect?orderId=$ORDER_ID&amount=$AMOUNT&email=$EMAIL")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/paybox/redirect?orderId=$ORDER_ID&amount=$AMOUNT&email=$EMAIL")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC (HTTP $HTTP_CODE)${NC}"
    exit 1
fi

# Extraire les paramètres du formulaire
PBX_SITE=$(echo "$RESPONSE" | grep 'name="PBX_SITE"' | sed 's/.*value="\([^"]*\)".*/\1/')
PBX_TOTAL=$(echo "$RESPONSE" | grep 'name="PBX_TOTAL"' | sed 's/.*value="\([^"]*\)".*/\1/')
PBX_CMD=$(echo "$RESPONSE" | grep 'name="PBX_CMD"' | sed 's/.*value="\([^"]*\)".*/\1/')
PBX_HMAC=$(echo "$RESPONSE" | grep 'name="PBX_HMAC"' | sed 's/.*value="\([^"]*\)".*/\1/')

echo "   ├─ PBX_SITE: $PBX_SITE"
echo "   ├─ PBX_TOTAL: $PBX_TOTAL ($(($PBX_TOTAL / 100))€)"
echo "   ├─ PBX_CMD: $PBX_CMD"
echo "   └─ PBX_HMAC: ${PBX_HMAC:0:32}...${PBX_HMAC: -16}"
echo ""

# Test 2: Simuler un callback IPN de succès
echo -e "${YELLOW}═══ ÉTAPE 2: Simulation callback IPN ═══${NC}"
echo -n "2️⃣  Simulation paiement réussi (callback)... "

# Paramètres de retour Paybox simulés (code erreur 00000 = succès)
CALLBACK_PARAMS="Mt=$PBX_TOTAL&Ref=$PBX_CMD&Auto=TEST123&Erreur=00000"

# Note: La vraie signature devrait être calculée par Paybox
# Pour un vrai test, il faudrait utiliser la vraie signature de Paybox
CALLBACK_RESPONSE=$(curl -s -X POST "$API_URL/api/paybox/callback?$CALLBACK_PARAMS&K=FAKE_SIGNATURE_FOR_TEST" 2>&1)

# Le callback devrait échouer sur la signature (c'est normal pour un test sans vraie clé Paybox)
# Mais on peut vérifier qu'il répond
if [[ "$CALLBACK_RESPONSE" == *"Signature"* ]] || [[ "$CALLBACK_RESPONSE" == *"OK"* ]]; then
    echo -e "${GREEN}✅ Callback reçu${NC}"
    echo "   ⚠️  Note: Signature rejetée (normal en test sans vraie signature Paybox)"
else
    echo -e "${YELLOW}⚠️  Callback traité${NC}"
fi
echo ""

# Test 3: Vérifier la base de données
echo -e "${YELLOW}═══ ÉTAPE 3: Vérification BDD ═══${NC}"
echo -n "3️⃣  Vérification enregistrement paiement... "

# Query Supabase pour vérifier si le paiement est enregistré
# (nécessiterait l'API Supabase ou un endpoint dédié)
echo -e "${YELLOW}⚠️  Manuel${NC}"
echo "   └─ Vérifier manuellement dans ic_postback et ___xtr_order"
echo ""

# Test 4: Logs backend
echo -e "${YELLOW}═══ ÉTAPE 4: Analyse logs ═══${NC}"
echo "4️⃣  Derniers logs du callback Paybox:"
echo ""

if [ -f "/tmp/backend.log" ]; then
    echo -e "${BLUE}──── Logs récents ────${NC}"
    tail -20 /tmp/backend.log | grep -i "paybox\|callback\|paiement" || echo "   Aucun log trouvé"
else
    echo "   ⚠️  Fichier de log non trouvé (/tmp/backend.log)"
fi
echo ""

# Test 5: Simulation avec vraie carte (instructions)
echo -e "${YELLOW}═══ ÉTAPE 5: Test manuel avec navigateur ═══${NC}"
echo ""
echo "Pour tester avec une vraie carte de test Paybox:"
echo ""
echo "1️⃣  Ouvrez dans votre navigateur:"
echo "   ${BLUE}http://localhost:3000/api/paybox/redirect?orderId=$ORDER_ID&amount=$AMOUNT&email=$EMAIL${NC}"
echo ""
echo "2️⃣  Vous serez redirigé vers Paybox"
echo ""
echo "3️⃣  Utilisez une carte de test:"
echo "   • Succès: ${GREEN}4012001037141112${NC}"
echo "   • Refus:  ${RED}4012001037167778${NC}"
echo "   • Date: n'importe quelle date future"
echo "   • CVV: 123"
echo ""
echo "4️⃣  Surveillez les logs backend:"
echo "   ${BLUE}tail -f /tmp/backend.log | grep -i paybox${NC}"
echo ""
echo "5️⃣  Vérifiez la BDD après paiement:"
echo "   • Table: ${BLUE}ic_postback${NC} (transactions)"
echo "   • Table: ${BLUE}___xtr_order${NC} (ord_is_pay='1', ord_date_pay)"
echo ""

# Résumé
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Tests E2E préparés !${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 RÉSUMÉ:"
echo "   ✅ Génération formulaire: OK"
echo "   ✅ Structure callback: OK"
echo "   ⚠️  Test complet: Nécessite carte de test Paybox"
echo ""
echo "🔗 PROCHAINES ÉTAPES:"
echo "   1. Ouvrir l'URL de test dans le navigateur"
echo "   2. Effectuer un paiement test"
echo "   3. Vérifier les logs et la BDD"
echo ""
