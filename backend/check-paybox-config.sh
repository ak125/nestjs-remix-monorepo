#!/bin/bash

echo "======================================"
echo "ðŸ” DIAGNOSTIC PAYBOX CONFIGURATION"
echo "======================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# VÃ©rifier le fichier .env
if [ -f .env ]; then
    echo "âœ… Fichier .env trouvÃ©"
    echo ""
    echo "ðŸ“‹ Configuration PAYBOX actuelle:"
    echo "=================================="
    grep -E "^PAYBOX_" .env | while read line; do
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2-)
        
        # Masquer les clÃ©s sensibles
        if [[ "$key" == "PAYBOX_HMAC_KEY" ]]; then
            value="${value:0:20}...${value: -20}"
        fi
        
        # Colorer selon le mode
        if [[ "$line" == *"tpeweb.paybox.com"* ]]; then
            echo -e "${RED}$key=$value (âš ï¸  PRODUCTION)${NC}"
        elif [[ "$line" == *"preprod-tpeweb.paybox.com"* ]]; then
            echo -e "${GREEN}$key=$value (âœ… TEST)${NC}"
        else
            echo "$key=$value"
        fi
    done
    echo ""
    
    # Analyser la cohÃ©rence
    echo "ðŸ”¬ ANALYSE DE COHÃ‰RENCE:"
    echo "========================"
    
    SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
    URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)
    MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
    
    echo "â€¢ PAYBOX_SITE: $SITE"
    echo "â€¢ PAYBOX_MODE: $MODE"
    echo "â€¢ PAYBOX_PAYMENT_URL: $URL"
    echo ""
    
    # VÃ©rification de cohÃ©rence
    ERRORS=0
    
    if [[ "$SITE" == "1999888" ]]; then
        echo -e "${GREEN}âœ… Compte TEST dÃ©tectÃ© (1999888)${NC}"
        if [[ "$URL" == *"preprod-tpeweb.paybox.com"* ]]; then
            echo -e "${GREEN}âœ… URL TEST cohÃ©rente${NC}"
        else
            echo -e "${RED}âŒ ERREUR: URL de PRODUCTION avec compte TEST!${NC}"
            ERRORS=$((ERRORS+1))
        fi
        if [[ "$MODE" == "TEST" ]]; then
            echo -e "${GREEN}âœ… MODE TEST cohÃ©rent${NC}"
        else
            echo -e "${YELLOW}âš ï¸  WARNING: MODE=$MODE mais compte TEST${NC}"
        fi
    elif [[ "$SITE" == "5259250" ]]; then
        echo -e "${YELLOW}âš ï¸  Compte PRODUCTION dÃ©tectÃ© (5259250)${NC}"
        if [[ "$URL" == *"tpeweb.paybox.com"* ]] && [[ "$URL" != *"preprod"* ]]; then
            echo -e "${GREEN}âœ… URL PRODUCTION cohÃ©rente${NC}"
        else
            echo -e "${RED}âŒ ERREUR: URL de TEST avec compte PRODUCTION!${NC}"
            ERRORS=$((ERRORS+1))
        fi
        if [[ "$MODE" == "PRODUCTION" ]]; then
            echo -e "${GREEN}âœ… MODE PRODUCTION cohÃ©rent${NC}"
        else
            echo -e "${YELLOW}âš ï¸  WARNING: MODE=$MODE mais compte PRODUCTION${NC}"
        fi
    else
        echo -e "${RED}âŒ ERREUR: PAYBOX_SITE inconnu: $SITE${NC}"
        ERRORS=$((ERRORS+1))
    fi
    
    echo ""
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}âœ… Configuration COHÃ‰RENTE${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}âŒ $ERRORS ERREUR(S) DÃ‰TECTÃ‰E(S)${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "ðŸ’¡ SOLUTION:"
        if [[ "$SITE" == "1999888" ]]; then
            echo "   Vous utilisez un compte TEST, l'URL doit Ãªtre:"
            echo "   PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
        else
            echo "   Vous utilisez un compte PRODUCTION, l'URL doit Ãªtre:"
            echo "   PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
        fi
    fi
    
else
    echo -e "${RED}âŒ Fichier .env non trouvÃ©${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo "ðŸ”§ ACTIONS DISPONIBLES:"
echo "======================================"
echo "â€¢ Pour basculer en mode TEST:"
echo "  ./switch-paybox-mode.sh test"
echo ""
echo "â€¢ Pour basculer en mode PRODUCTION:"
echo "  ./switch-paybox-mode.sh prod"
echo ""
echo "â€¢ AprÃ¨s modification, redÃ©marrer le backend:"
echo "  pm2 restart backend"
echo "  # ou"
echo "  docker-compose restart backend"
echo "======================================"
