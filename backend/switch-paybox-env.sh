#!/bin/bash
# Script pour basculer entre environnements Paybox TEST et PRODUCTION

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔄 Basculement Environnement Paybox                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier l'environnement actuel
CURRENT_MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2)
CURRENT_URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2)

echo "📊 Environnement actuel :"
echo "   • Mode : $CURRENT_MODE"
echo "   • URL  : $CURRENT_URL"
echo ""

# Menu de sélection
echo "Choisir l'environnement :"
echo "  1) TEST (preprod - cartes de test)"
echo "  2) PRODUCTION (paiements réels) ⚠️"
echo "  3) Annuler"
echo ""
read -p "Votre choix (1/2/3) : " choice

case $choice in
  1)
    if [ ! -f .env.test ]; then
      echo "❌ Erreur : .env.test n'existe pas"
      echo ""
      echo "Pour créer .env.test :"
      echo "1. Contactez le support Paybox pour obtenir vos identifiants TEST"
      echo "2. Copiez le template : cp .env.test.template .env.test"
      echo "3. Modifiez .env.test avec vos vrais identifiants TEST"
      exit 1
    fi
    
    echo "🔄 Basculement vers TEST..."
    cp .env .env.backup-before-switch
    cp .env.test .env
    echo "✅ Environnement TEST activé"
    echo ""
    echo "Configuration Paybox TEST :"
    grep "^PAYBOX_" .env | grep -v "HMAC_KEY"
    echo "PAYBOX_HMAC_KEY=***...*** (masqué)"
    echo ""
    echo "💳 Utilisez les cartes de test Paybox :"
    echo "   • VISA : 4000000000001091 | Exp: 01/2026 | CVV: 123"
    echo ""
    echo "🔄 Redémarrez le serveur : npm run dev"
    ;;
    
  2)
    if [ ! -f .env.production ]; then
      echo "❌ Erreur : .env.production n'existe pas"
      exit 1
    fi
    
    echo "⚠️⚠️⚠️  ATTENTION  ⚠️⚠️⚠️"
    echo "Vous allez basculer en PRODUCTION !"
    echo "Les paiements seront RÉELS et les cartes DÉBITÉES."
    echo ""
    read -p "Êtes-vous sûr ? (oui/non) : " confirm
    
    if [ "$confirm" = "oui" ]; then
      echo "🔄 Basculement vers PRODUCTION..."
      cp .env .env.backup-before-switch
      cp .env.production .env
      echo "✅ Environnement PRODUCTION activé"
      echo ""
      echo "Configuration Paybox PRODUCTION :"
      grep "^PAYBOX_" .env | grep -v "HMAC_KEY"
      echo "PAYBOX_HMAC_KEY=***...*** (masqué)"
      echo ""
      echo "⚠️  PAIEMENTS RÉELS ACTIVÉS"
      echo "🔄 Redémarrez le serveur : npm run dev"
    else
      echo "❌ Annulé"
    fi
    ;;
    
  3)
    echo "❌ Annulé"
    exit 0
    ;;
    
  *)
    echo "❌ Choix invalide"
    exit 1
    ;;
esac
