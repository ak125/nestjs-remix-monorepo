#!/bin/bash

# Script pour tester et valider les clés HMAC Paybox

echo "======================================"
echo "🔐 VALIDATION CLÉ HMAC PAYBOX"
echo "======================================"
echo ""

# Lire la clé actuelle
HMAC_KEY=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2)
SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2)
MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)

echo "Configuration actuelle:"
echo "  SITE: $SITE"
echo "  MODE: $MODE"
echo "  HMAC (début): ${HMAC_KEY:0:20}..."
echo "  HMAC (fin): ...${HMAC_KEY: -20}"
echo "  Longueur: ${#HMAC_KEY} caractères"
echo ""

# Validation
if [ ${#HMAC_KEY} -ne 128 ]; then
    echo "❌ ERREUR: La clé HMAC doit faire 128 caractères (512 bits)"
    echo "   Longueur actuelle: ${#HMAC_KEY}"
    exit 1
fi

echo "✅ Longueur de la clé correcte (128 caractères)"
echo ""

# Vérification de cohérence
echo "🔍 Vérification de cohérence:"
echo "=============================="

if [ "$SITE" == "5259250" ] && [ "$MODE" == "PRODUCTION" ]; then
    echo "✅ Configuration PRODUCTION détectée"
    echo ""
    echo "⚠️  IMPORTANT: Vérifiez que la clé HMAC est bien celle de PRODUCTION"
    echo ""
    echo "La clé HMAC actuelle commence par: ${HMAC_KEY:0:20}"
    echo ""
    echo "❓ Est-ce la clé de PRODUCTION fournie par Paybox?"
    echo ""
    echo "📋 Pour obtenir la bonne clé:"
    echo "   1. Connexion: https://www1.paybox.com/"
    echo "   2. Menu: Profil Marchand > Clé HMAC"
    echo "   3. Copier la clé HMAC de PRODUCTION"
    echo "   4. Mettre à jour dans .env: PAYBOX_HMAC_KEY=..."
    echo ""
    
    # Vérifier si c'est une clé connue de TEST
    if [[ "$HMAC_KEY" == "0123456789ABCDEF"* ]] || [[ "$HMAC_KEY" == "7731B4225651B0C4"* ]]; then
        echo "🚨 ALERTE: Cette clé ressemble à une clé de TEST!"
        echo "   Elle commence par: ${HMAC_KEY:0:16}"
        echo ""
        echo "   Vous DEVEZ utiliser la clé HMAC de PRODUCTION"
        echo "   fournie par Paybox pour votre compte 5259250"
        echo ""
        exit 1
    fi
    
elif [ "$SITE" == "1999888" ] && [ "$MODE" == "TEST" ]; then
    echo "✅ Configuration TEST détectée"
    echo "   La clé HMAC de test est: 0123456789ABCDEF... (standard)"
else
    echo "⚠️  Configuration mixte détectée"
fi

echo ""
echo "======================================"
echo "📝 RÉSUMÉ"
echo "======================================"
echo ""
echo "Pour tester un paiement:"
echo "  1. Assurez-vous que la clé HMAC est correcte"
echo "  2. Redémarrez: pm2 restart backend"
echo "  3. Consultez les logs: pm2 logs backend | grep -i 'hmac\|signature'"
echo "  4. Testez un paiement de 1€"
echo ""
echo "Si l'erreur persiste après avoir mis la bonne clé:"
echo "  • Vérifiez l'ordre des paramètres dans la signature"
echo "  • Contactez le support Paybox"
echo "  • Fournissez: SITE=$SITE, RANG=001, IDENTIFIANT=$(grep '^PAYBOX_IDENTIFIANT=' .env | cut -d'=' -f2)"
echo ""
