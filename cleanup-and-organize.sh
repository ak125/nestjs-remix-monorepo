#!/bin/bash

# 🧹 SCRIPT DE NETTOYAGE ET ORGANISATION
# Nettoie les fichiers obsolètes et organise la structure

echo "🧹 Nettoyage et organisation du projet"
echo "======================================"

# Dossier de base
PROJECT_ROOT="/workspaces/nestjs-remix-monorepo"
cd "$PROJECT_ROOT"

# Compteurs
CLEANED_FILES=0
ORGANIZED_FILES=0
ERRORS=0

echo ""
echo "📂 Phase 1: Nettoyage des fichiers obsolètes"
echo "============================================"

# Supprimer les fichiers de build temporaires
if [ -f "backend/tsconfig.tsbuildinfo" ]; then
    echo "🗑️  Suppression de tsconfig.tsbuildinfo"
    rm backend/tsconfig.tsbuildinfo
    CLEANED_FILES=$((CLEANED_FILES + 1))
fi

# Nettoyer les node_modules temporaires si nécessaire
echo "🔍 Vérification des node_modules..."

# Nettoyer les fichiers de cache
if [ -d ".cache" ]; then
    echo "🗑️  Suppression du cache temporaire"
    rm -rf .cache
    CLEANED_FILES=$((CLEANED_FILES + 1))
fi

echo ""
echo "📁 Phase 2: Organisation des composants"
echo "======================================="

# Vérifier que les composants UI sont bien organisés
if [ -f "frontend/app/components/ui/LazyCard.tsx" ] && 
   [ -f "frontend/app/components/ui/LazyImage.tsx" ] && 
   [ -f "frontend/app/components/ui/SkeletonLoader.tsx" ]; then
    echo "✅ Composants UI bien organisés"
    ORGANIZED_FILES=$((ORGANIZED_FILES + 3))
else
    echo "⚠️  Certains composants UI manquent"
    ERRORS=$((ERRORS + 1))
fi

# Vérifier l'organisation des composants de panier
if [ -f "frontend/app/components/cart/index.ts" ]; then
    echo "✅ Module cart organisé"
    ORGANIZED_FILES=$((ORGANIZED_FILES + 1))
else
    echo "⚠️  Module cart non organisé"
    ERRORS=$((ERRORS + 1))
fi

# Vérifier l'organisation des composants dev
if [ -f "frontend/app/components/dev/index.ts" ]; then
    echo "✅ Module dev organisé"
    ORGANIZED_FILES=$((ORGANIZED_FILES + 1))
else
    echo "⚠️  Module dev non organisé"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📋 Phase 3: Vérification de la structure"
echo "========================================"

# Vérifier que les dossiers importants existent
REQUIRED_DIRS=(
    "backend/src/common/validation"
    "frontend/app/components/ui"
    "frontend/app/components/cart"
    "frontend/app/components/dev"
    "frontend/app/routes/dev"
    "frontend/app/hooks"
    "frontend/app/types"
    "frontend/app/utils"
    "docs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir existe"
    else
        echo "❌ $dir manquant"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "🧪 Phase 4: Validation des fichiers critiques"
echo "============================================="

# Fichiers critiques qui doivent exister
CRITICAL_FILES=(
    "backend/src/common/validation/cart-validation-fixed.ts"
    "backend/src/common/validation/zod-validation.module.ts"
    "frontend/app/hooks/useZodValidation.ts"
    "frontend/app/types/cart-validation.ts"
    "docs/ZOD_VALIDATION_GUIDE.md"
    "ZOD_QUICK_START.md"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file présent"
    else
        echo "❌ $file manquant"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "📊 Phase 5: Statistiques de taille"
echo "=================================="

# Calculer la taille des dossiers principaux
if command -v du > /dev/null; then
    echo "📏 Tailles des dossiers principaux:"
    du -sh backend/src/ 2>/dev/null | sed 's/^/   Backend: /' || echo "   Backend: N/A"
    du -sh frontend/app/ 2>/dev/null | sed 's/^/   Frontend: /' || echo "   Frontend: N/A"
    du -sh docs/ 2>/dev/null | sed 's/^/   Docs: /' || echo "   Docs: N/A"
fi

# Compter les fichiers TypeScript
if command -v find > /dev/null; then
    TS_FILES=$(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)
    echo "📄 Fichiers TypeScript: $TS_FILES"
fi

echo ""
echo "🎯 RÉSULTATS DU NETTOYAGE"
echo "========================"
echo "Fichiers nettoyés: $CLEANED_FILES"
echo "Fichiers organisés: $ORGANIZED_FILES" 
echo "Erreurs détectées: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo ""
    echo "🎉 NETTOYAGE RÉUSSI !"
    echo "✅ Projet bien organisé et structure propre"
    echo "✅ Tous les fichiers critiques présents"
    echo "✅ Modules correctement structurés"
    echo ""
    echo "📁 Structure organisée:"
    echo "   🛡️  Validation Zod complète"
    echo "   🎨 Composants UI modulaires" 
    echo "   🛒 Système de panier intégré"
    echo "   🧪 Outils de développement"
    echo "   📚 Documentation complète"
else
    echo ""
    echo "⚠️  NETTOYAGE PARTIEL"
    echo "Certains problèmes détectés (voir ci-dessus)"
    echo "Nombre d'erreurs: $ERRORS"
fi

echo ""
echo "🚀 Prêt pour les prochaines étapes de développement !"

exit $ERRORS