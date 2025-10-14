#!/bin/bash

# Script de vérification pré-suppression
# Vérifie qu'aucun fichier n'importe les contrôleurs à supprimer

set -e

echo "🔍 VÉRIFICATION PRÉ-SUPPRESSION - Contrôleurs Backend"
echo "═══════════════════════════════════════════════════════════"
echo ""

BASE_DIR="/workspaces/nestjs-remix-monorepo/backend/src"

echo "📝 Fichiers à supprimer (Phase 1):"
echo "  1. modules/users/users.controller.ts"
echo "  2. modules/users/users-consolidated.controller.ts"
echo "  3. modules/users/users-consolidated.service.ts"
echo ""

echo "🔍 Recherche d'imports de users.controller.ts (modules/users/)..."
IMPORTS_USERS=$(grep -r "from.*users/users\.controller" "$BASE_DIR" 2>/dev/null | grep -v "node_modules" || echo "")
if [ -z "$IMPORTS_USERS" ]; then
    echo "  ✅ Aucun import trouvé"
else
    echo "  ❌ IMPORTS TROUVÉS:"
    echo "$IMPORTS_USERS"
fi
echo ""

echo "🔍 Recherche d'imports de users-consolidated.controller.ts..."
IMPORTS_CONSOLIDATED=$(grep -r "from.*users-consolidated\.controller" "$BASE_DIR" 2>/dev/null | grep -v "node_modules" || echo "")
if [ -z "$IMPORTS_CONSOLIDATED" ]; then
    echo "  ✅ Aucun import trouvé"
else
    echo "  ❌ IMPORTS TROUVÉS:"
    echo "$IMPORTS_CONSOLIDATED"
fi
echo ""

echo "🔍 Recherche d'imports de users-consolidated.service.ts..."
IMPORTS_SERVICE=$(grep -r "from.*users-consolidated\.service" "$BASE_DIR" 2>/dev/null | grep -v "node_modules" | grep -v "users-consolidated.controller.ts" || echo "")
if [ -z "$IMPORTS_SERVICE" ]; then
    echo "  ✅ Aucun import trouvé (hors auto-référence)"
else
    echo "  ❌ IMPORTS TROUVÉS:"
    echo "$IMPORTS_SERVICE"
fi
echo ""

echo "🔍 Vérification dans users.module.ts..."
MODULE_CHECK=$(grep -E "UsersController[^F]|UsersConsolidatedController|UsersConsolidatedService" "$BASE_DIR/modules/users/users.module.ts" 2>/dev/null || echo "")
if [ -z "$MODULE_CHECK" ]; then
    echo "  ✅ Aucune référence dans users.module.ts"
else
    echo "  ⚠️  RÉFÉRENCES TROUVÉES dans users.module.ts:"
    echo "$MODULE_CHECK"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier si on peut supprimer en toute sécurité
if [ -z "$IMPORTS_USERS" ] && [ -z "$IMPORTS_CONSOLIDATED" ] && [ -z "$IMPORTS_SERVICE" ] && [ -z "$MODULE_CHECK" ]; then
    echo "✅ SÉCURISÉ - Aucune dépendance détectée"
    echo ""
    echo "🎯 Vous pouvez exécuter le nettoyage Phase 1 :"
    echo "   bash cleanup-backend-users-phase1.sh"
    echo ""
else
    echo "⚠️  ATTENTION - Dépendances détectées !"
    echo ""
    echo "❌ NE PAS EXÉCUTER le nettoyage avant résolution"
    echo ""
    exit 1
fi

echo "📊 Statistiques des contrôleurs ACTIFS:"
echo ""
echo "  Enregistrés dans UsersModule:"
grep -A 20 "controllers: \[" "$BASE_DIR/modules/users/users.module.ts" | grep -E "Controller," | sed 's/^/    ✅ /'
echo ""
echo "  Enregistrés dans ApiModule:"
grep -A 10 "controllers: \[" "$BASE_DIR/modules/api.module.ts" | grep -E "Controller," | sed 's/^/    ✅ /'
echo ""

echo "═══════════════════════════════════════════════════════════"
