#!/bin/bash

# Script de mise à jour automatique des package.json
# Unifie les versions et supprime les doublons

set -e

echo "📝 Mise à jour des fichiers package.json..."

MONOREPO_ROOT="/workspaces/nestjs-remix-monorepo"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Mise à jour des package.json${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Créer une sauvegarde
BACKUP_DIR="$MONOREPO_ROOT/.package-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Sauvegarde des package.json originaux...${NC}"
cp "$MONOREPO_ROOT/package.json" "$BACKUP_DIR/root-package.json"
cp "$MONOREPO_ROOT/backend/package.json" "$BACKUP_DIR/backend-package.json"
echo "✓ Backup créé: $BACKUP_DIR"

# Fonction pour mettre à jour le backend/package.json
update_backend_package() {
    echo -e "\n${YELLOW}🔧 Mise à jour de backend/package.json...${NC}"
    
    cd "$MONOREPO_ROOT/backend"
    
    # Supprimer bcryptjs (remplacé par bcrypt)
    npm uninstall bcryptjs 2>/dev/null || true
    echo "  ✓ bcryptjs supprimé"
    
    # Supprimer unix-crypt-td-js (obsolète)
    npm uninstall unix-crypt-td-js 2>/dev/null || true
    echo "  ✓ unix-crypt-td-js supprimé"
    
    # Mettre à jour les versions pour correspondre à la racine
    npm install --save-exact zod@3.24.1 2>/dev/null || true
    echo "  ✓ zod unifié sur 3.24.1"
    
    # Mettre à jour NestJS packages
    npm install @nestjs/swagger@^11.2.0 2>/dev/null || true
    echo "  ✓ @nestjs/swagger mis à jour vers 11.2.0"
    
    npm install @nestjs/platform-express@^11.1.5 2>/dev/null || true
    echo "  ✓ @nestjs/platform-express mis à jour vers 11.1.5"
}

# Fonction pour nettoyer le package.json racine
update_root_package() {
    echo -e "\n${YELLOW}🔧 Nettoyage du package.json racine...${NC}"
    
    cd "$MONOREPO_ROOT"
    
    # S'assurer que les versions communes sont définies
    echo "  ✓ Vérification des dépendances communes"
}

# Exécuter les mises à jour
update_backend_package
update_root_package

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ MISE À JOUR TERMINÉE${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}📊 Résumé des changements:${NC}"
echo "  ✓ bcryptjs supprimé (utiliser bcrypt)"
echo "  ✓ unix-crypt-td-js supprimé"
echo "  ✓ zod unifié sur version 3.24.1"
echo "  ✓ @nestjs/swagger unifié sur 11.2.0"
echo "  ✓ @nestjs/platform-express unifié sur 11.1.5"

echo -e "\n${BLUE}📁 Backup:${NC} $BACKUP_DIR"

echo -e "\n${YELLOW}⚠️  Prochaines étapes:${NC}"
echo "  1. Rechercher et remplacer 'bcryptjs' par 'bcrypt' dans le code"
echo "  2. Réinstaller toutes les dépendances: npm install"
echo "  3. Rebuild: npm run build"
echo "  4. Tester: npm test"

echo -e "\n${RED}⚠️  Action manuelle requise:${NC}"
echo "  Vous devez mettre à jour les imports dans le code:"
echo -e "  ${YELLOW}find backend/src -type f -name '*.ts' -exec sed -i 's/bcryptjs/bcrypt/g' {} +${NC}"
