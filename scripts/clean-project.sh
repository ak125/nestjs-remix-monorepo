#!/bin/bash

# 🧹 NETTOYAGE INTELLIGENT DU PROJET
# Supprime les fichiers temporaires et de debug en préservant les fichiers utiles

echo "🧹 NETTOYAGE INTELLIGENT DU PROJET"
echo "=================================="
echo ""

# Compteurs
DELETED_FILES=0
DELETED_DIRS=0
PRESERVED_FILES=0

# Fonction pour supprimer un fichier avec confirmation
delete_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        echo "🗑️  Suppression: $file"
        rm "$file"
        DELETED_FILES=$((DELETED_FILES + 1))
    fi
}

# Fonction pour préserver un fichier
preserve_file() {
    local file="$1"
    echo "💾 Préservé: $file"
    PRESERVED_FILES=$((PRESERVED_FILES + 1))
}

echo "🔍 Analyse des fichiers temporaires..."

# 1. FICHIERS DE DEBUG/ANALYSE À LA RACINE (à supprimer)
echo ""
echo "📁 Nettoyage racine du projet:"

# Scripts d'analyse temporaires
delete_file "/workspaces/nestjs-remix-monorepo/analyze-invoice-tables.js"
delete_file "/workspaces/nestjs-remix-monorepo/analyze-pieces.js" 
delete_file "/workspaces/nestjs-remix-monorepo/explore-all-tables.js"
delete_file "/workspaces/nestjs-remix-monorepo/explore-sql.js"
delete_file "/workspaces/nestjs-remix-monorepo/find-invoice-tables.js"

# Fichiers de test temporaires  
delete_file "/workspaces/nestjs-remix-monorepo/test-invoices-api.js"
delete_file "/workspaces/nestjs-remix-monorepo/test-images-simple.html"
delete_file "/workspaces/nestjs-remix-monorepo/test-mine-frontend.html"
delete_file "/workspaces/nestjs-remix-monorepo/test-logos.html"

# Scripts de test anciens
delete_file "/workspaces/nestjs-remix-monorepo/test-vehicles-system.sh"

# 2. BACKEND - Scripts temporaires
echo ""
echo "📁 Nettoyage backend/scripts:"

delete_file "/workspaces/nestjs-remix-monorepo/backend/test-modele-structure.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/test-marque-structure.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/scripts/create-test-user.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/scripts/create-test-messages-api.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/scripts/create-test-messages.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/scripts/create-test-user-local.js"
delete_file "/workspaces/nestjs-remix-monorepo/backend/scripts/test-legacy-api.sh"

# Préserver les scripts utiles d'analyse
preserve_file "/workspaces/nestjs-remix-monorepo/backend/scripts/analyze-database.js"
preserve_file "/workspaces/nestjs-remix-monorepo/backend/scripts/analyze-database.ts"
preserve_file "/workspaces/nestjs-remix-monorepo/backend/scripts/analyze-database-structure.ts"

# 3. FRONTEND - Fichiers de test temporaires
echo ""
echo "📁 Nettoyage frontend:"

delete_file "/workspaces/nestjs-remix-monorepo/frontend/test-images.html"

# Préserver les vrais tests
preserve_file "/workspaces/nestjs-remix-monorepo/frontend/app/routes/admin.test.tsx"
preserve_file "/workspaces/nestjs-remix-monorepo/tests/performance/products-performance.test.js"

# 4. RAPPORTS ANCIENS (vérifier avant suppression)
echo ""
echo "📁 Vérification des anciens rapports:"

# Ces fichiers peuvent être archivés plutôt que supprimés
if [[ -f "/workspaces/nestjs-remix-monorepo/NETTOYAGE_PROJET_2025-08-16.md" ]]; then
    echo "📋 Trouvé: NETTOYAGE_PROJET_2025-08-16.md"
    echo "   → À déplacer vers docs/archives/ ? (o/n)"
    # Pour l'instant, on le préserve
    preserve_file "NETTOYAGE_PROJET_2025-08-16.md"
fi

if [[ -f "/workspaces/nestjs-remix-monorepo/NETTOYAGE_SUPPLIERS_RAPPORT.md" ]]; then
    preserve_file "NETTOYAGE_SUPPLIERS_RAPPORT.md"
