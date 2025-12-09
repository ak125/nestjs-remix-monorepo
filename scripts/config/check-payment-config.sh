#!/bin/bash
# ðŸ” Script de validation de la configuration de paiement
# Usage: ./check-payment-config.sh

set -e

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ” VÃ‰RIFICATION DE LA CONFIGURATION PAIEMENT"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
ERRORS=0
WARNINGS=0

# Fonction pour afficher les erreurs
error() {
  echo -e "${RED}âŒ ERREUR:${NC} $1"
  ((ERRORS++))
}

# Fonction pour afficher les warnings
warning() {
  echo -e "${YELLOW}âš ï¸  WARNING:${NC} $1"
  ((WARNINGS++))
}

# Fonction pour afficher les succÃ¨s
success() {
  echo -e "${GREEN}âœ…${NC} $1"
}

# 1. VÃ©rifier que .env existe
echo "ðŸ“ VÃ©rification des fichiers..."
if [ ! -f "backend/.env" ]; then
  error "Fichier backend/.env introuvable"
  echo "   ðŸ’¡ Solution: cp backend/.env.example backend/.env"
else
  success "Fichier backend/.env trouvÃ©"
fi

# 2. VÃ©rifier que .env n'est pas versionnÃ©
if git check-ignore backend/.env >/dev/null 2>&1; then
  success "Fichier .env correctement ignorÃ© par git"
else
  error "Fichier .env n'est PAS dans .gitignore !"
  echo "   âš ï¸  RISQUE DE SÃ‰CURITÃ‰ : VÃ©rifiez votre .gitignore"
fi

# 3. Charger les variables
if [ -f "backend/.env" ]; then
  set -a
  source backend/.env
  set +a
fi

echo ""
echo "ðŸ”‘ VÃ©rification des variables d'environnement..."

# 4. VÃ©rifier CYBERPLUS_SITE_ID
if [ -z "$CYBERPLUS_SITE_ID" ]; then
  error "CYBERPLUS_SITE_ID non dÃ©fini"
else
  # Masquer partiellement pour la sÃ©curitÃ©
  MASKED_ID="${CYBERPLUS_SITE_ID:0:4}****${CYBERPLUS_SITE_ID: -4}"
  success "CYBERPLUS_SITE_ID: $MASKED_ID"
fi

# 5. VÃ©rifier CYBERPLUS_CERTIFICAT
if [ -z "$CYBERPLUS_CERTIFICAT" ]; then
  error "CYBERPLUS_CERTIFICAT non dÃ©fini"
else
  # Ne jamais afficher le certificat, mÃªme masquÃ©
  success "CYBERPLUS_CERTIFICAT: ********** (dÃ©fini)"
  
  # VÃ©rifier la longueur
  CERT_LENGTH=${#CYBERPLUS_CERTIFICAT}
  if [ $CERT_LENGTH -lt 16 ]; then
    warning "Certificat trÃ¨s court ($CERT_LENGTH caractÃ¨res) - VÃ©rifiez sa validitÃ©"
  fi
fi

# 6. VÃ©rifier CYBERPLUS_MODE
if [ -z "$CYBERPLUS_MODE" ]; then
  error "CYBERPLUS_MODE non dÃ©fini"
elif [ "$CYBERPLUS_MODE" != "TEST" ] && [ "$CYBERPLUS_MODE" != "PRODUCTION" ]; then
  error "CYBERPLUS_MODE invalide: $CYBERPLUS_MODE (doit Ãªtre TEST ou PRODUCTION)"
else
  if [ "$CYBERPLUS_MODE" = "PRODUCTION" ]; then
    echo -e "${YELLOW}âš ï¸  Mode PRODUCTION activÃ©${NC}"
    if [ "$NODE_ENV" != "production" ]; then
      warning "CYBERPLUS_MODE=PRODUCTION mais NODE_ENV=$NODE_ENV"
    fi
  else
    success "CYBERPLUS_MODE: $CYBERPLUS_MODE"
  fi
fi

# 7. VÃ©rifier CYBERPLUS_PAYMENT_URL
if [ -z "$CYBERPLUS_PAYMENT_URL" ]; then
  warning "CYBERPLUS_PAYMENT_URL non dÃ©fini (valeur par dÃ©faut sera utilisÃ©e)"
else
  success "CYBERPLUS_PAYMENT_URL: $CYBERPLUS_PAYMENT_URL"
  
  # VÃ©rifier HTTPS en production
  if [ "$CYBERPLUS_MODE" = "PRODUCTION" ] && [[ ! "$CYBERPLUS_PAYMENT_URL" =~ ^https:// ]]; then
    error "CYBERPLUS_PAYMENT_URL doit utiliser HTTPS en production"
  fi
fi

# 8. VÃ©rifier APP_URL
if [ -z "$APP_URL" ]; then
  error "APP_URL non dÃ©fini"
else
  success "APP_URL: $APP_URL"
  
  # VÃ©rifier HTTPS en production
  if [ "$CYBERPLUS_MODE" = "PRODUCTION" ] && [[ ! "$APP_URL" =~ ^https:// ]]; then
    warning "APP_URL devrait utiliser HTTPS en production"
  fi
fi

echo ""
echo "ðŸ” VÃ©rification de la configuration TypeScript..."

# 9. VÃ©rifier que le fichier de config existe
if [ ! -f "backend/src/config/payment.config.ts" ]; then
  error "Fichier payment.config.ts introuvable"
else
  success "Fichier payment.config.ts trouvÃ©"
fi

# 10. VÃ©rifier l'import dans le module
if grep -q "paymentConfig" backend/src/modules/payments/payments.module.ts; then
  success "Configuration importÃ©e dans PaymentsModule"
else
  warning "Configuration pas importÃ©e dans PaymentsModule"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SULTAT"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}âœ… Configuration parfaite !${NC}"
  echo ""
  echo "Vous pouvez dÃ©marrer l'application :"
  echo "  cd backend && npm run dev"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}âš ï¸  Configuration OK avec $WARNINGS warning(s)${NC}"
  echo ""
  echo "Vous pouvez dÃ©marrer l'application :"
  echo "  cd backend && npm run dev"
  exit 0
else
  echo -e "${RED}âŒ $ERRORS erreur(s) et $WARNINGS warning(s)${NC}"
  echo ""
  echo "Corrigez les erreurs avant de dÃ©marrer l'application."
  echo ""
  echo "ðŸ’¡ Actions recommandÃ©es :"
  echo "  1. Copier le template : cp backend/.env.example backend/.env"
  echo "  2. Remplir les variables CYBERPLUS_* dans backend/.env"
  echo "  3. Relancer ce script : ./check-payment-config.sh"
  exit 1
fi
