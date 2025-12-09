#!/bin/bash

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "   CORRECTION CONFIGURATION PAIEMENT - VPS PRODUCTION"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "Date: $(date)"
echo ""

# VÃ©rification que nous sommes dans le bon rÃ©pertoire
if [ ! -f .env ]; then
    echo "âŒ ERREUR: Fichier .env introuvable dans le rÃ©pertoire actuel!"
    echo "   Assurez-vous d'Ãªtre dans ~/production/"
    exit 1
fi

# Backup automatique
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
cp .env "$BACKUP_FILE"
echo "âœ… Backup crÃ©Ã© : $BACKUP_FILE"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ”§ CORRECTIONS AUTOMATIQUES"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# 1. Supprimer la premiÃ¨re dÃ©finition de APP_URL (la ligne https://automecanik.fr)
echo "1ï¸âƒ£  Suppression de la duplication APP_URL..."
sed -i '/^APP_URL=https:\/\/automecanik\.fr$/d' .env
echo "   âœ… PremiÃ¨re dÃ©finition de APP_URL supprimÃ©e"

# 2. Corriger APP_URL pour utiliser HTTPS et le bon domaine
echo ""
echo "2ï¸âƒ£  Correction de APP_URL..."
if grep -q "^APP_URL=" .env; then
    sed -i 's|^APP_URL=.*|APP_URL=https://www.automecanik.com|' .env
    echo "   âœ… APP_URL = https://www.automecanik.com"
else
    echo "APP_URL=https://www.automecanik.com" >> .env
    echo "   âœ… APP_URL ajoutÃ©e"
fi

# 3. Corriger BASE_URL
echo ""
echo "3ï¸âƒ£  Correction de BASE_URL..."
if grep -q "^BASE_URL=" .env; then
    sed -i 's|^BASE_URL=.*|BASE_URL=https://www.automecanik.com|' .env
    echo "   âœ… BASE_URL = https://www.automecanik.com"
else
    echo "BASE_URL=https://www.automecanik.com" >> .env
    echo "   âœ… BASE_URL ajoutÃ©e"
fi

# 4. Ajouter FRONTEND_URL si elle n'existe pas
echo ""
echo "4ï¸âƒ£  Configuration de FRONTEND_URL..."
if grep -q "^FRONTEND_URL=" .env; then
    sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://www.automecanik.com|' .env
    echo "   âœ… FRONTEND_URL mise Ã  jour"
else
    echo "FRONTEND_URL=https://www.automecanik.com" >> .env
    echo "   âœ… FRONTEND_URL ajoutÃ©e"
fi

# 5. VÃ©rifier que SystemPay est en PRODUCTION
echo ""
echo "5ï¸âƒ£  VÃ©rification SystemPay..."
if grep -q "^SYSTEMPAY_MODE=PRODUCTION" .env; then
    echo "   âœ… SYSTEMPAY_MODE = PRODUCTION (dÃ©jÃ  correct)"
else
    sed -i 's/^SYSTEMPAY_MODE=.*/SYSTEMPAY_MODE=PRODUCTION/' .env
    echo "   âœ… SYSTEMPAY_MODE mis Ã  PRODUCTION"
fi

# 6. VÃ©rifier que Paybox est en PRODUCTION
echo ""
echo "6ï¸âƒ£  VÃ©rification Paybox..."
if grep -q "^PAYBOX_MODE=PRODUCTION" .env; then
    echo "   âœ… PAYBOX_MODE = PRODUCTION (dÃ©jÃ  correct)"
else
    sed -i 's/^PAYBOX_MODE=.*/PAYBOX_MODE=PRODUCTION/' .env
    echo "   âœ… PAYBOX_MODE mis Ã  PRODUCTION"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SUMÃ‰ DES CHANGEMENTS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "âœ… URLs corrigÃ©es vers HTTPS :"
echo "   APP_URL = https://www.automecanik.com"
echo "   BASE_URL = https://www.automecanik.com"
echo "   FRONTEND_URL = https://www.automecanik.com"
echo ""
echo "âœ… Modes de paiement vÃ©rifiÃ©s :"
echo "   SYSTEMPAY_MODE = PRODUCTION"
echo "   PAYBOX_MODE = PRODUCTION"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "âš ï¸  ACTIONS MANUELLES REQUISES"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "ðŸ” IMPORTANT - CLÃ‰S HMAC"
echo ""
echo "Les clÃ©s HMAC actuelles sont identiques pour :"
echo "  - PAYBOX_HMAC_KEY"
echo "  - SYSTEMPAY_HMAC_KEY_TEST"
echo "  - SYSTEMPAY_HMAC_KEY_PROD"
echo ""
echo "ðŸ“ž CONTACTEZ LES FOURNISSEURS :"
echo ""
echo "1ï¸âƒ£  PAYBOX - Obtenir la clÃ© HMAC de PRODUCTION"
echo "   ðŸ“§ Email : support@paybox.com"
echo "   ðŸ“ž TÃ©l : +33 (0)5 56 49 39 00"
echo ""
echo "   Informations Ã  fournir :"
echo "   - SITE : 5259250"
echo "   - RANG : 001"
echo "   - IDENTIFIANT : 822188223"
echo "   - Domaine : https://www.automecanik.com"
echo ""
echo "2ï¸âƒ£  SYSTEMPAY - VÃ©rifier la clÃ© HMAC de PRODUCTION"
echo "   Confirmer que la clÃ© PROD actuelle est bien diffÃ©rente de TEST"
echo ""
echo "Une fois les clÃ©s reÃ§ues, modifiez manuellement le .env :"
echo "  nano .env"
echo ""
echo "Puis mettez Ã  jour :"
echo "  PAYBOX_HMAC_KEY=<nouvelle_cle_paybox_prod>"
echo "  SYSTEMPAY_HMAC_KEY_PROD=<nouvelle_cle_systempay_prod>"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ”„ REDÃ‰MARRAGE DES SERVICES"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

read -p "Voulez-vous redÃ©marrer les conteneurs Docker maintenant ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "ðŸ”„ RedÃ©marrage en cours..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose restart
        echo "âœ… Services redÃ©marrÃ©s avec docker-compose"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose restart
        echo "âœ… Services redÃ©marrÃ©s avec docker compose"
    else
        echo "âš ï¸  Docker Compose introuvable. RedÃ©marrez manuellement :"
        echo "   docker-compose restart"
        echo "   OU"
        echo "   docker compose restart"
    fi
else
    echo ""
    echo "âš ï¸  N'oubliez pas de redÃ©marrer les services aprÃ¨s avoir mis Ã  jour les clÃ©s HMAC :"
    echo "   docker-compose restart"
    echo "   OU"
    echo "   docker compose restart"
fi

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "âœ… CORRECTION TERMINÃ‰E"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "ðŸ“‹ RÃ©capitulatif :"
echo "  âœ… URLs corrigÃ©es (HTTP â†’ HTTPS)"
echo "  âœ… Duplication APP_URL supprimÃ©e"
echo "  âœ… Modes PRODUCTION vÃ©rifiÃ©s"
echo "  âš ï¸  ClÃ©s HMAC Ã  obtenir auprÃ¨s des fournisseurs"
echo ""
echo "ðŸ’¾ Backup sauvegardÃ© : $BACKUP_FILE"
echo ""
echo "ðŸ“ Pour vÃ©rifier les changements :"
echo "   diff $BACKUP_FILE .env"
echo ""
