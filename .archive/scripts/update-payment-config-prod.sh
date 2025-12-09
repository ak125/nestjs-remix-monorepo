#!/bin/bash

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "   MISE Ã€ JOUR CONFIGURATION PAIEMENT - PRODUCTION VPS"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "Date: $(date)"
echo ""

# VÃ©rification de l'existence du fichier .env
if [ ! -f .env ]; then
    echo "âŒ ERREUR: Fichier .env introuvable!"
    exit 1
fi

# Backup du fichier .env
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
cp .env "$BACKUP_FILE"
echo "âœ… Backup crÃ©Ã©: $BACKUP_FILE"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“ MISE Ã€ JOUR DES CONFIGURATIONS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Configuration SystemPay/Cyberplus (celle qui fonctionne actuellement)
echo "1ï¸âƒ£  Configuration SystemPay (ACTIF EN PRODUCTION)"

# Mise Ã  jour SYSTEMPAY_MODE
if grep -q "^SYSTEMPAY_MODE=" .env; then
    sed -i 's/^SYSTEMPAY_MODE=.*/SYSTEMPAY_MODE=PRODUCTION/' .env
    echo "  âœ… SYSTEMPAY_MODE = PRODUCTION"
else
    echo "SYSTEMPAY_MODE=PRODUCTION" >> .env
    echo "  âœ… SYSTEMPAY_MODE = PRODUCTION (ajoutÃ©)"
fi

# Mise Ã  jour SYSTEMPAY_CERTIFICATE_TEST
if grep -q "^SYSTEMPAY_CERTIFICATE_TEST=" .env; then
    sed -i 's/^SYSTEMPAY_CERTIFICATE_TEST=.*/SYSTEMPAY_CERTIFICATE_TEST=9300172162563656/' .env
    echo "  âœ… SYSTEMPAY_CERTIFICATE_TEST = 9300172162563656"
else
    echo "SYSTEMPAY_CERTIFICATE_TEST=9300172162563656" >> .env
    echo "  âœ… SYSTEMPAY_CERTIFICATE_TEST = 9300172162563656 (ajoutÃ©)"
fi

# Mise Ã  jour SYSTEMPAY_CERTIFICATE_PROD
if grep -q "^SYSTEMPAY_CERTIFICATE_PROD=" .env; then
    sed -i 's/^SYSTEMPAY_CERTIFICATE_PROD=.*/SYSTEMPAY_CERTIFICATE_PROD=9816635272016068/' .env
    echo "  âœ… SYSTEMPAY_CERTIFICATE_PROD = 9816635272016068"
else
    echo "SYSTEMPAY_CERTIFICATE_PROD=9816635272016068" >> .env
    echo "  âœ… SYSTEMPAY_CERTIFICATE_PROD = 9816635272016068 (ajoutÃ©)"
fi

# Mise Ã  jour SYSTEMPAY_SITE_ID
if grep -q "^SYSTEMPAY_SITE_ID=" .env; then
    sed -i 's/^SYSTEMPAY_SITE_ID=.*/SYSTEMPAY_SITE_ID=43962882/' .env
    echo "  âœ… SYSTEMPAY_SITE_ID = 43962882"
else
    echo "SYSTEMPAY_SITE_ID=43962882" >> .env
    echo "  âœ… SYSTEMPAY_SITE_ID = 43962882 (ajoutÃ©)"
fi

# Mise Ã  jour SYSTEMPAY_API_URL
if grep -q "^SYSTEMPAY_API_URL=" .env; then
    sed -i 's|^SYSTEMPAY_API_URL=.*|SYSTEMPAY_API_URL=https://paiement.systempay.fr/vads-payment/|' .env
    echo "  âœ… SYSTEMPAY_API_URL = https://paiement.systempay.fr/vads-payment/"
else
    echo "SYSTEMPAY_API_URL=https://paiement.systempay.fr/vads-payment/" >> .env
    echo "  âœ… SYSTEMPAY_API_URL = https://paiement.systempay.fr/vads-payment/ (ajoutÃ©)"
fi

echo ""
echo "2ï¸âƒ£  Configuration Paybox (PRODUCTION)"

# Configuration Paybox - Mode PRODUCTION
if grep -q "^PAYBOX_MODE=" .env; then
    sed -i 's/^PAYBOX_MODE=.*/PAYBOX_MODE=PRODUCTION/' .env
    echo "  âœ… PAYBOX_MODE = PRODUCTION"
