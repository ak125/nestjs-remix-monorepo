#!/bin/bash
# Script pour mettre à jour la clé HMAC Paybox

echo "🔐 Mise à jour de la clé HMAC Paybox"
echo ""
echo "Pour obtenir votre clé HMAC de test :"
echo "1. Connectez-vous à https://preprod-admin.paybox.com"
echo "2. Allez dans 'Profil marchand' > 'Clés de sécurité'"
echo "3. Copiez la 'Clé HMAC' (128 caractères)"
echo ""
read -p "Entrez votre clé HMAC (128 caractères hex) : " HMAC_KEY

# Validation basique
if [ ${#HMAC_KEY} -ne 128 ]; then
    echo "❌ Erreur: La clé doit faire exactement 128 caractères"
    exit 1
fi

# Mise à jour du .env
sed -i "s|^PAYBOX_HMAC_KEY=.*|PAYBOX_HMAC_KEY=$HMAC_KEY|" .env
echo "✅ Clé HMAC mise à jour dans .env"
echo ""
echo "Redémarrez le serveur avec: npm run dev"
