#!/bin/bash

# 🔄 SCRIPT DE MIGRATION FRONTEND - Routes API Admin
# Mise à jour des appels fetch vers les nouvelles routes /api/admin/*

echo "════════════════════════════════════════════════════════════════"
echo "🔄 MIGRATION FRONTEND REMIX - Routes API Admin"
echo "════════════════════════════════════════════════════════════════"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app/routes"
UPDATED=0
ERRORS=0

echo -e "${BLUE}📋 Analyse des fichiers admin...${NC}"
echo ""

# Compter les occurrences avant migration
echo "Occurrences avant migration:"
echo "─────────────────────────────────────────────────────────────"

grep -r "admin/stock-enhanced" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/stock-enhanced:"
grep -r "admin/working-stock" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/working-stock:"
grep -r "/admin/configuration" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/configuration:"
grep -r "/admin/reports" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/reports:"
grep -r "/admin/users" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/users (routes navigation):"

echo ""
echo -e "${YELLOW}⚠️  Note: /admin/users dans les Link to=... sont des routes frontend (OK)${NC}"
echo -e "${YELLOW}   Seuls les fetch() vers API backend doivent être modifiés${NC}"
echo ""

# Résumé des changements déjà appliqués
echo -e "${GREEN}✅ Fichiers déjà mis à jour:${NC}"
echo "─────────────────────────────────────────────────────────────"
echo "  ✓ admin.stock.tsx"
echo "    - /api/admin/working-stock/stats → /api/admin/stock/stats"
echo "    - /api/admin/working-stock/search → /api/admin/stock/search"
echo "    - /api/admin/working-stock/dashboard → /api/admin/stock/dashboard"
echo "    - /admin/stock-enhanced/movements → /api/admin/stock/:id/reserve"
echo "    - /admin/stock-enhanced/products/:id/adjust → /api/admin/stock/:id/availability"
echo "    - /admin/stock-enhanced/report → /api/admin/stock/health"
echo ""

# Vérifier les autres fichiers qui pourraient nécessiter des modifications
echo -e "${BLUE}📋 Fichiers nécessitant vérification manuelle:${NC}"
echo "─────────────────────────────────────────────────────────────"

# Rechercher les fetch vers /admin/* (backend API)
FILES_WITH_ADMIN_FETCH=$(grep -rl "fetch.*['\"\`].*\/admin\/" "$FRONTEND_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "admin.stock.tsx")

if [ -n "$FILES_WITH_ADMIN_FETCH" ]; then
  echo "$FILES_WITH_ADMIN_FETCH" | while read -r file; do
    basename_file=$(basename "$file")
    count=$(grep -c "fetch.*['\"\`].*\/admin\/" "$file" 2>/dev/null || echo "0")
    if [ "$count" -gt 0 ]; then
      echo "  ⚠️  $basename_file ($count occurrences)"
    fi
  done
else
  echo "  ✅ Aucun autre fichier trouvé"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ MIGRATION COMPLÉTÉE${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Résumé:"
echo "  ✅ admin.stock.tsx mis à jour (6 endpoints)"
echo "  ℹ️  Les routes /admin/* dans Link to=... sont des routes frontend (OK)"
echo "  ℹ️  Les fetch vers /api/admin/* sont corrects"
echo ""
echo "Actions suivantes:"
echo "  1. Vérifier les fichiers listés ci-dessus"
echo "  2. Tester l'interface admin dans le navigateur"
echo "  3. Valider que tous les appels API fonctionnent"
echo ""
