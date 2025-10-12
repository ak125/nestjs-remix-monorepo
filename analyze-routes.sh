#!/bin/bash

# Script d'analyse des routes dupliquées
# Date: 6 octobre 2025

ROUTES_DIR="/workspaces/nestjs-remix-monorepo/frontend/app/routes"

echo "📊 ANALYSE DES ROUTES DUPLIQUÉES"
echo "═══════════════════════════════════════════════════════"
echo ""

# Fonction pour afficher les infos d'un fichier
analyze_file() {
    local file=$1
    local lines=$(wc -l < "$ROUTES_DIR/$file" 2>/dev/null || echo "0")
    local exports=$(grep -c "export default" "$ROUTES_DIR/$file" 2>/dev/null || echo "0")
    local loaders=$(grep -c "export.*loader" "$ROUTES_DIR/$file" 2>/dev/null || echo "0")
    
    printf "%-40s | %5s lignes | Loader: %s | Export: %s\n" "$file" "$lines" "$loaders" "$exports"
}

echo "🔍 DASHBOARDS (5 fichiers)"
echo "───────────────────────────────────────────────────────"
analyze_file "account.dashboard.tsx"
analyze_file "account.dashboard.authenticated.tsx"
analyze_file "account.dashboard.enhanced.tsx"
analyze_file "account.dashboard.unified.tsx"
analyze_file "admin.dashboard.tsx"
echo ""

echo "🔍 PROFILES (5 fichiers)"
echo "───────────────────────────────────────────────────────"
analyze_file "profile.tsx"
analyze_file "profile._index.tsx"
analyze_file "account.profile.tsx"
analyze_file "profile-debug.tsx"
analyze_file "profile-super-debug.tsx"
echo ""

echo "🔍 AUTRES DOUBLONS POTENTIELS"
echo "───────────────────────────────────────────────────────"
analyze_file "account.tsx"
analyze_file "optimization-dashboard.tsx"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "✅ Analyse terminée"
echo ""
echo "📋 RECOMMANDATIONS:"
echo ""
echo "Dashboards - GARDER:"
echo "  ✅ account.dashboard.tsx (le plus complet)"
echo ""
echo "Dashboards - SUPPRIMER:"
echo "  ❌ account.dashboard.authenticated.tsx (obsolète)"
echo "  ❌ account.dashboard.enhanced.tsx (obsolète)"
echo "  ❌ account.dashboard.unified.tsx (obsolète)"
echo ""
echo "Profiles - GARDER:"
echo "  ✅ account.profile.tsx (dans la structure account/)"
echo ""
echo "Profiles - SUPPRIMER:"
echo "  ❌ profile.tsx (doublon, hors structure)"
echo "  ❌ profile._index.tsx (doublon)"
echo "  ❌ profile-debug.tsx (debug uniquement)"
echo "  ❌ profile-super-debug.tsx (debug uniquement)"
echo ""
echo "Autres - SUPPRIMER:"
echo "  ❌ optimization-dashboard.tsx (test/debug)"
echo ""
