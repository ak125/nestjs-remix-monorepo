#!/bin/bash

# 🤖 Script de lancement rapide des agents IA

echo "🤖 Système d'Agents IA - Menu"
echo "================================"
echo ""
echo "1) Lancer l'agent Cartographe"
echo "2) Lancer le driver complet"
echo "3) Lister les agents disponibles"
echo "4) Voir les derniers résultats"
echo "5) Nettoyer les rapports"
echo "6) Quitter"
echo ""
read -p "Choisissez une option (1-6): " choice

case $choice in
  1)
    echo ""
    echo "🚀 Lancement de l'agent Cartographe..."
    npm run agent:cartographe
    ;;
  2)
    echo ""
    echo "🚀 Lancement du driver IA complet..."
    npm run agent:driver
    ;;
  3)
    echo ""
    echo "📋 Agents disponibles:"
    npx ts-node src/cli/audit.ts list
    ;;
  4)
    echo ""
    if [ -f "reports/cartographe-summary.md" ]; then
      echo "📊 Résumé du dernier audit:"
      echo "================================"
      cat reports/cartographe-summary.md
    else
      echo "❌ Aucun rapport trouvé. Lancez d'abord un audit."
    fi
    ;;
  5)
    echo ""
    read -p "⚠️  Voulez-vous vraiment supprimer tous les rapports ? (o/N): " confirm
    if [[ $confirm == [oO] ]]; then
      rm -f reports/*.json reports/*.md
      echo "✅ Rapports supprimés (sauf .gitkeep)"
    else
      echo "❌ Annulé"
    fi
    ;;
  6)
    echo ""
    echo "👋 Au revoir !"
    exit 0
    ;;
  *)
    echo ""
    echo "❌ Option invalide"
    exit 1
    ;;
esac

echo ""
echo "✅ Terminé !"
echo ""
read -p "Appuyez sur Entrée pour continuer..."
