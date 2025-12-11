#!/bin/bash
# Script pour mettre Ã  jour la clÃ© HMAC Paybox

echo "ðŸ” Mise Ã  jour de la clÃ© HMAC Paybox"
echo ""
echo "Pour obtenir votre clÃ© HMAC de test :"
echo "1. Connectez-vous Ã  https://preprod-admin.paybox.com"
echo "2. Allez dans 'Profil marchand' > 'ClÃ©s de sÃ©curitÃ©'"
echo "3. Copiez la 'ClÃ© HMAC' (128 caractÃ¨res)"
echo ""
read -p "Entrez votre clÃ© HMAC (128 caractÃ¨res hex) : " HMAC_KEY

# Validation basique
if [ ${#HMAC_KEY} -ne 128 ]; then
    echo "âŒ Erreur: La clÃ© doit faire exactement 128 caractÃ¨res"
    exit 1
fi

# Mise Ã  jour du .env
sed -i "s|^PAYBOX_HMAC_KEY=.*|PAYBOX_HMAC_KEY=$HMAC_KEY|" .env
echo "âœ… ClÃ© HMAC mise Ã  jour dans .env"
echo ""
echo "RedÃ©marrez le serveur avec: npm run dev"