else
    echo "PAYBOX_MODE=PRODUCTION" >> .env
    echo "  âœ… PAYBOX_MODE = PRODUCTION (ajoutÃ©)"
fi

# Mise Ã  jour PAYBOX_SITE
if grep -q "^PAYBOX_SITE=" .env; then
    sed -i 's/^PAYBOX_SITE=.*/PAYBOX_SITE=5259250/' .env
    echo "  âœ… PAYBOX_SITE = 5259250"
else
    echo "PAYBOX_SITE=5259250" >> .env
    echo "  âœ… PAYBOX_SITE = 5259250 (ajoutÃ©)"
fi

# Mise Ã  jour PAYBOX_PAYMENT_URL
if grep -q "^PAYBOX_PAYMENT_URL=" .env; then
    sed -i 's|^PAYBOX_PAYMENT_URL=.*|PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi|' .env
    echo "  âœ… PAYBOX_PAYMENT_URL = https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
else
    echo "PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi" >> .env
    echo "  âœ… PAYBOX_PAYMENT_URL = https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi (ajoutÃ©)"
fi

# Mise Ã  jour PAYBOX_URL (alias)
if grep -q "^PAYBOX_URL=" .env; then
    sed -i 's|^PAYBOX_URL=.*|PAYBOX_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi|' .env
    echo "  âœ… PAYBOX_URL = https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi"
fi

echo ""
echo "3ï¸âƒ£  Configuration URLs"

# Mise Ã  jour BASE_URL
if grep -q "^BASE_URL=" .env; then
    sed -i 's|^BASE_URL=.*|BASE_URL=https://www.automecanik.com|' .env
    echo "  âœ… BASE_URL = https://www.automecanik.com"
else
    echo "BASE_URL=https://www.automecanik.com" >> .env
    echo "  âœ… BASE_URL = https://www.automecanik.com (ajoutÃ©)"
fi

# Mise Ã  jour FRONTEND_URL
if grep -q "^FRONTEND_URL=" .env; then
    sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://www.automecanik.com|' .env
    echo "  âœ… FRONTEND_URL = https://www.automecanik.com"
else
    echo "FRONTEND_URL=https://www.automecanik.com" >> .env
    echo "  âœ… FRONTEND_URL = https://www.automecanik.com (ajoutÃ©)"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "âš ï¸  ATTENTION - CLÃ‰S HMAC"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "Les clÃ©s HMAC n'ont PAS Ã©tÃ© modifiÃ©es automatiquement pour des raisons de sÃ©curitÃ©."
echo ""
echo "ðŸ” Actions requises :"
echo ""
echo "1. Contactez Paybox pour obtenir votre clÃ© HMAC de PRODUCTION :"
echo "   ðŸ“§ Email: support@paybox.com"
echo "   ðŸ“ž TÃ©l: +33 (0)5 56 49 39 00"
echo ""
echo "2. Informations Ã  fournir Ã  Paybox :"
echo "   - SITE: 5259250"
echo "   - RANG: 001"
echo "   - IDENTIFIANT: 822188223"
echo "   - Domaine: https://www.automecanik.com"
echo ""
echo "3. Une fois reÃ§ue, mettez Ã  jour manuellement dans le .env :"
echo "   PAYBOX_HMAC_KEY=<votre_clÃ©_production>"
echo ""
echo "4. Pour SystemPay, si vous avez une clÃ© PROD diffÃ©rente de TEST :"
echo "   SYSTEMPAY_HMAC_KEY_PROD=<votre_clÃ©_systempay_production>"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ”„ REDÃ‰MARRAGE DES SERVICES"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

read -p "Voulez-vous redÃ©marrer les conteneurs Docker maintenant ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "ðŸ”„ RedÃ©marrage des conteneurs..."
    docker-compose restart backend
    echo "âœ… Backend redÃ©marrÃ©"
else
    echo "âš ï¸  N'oubliez pas de redÃ©marrer manuellement : docker-compose restart backend"
fi

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "âœ… CONFIGURATION MISE Ã€ JOUR"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "ðŸ“‹ RÃ©sumÃ© :"
echo "  âœ… SystemPay configurÃ© en mode PRODUCTION"
echo "  âœ… Paybox configurÃ© en mode PRODUCTION"
echo "  âœ… URLs mises Ã  jour vers HTTPS"
echo "  âš ï¸  ClÃ©s HMAC Ã  obtenir auprÃ¨s des fournisseurs"
echo ""
echo "ðŸ’¾ Backup disponible : $BACKUP_FILE"
echo ""