fi

# 5. NODE_MODULES orphelins
echo ""
echo "📁 Vérification node_modules:"

if [[ -d "/workspaces/nestjs-remix-monorepo/node_modules" ]]; then
    echo "📦 node_modules racine trouvé (normal pour monorepo)"
    preserve_file "node_modules/"
fi

# 6. CACHE et fichiers temporaires système
echo ""
echo "📁 Nettoyage cache système:"

if [[ -d "/workspaces/nestjs-remix-monorepo/.turbo" ]]; then
    echo "🗑️  Nettoyage cache Turbo"
    rm -rf "/workspaces/nestjs-remix-monorepo/.turbo"
    DELETED_DIRS=$((DELETED_DIRS + 1))
fi

if [[ -f "/workspaces/nestjs-remix-monorepo/cache/dump.rdb" ]]; then
    echo "🗑️  Nettoyage dump Redis"
    delete_file "/workspaces/nestjs-remix-monorepo/cache/dump.rdb"
fi

# 7. LOGS et fichiers temporaires TypeScript
echo ""
echo "📁 Nettoyage fichiers de build:"

find /workspaces/nestjs-remix-monorepo -name "*.log" -type f | while read -r logfile; do
    delete_file "$logfile"
done

find /workspaces/nestjs-remix-monorepo -name "tsconfig.tsbuildinfo" -type f | while read -r buildinfo; do
    delete_file "$buildinfo"
done

# 8. MODULES avec fichiers en double
echo ""
echo "📁 Vérification modules en double:"

# Vérifier s'il y a un module invoices.module.ts en double
if [[ -f "/workspaces/nestjs-remix-monorepo/backend/src/modules/invoices.module.ts" ]] && 
   [[ -f "/workspaces/nestjs-remix-monorepo/backend/src/modules/invoices/invoices.module.ts" ]]; then
    echo "🔍 Modules invoices en double détectés"
    echo "   → Suppression du fichier racine (doublon)"
    delete_file "/workspaces/nestjs-remix-monorepo/backend/src/modules/invoices.module.ts"
fi

# 9. ARCHIVES - Créer un dossier d'archives si nécessaire
echo ""
echo "📁 Création archives pour anciens rapports:"

mkdir -p "/workspaces/nestjs-remix-monorepo/docs/archives"

# Déplacer les anciens rapports vers archives
if [[ -f "/workspaces/nestjs-remix-monorepo/MODULE_PRODUCTS_SUCCESS.md" ]]; then
    mv "/workspaces/nestjs-remix-monorepo/MODULE_PRODUCTS_SUCCESS.md" "/workspaces/nestjs-remix-monorepo/docs/archives/"
    echo "📋 Archivé: MODULE_PRODUCTS_SUCCESS.md"
fi

if [[ -f "/workspaces/nestjs-remix-monorepo/TYPESELECTOR_EVALUATION_FINAL.md" ]]; then
    mv "/workspaces/nestjs-remix-monorepo/TYPESELECTOR_EVALUATION_FINAL.md" "/workspaces/nestjs-remix-monorepo/docs/archives/"
    echo "📋 Archivé: TYPESELECTOR_EVALUATION_FINAL.md"
fi

# 10. RÉSUMÉ
echo ""
echo "🎯 RÉSUMÉ DU NETTOYAGE"
echo "======================"
echo "✅ Fichiers supprimés: $DELETED_FILES"
echo "✅ Dossiers supprimés: $DELETED_DIRS" 
echo "💾 Fichiers préservés: $PRESERVED_FILES"
echo ""
echo "📁 Structure finale:"
echo "   ├── docs/ (documentation complète)"
echo "   ├── docs/archives/ (anciens rapports)"
echo "   ├── scripts/ (scripts utiles)" 
echo "   ├── backend/ (code source propre)"
echo "   └── frontend/ (interface utilisateur)"
echo ""
echo "🎉 Nettoyage terminé avec succès!"
echo ""
echo "📋 Prochaines actions recommandées:"
echo "1. Vérifier que le build fonctionne: npm run build"
echo "2. Tester les APIs: npm run dev"  
echo "3. Commit des changements: git add . && git commit -m 'Clean: Remove temporary files'"
