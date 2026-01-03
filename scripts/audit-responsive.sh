#!/bin/bash
# =============================================================================
# AUDIT RESPONSIVE - Mobile-First E-commerce
# =============================================================================
# Détecte automatiquement les problèmes responsive sans vérifier page par page
# Usage: ./scripts/audit-responsive.sh [--fix]
# =============================================================================

set -e

FRONTEND_DIR="frontend/app"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       📱 AUDIT RESPONSIVE - Mobile-First E-commerce       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Fichiers sans classes responsive
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📱 Fichiers SANS classes responsive (sm:|md:|lg:|xl:)${NC}"
echo -e "${YELLOW}   Ces fichiers peuvent avoir des problèmes mobile${NC}"
echo ""

FILES_WITHOUT_RESPONSIVE=$(find "$FRONTEND_DIR" -name "*.tsx" -type f \
  ! -path "*/node_modules/*" \
  ! -name "*.test.tsx" \
  ! -name "*.spec.tsx" \
  -exec grep -L "sm:\|md:\|lg:\|xl:" {} \; 2>/dev/null | head -20)

if [ -n "$FILES_WITHOUT_RESPONSIVE" ]; then
  echo "$FILES_WITHOUT_RESPONSIVE" | while read -r file; do
    echo -e "   ${RED}⚠${NC}  $file"
  done
  COUNT_NO_RESPONSIVE=$(echo "$FILES_WITHOUT_RESPONSIVE" | wc -l | tr -d ' ')
  echo ""
  echo -e "   ${RED}Total: $COUNT_NO_RESPONSIVE fichiers sans responsive${NC}"
else
  echo -e "   ${GREEN}✓ Tous les fichiers ont des classes responsive${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 2. Touch targets insuffisants
# -----------------------------------------------------------------------------
echo -e "${YELLOW}👆 Boutons potentiellement trop petits pour touch (<44px)${NC}"
echo -e "${YELLOW}   Recommandation: min-h-[44px] ou touch-target${NC}"
echo ""

SMALL_BUTTONS=$(grep -rn "className.*<Button\|<button" "$FRONTEND_DIR" --include="*.tsx" 2>/dev/null \
  | grep -v "min-h-\[44\|min-h-\[48\|touch-target\|h-10\|h-11\|h-12\|size=\"lg\"" \
  | head -10)

if [ -n "$SMALL_BUTTONS" ]; then
  echo "$SMALL_BUTTONS" | while read -r line; do
    FILE=$(echo "$line" | cut -d':' -f1)
    LINE_NUM=$(echo "$line" | cut -d':' -f2)
    echo -e "   ${YELLOW}⚠${NC}  $FILE:$LINE_NUM"
  done
else
  echo -e "   ${GREEN}✓ Tous les boutons ont une taille touch adéquate${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Inputs sans text-base (zoom iOS)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}🔍 Inputs risquant le zoom iOS (font-size < 16px)${NC}"
echo -e "${YELLOW}   Recommandation: text-base ou no-zoom-input${NC}"
echo ""

ZOOM_INPUTS=$(grep -rn "<input\|<Input\|<textarea\|<Textarea" "$FRONTEND_DIR" --include="*.tsx" 2>/dev/null \
  | grep -v "text-base\|text-lg\|no-zoom-input\|type=\"hidden\"\|type=\"checkbox\"\|type=\"radio\"" \
  | head -10)

if [ -n "$ZOOM_INPUTS" ]; then
  echo "$ZOOM_INPUTS" | while read -r line; do
    FILE=$(echo "$line" | cut -d':' -f1)
    LINE_NUM=$(echo "$line" | cut -d':' -f2)
    echo -e "   ${YELLOW}⚠${NC}  $FILE:$LINE_NUM"
  done
else
  echo -e "   ${GREEN}✓ Tous les inputs ont une taille de police adéquate${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 4. Tables sans responsive
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📊 Tables sans gestion mobile${NC}"
echo -e "${YELLOW}   Recommandation: ResponsiveTable ou overflow-x-auto${NC}"
echo ""

NON_RESPONSIVE_TABLES=$(grep -rn "<table" "$FRONTEND_DIR" --include="*.tsx" 2>/dev/null \
  | grep -v "overflow-x-auto\|ResponsiveTable\|hidden\|mobile" \
  | head -10)

if [ -n "$NON_RESPONSIVE_TABLES" ]; then
  echo "$NON_RESPONSIVE_TABLES" | while read -r line; do
    FILE=$(echo "$line" | cut -d':' -f1)
    LINE_NUM=$(echo "$line" | cut -d':' -f2)
    echo -e "   ${YELLOW}⚠${NC}  $FILE:$LINE_NUM"
  done
else
  echo -e "   ${GREEN}✓ Toutes les tables sont responsive${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 5. Grids sans colonnes mobile
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📐 Grids potentiellement cassées sur mobile${NC}"
echo -e "${YELLOW}   Pattern attendu: grid-cols-1 sm:grid-cols-2 ...${NC}"
echo ""

BAD_GRIDS=$(grep -rn "grid-cols-[2-6]" "$FRONTEND_DIR" --include="*.tsx" 2>/dev/null \
  | grep -v "grid-cols-1\|sm:grid-cols\|md:grid-cols" \
  | head -10)

if [ -n "$BAD_GRIDS" ]; then
  echo "$BAD_GRIDS" | while read -r line; do
    FILE=$(echo "$line" | cut -d':' -f1)
    LINE_NUM=$(echo "$line" | cut -d':' -f2)
    echo -e "   ${YELLOW}⚠${NC}  $FILE:$LINE_NUM"
  done
else
  echo -e "   ${GREEN}✓ Toutes les grilles sont mobile-first${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 6. Statistiques globales
# -----------------------------------------------------------------------------
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                      📊 STATISTIQUES                       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL_TSX=$(find "$FRONTEND_DIR" -name "*.tsx" -type f ! -path "*/node_modules/*" | wc -l | tr -d ' ')
WITH_RESPONSIVE=$(grep -rl "sm:\|md:\|lg:\|xl:" "$FRONTEND_DIR" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
WITHOUT_RESPONSIVE=$((TOTAL_TSX - WITH_RESPONSIVE))
PERCENTAGE=$((WITH_RESPONSIVE * 100 / TOTAL_TSX))

echo -e "   📁 Total fichiers TSX:        ${BLUE}$TOTAL_TSX${NC}"
echo -e "   ✓  Avec classes responsive:   ${GREEN}$WITH_RESPONSIVE${NC}"
echo -e "   ⚠  Sans classes responsive:   ${YELLOW}$WITHOUT_RESPONSIVE${NC}"
echo -e "   📈 Couverture responsive:     ${GREEN}${PERCENTAGE}%${NC}"
echo ""

# Nouveaux composants disponibles
echo -e "${BLUE}🆕 Composants Mobile-First disponibles:${NC}"
echo -e "   • Container, Section       - Wrapper responsive"
echo -e "   • Stack, HStack, VStack    - Flexbox simplifié"
echo -e "   • ResponsiveGrid           - Grille e-commerce"
echo -e "   • MobileBottomBar          - CTA sticky mobile"
echo -e "   • ResponsiveTable          - Table → Cards"
echo -e "   • FilterDrawer             - Bottom sheet filtres"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    ✓ Audit terminé                        ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
