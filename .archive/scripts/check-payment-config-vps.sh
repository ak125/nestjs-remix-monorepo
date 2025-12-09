#!/bin/bash

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "   VÃ‰RIFICATION CONFIGURATION PAIEMENT - PRODUCTION VPS"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "Date: $(date)"
echo ""

# VÃ©rification de l'existence du fichier .env
if [ ! -f .env ]; then
    echo "âŒ ERREUR: Fichier .env introuvable!"
    exit 1
fi

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "1ï¸âƒ£  CONFIGURATION PAYBOX"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
grep "^PAYBOX_" .env | while read line; do
    key=$(echo "$line" | cut -d'=' -f1)
    value=$(echo "$line" | cut -d'=' -f2-)
    
    # Masquer partiellement les clÃ©s sensibles
    if [[ $key == *"KEY"* ]] || [[ $key == *"SECRET"* ]]; then
        if [ ${#value} -gt 16 ]; then
            masked="${value:0:8}...${value: -8}"
            echo "  $key = $masked"
        else
            echo "  $key = ****"
        fi
    else
        echo "  $key = $value"
    fi
done
echo ""

# VÃ©rification des variables SystemPay
echo "ðŸ“‹ CONFIGURATION SYSTEMPAY:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
grep "^SYSTEMPAY_" .env | while read line; do
    key=$(echo "$line" | cut -d'=' -f1)
    value=$(echo "$line" | cut -d'=' -f2-)
    
    if [[ $key == *"KEY"* ]] || [[ $key == *"SECRET"* ]]; then
        if [ ${#value} -gt 16 ]; then
            masked="${value:0:8}...${value: -8}"
            echo "  $key = $masked"
        else
            echo "  $key = ****"
        fi
    else
        echo "  $key = $value"
    fi
done
echo ""

# VÃ©rification BASE_URL
echo "ðŸŒ CONFIGURATION URLs:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
grep "^BASE_URL" .env
grep "^FRONTEND_URL" .env 2>/dev/null || echo "  FRONTEND_URL = (non dÃ©finie)"
echo ""

# Analyse du mode de paiement
echo "ðŸ” ANALYSE DE LA CONFIGURATION:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

PAYBOX_MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
PAYBOX_URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)
PAYBOX_SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)

echo "  Mode actuel: $PAYBOX_MODE"

if [ "$PAYBOX_MODE" = "PRODUCTION" ]; then
    echo "  âœ… Mode PRODUCTION activÃ©"
    
    if [[ "$PAYBOX_URL" == *"preprod"* ]]; then
        echo "  âš ï¸  ATTENTION: URL de PREPROD dÃ©tectÃ©e en mode PRODUCTION!"
    elif [[ "$PAYBOX_URL" == *"tpeweb.paybox.com"* ]]; then
        echo "  âœ… URL de production correcte"
    fi
    
    if [ "$PAYBOX_SITE" = "1999888" ]; then
        echo "  âš ï¸  ATTENTION: Site de TEST (1999888) en mode PRODUCTION!"
    elif [ "$PAYBOX_SITE" = "5259250" ]; then
        echo "  âœ… Site de production (5259250)"
    fi
else
    echo "  â„¹ï¸  Mode TEST activÃ©"
fi

echo ""

# Comparaison des clÃ©s HMAC
echo "ðŸ” COMPARAISON DES CLÃ‰S HMAC:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

PAYBOX_KEY=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2)
SYSTEMPAY_TEST_KEY=$(grep "^SYSTEMPAY_HMAC_KEY_TEST=" .env | cut -d'=' -f2)
SYSTEMPAY_PROD_KEY=$(grep "^SYSTEMPAY_HMAC_KEY_PROD=" .env | cut -d'=' -f2)

echo "  Longueur clÃ© Paybox: ${#PAYBOX_KEY} caractÃ¨res"
echo "  Longueur clÃ© SystemPay TEST: ${#SYSTEMPAY_TEST_KEY} caractÃ¨res"
echo "  Longueur clÃ© SystemPay PROD: ${#SYSTEMPAY_PROD_KEY} caractÃ¨res"
echo ""

if [ "$PAYBOX_KEY" = "$SYSTEMPAY_TEST_KEY" ]; then
    echo "  âš ï¸  PAYBOX_HMAC_KEY = SYSTEMPAY_HMAC_KEY_TEST"
    echo "      â†’ Vous utilisez la clÃ© de TEST SystemPay pour Paybox!"
fi

if [ "$PAYBOX_KEY" = "$SYSTEMPAY_PROD_KEY" ]; then
    echo "  âœ… PAYBOX_HMAC_KEY = SYSTEMPAY_HMAC_KEY_PROD"
    echo "      â†’ Configuration cohÃ©rente pour la production"
fi

if [ "$SYSTEMPAY_TEST_KEY" = "$SYSTEMPAY_PROD_KEY" ]; then
    echo "  âš ï¸  Les clÃ©s TEST et PROD de SystemPay sont identiques!"
fi

echo ""

# VÃ©rification du conteneur Docker
echo "ðŸ³ Ã‰TAT DU CONTENEUR DOCKER:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
docker ps --filter "name=backend" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  âš ï¸  Docker non accessible ou conteneur non trouvÃ©"
echo ""

# RÃ©sumÃ© et recommandations
echo "ðŸ“Š RÃ‰SUMÃ‰ ET RECOMMANDATIONS:"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if [ "$PAYBOX_MODE" = "PRODUCTION" ] && [ "$PAYBOX_KEY" = "$SYSTEMPAY_TEST_KEY" ]; then
    echo "  ðŸš¨ PROBLÃˆME DÃ‰TECTÃ‰:"
    echo "     Vous Ãªtes en mode PRODUCTION avec une clÃ© de TEST!"
    echo ""
    echo "  ðŸ’¡ SOLUTION:"
    echo "     Contactez Paybox pour obtenir votre clÃ© HMAC de PRODUCTION"
    echo "     Email: support@paybox.com"
    echo "     TÃ©l: +33 (0)5 56 49 39 00"
    echo ""
    echo "  ðŸ“ Informations Ã  fournir Ã  Paybox:"
    echo "     - SITE: $PAYBOX_SITE"
    echo "     - RANG: $(grep '^PAYBOX_RANG=' .env | cut -d'=' -f2)"
    echo "     - IDENTIFIANT: $(grep '^PAYBOX_IDENTIFIANT=' .env | cut -d'=' -f2)"
    echo "     - Domaine: https://www.automecanik.com"
elif [ "$PAYBOX_MODE" = "PRODUCTION" ] && [ "$PAYBOX_KEY" = "$SYSTEMPAY_PROD_KEY" ]; then
    echo "  âœ… Configuration correcte pour la PRODUCTION"
    echo "     Vous utilisez une clÃ© de production cohÃ©rente"
else
    echo "  â„¹ï¸  Mode TEST - Configuration normale"
fi

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
