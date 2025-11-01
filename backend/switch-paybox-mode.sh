#!/bin/bash
# Script de basculement entre TEST et PRODUCTION Paybox

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🔄 Basculement d'environnement Paybox                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Environnement actuel:"
grep "^PAYBOX_MODE" .env || echo "  Mode: non défini"
grep "^PAYBOX_SITE" .env || echo "  Site: non défini"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choisissez le mode:"
echo ""
echo "  1) 🧪 TEST (paiements simulés, compte 1999888)"
echo "     • URL: https://preprod-tpeweb.paybox.com"
echo "     • Carte test: 4000 0000 0000 1091"
echo "     • Base URL: http://localhost:5173"
echo ""
echo "  2) 🔴 PRODUCTION (vrais paiements, compte 5259250)"
echo "     • URL: https://tpeweb.paybox.com"
echo "     • ATTENTION: Paiements RÉELS !"
echo "     • Base URL: https://www.automecanik.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Votre choix [1-2]: " choice

case $choice in
  1)
    echo ""
    echo "🧪 Activation du mode TEST..."
    
    # Backup avant modification
    cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
    
    # Mettre à jour les variables
    sed -i 's/^PAYBOX_MODE=.*/PAYBOX_MODE=TEST/' .env
    sed -i 's/^PAYBOX_SITE=.*/PAYBOX_SITE=1999888/' .env
    sed -i 's/^PAYBOX_RANG=.*/PAYBOX_RANG=32/' .env
    sed -i 's/^PAYBOX_IDENTIFIANT=.*/PAYBOX_IDENTIFIANT=107904482/' .env
    sed -i 's/^PAYBOX_HMAC_KEY=.*/PAYBOX_HMAC_KEY=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF/' .env
    sed -i 's|^PAYBOX_PAYMENT_URL=.*|PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi|' .env
    sed -i 's|^BASE_URL=.*|BASE_URL="http://localhost:5173"|' .env
    
    echo ""
    echo "✅ Mode TEST activé avec succès !"
    echo ""
    echo "Configuration:"
    echo "  • Mode: TEST"
    echo "  • Site: 1999888"
    echo "  • URL: https://preprod-tpeweb.paybox.com"
    echo "  • Base URL: http://localhost:5173"
    echo ""
    echo "💳 Carte de test à utiliser:"
    echo "  Numéro: 4000 0000 0000 1091"
    echo "  Exp: 01/2026"
    echo "  CVV: 123"
    echo ""
    echo "🔄 Redémarrez le serveur: npm run dev"
    ;;
    
  2)
    echo ""
    echo "⚠️  Activation du mode PRODUCTION..."
    echo ""
    echo "🚨 ATTENTION: Les paiements seront RÉELS !"
    echo ""
    read -p "Êtes-vous absolument SÛR ? [tapez 'OUI' en majuscules]: " confirm
    
    if [ "$confirm" = "OUI" ]; then
      # Backup avant modification
      cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
      
      # Mettre à jour les variables
      sed -i 's/^PAYBOX_MODE=.*/PAYBOX_MODE=PRODUCTION/' .env
      sed -i 's/^PAYBOX_SITE=.*/PAYBOX_SITE=5259250/' .env
      sed -i 's/^PAYBOX_RANG=.*/PAYBOX_RANG=001/' .env
      sed -i 's/^PAYBOX_IDENTIFIANT=.*/PAYBOX_IDENTIFIANT=822188223/' .env
      sed -i 's/^PAYBOX_HMAC_KEY=.*/PAYBOX_HMAC_KEY=7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5/' .env
      sed -i 's|^PAYBOX_PAYMENT_URL=.*|PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi|' .env
      sed -i 's|^BASE_URL=.*|BASE_URL="https://www.automecanik.com"|' .env
      
      echo ""
      echo "🔴 Mode PRODUCTION activé !"
      echo ""
      echo "Configuration:"
      echo "  • Mode: PRODUCTION"
      echo "  • Site: 5259250"
      echo "  • URL: https://tpeweb.paybox.com"
      echo "  • Base URL: https://www.automecanik.com"
      echo ""
      echo "⚠️  RAPPEL: PAIEMENTS RÉELS ACTIVÉS !"
      echo ""
      echo "🔄 Redémarrez le serveur: npm run dev"
    else
      echo ""
      echo "❌ Activation annulée (réponse incorrecte)"
      echo "   Vous devez taper 'OUI' en majuscules pour confirmer"
      exit 1
    fi
    ;;
    
  *)
    echo ""
    echo "❌ Choix invalide. Annulation."
    exit 1
    ;;
esac

echo ""
