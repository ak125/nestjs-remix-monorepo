#!/bin/bash

# 🧹 Phase 1: Nettoyage des fichiers Legacy (Sans risque)
# Objectif: Supprimer les fichiers clairement obsolètes

set -e

echo "🧹 PHASE 1: NETTOYAGE LEGACY"
echo "============================"
echo "📅 Date: $(date)"
echo ""

cd "$(dirname "$0")/.."

# Créer sauvegarde spécifique legacy
BACKUP_DIR="../backup/legacy-cleanup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🗄️  Sauvegarde des fichiers legacy..."

# Sauvegarder les fichiers legacy
legacy_files=(
    "src/modules/orders/controllers/legacy-orders.controller.ts"
    "src/modules/messages/legacy-messaging.controller.ts" 
    "src/modules/messages/legacy-messaging.service.ts"
    "src/modules/search/services/search-legacy.service.ts"
    "src/modules/blog/services/advice.service.backup.ts"
    "src/database/services/legacy-order.service.ts"
    "src/database/services/legacy-user.service.ts"
)

saved_count=0
for file in "${legacy_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  📄 Sauvegarde: $file"
        cp "$file" "$BACKUP_DIR/$(basename "$file")"
        saved_count=$((saved_count + 1))
    else
        echo "  ⚠️  Non trouvé: $file"
    fi
done

echo ""
echo "🗑️  Suppression des fichiers legacy..."

removed_count=0
for file in "${legacy_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  🗑️  Suppression: $file"
        rm "$file"
        removed_count=$((removed_count + 1))
    fi
done

echo ""
echo "✅ PHASE 1 TERMINÉE"
echo "==================="
echo "📁 Sauvegarde: $BACKUP_DIR"
echo "📊 Fichiers sauvegardés: $saved_count"
echo "📊 Fichiers supprimés: $removed_count"
echo ""

# Test rapide de compilation
echo "🔧 Test de compilation..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie après nettoyage legacy"
else
    echo "⚠️  Problème de compilation détecté - vérification recommandée"
fi

echo ""
echo "🎯 PRÊT POUR LA PHASE 2: Module Orders"
