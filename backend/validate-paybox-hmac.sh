#!/bin/bash

# Script pour tester et valider les clÃ©s HMAC Paybox

echo "======================================"
echo "ðŸ” VALIDATION CLÃ‰ HMAC PAYBOX"
echo "======================================"
echo ""

# Lire la clÃ© actuelle
HMAC_KEY=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2)
SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)

echo "Configuration actuelle:"
echo "  SITE: $SITE"
echo "  MODE: $MODE"
echo "  HMAC (dÃ©but): ${HMAC_KEY:0:20}..."
echo "  HMAC (fin): ...${HMAC_KEY: -20}"
echo "  Longueur: ${#HMAC_KEY} caractÃ¨res"
echo ""

# Validation
if [ ${#HMAC_KEY} -ne 128 ]; then
    echo "âŒ ERREUR: La clÃ© HMAC doit faire 128 caractÃ¨res (512 bits)"
    echo "   Longueur actuelle: ${#HMAC_KEY}"
    exit 1
fi

echo "âœ… Longueur de la clÃ© correcte (128 caractÃ¨res)"
echo ""

# VÃ©rification de cohÃ©rence
echo "ðŸ” VÃ©rification de cohÃ©rence:"
echo "=============================="

if [ "$SITE" == "5259250" ] && [ "$MODE" == "PRODUCTION" ]; then
    echo "âœ… Configuration PRODUCTION dÃ©tectÃ©e"
    echo ""
    echo "âš ï¸  IMPORTANT: VÃ©rifiez que la clÃ© HMAC est bien celle de PRODUCTION"
    echo ""
    echo "La clÃ© HMAC actuelle commence par: ${HMAC_KEY:0:20}"
    echo ""
    echo "â“ Est-ce la clÃ© de PRODUCTION fournie par Paybox?"
    echo ""
    echo "ðŸ“‹ Pour obtenir la bonne clÃ©:"
    echo "   1. Connexion: https://www1.paybox.com/"
    echo "   2. Menu: Profil Marchand > ClÃ© HMAC"
    echo "   3. Copier la clÃ© HMAC de PRODUCTION"
    echo "   4. Mettre Ã  jour dans .env: PAYBOX_HMAC_KEY=..."
    echo ""
    
    # VÃ©rifier si c'est une clÃ© connue de TEST
    if [[ "$HMAC_KEY" == "0123456789ABCDEF"* ]] || [[ "$HMAC_KEY" == "7731B4225651B0C4"* ]]; then
        echo "ðŸš¨ ALERTE: Cette clÃ© ressemble Ã  une clÃ© de TEST!"
        echo "   Elle commence par: ${HMAC_KEY:0:16}"
        echo ""
        echo "   Vous DEVEZ utiliser la clÃ© HMAC de PRODUCTION"
        echo "   fournie par Paybox pour votre compte 5259250"
        echo ""
        exit 1
    fi
    
elif [ "$SITE" == "1999888" ] && [ "$MODE" == "TEST" ]; then
    echo "âœ… Configuration TEST dÃ©tectÃ©e"
    echo "   La clÃ© HMAC de test est: 0123456789ABCDEF... (standard)"
else
    echo "âš ï¸  Configuration mixte dÃ©tectÃ©e"
fi

echo ""
echo "======================================"
echo "ðŸ“ RÃ‰SUMÃ‰"
echo "======================================"
echo ""
echo "Pour tester un paiement:"
echo "  1. Assurez-vous que la clÃ© HMAC est correcte"
echo "  2. RedÃ©marrez: pm2 restart backend"
echo "  3. Consultez les logs: pm2 logs backend | grep -i 'hmac\|signature'"
echo "  4. Testez un paiement de 1â‚¬"
echo ""
echo "Si l'erreur persiste aprÃ¨s avoir mis la bonne clÃ©:"
echo "  â€¢ VÃ©rifiez l'ordre des paramÃ¨tres dans la signature"
echo "  â€¢ Contactez le support Paybox"
echo "  â€¢ Fournissez: SITE=$SITE, RANG=001, IDENTIFIANT=$(grep '^PAYBOX_IDENTIFIANT=' .env | cut -d'=' -f2)"
echo ""
