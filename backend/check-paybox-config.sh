#!/bin/bash

echo "======================================"
echo "🔍 DIAGNOSTIC PAYBOX CONFIGURATION"
echo "======================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier le fichier .env
if [ -f .env ]; then
    echo "✅ Fichier .env trouvé"
    echo ""
    echo "📋 Configuration PAYBOX actuelle:"
    echo "=================================="
    grep -E "^PAYBOX_" .env | while read line; do
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2-)
        
        # Masquer les clés sensibles
        if [[ "$key" == "PAYBOX_HMAC_KEY" ]]; then
            value="${value:0:20}...${value: -20}"
        fi
        
        # Colorer selon le mode
        if [[ "$line" == *"tpeweb.paybox.com"* ]]; then
            echo -e "${RED}$key=$value (⚠️  PRODUCTION)${NC}"
        elif [[ "$line" == *"preprod-tpeweb.paybox.com"* ]]; then
            echo -e "${GREEN}$key=$value (✅ TEST)${NC}"
        else
            echo "$key=$value"
        fi
    done
    echo ""
    
    # Analyser la cohérence
    echo "🔬 ANALYSE DE COHÉRENCE:"
    echo "========================"
    
    SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
    URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)
    MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
    
    echo "• PAYBOX_SITE: $SITE"
    echo "• PAYBOX_MODE: $MODE"
    echo "• PAYBOX_PAYMENT_URL: $URL"
    echo ""
    
    # Vérification de cohérence
    ERRORS=0
    
    if [[ "$SITE" == "1999888" ]]; then
        echo -e "${GREEN}✅ Compte TEST détecté (1999888)${NC}"
        if [[ "$URL" == *"preprod-tpeweb.paybox.com"* ]]; then
            echo -e "${GREEN}✅ URL TEST cohérente${NC}"
        else
            echo -e "${RED}❌ ERREUR: URL de PRODUCTION avec compte TEST!${NC}"
            ERRORS=$((ERRORS+1))
        fi
        if [[ "$MODE" == "TEST" ]]; then
            echo -e "${GREEN}✅ MODE TEST cohérent${NC}"
        else
            echo -e "${YELLOW}⚠️  WARNING: MODE=$MODE mais compte TEST${NC}"
        fi
    elif [[ "$SITE" == "5259250" ]]; then
        echo -e "${YELLOW}⚠️  Compte PRODUCTION détecté (5259250)${NC}"
        if [[ "$URL" == *"tpeweb.paybox.com"* ]] && [[ "$URL" != *"preprod"* ]]; then
            echo -e "${GREEN}✅ URL PRODUCTION cohérente${NC}"
        else
            echo -e "${RED}❌ ERREUR: URL de TEST avec compte PRODUCTION!${NC}"
            ERRORS=$((ERRORS+1))
        fi
        if [[ "$MODE" == "PRODUCTION" ]]; then
            echo -e "${GREEN}✅ MODE PRODUCTION cohérent${NC}"
        else
            echo -e "${YELLOW}⚠️  WARNING: MODE=$MODE mais compte PRODUCTION${NC}"
        fi
    else
        echo -e "${RED}❌ ERREUR: PAYBOX_SITE inconnu: $SITE${NC}"
        ERRORS=$((ERRORS+1))
    fi
    
    echo ""
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✅ Configuration COHÉRENTE${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}❌ $ERRORS ERREUR(S) DÉTECTÉE(S)${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "💡 SOLUTION:"
        if [[ "$SITE" == "1999888" ]]; then
            echo "   Vous utilisez un compte TEST, l'URL doit être:"
            echo "   PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
        else
            echo "   Vous utilisez un compte PRODUCTION, l'URL doit être:"
            echo "   PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
        fi
    fi
    
else
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo "🔧 ACTIONS DISPONIBLES:"
echo "======================================"
echo "• Pour basculer en mode TEST:"
echo "  ./switch-paybox-mode.sh test"
echo ""
echo "• Pour basculer en mode PRODUCTION:"
echo "  ./switch-paybox-mode.sh prod"
echo ""
echo "• Après modification, redémarrer le backend:"
echo "  pm2 restart backend"
echo "  # ou"
echo "  docker-compose restart backend"
echo "======================================"
