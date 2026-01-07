#!/bin/bash
# ============================================
# Lint UI - Vérification des règles layout
# ============================================
# Usage: npm run lint:ui
#
# Vérifie les patterns CSS/Tailwind interdits:
# - w-screen (provoque scroll horizontal)
# - absolute sans parent relative
# - fixed sans z-index
# ============================================

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "  UI Lint - Vérification Layout Rules"
echo "=========================================="
echo ""

# 1. Vérifier w-screen (INTERDIT)
echo "Checking for w-screen..."
if grep -rn "w-screen" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null; then
    echo -e "${RED}ERROR: w-screen trouvé - utiliser w-full${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Pas de w-screen${NC}"
fi
echo ""

# 2. Vérifier vw/vh sans clamp (potentiellement problématique)
echo "Checking for uncontrolled viewport units..."
if grep -rn "\[100vw\]" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null; then
    echo -e "${YELLOW}WARNING: 100vw trouvé - vérifier si overflow-x:hidden est présent${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Pas de 100vw non contrôlé${NC}"
fi
echo ""

# 3. Vérifier les positions absolute orphelines (warning seulement)
echo "Checking for absolute without relative parent context..."
ABSOLUTE_COUNT=$(grep -rn "className.*absolute" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null | wc -l || echo "0")
RELATIVE_COUNT=$(grep -rn "className.*relative" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null | wc -l || echo "0")

if [ "$ABSOLUTE_COUNT" -gt "$RELATIVE_COUNT" ]; then
    echo -e "${YELLOW}WARNING: Plus de 'absolute' ($ABSOLUTE_COUNT) que de 'relative' ($RELATIVE_COUNT)${NC}"
    echo "         Vérifier que chaque absolute a un parent relative"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Ratio absolute/relative OK ($ABSOLUTE_COUNT/$RELATIVE_COUNT)${NC}"
fi
echo ""

# 4. Vérifier fixed sans z-index
echo "Checking for fixed without z-index..."
FIXED_LINES=$(grep -rn "className.*fixed" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null || true)
FIXED_NO_Z=$(echo "$FIXED_LINES" | grep -v "z-" || true)

if [ -n "$FIXED_NO_Z" ] && [ "$FIXED_NO_Z" != "" ]; then
    echo -e "${YELLOW}WARNING: 'fixed' trouvé sans z-index explicite:${NC}"
    echo "$FIXED_NO_Z" | head -5
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Tous les fixed ont un z-index${NC}"
fi
echo ""

# 5. Vérifier les touch targets (min-h-[44px] recommandé pour boutons)
echo "Checking touch target sizes..."
SMALL_BUTTONS=$(grep -rn "className.*h-8\|className.*h-6\|className.*h-7" app/components --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -i "button\|btn" || true)

if [ -n "$SMALL_BUTTONS" ] && [ "$SMALL_BUTTONS" != "" ]; then
    echo -e "${YELLOW}WARNING: Boutons avec h < 44px trouvés (WCAG recommande min-h-[44px]):${NC}"
    echo "$SMALL_BUTTONS" | head -3
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Touch targets OK${NC}"
fi
echo ""

# Résumé
echo "=========================================="
echo "  Résumé"
echo "=========================================="
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}ERRORS: $ERRORS${NC}"
fi
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}WARNINGS: $WARNINGS${NC}"
fi
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Aucun problème détecté${NC}"
fi
echo ""

# Exit avec code erreur si erreurs critiques
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Lint UI échoué - corriger les erreurs avant commit${NC}"
    exit 1
fi

echo -e "${GREEN}Lint UI OK${NC}"
exit 0
