#!/bin/bash

# Script de diagnostic Paybox - Identifier "AccÃ¨s refusÃ©"
# Usage: ./diagnose-paybox-error.sh

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}ðŸ” DIAGNOSTIC PAYBOX - AccÃ¨s refusÃ©${NC}"
echo -e "${BLUE}=========================================${NC}\n"

# VÃ©rifier si .env existe
if [ ! -f .env ]; then
    echo -e "${RED}âŒ Fichier .env introuvable${NC}"
    exit 1
fi

# Lire la configuration actuelle
echo -e "${YELLOW}ðŸ“‹ Configuration actuelle :${NC}\n"

SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
RANG=$(grep "^PAYBOX_RANG=" .env | cut -d'=' -f2)
IDENT=$(grep "^PAYBOX_IDENTIFIANT=" .env | cut -d'=' -f2)
HMAC=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2)
MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)

echo "  â€¢ PAYBOX_SITE: $SITE"
echo "  â€¢ PAYBOX_RANG: $RANG"
echo "  â€¢ PAYBOX_IDENTIFIANT: $IDENT"
echo "  â€¢ PAYBOX_HMAC_KEY: ${HMAC:0:20}... (${#HMAC} caractÃ¨res)"
echo "  â€¢ PAYBOX_MODE: $MODE"
echo "  â€¢ PAYBOX_PAYMENT_URL: $URL"
echo ""

# Identifier le type de compte
echo -e "${YELLOW}ðŸ”Ž Analyse de la configuration :${NC}\n"

IS_TEST_ACCOUNT=false
IS_PROD_ACCOUNT=false
IS_TEST_KEY=false
IS_PROD_URL=false

# VÃ©rifier le type de compte
if [ "$SITE" = "1999888" ] && [ "$RANG" = "32" ] && [ "$IDENT" = "107904482" ]; then
    echo -e "${GREEN}âœ… Identifiants : Compte TEST officiel Paybox${NC}"
    IS_TEST_ACCOUNT=true
elif [ "$SITE" = "5259250" ] && [ "$IDENT" = "822188223" ]; then
    echo -e "${BLUE}â„¹ï¸  Identifiants : Compte PRODUCTION (SITE=$SITE)${NC}"
    IS_PROD_ACCOUNT=true
else
    echo -e "${YELLOW}âš ï¸  Identifiants : Compte personnalisÃ© (SITE=$SITE)${NC}"
fi

# VÃ©rifier la clÃ© HMAC
if [ "${HMAC:0:16}" = "0123456789ABCDEF" ]; then
    echo -e "${GREEN}âœ… ClÃ© HMAC : ClÃ© TEST officielle Paybox${NC}"
    IS_TEST_KEY=true
