#!/bin/bash

# Script de diagnostic Paybox - Identifier "Accès refusé"
# Usage: ./diagnose-paybox-error.sh

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}🔍 DIAGNOSTIC PAYBOX - Accès refusé${NC}"
echo -e "${BLUE}=========================================${NC}\n"

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

# Lire la configuration actuelle
echo -e "${YELLOW}📋 Configuration actuelle :${NC}\n"

SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
RANG=$(grep "^PAYBOX_RANG=" .env | cut -d'=' -f2)
IDENT=$(grep "^PAYBOX_IDENTIFIANT=" .env | cut -d'=' -f2)
HMAC=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2)
MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)

echo "  • PAYBOX_SITE: $SITE"
echo "  • PAYBOX_RANG: $RANG"
echo "  • PAYBOX_IDENTIFIANT: $IDENT"
echo "  • PAYBOX_HMAC_KEY: ${HMAC:0:20}... (${#HMAC} caractères)"
echo "  • PAYBOX_MODE: $MODE"
echo "  • PAYBOX_PAYMENT_URL: $URL"
echo ""

# Identifier le type de compte
echo -e "${YELLOW}🔎 Analyse de la configuration :${NC}\n"

IS_TEST_ACCOUNT=false
IS_PROD_ACCOUNT=false
IS_TEST_KEY=false
IS_PROD_URL=false

# Vérifier le type de compte
if [ "$SITE" = "1999888" ] && [ "$RANG" = "32" ] && [ "$IDENT" = "107904482" ]; then
    echo -e "${GREEN}✅ Identifiants : Compte TEST officiel Paybox${NC}"
    IS_TEST_ACCOUNT=true
elif [ "$SITE" = "5259250" ] && [ "$IDENT" = "822188223" ]; then
    echo -e "${BLUE}ℹ️  Identifiants : Compte PRODUCTION (SITE=$SITE)${NC}"
    IS_PROD_ACCOUNT=true
else
    echo -e "${YELLOW}⚠️  Identifiants : Compte personnalisé (SITE=$SITE)${NC}"
fi

# Vérifier la clé HMAC
if [ "${HMAC:0:16}" = "0123456789ABCDEF" ]; then
    echo -e "${GREEN}✅ Clé HMAC : Clé TEST officielle Paybox${NC}"
    IS_TEST_KEY=true
elif [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${RED}❌ Clé HMAC : Clé SystemPay/Lyra (INCORRECTE pour Paybox !)${NC}"
    echo -e "${RED}   Cette clé est pour SystemPay, pas pour Paybox${NC}"
elif [ ${#HMAC} -eq 128 ]; then
    echo -e "${BLUE}ℹ️  Clé HMAC : Clé personnalisée (128 caractères)${NC}"
else
    echo -e "${RED}❌ Clé HMAC : Longueur invalide (${#HMAC} caractères, attendu: 128)${NC}"
fi

# Vérifier l'URL
if [[ "$URL" == *"preprod"* ]] || [[ "$URL" == *"test.php"* ]]; then
    echo -e "${GREEN}✅ URL : Environnement TEST/PREPROD${NC}"
elif [[ "$URL" == "https://tpeweb.paybox.com"* ]]; then
    echo -e "${BLUE}ℹ️  URL : Environnement PRODUCTION${NC}"
    IS_PROD_URL=true
else
    echo -e "${YELLOW}⚠️  URL : URL personnalisée${NC}"
fi

echo ""

# Diagnostic du problème "Accès refusé"
echo -e "${RED}=========================================${NC}"
echo -e "${RED}🚨 DIAGNOSTIC : Accès refusé${NC}"
echo -e "${RED}=========================================${NC}\n"

ISSUES_FOUND=0

# Problème 1 : Mélange TEST/PROD
if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_TEST_KEY" = true ]; then
    echo -e "${RED}❌ PROBLÈME 1 : Mélange identifiants PROD + clé TEST${NC}"
    echo -e "   Vous utilisez des identifiants PRODUCTION avec la clé HMAC TEST"
    echo -e "   → Paybox refuse cet accès pour des raisons de sécurité\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Problème 2 : Clé HMAC incorrecte (SystemPay)
if [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${RED}❌ PROBLÈME 2 : Clé HMAC SystemPay au lieu de Paybox${NC}"
    echo -e "   Vous utilisez la clé HMAC de SystemPay/Lyra (BNP Paribas)"
    echo -e "   → Cette clé ne fonctionne pas avec Paybox/Verifone\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Problème 3 : Compte PROD sans clé PROD
if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ] && [ "$IS_TEST_KEY" = false ] && [ ${#HMAC} -ne 128 ]; then
    echo -e "${RED}❌ PROBLÈME 3 : Compte PROD sans clé HMAC valide${NC}"
    echo -e "   Vous devez obtenir la vraie clé HMAC PRODUCTION auprès de Paybox\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Aucun problème évident détecté dans la configuration${NC}"
    echo -e "   Mais Paybox refuse quand même l'accès...\n"
    echo -e "${BLUE}Raisons possibles :${NC}"
    echo -e "   1. Identifiants invalides ou compte désactivé"
    echo -e "   2. Clé HMAC incorrecte"
    echo -e "   3. Restrictions IP (firewall Paybox)"
    echo -e "   4. Compte en attente d'activation\n"
fi

# Solutions proposées
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ SOLUTIONS${NC}"
echo -e "${GREEN}=========================================${NC}\n"

if [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${YELLOW}Solution 1 : Obtenir la vraie clé HMAC Paybox${NC}"
    echo -e "   Contactez Paybox/Verifone pour obtenir votre clé HMAC :"
    echo -e "   📧 Email : support@paybox.com"
    echo -e "   ☎️  Tél : +33 (0)5 56 49 39 00"
    echo -e "   🌐 Espace client : https://www.paybox.com/espace-client/\n"
fi

if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ]; then
    echo -e "${YELLOW}Solution 2 : Basculer temporairement en mode TEST${NC}"
    echo -e "   Pour tester l'intégration en attendant la vraie clé PROD :\n"
    echo -e "   ${BLUE}./switch-paybox-mode.sh test${NC}\n"
    echo -e "   Cela configurera automatiquement :"
    echo -e "   • Identifiants TEST officiels (SITE=1999888)"
    echo -e "   • Clé HMAC TEST officielle"
    echo -e "   • URL preprod Paybox\n"
fi

echo -e "${YELLOW}Solution 3 : Vérifier avec Paybox${NC}"
echo -e "   Demandez à Paybox de confirmer :"
echo -e "   • Que votre compte est actif"
echo -e "   • Vos identifiants exacts (SITE, RANG, IDENTIFIANT)"
echo -e "   • La clé HMAC associée à votre compte"
echo -e "   • L'URL du gateway à utiliser\n"

# Action rapide
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}⚡ ACTION RAPIDE${NC}"
echo -e "${BLUE}=========================================${NC}\n"

if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ]; then
    echo -e "Pour tester IMMÉDIATEMENT avec les identifiants TEST officiels :\n"
    echo -e "${GREEN}./switch-paybox-mode.sh test${NC}"
    echo -e "${GREEN}npm run start:dev${NC}\n"
    echo -e "Puis testez : ${BLUE}http://localhost:3000/api/payments/paybox/test${NC}\n"
fi

echo -e "${YELLOW}Pour plus d'informations, consultez :${NC}"
echo -e "   📄 PAYBOX-PRODUCTION-SETUP.md\n"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Diagnostic terminé${NC}"
echo -e "${BLUE}=========================================${NC}"
