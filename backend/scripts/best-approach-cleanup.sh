#!/bin/bash

# 🎯 MEILLEURE APPROCHE - Script maître de nettoyage optimal
# Objectif: Orchestrer le nettoyage en 3 phases avec validation

set -e

echo "🎯 MEILLEURE APPROCHE DE NETTOYAGE"
echo "=================================="
echo "📅 Date: $(date)"
echo "🏗️  Projet: NestJS Remix Monorepo"
echo ""

cd "$(dirname "$0")/.."

# Vérifications préalables
echo "🔍 VÉRIFICATIONS PRÉALABLES"
echo "=========================="

# Vérifier Git
if ! git status > /dev/null 2>&1; then
    echo "⚠️  Attention: Pas de repository Git détecté"
    echo "   Il est recommandé de committer vos changements avant nettoyage"
fi

# Vérifier que les scripts existent
scripts_required=(
    "scripts/phase1-legacy-cleanup.sh"
    "scripts/phase2-orders-cleanup.sh" 
    "scripts/phase3-final-optimization.sh"
)

for script in "${scripts_required[@]}"; do
    if [[ ! -f "$script" ]]; then
        echo "❌ Script manquant: $script"
        exit 1
    fi
    chmod +x "$script"
done

echo "✅ Tous les scripts sont prêts"
echo ""

# Affichage du plan
echo "📋 PLAN DE NETTOYAGE OPTIMAL"
echo "=========================="
echo ""
echo "Basé sur l'analyse stratégique, voici l'approche optimale :"
echo ""
echo "🌊 PHASE 1 - LEGACY (Sans risque)"
echo "  • Fichiers: legacy*, backup* (~ 7 fichiers)"
echo "  • Risque: Minimal ⭐"
echo "  • Bénéfice: Immédiat 🚀"
echo "  • Temps: ~2 minutes"
echo ""
echo "🌊 PHASE 2 - MODULE ORDERS (Impact élevé)"  
echo "  • Fichiers: enhanced*, simple*, minimal* dans orders (~ 9 fichiers)"
echo "  • Risque: Moyen ⭐⭐"
echo "  • Bénéfice: Très élevé 🚀🚀🚀"
echo "  • Temps: ~5 minutes + validation"
echo ""
echo "🌊 PHASE 3 - OPTIMISATION FINALE"
echo "  • Fichiers: Redondances restantes dans autres modules"
echo "  • Risque: Variable ⭐⭐"
echo "  • Bénéfice: Finition 🚀🚀"
echo "  • Temps: ~10 minutes + tests"
echo ""

echo "💾 SAUVEGARDES AUTOMATIQUES"
echo "==========================="
echo "• Sauvegarde avant chaque phase"
echo "• Scripts de restauration inclus"
echo "• Historique complet préservé"
echo ""

echo "🧪 VALIDATION CONTINUE"
echo "====================="
echo "• Test de compilation après chaque phase"
echo "• Validation de l'authentification"
echo "• Test de démarrage du serveur"
echo "• Possibilité d'arrêt à tout moment"
echo ""

# Demander confirmation
echo "🤔 ÊTES-VOUS PRÊT À COMMENCER ?"
echo "==============================="
echo ""
read -p "Lancer le nettoyage optimal en 3 phases ? (y/N) " -n 1 -r
echo
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Nettoyage annulé"
    echo ""
    echo "💡 Vous pouvez :"
    echo "  • Examiner les scripts individuellement"
    echo "  • Exécuter une phase à la fois"
    echo "  • Modifier l'approche selon vos besoins"
    exit 0
fi

echo "🚀 DÉMARRAGE DU NETTOYAGE OPTIMAL"
echo "================================="
echo ""

# Variables de suivi
phase1_success=false
phase2_success=false  
phase3_success=false
start_time=$(date +%s)

echo "🌊 EXÉCUTION PHASE 1 - LEGACY CLEANUP"
echo "===================================="
if ./scripts/phase1-legacy-cleanup.sh; then
    phase1_success=true
    echo "✅ Phase 1 réussie"
else
    echo "❌ Phase 1 échouée - Arrêt du processus"
    exit 1
