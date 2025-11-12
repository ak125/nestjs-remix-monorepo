#!/bin/bash

echo "🧹 Nettoyage intelligent du projet"
echo "=================================="
echo ""

# Sauvegarder les fichiers importants
KEEP_FILES=(
  "README.md"
  "AI-CONTENT-QUICK-START.md"
  "AI-QUICK-START.md"
  "QUICK-START.md"
)

# Créer un dossier d'archive pour les docs obsolètes
mkdir -p .archive/docs
mkdir -p .archive/scripts

echo "📦 Archivage des fichiers de documentation obsolètes..."

# Archiver les docs redondants/obsolètes
mv -f ANALYSE-CONFIG-VPS.md .archive/docs/ 2>/dev/null
mv -f AUDIT-COMPOSANTS-UI.md .archive/docs/ 2>/dev/null
mv -f CATALOGUE-ORDRE-*.md .archive/docs/ 2>/dev/null
mv -f DEBUG-MOTORISATIONS-ZERO.md .archive/docs/ 2>/dev/null
mv -f DIAGNOSTIC-SUPABASE-ETIMEDOUT.md .archive/docs/ 2>/dev/null
mv -f FIXES-SUPABASE-TIMEOUT*.md .archive/docs/ 2>/dev/null
mv -f MIGRATION-*.md .archive/docs/ 2>/dev/null
mv -f NAVIGATION-*.md .archive/docs/ 2>/dev/null
mv -f OPTIMISATIONS-PAGE-CATALOGUE.md .archive/docs/ 2>/dev/null
mv -f PERFORMANCE-ANALYSIS.md .archive/docs/ 2>/dev/null
mv -f SOLUTION-ORDRE-CATALOGUE-RECAP.md .archive/docs/ 2>/dev/null

echo "✅ Documentation obsolète archivée"

echo ""
echo "🗑️  Suppression des scripts de test/debug obsolètes..."

# Archiver les scripts de test
mv -f test-top-gammes.html .archive/scripts/ 2>/dev/null
mv -f check-payment-config-vps.sh .archive/scripts/ 2>/dev/null
mv -f fix-payment-config-vps.sh .archive/scripts/ 2>/dev/null
mv -f update-payment-config-prod.sh .archive/scripts/ 2>/dev/null
mv -f get-env-from-vps.sh .archive/scripts/ 2>/dev/null
mv -f test-performance.sh .archive/scripts/ 2>/dev/null

echo "✅ Scripts obsolètes archivés"

echo ""
echo "🧹 Nettoyage des fichiers temporaires..."

# Supprimer les caches
rm -rf .next .turbo **/.cache 2>/dev/null
rm -f cache/dump.rdb 2>/dev/null || sudo rm -f cache/dump.rdb 2>/dev/null

# Supprimer les logs
find . -name "*.log" -type f -size +1M -delete 2>/dev/null

# Supprimer les backups
find . -name "*.bak" -o -name "*~" -delete 2>/dev/null

echo "✅ Fichiers temporaires supprimés"

echo ""
echo "📊 Espace libéré:"
du -sh . 2>/dev/null

echo ""
echo "✨ Nettoyage terminé!"
echo ""
echo "📁 Fichiers archivés disponibles dans:"
echo "   - .archive/docs/ (documentation obsolète)"
echo "   - .archive/scripts/ (scripts de test)"
