#!/bin/bash

# 🧹 Script de Nettoyage des Fichiers Users en Doublon
# ATTENTION: Ce script SUPPRIME définitivement des fichiers !
# Faire un backup avant d'exécuter

set -e  # Arrêter en cas d'erreur

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🧹 NETTOYAGE DES DOUBLONS - MODULE USERS                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="/workspaces/nestjs-remix-monorepo"

# ============================================================================
# VÉRIFICATIONS PRÉALABLES
# ============================================================================

echo -e "${YELLOW}⚠️  ATTENTION: Ce script va SUPPRIMER des fichiers !${NC}"
echo ""
echo "Fichiers qui seront supprimés:"
echo "  • backend/src/controllers/users.controller.ts"
echo "  • backend/src/controllers/users-clean.controller.ts"
echo "  • backend/src/database/services/user.service.ts"
echo "  • backend/src/database/services/user-data.service.ts"
echo "  • backend/src/modules/users/users.controller.ts"
echo "  • backend/src/modules/users/users.service.ts"
echo "  • frontend/app/routes/admin.users-v2.tsx"
echo ""

# Mode dry-run par défaut
DRY_RUN=true

if [ "$1" == "--execute" ]; then
  DRY_RUN=false
  echo -e "${RED}MODE EXÉCUTION ACTIVÉ - Les fichiers seront RÉELLEMENT supprimés !${NC}"
  echo ""
  read -p "Êtes-vous sûr de vouloir continuer ? (tapez 'OUI' pour confirmer): " confirm
  if [ "$confirm" != "OUI" ]; then
    echo -e "${YELLOW}Opération annulée.${NC}"
    exit 0
  fi
else
  echo -e "${GREEN}MODE DRY-RUN - Aucun fichier ne sera supprimé (utilisez --execute pour vraiment supprimer)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# FONCTION DE SUPPRESSION
# ============================================================================

delete_file() {
  local file=$1
  local full_path="$PROJECT_ROOT/$file"
  
  if [ -f "$full_path" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo -e "${BLUE}[DRY-RUN]${NC} Serait supprimé: $file"
    else
      echo -e "${RED}[DELETE]${NC} Suppression de: $file"
      rm "$full_path"
    fi
  else
    echo -e "${YELLOW}[SKIP]${NC} Fichier introuvable: $file"
  fi
}

# ============================================================================
# FONCTION DE BACKUP
# ============================================================================

create_backup() {
  if [ "$DRY_RUN" = false ]; then
    BACKUP_DIR="$PROJECT_ROOT/_backup_users_$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}📦 Création d'un backup dans: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
    
    # Backup des fichiers à supprimer
    for file in "${FILES_TO_DELETE[@]}"; do
      full_path="$PROJECT_ROOT/$file"
      if [ -f "$full_path" ]; then
        dir=$(dirname "$file")
        mkdir -p "$BACKUP_DIR/$dir"
        cp "$full_path" "$BACKUP_DIR/$file"
      fi
    done
    
    echo -e "${GREEN}✅ Backup créé avec succès${NC}"
    echo ""
  fi
}

# ============================================================================
# LISTE DES FICHIERS À SUPPRIMER
# ============================================================================

FILES_TO_DELETE=(
  "backend/src/controllers/users.controller.ts"
  "backend/src/controllers/users-clean.controller.ts"
  "backend/src/database/services/user.service.ts"
  "backend/src/database/services/user-data.service.ts"
  "backend/src/modules/users/users.controller.ts"
  "backend/src/modules/users/users.service.ts"
  "frontend/app/routes/admin.users-v2.tsx"
)

# ============================================================================
# SUPPRESSION DES FICHIERS
# ============================================================================

echo -e "${BLUE}🗑️  Suppression des fichiers en doublon...${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
  create_backup
fi

for file in "${FILES_TO_DELETE[@]}"; do
  delete_file "$file"
done

echo ""

# ============================================================================
# VÉRIFICATION DES FICHIERS CONSERVÉS
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}✅ Vérification des fichiers conservés...${NC}"
echo ""

FILES_TO_KEEP=(
  "backend/src/modules/users/users-consolidated.controller.ts"
  "backend/src/modules/users/users-consolidated.service.ts"
  "backend/src/modules/users/services/user-data-consolidated.service.ts"
  "backend/src/modules/users/dto/user.dto.ts"
  "frontend/app/routes/admin.users.tsx"
  "frontend/app/routes/admin.users.\$id.tsx"
  "frontend/app/routes/admin.users.\$id.edit.tsx"
)

all_present=true

for file in "${FILES_TO_KEEP[@]}"; do
  full_path="$PROJECT_ROOT/$file"
  if [ -f "$full_path" ]; then
    echo -e "${GREEN}[OK]${NC} $file"
  else
    echo -e "${RED}[MANQUANT]${NC} $file"
    all_present=false
  fi
done

echo ""

# ============================================================================
# STATISTIQUES FINALES
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 STATISTIQUES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Mode Dry-Run - Aucun fichier n'a été supprimé${NC}"
  echo ""
  echo "Pour VRAIMENT supprimer les fichiers, exécutez:"
  echo "  ./scripts/cleanup-users-duplicates.sh --execute"
else
  echo -e "${GREEN}✅ Fichiers supprimés: ${#FILES_TO_DELETE[@]}${NC}"
  echo -e "${GREEN}✅ Fichiers conservés: ${#FILES_TO_KEEP[@]}${NC}"
  
  if [ "$all_present" = true ]; then
    echo -e "${GREEN}✅ Tous les fichiers importants sont présents${NC}"
  else
    echo -e "${RED}⚠️  ATTENTION: Certains fichiers importants sont manquants !${NC}"
  fi
  
  echo ""
  echo -e "${GREEN}💾 Backup disponible dans: $BACKUP_DIR${NC}"
fi

echo ""

# ============================================================================
# PROCHAINES ÉTAPES
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🎯 PROCHAINES ÉTAPES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo "1. ✅ Vérifier que tout compile:"
  echo "   cd backend && npm run build"
  echo ""
  echo "2. ✅ Lancer les tests:"
  echo "   npm run test:e2e"
  echo ""
  echo "3. ✅ Mettre à jour les imports si nécessaire"
  echo ""
  echo "4. ✅ Tester manuellement l'interface admin users"
  echo ""
  echo "5. ✅ Commit et push:"
  echo "   git add ."
  echo "   git commit -m 'Consolidation module users - suppression doublons'"
  echo "   git push origin consolidation-dashboard"
  echo ""
  echo "6. 🗑️  Si tout fonctionne, vous pouvez supprimer le backup dans 1 semaine:"
  echo "   rm -rf $BACKUP_DIR"
else
  echo "1. Vérifier le rapport d'analyse:"
  echo "   cat RAPPORT-ANALYSE-USERS.md"
  echo ""
  echo "2. Lire le guide de consolidation:"
  echo "   cat docs/GUIDE-CONSOLIDATION-USERS.md"
  echo ""
  echo "3. Si prêt, exécuter pour de vrai:"
  echo "   ./scripts/cleanup-users-duplicates.sh --execute"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${GREEN}✅ Analyse terminée (dry-run)${NC}"
else
  echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
fi

echo ""