elif [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${RED}âŒ ClÃ© HMAC : ClÃ© SystemPay/Lyra (INCORRECTE pour Paybox !)${NC}"
    echo -e "${RED}   Cette clÃ© est pour SystemPay, pas pour Paybox${NC}"
elif [ ${#HMAC} -eq 128 ]; then
    echo -e "${BLUE}â„¹ï¸  ClÃ© HMAC : ClÃ© personnalisÃ©e (128 caractÃ¨res)${NC}"
else
    echo -e "${RED}âŒ ClÃ© HMAC : Longueur invalide (${#HMAC} caractÃ¨res, attendu: 128)${NC}"
fi

# VÃ©rifier l'URL
if [[ "$URL" == *"preprod"* ]] || [[ "$URL" == *"test.php"* ]]; then
    echo -e "${GREEN}âœ… URL : Environnement TEST/PREPROD${NC}"
elif [[ "$URL" == "https://tpeweb.paybox.com"* ]]; then
    echo -e "${BLUE}â„¹ï¸  URL : Environnement PRODUCTION${NC}"
    IS_PROD_URL=true
else
    echo -e "${YELLOW}âš ï¸  URL : URL personnalisÃ©e${NC}"
fi

echo ""

# Diagnostic du problÃ¨me "AccÃ¨s refusÃ©"
echo -e "${RED}=========================================${NC}"
echo -e "${RED}ðŸš¨ DIAGNOSTIC : AccÃ¨s refusÃ©${NC}"
echo -e "${RED}=========================================${NC}\n"

ISSUES_FOUND=0

# ProblÃ¨me 1 : MÃ©lange TEST/PROD
if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_TEST_KEY" = true ]; then
    echo -e "${RED}âŒ PROBLÃˆME 1 : MÃ©lange identifiants PROD + clÃ© TEST${NC}"
    echo -e "   Vous utilisez des identifiants PRODUCTION avec la clÃ© HMAC TEST"
    echo -e "   â†’ Paybox refuse cet accÃ¨s pour des raisons de sÃ©curitÃ©\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# ProblÃ¨me 2 : ClÃ© HMAC incorrecte (SystemPay)
if [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${RED}âŒ PROBLÃˆME 2 : ClÃ© HMAC SystemPay au lieu de Paybox${NC}"
    echo -e "   Vous utilisez la clÃ© HMAC de SystemPay/Lyra (BNP Paribas)"
    echo -e "   â†’ Cette clÃ© ne fonctionne pas avec Paybox/Verifone\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# ProblÃ¨me 3 : Compte PROD sans clÃ© PROD
if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ] && [ "$IS_TEST_KEY" = false ] && [ ${#HMAC} -ne 128 ]; then
    echo -e "${RED}âŒ PROBLÃˆME 3 : Compte PROD sans clÃ© HMAC valide${NC}"
    echo -e "   Vous devez obtenir la vraie clÃ© HMAC PRODUCTION auprÃ¨s de Paybox\n"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${YELLOW}âš ï¸  Aucun problÃ¨me Ã©vident dÃ©tectÃ© dans la configuration${NC}"
    echo -e "   Mais Paybox refuse quand mÃªme l'accÃ¨s...\n"
    echo -e "${BLUE}Raisons possibles :${NC}"
    echo -e "   1. Identifiants invalides ou compte dÃ©sactivÃ©"
    echo -e "   2. ClÃ© HMAC incorrecte"
    echo -e "   3. Restrictions IP (firewall Paybox)"
    echo -e "   4. Compte en attente d'activation\n"
fi

# Solutions proposÃ©es
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}âœ… SOLUTIONS${NC}"
echo -e "${GREEN}=========================================${NC}\n"

if [ "${HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${YELLOW}Solution 1 : Obtenir la vraie clÃ© HMAC Paybox${NC}"
    echo -e "   Contactez Paybox/Verifone pour obtenir votre clÃ© HMAC :"
    echo -e "   ðŸ“§ Email : support@paybox.com"
    echo -e "   â˜Žï¸  TÃ©l : +33 (0)5 56 49 39 00"
    echo -e "   ðŸŒ Espace client : https://www.paybox.com/espace-client/\n"
fi

if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ]; then
    echo -e "${YELLOW}Solution 2 : Basculer temporairement en mode TEST${NC}"
    echo -e "   Pour tester l'intÃ©gration en attendant la vraie clÃ© PROD :\n"
    echo -e "   ${BLUE}./switch-paybox-mode.sh test${NC}\n"
    echo -e "   Cela configurera automatiquement :"
    echo -e "   â€¢ Identifiants TEST officiels (SITE=1999888)"
    echo -e "   â€¢ ClÃ© HMAC TEST officielle"
    echo -e "   â€¢ URL preprod Paybox\n"
fi

echo -e "${YELLOW}Solution 3 : VÃ©rifier avec Paybox${NC}"
echo -e "   Demandez Ã  Paybox de confirmer :"
echo -e "   â€¢ Que votre compte est actif"
echo -e "   â€¢ Vos identifiants exacts (SITE, RANG, IDENTIFIANT)"
echo -e "   â€¢ La clÃ© HMAC associÃ©e Ã  votre compte"
echo -e "   â€¢ L'URL du gateway Ã  utiliser\n"

# Action rapide
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}âš¡ ACTION RAPIDE${NC}"
echo -e "${BLUE}=========================================${NC}\n"

if [ "$IS_PROD_ACCOUNT" = true ] && [ "$IS_PROD_URL" = true ]; then
    echo -e "Pour tester IMMÃ‰DIATEMENT avec les identifiants TEST officiels :\n"
    echo -e "${GREEN}./switch-paybox-mode.sh test${NC}"
    echo -e "${GREEN}npm run start:dev${NC}\n"
    echo -e "Puis testez : ${BLUE}http://localhost:3000/api/payments/paybox/test${NC}\n"
fi

echo -e "${YELLOW}Pour plus d'informations, consultez :${NC}"
echo -e "   ðŸ“„ PAYBOX-PRODUCTION-SETUP.md\n"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Diagnostic terminÃ©${NC}"
echo -e "${BLUE}=========================================${NC}"
