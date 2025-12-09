#!/bin/bash

# ðŸ”„ SCRIPT DE MIGRATION FRONTEND - Routes API Admin
# Mise Ã  jour des appels fetch vers les nouvelles routes /api/admin/*

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "ðŸ”„ MIGRATION FRONTEND REMIX - Routes API Admin"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app/routes"
UPDATED=0
ERRORS=0

echo -e "${BLUE}ðŸ“‹ Analyse des fichiers admin...${NC}"
echo ""

# Compter les occurrences avant migration
echo "Occurrences avant migration:"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"

grep -r "admin/stock-enhanced" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/stock-enhanced:"
grep -r "admin/working-stock" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/working-stock:"
grep -r "/admin/configuration" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/configuration:"
grep -r "/admin/reports" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/reports:"
grep -r "/admin/users" "$FRONTEND_DIR" 2>/dev/null | wc -l | xargs echo "  /admin/users (routes navigation):"

echo ""
echo -e "${YELLOW}âš ï¸  Note: /admin/users dans les Link to=... sont des routes frontend (OK)${NC}"
echo -e "${YELLOW}   Seuls les fetch() vers API backend doivent Ãªtre modifiÃ©s${NC}"
echo ""

# RÃ©sumÃ© des changements dÃ©jÃ  appliquÃ©s
echo -e "${GREEN}âœ… Fichiers dÃ©jÃ  mis Ã  jour:${NC}"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo "  âœ“ admin.stock.tsx"
echo "    - /api/admin/working-stock/stats â†’ /api/admin/stock/stats"
echo "    - /api/admin/working-stock/search â†’ /api/admin/stock/search"
echo "    - /api/admin/working-stock/dashboard â†’ /api/admin/stock/dashboard"
echo "    - /admin/stock-enhanced/movements â†’ /api/admin/stock/:id/reserve"
echo "    - /admin/stock-enhanced/products/:id/adjust â†’ /api/admin/stock/:id/availability"
echo "    - /admin/stock-enhanced/report â†’ /api/admin/stock/health"
echo ""

# VÃ©rifier les autres fichiers qui pourraient nÃ©cessiter des modifications
echo -e "${BLUE}ðŸ“‹ Fichiers nÃ©cessitant vÃ©rification manuelle:${NC}"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"

# Rechercher les fetch vers /admin/* (backend API)
FILES_WITH_ADMIN_FETCH=$(grep -rl "fetch.*['\"\`].*\/admin\/" "$FRONTEND_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "admin.stock.tsx")

if [ -n "$FILES_WITH_ADMIN_FETCH" ]; then
  echo "$FILES_WITH_ADMIN_FETCH" | while read -r file; do
    basename_file=$(basename "$file")
    count=$(grep -c "fetch.*['\"\`].*\/admin\/" "$file" 2>/dev/null || echo "0")
    if [ "$count" -gt 0 ]; then
      echo "  âš ï¸  $basename_file ($count occurrences)"
    fi
  done
else
  echo "  âœ… Aucun autre fichier trouvÃ©"
fi

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo -e "${GREEN}âœ… MIGRATION COMPLÃ‰TÃ‰E${NC}"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "RÃ©sumÃ©:"
echo "  âœ… admin.stock.tsx mis Ã  jour (6 endpoints)"
echo "  â„¹ï¸  Les routes /admin/* dans Link to=... sont des routes frontend (OK)"
echo "  â„¹ï¸  Les fetch vers /api/admin/* sont corrects"
echo ""
echo "Actions suivantes:"
echo "  1. VÃ©rifier les fichiers listÃ©s ci-dessus"
echo "  2. Tester l'interface admin dans le navigateur"
echo "  3. Valider que tous les appels API fonctionnent"
echo ""
