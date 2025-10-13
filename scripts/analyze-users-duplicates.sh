#!/bin/bash

# 🔍 Script d'Analyse des Doublons - Module Users
# Génère un rapport détaillé des fichiers en doublon

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🔍 ANALYSE DES DOUBLONS - MODULE USERS                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

BACKEND_DIR="/workspaces/nestjs-remix-monorepo/backend"
FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# BACKEND - CONTRÔLEURS
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📁 BACKEND - CONTRÔLEURS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONTROLLERS=(
  "src/controllers/users.controller.ts"
  "src/controllers/users-clean.controller.ts"
  "src/modules/users/users.controller.ts"
  "src/modules/users/users-consolidated.controller.ts"
)

for file in "${CONTROLLERS[@]}"; do
  full_path="$BACKEND_DIR/$file"
  if [ -f "$full_path" ]; then
    lines=$(wc -l < "$full_path")
    size=$(du -h "$full_path" | cut -f1)
    
    if [ $lines -eq 0 ]; then
      echo -e "${RED}❌ VIDE${NC}    $file"
      echo "         └─ $size, $lines lignes"
    elif [[ "$file" == *"consolidated"* ]]; then
      echo -e "${GREEN}✅ KEEPER${NC}  $file"
      echo "         └─ $size, $lines lignes"
    elif [[ "$file" == *"legacy"* ]] || [[ "$file" == "src/controllers/"* ]]; then
      echo -e "${YELLOW}⚠️  LEGACY${NC}  $file"
      echo "         └─ $size, $lines lignes"
    else
      echo -e "${YELLOW}⚠️  DOUBLON${NC} $file"
      echo "         └─ $size, $lines lignes"
    fi
  else
    echo -e "${RED}❌ MANQUANT${NC} $file"
  fi
  echo ""
done

# ============================================================================
# BACKEND - SERVICES
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📁 BACKEND - SERVICES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SERVICES=(
  "src/database/services/user.service.ts"
  "src/database/services/user-data.service.ts"
  "src/modules/users/users.service.ts"
  "src/modules/users/users-consolidated.service.ts"
  "src/modules/users/services/user-data-consolidated.service.ts"
)

for file in "${SERVICES[@]}"; do
  full_path="$BACKEND_DIR/$file"
  if [ -f "$full_path" ]; then
    lines=$(wc -l < "$full_path")
    size=$(du -h "$full_path" | cut -f1)
    
    if [[ "$file" == *"consolidated"* ]]; then
      echo -e "${GREEN}✅ KEEPER${NC}  $file"
      echo "         └─ $size, $lines lignes"
    elif [[ "$file" == "src/database/"* ]]; then
      echo -e "${YELLOW}⚠️  LEGACY${NC}  $file"
      echo "         └─ $size, $lines lignes"
    else
      echo -e "${YELLOW}⚠️  DOUBLON${NC} $file"
      echo "         └─ $size, $lines lignes"
    fi
  else
    echo -e "${RED}❌ MANQUANT${NC} $file"
  fi
  echo ""
done

# ============================================================================
# FRONTEND - ROUTES
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📁 FRONTEND - ROUTES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ROUTES=(
  "app/routes/admin.users.tsx"
  "app/routes/admin.users-v2.tsx"
  "app/routes/admin.users.\$id.tsx"
  "app/routes/admin.users.\$id.edit.tsx"
)

for file in "${ROUTES[@]}"; do
  full_path="$FRONTEND_DIR/$file"
  if [ -f "$full_path" ]; then
    lines=$(wc -l < "$full_path")
    size=$(du -h "$full_path" | cut -f1)
    
    if [[ "$file" == *"-v2"* ]]; then
      echo -e "${RED}❌ DOUBLON${NC} $file"
      echo "         └─ $size, $lines lignes"
    else
      echo -e "${GREEN}✅ KEEPER${NC}  $file"
      echo "         └─ $size, $lines lignes"
    fi
  else
    echo -e "${RED}❌ MANQUANT${NC} $file"
  fi
  echo ""
done

# ============================================================================
# STATISTIQUES
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 STATISTIQUES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_files=0
keeper_files=0
duplicate_files=0
empty_files=0
total_lines=0
duplicate_lines=0

for file in "${CONTROLLERS[@]}" "${SERVICES[@]}" "${ROUTES[@]}"; do
  if [[ "$file" == src/* ]]; then
    full_path="$BACKEND_DIR/$file"
  else
    full_path="$FRONTEND_DIR/$file"
  fi
  
  if [ -f "$full_path" ]; then
    ((total_files++))
    lines=$(wc -l < "$full_path")
    total_lines=$((total_lines + lines))
    
    if [ $lines -eq 0 ]; then
      ((empty_files++))
    elif [[ "$file" == *"consolidated"* ]] || ([[ "$file" == "app/routes/admin.users"* ]] && [[ "$file" != *"-v2"* ]]); then
      ((keeper_files++))
    else
      ((duplicate_files++))
      duplicate_lines=$((duplicate_lines + lines))
    fi
  fi
done

echo "📁 Fichiers totaux:        $total_files"
echo -e "${GREEN}✅ À conserver:            $keeper_files${NC}"
echo -e "${YELLOW}⚠️  En doublon:            $duplicate_files${NC}"
echo -e "${RED}❌ Vides:                  $empty_files${NC}"
echo ""
echo "📄 Lignes totales:         $total_lines"
echo -e "${RED}🗑️  Lignes dupliquées:     $duplicate_lines${NC}"
echo -e "${GREEN}💾 Économie potentielle:   $duplicate_lines lignes${NC}"
echo ""

# ============================================================================
# RECOMMANDATIONS
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🎯 RECOMMANDATIONS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${GREEN}✅ FICHIERS À CONSERVER:${NC}"
echo "   • backend/src/modules/users/users-consolidated.controller.ts"
echo "   • backend/src/modules/users/users-consolidated.service.ts"
echo "   • backend/src/modules/users/services/user-data-consolidated.service.ts"
echo "   • backend/src/modules/users/dto/user.dto.ts"
echo "   • frontend/app/routes/admin.users.tsx"
echo "   • frontend/app/routes/admin.users.\$id.tsx"
echo "   • frontend/app/routes/admin.users.\$id.edit.tsx"
echo ""

echo -e "${RED}❌ FICHIERS À SUPPRIMER:${NC}"
echo "   • backend/src/controllers/users.controller.ts"
echo "   • backend/src/controllers/users-clean.controller.ts"
echo "   • backend/src/database/services/user.service.ts"
echo "   • backend/src/database/services/user-data.service.ts"
echo "   • backend/src/modules/users/users.controller.ts"
echo "   • backend/src/modules/users/users.service.ts"
echo "   • frontend/app/routes/admin.users-v2.tsx"
echo ""

echo -e "${YELLOW}⚠️  ACTIONS REQUISES:${NC}"
echo "   1. Créer users-final.controller.ts en fusionnant les meilleurs morceaux"
echo "   2. Créer users-final.service.ts avec cache Redis intégré"
echo "   3. Mettre à jour users.module.ts pour utiliser les nouveaux fichiers"
echo "   4. Tester tous les endpoints"
echo "   5. Supprimer progressivement les anciens fichiers"
echo "   6. Mettre à jour la documentation"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Analyse terminée !${NC}"
echo ""
echo "Pour plus de détails, consultez:"
echo "  📄 docs/GUIDE-CONSOLIDATION-USERS.md"
echo "  📄 CONSOLIDATION-USERS-PLAN.md"
echo ""