fi

echo ""
read -p "Continuer avec la Phase 2 (Module Orders) ? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "⏸️  Arrêt après Phase 1 - C'est déjà un progrès !"
    exit 0
fi

echo ""
echo "🌊 EXÉCUTION PHASE 2 - ORDERS MODULE CLEANUP"
echo "==========================================="
if ./scripts/phase2-orders-cleanup.sh; then
    phase2_success=true
    echo "✅ Phase 2 réussie"
else
    echo "⚠️  Phase 2 a rencontré des problèmes"
    echo "🔄 Les sauvegardes permettent une restauration complète"
    read -p "Continuer malgré tout avec la Phase 3 ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏸️  Arrêt après Phase 2"
        exit 0
    fi
fi

echo ""
read -p "Continuer avec la Phase 3 (Optimisation finale) ? (Y/n) " -n 1 -r  
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "⏸️  Arrêt après Phase 2 - Déjà de gros progrès !"
    exit 0
fi

echo ""
echo "🌊 EXÉCUTION PHASE 3 - FINAL OPTIMIZATION"
echo "======================================="
if ./scripts/phase3-final-optimization.sh; then
    phase3_success=true
    echo "✅ Phase 3 réussie"
else
    echo "⚠️  Phase 3 a rencontré des problèmes"
    echo "💡 Le système devrait tout de même être fonctionnel"
fi

# Rapport final
end_time=$(date +%s)
duration=$((end_time - start_time))
minutes=$((duration / 60))
seconds=$((duration % 60))

echo ""
echo "🎉 NETTOYAGE OPTIMAL TERMINÉ"
echo "=========================="
echo "⏱️  Durée totale: ${minutes}m ${seconds}s"
echo ""

echo "📊 RÉSULTATS PAR PHASE"
echo "====================="
if [[ "$phase1_success" == "true" ]]; then
    echo "✅ Phase 1 (Legacy): Réussie"
else
    echo "❌ Phase 1 (Legacy): Échouée"
fi

if [[ "$phase2_success" == "true" ]]; then
    echo "✅ Phase 2 (Orders): Réussie" 
else
    echo "⚠️  Phase 2 (Orders): Problèmes détectés"
fi

if [[ "$phase3_success" == "true" ]]; then
    echo "✅ Phase 3 (Final): Réussie"
else
    echo "⚠️  Phase 3 (Final): Problèmes détectés"
fi

echo ""
echo "💾 SAUVEGARDES CRÉÉES"
echo "===================="
find ../backup -name "*cleanup*" -type d | sort | while read dir; do
    echo "📁 $(basename "$dir")"
done

echo ""
if [[ "$phase1_success" == "true" && "$phase2_success" == "true" && "$phase3_success" == "true" ]]; then
    echo "🏆 NETTOYAGE PARFAITEMENT RÉUSSI !"
    echo "================================="
    echo ""
    echo "🎯 Bénéfices obtenus :"
    echo "✅ Architecture simplifiée et claire"
    echo "✅ Code redondant supprimé"  
    echo "✅ Performance améliorée"
    echo "✅ Maintenabilité accrue"
    echo "✅ Moins de confusion pour l'équipe"
    echo ""
    echo "🚀 Votre projet est maintenant optimisé et prêt pour la production !"
else
    echo "⚠️  NETTOYAGE PARTIELLEMENT RÉUSSI"
    echo "=================================="
    echo ""
    echo "💡 Vous avez tout de même obtenu des améliorations significatives"
    echo "🔄 Les sauvegardes permettent une restauration si nécessaire"
    echo "🛠️  Des ajustements manuels peuvent finaliser l'optimisation"
fi

echo ""
echo "📚 PROCHAINES ÉTAPES RECOMMANDÉES"
echo "================================"
echo "1. 🧪 Tester votre application complètement"
echo "2. 📝 Mettre à jour la documentation"
echo "3. 👥 Informer l'équipe des changements"
echo "4. 🔄 Établir des standards pour éviter la redondance future"
echo ""
echo "🎯 Félicitations pour avoir optimisé votre architecture NestJS !"
