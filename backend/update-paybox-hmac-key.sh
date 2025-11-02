#!/bin/bash
# Script pour mettre à jour la clé HMAC Paybox dans le .env

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔐 Mise à jour de la clé HMAC Paybox                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Pour obtenir votre clé HMAC :"
echo "1. Connectez-vous à : https://preprod-admin.paybox.com"
echo "2. Login    : 199988832"
echo "3. Password : 1999888I"
echo "4. Menu : Configuration > Sécurité > Clés de sécurité"
echo "5. Copiez la 'Clé HMAC' (128 caractères)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Entrez votre clé HMAC (128 caractères hex) : " HMAC_KEY

# Validation basique
if [ -z "$HMAC_KEY" ]; then
    echo "❌ Erreur : Aucune clé fournie"
    exit 1
fi

if [ ${#HMAC_KEY} -ne 128 ]; then
    echo "❌ Erreur : La clé doit faire exactement 128 caractères"
    echo "   Longueur actuelle : ${#HMAC_KEY}"
    exit 1
fi

# Vérifier que ce n'est pas la clé d'exemple
if [[ "$HMAC_KEY" == 0123456789ABCDEF* ]]; then
    echo "❌ Erreur : Vous utilisez toujours la clé d'exemple !"
    echo "   Connectez-vous au Back Office pour obtenir la vraie clé."
    exit 1
fi

# Backup du .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup créé : .env.backup-$(date +%Y%m%d-%H%M%S)"

# Mise à jour du .env
sed -i "s|^PAYBOX_HMAC_KEY=.*|PAYBOX_HMAC_KEY=$HMAC_KEY|" .env
echo "✅ Clé HMAC mise à jour dans .env"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Pour appliquer les changements :"
echo "   1. Arrêtez le serveur (Ctrl+C)"
echo "   2. Redémarrez avec : npm run dev"
echo ""
echo "✅ Configuration prête !"
