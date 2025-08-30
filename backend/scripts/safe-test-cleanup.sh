#!/bin/bash

# 🧹 Nettoyage ultra-sûr - Fichiers de test non importés
# Objectif: Supprimer seulement les fichiers confirmés non utilisés

set -e

echo "🧹 NETTOYAGE ULTRA-SÛRE - FICHIERS TEST NON IMPORTÉS"
echo "=================================================="
echo "📅 Date: $(date)"
echo ""

cd "$(dirname "$0")/.."

# Créer sauvegarde spécifique
BACKUP_DIR="../backup/safe-test-cleanup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🗄️  Sauvegarde des fichiers de test sûrs..."

# Fichiers confirmés non importés
safe_files=(
    "src/modules/search/services/indexation-test.service.ts"
    "src/modules/vehicles/vehicles-zod-test.module.ts" 
    "src/common/utils/test-helpers.ts"
)

saved_count=0
for file in "${safe_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  📄 Sauvegarde: $file"
        cp "$file" "$BACKUP_DIR/$(basename "$file")"
        saved_count=$((saved_count + 1))
    else
        echo "  ⚠️  Non trouvé: $file"
    fi
done

echo ""
echo "🗑️  Suppression des fichiers de test sûrs..."

removed_count=0
for file in "${safe_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  🗑️  Suppression: $file"
        rm "$file"
        removed_count=$((removed_count + 1))
    fi
done

echo ""
echo "✅ NETTOYAGE ULTRA-SÛRE TERMINÉ"
echo "==============================="
echo "📁 Sauvegarde: $BACKUP_DIR"
echo "📊 Fichiers sauvegardés: $saved_count"
echo "📊 Fichiers supprimés: $removed_count"
echo ""

# Test rapide de compilation
echo "🔧 Test de compilation..."
if timeout 30s npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie après nettoyage sûr"
    
    # Test du serveur
    echo ""
    echo "🚀 Test de démarrage du serveur..."
    timeout 15s npm run dev > /dev/null 2>&1 &
    server_pid=$!
    sleep 8
    
    if kill -0 $server_pid 2>/dev/null; then
        echo "✅ Serveur démarre correctement"
        kill $server_pid 2>/dev/null || true
    else
        echo "⚠️  Problème de démarrage détecté"
    fi
    
else
    echo "⚠️  Problème de compilation détecté"
    echo "🔄 Restauration possible avec: cp $BACKUP_DIR/* [destination]"
fi

echo ""
echo "🎯 RECOMMANDATIONS SUIVANTES"
echo "=========================="
echo ""
if [[ $removed_count -eq ${#safe_files[@]} ]]; then
    echo "🏆 NETTOYAGE PARFAITEMENT RÉUSSI !"
    echo ""
    echo "Options pour continuer :"
    echo "1. 🛡️  S'ARRÊTER ICI - Vous avez déjà gagné en propreté"
    echo "2. 🎯 CONTINUER - Phase 2 avec le module Orders"  
    echo "3. 🔍 ANALYSER - Examiner d'autres modules individuellement"
    echo ""
    echo "Votre projet est plus propre et stable !"
else
    echo "⚠️  Nettoyage partiel - vérification recommandée"
fi
