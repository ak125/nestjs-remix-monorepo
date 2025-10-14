#!/bin/bash

# Script d'analyse des contrôleurs utilisateurs backend
# Date: 6 octobre 2025

set -e

echo "🔍 ANALYSE DES CONTRÔLEURS UTILISATEURS BACKEND"
echo "═══════════════════════════════════════════════════════════"
echo ""

BASE_DIR="/workspaces/nestjs-remix-monorepo/backend/src"

# Fonction pour analyser un fichier
analyze_file() {
    local file=$1
    local path="$BASE_DIR/$file"
    
    if [ -f "$path" ]; then
        local lines=$(wc -l < "$path")
        local controller=$(grep -E "@Controller\(" "$path" | head -1 | sed "s/.*@Controller('\(.*\)').*/\1/" || echo "N/A")
        local routes=$(grep -cE "@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(" "$path" || echo "0")
        
        printf "  %-50s %5s lignes  Route: %-30s  Endpoints: %2s\n" \
            "$(basename $file)" "$lines" "$controller" "$routes"
    fi
}

echo "📊 CONTRÔLEURS UTILISATEURS (modules/users/)"
echo "───────────────────────────────────────────────────────────"
analyze_file "modules/users/users.controller.ts"
analyze_file "modules/users/users-consolidated.controller.ts"
analyze_file "modules/users/users-final.controller.ts"
echo ""

echo "📊 CONTRÔLEURS UTILISATEURS (modules/users/controllers/)"
echo "───────────────────────────────────────────────────────────"
analyze_file "modules/users/controllers/addresses.controller.ts"
analyze_file "modules/users/controllers/password.controller.ts"
analyze_file "modules/users/controllers/user-shipment.controller.ts"
echo ""

echo "📊 CONTRÔLEURS LEGACY (controllers/)"
echo "───────────────────────────────────────────────────────────"
analyze_file "controllers/users.controller.ts"
analyze_file "controllers/users-clean.controller.ts"
echo ""

echo "📊 CONTRÔLEURS AUTH/PROFILE"
echo "───────────────────────────────────────────────────────────"
analyze_file "auth/profile.controller.ts"
echo ""

echo "📊 CONTRÔLEURS CUSTOMERS"
echo "───────────────────────────────────────────────────────────"
analyze_file "customers/customers.controller.ts"
echo ""

echo "📊 CONTRÔLEURS ADMIN"
echo "───────────────────────────────────────────────────────────"
analyze_file "modules/admin/controllers/user-management.controller.ts"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🎯 ANALYSE DES ROUTES"
echo "───────────────────────────────────────────────────────────"
echo ""

grep -h "@Controller" \
    "$BASE_DIR/modules/users/"*.controller.ts \
    "$BASE_DIR/modules/users/controllers/"*.controller.ts \
    "$BASE_DIR/controllers/users"*.controller.ts \
    "$BASE_DIR/auth/profile.controller.ts" \
    "$BASE_DIR/customers/customers.controller.ts" \
    "$BASE_DIR/modules/admin/controllers/user-management.controller.ts" \
    2>/dev/null | \
    sed "s/@Controller('\(.*\)')/  🌐 \1/" | sort -u

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 SERVICES UTILISATEURS"
echo "───────────────────────────────────────────────────────────"

for service in \
    "modules/users/users.service.ts" \
    "modules/users/users-consolidated.service.ts" \
    "modules/users/users-final.service.ts"
do
    if [ -f "$BASE_DIR/$service" ]; then
        local lines=$(wc -l < "$BASE_DIR/$service")
        local methods=$(grep -cE "^\s*(async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(" "$BASE_DIR/$service" || echo "0")
        printf "  %-45s %5s lignes  ~%3s méthodes\n" \
            "$(basename $service)" "$lines" "$methods"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 RECOMMANDATIONS"
echo "───────────────────────────────────────────────────────────"
echo ""
echo "  ✅ GARDER (Version finale consolidée):"
echo "     • users-final.controller.ts → /api/users"
echo "     • users-final.service.ts"
echo "     • addresses.controller.ts → /api/users/addresses"
echo "     • password.controller.ts → /api/users/password"
echo "     • user-management.controller.ts → /api/admin/users"
echo ""
echo "  ❌ SUPPRIMER (Doublons/Legacy):"
echo "     • users.controller.ts (modules/users/) - doublon"
echo "     • users-consolidated.controller.ts - version intermédiaire"
echo "     • users.controller.ts (controllers/) - legacy"
echo "     • users-clean.controller.ts - legacy"
echo ""
echo "  🔄 MIGRER:"
echo "     • user-shipment.controller.ts → intégrer dans users-final"
echo "     • profile.controller.ts → intégrer dans users-final"
echo "     • customers.controller.ts → clarifier séparation customers/users"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
