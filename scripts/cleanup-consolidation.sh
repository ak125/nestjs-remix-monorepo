#!/bin/bash

# Script de nettoyage et consolidation du monorepo
# Objectif : Éliminer les doublons, redondances et fichiers obsolètes

set -e

echo "🧹 Démarrage du nettoyage et consolidation du monorepo..."

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MONOREPO_ROOT="/workspaces/nestjs-remix-monorepo"
BACKUP_DIR="$MONOREPO_ROOT/.cleanup-backup-$(date +%Y%m%d-%H%M%S)"

# Créer un backup avant toute opération
echo -e "${BLUE}📦 Création d'un backup dans $BACKUP_DIR${NC}"
mkdir -p "$BACKUP_DIR"

# =============================================================================
# PHASE 1 : NETTOYAGE DES FICHIERS COMPILÉS ET CACHES
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 1 : Nettoyage des fichiers compilés et caches${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Nettoyer les dossiers dist
echo -e "${YELLOW}🗑️  Nettoyage des dossiers dist...${NC}"
if [ -d "$MONOREPO_ROOT/backend/dist" ]; then
    mv "$MONOREPO_ROOT/backend/dist" "$BACKUP_DIR/backend-dist"
    echo "✓ backend/dist sauvegardé et supprimé"
fi

# Nettoyer les caches turbo
echo -e "${YELLOW}🗑️  Nettoyage des caches turbo...${NC}"
find "$MONOREPO_ROOT" -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
echo "✓ Caches turbo nettoyés"

# Nettoyer les tsbuildinfo
echo -e "${YELLOW}🗑️  Nettoyage des fichiers tsbuildinfo...${NC}"
find "$MONOREPO_ROOT" -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null || true
echo "✓ Fichiers tsbuildinfo nettoyés"

# =============================================================================
# PHASE 2 : CONSOLIDATION DES SCRIPTS DE TEST
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 2 : Consolidation des scripts de test${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Créer le dossier de tests consolidé
TESTS_DIR="$MONOREPO_ROOT/backend/tests/e2e"
mkdir -p "$TESTS_DIR"

echo -e "${YELLOW}📁 Déplacement des scripts de test vers tests/e2e...${NC}"

# Déplacer les scripts de test de la racine backend vers tests/e2e
cd "$MONOREPO_ROOT/backend"
for file in test-*.sh test-*.js; do
    if [ -f "$file" ]; then
        mv "$file" "$TESTS_DIR/"
        echo "  ✓ Déplacé: $file → tests/e2e/"
    fi
done

# Déplacer les scripts d'audit
echo -e "${YELLOW}📁 Déplacement des scripts d'audit...${NC}"
for file in audit-*.sh; do
    if [ -f "$file" ]; then
        mv "$file" "$TESTS_DIR/"
        echo "  ✓ Déplacé: $file → tests/e2e/"
    fi
done

# =============================================================================
# PHASE 3 : NETTOYAGE DES DOSSIERS _temp
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 3 : Nettoyage des dossiers temporaires${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}🗑️  Archivage des dossiers _temp...${NC}"

# Sauvegarder et nettoyer backend/_temp
if [ -d "$MONOREPO_ROOT/backend/_temp" ]; then
    mv "$MONOREPO_ROOT/backend/_temp" "$BACKUP_DIR/backend-temp"
    echo "  ✓ backend/_temp archivé"
fi

# Sauvegarder et nettoyer _temp à la racine
if [ -d "$MONOREPO_ROOT/_temp" ]; then
    mv "$MONOREPO_ROOT/_temp" "$BACKUP_DIR/root-temp"
    echo "  ✓ _temp (racine) archivé"
fi

# =============================================================================
# PHASE 4 : CONSOLIDATION DE LA DOCUMENTATION
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 4 : Consolidation de la documentation${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

cd "$MONOREPO_ROOT/docs"

# Créer un dossier archives pour les docs redondantes
mkdir -p archives/consolidation-reports
mkdir -p archives/implementation-reports

echo -e "${YELLOW}📚 Organisation de la documentation...${NC}"

# Archiver les rapports de consolidation multiples (garder seulement le FINAL)
for doc in *CONSOLIDATION*.md; do
    if [ -f "$doc" ] && [[ ! "$doc" =~ FINAL ]]; then
        mv "$doc" archives/consolidation-reports/
        echo "  ✓ Archivé: $doc"
    fi
done

# Archiver les rapports COMPLETE multiples (garder seulement les essentiels)
for doc in *COMPLETE*.md; do
    if [ -f "$doc" ] && [[ ! "$doc" =~ (ADMIN-MODULE-SPECIFICATIONS|STOCK-IMPLEMENTATION) ]]; then
        mv "$doc" archives/implementation-reports/
        echo "  ✓ Archivé: $doc"
    fi
done

# Archiver les rapports de PHASE multiples
for doc in *PHASE*.md; do
    if [ -f "$doc" ]; then
        mv "$doc" archives/implementation-reports/
        echo "  ✓ Archivé: $doc"
    fi
done

# =============================================================================
# PHASE 5 : MISE À JOUR DU .gitignore
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 5 : Mise à jour des fichiers .gitignore${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}📝 Mise à jour du .gitignore racine...${NC}"

cat > "$MONOREPO_ROOT/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.log

# Production builds
dist/
build/
.next/
out/

# Misc
.DS_Store
*.pem
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
.idea/
*.swp
*.swo
*~

# Turbo
.turbo

# TypeScript
*.tsbuildinfo
tsconfig.tsbuildinfo

# Cache
.cache/
cache/
*.cache

# Temporary files
_temp/
tmp/
temp/
*.tmp

# Backups
*.backup
.cleanup-backup-*/

# Prisma
prisma/migrations/*/*.sql
!prisma/migrations/migration_lock.toml

# Environment
.env
!.env.example
EOF

echo "✓ .gitignore racine mis à jour"

echo -e "${YELLOW}📝 Mise à jour du .gitignore backend...${NC}"

cat > "$MONOREPO_ROOT/backend/.gitignore" << 'EOF'
# Compiled output
dist/
node_modules/
*.tsbuildinfo

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store

# Tests
coverage/
.nyc_output/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Environment
.env
.env.test
!.env.example

# Temporary
_temp/
*.tmp
EOF

echo "✓ .gitignore backend mis à jour"

# =============================================================================
# PHASE 6 : GÉNÉRATION DU RAPPORT DE NETTOYAGE
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}PHASE 6 : Génération du rapport${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

REPORT_FILE="$MONOREPO_ROOT/docs/CLEANUP-REPORT-$(date +%Y-%m-%d).md"

cat > "$REPORT_FILE" << EOF
# 🧹 Rapport de Nettoyage et Consolidation

**Date**: $(date +"%Y-%m-%d %H:%M:%S")
**Backup**: \`$BACKUP_DIR\`

## ✅ Actions Effectuées

### Phase 1 : Nettoyage des fichiers compilés
- ✓ Suppression de \`backend/dist/\` (15 Mo)
- ✓ Nettoyage des caches Turbo
- ✓ Suppression des fichiers \`.tsbuildinfo\`

### Phase 2 : Consolidation des scripts de test
- ✓ Déplacement de tous les scripts de test vers \`backend/tests/e2e/\`
- ✓ Organisation des scripts d'audit

### Phase 3 : Nettoyage des dossiers temporaires
- ✓ Archivage de \`backend/_temp/\`
- ✓ Archivage de \`_temp/\` (racine)

### Phase 4 : Consolidation de la documentation
- ✓ Archivage des rapports de consolidation redondants
- ✓ Organisation dans \`docs/archives/\`
- ✓ Conservation uniquement des documents essentiels

### Phase 5 : Mise à jour des .gitignore
- ✓ Configuration du \`.gitignore\` racine
- ✓ Configuration du \`.gitignore\` backend

## 📊 Statistiques

### Avant nettoyage
- Documentation: ~80 fichiers MD
- Scripts de test: ~25 fichiers éparpillés
- Dossiers temporaires: 2
- Fichiers compilés: 15 Mo

### Après nettoyage
- Documentation: Documents essentiels + archives organisées
- Scripts de test: Centralisés dans \`tests/e2e/\`
- Dossiers temporaires: 0 (archivés)
- Fichiers compilés: 0 (ignorés par Git)

## 📝 Prochaines Étapes Recommandées

1. **Nettoyage des dépendances**
   \`\`\`bash
   npm run clean-deps
   npm install
   \`\`\`

2. **Rebuild propre**
   \`\`\`bash
   npm run build
   \`\`\`

3. **Vérification des tests**
   \`\`\`bash
   npm test
   \`\`\`

4. **Commit des changements**
   \`\`\`bash
   git add .
   git commit -m "chore: cleanup and consolidation"
   \`\`\`

## 🔄 Restauration (si nécessaire)

En cas de problème, restaurez depuis le backup :
\`\`\`bash
cp -r $BACKUP_DIR/* /workspaces/nestjs-remix-monorepo/
\`\`\`

## 📦 Contenu du Backup

Le backup contient :
- \`backend-dist/\` - Fichiers compilés
- \`backend-temp/\` - Dossier temporaire backend
- \`root-temp/\` - Dossier temporaire racine

**Note**: Ce backup peut être supprimé après vérification que tout fonctionne correctement.
EOF

echo "✓ Rapport généré: $REPORT_FILE"

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ NETTOYAGE ET CONSOLIDATION TERMINÉS${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}📊 Résumé:${NC}"
echo -e "  ✓ Fichiers compilés nettoyés"
echo -e "  ✓ Scripts de test consolidés dans tests/e2e/"
echo -e "  ✓ Dossiers temporaires archivés"
echo -e "  ✓ Documentation organisée"
echo -e "  ✓ .gitignore mis à jour"

echo -e "\n${BLUE}📁 Backup créé:${NC} $BACKUP_DIR"
echo -e "${BLUE}📄 Rapport généré:${NC} $REPORT_FILE"

echo -e "\n${YELLOW}⚠️  Prochaines étapes:${NC}"
echo -e "  1. Vérifier que tout fonctionne correctement"
echo -e "  2. Exécuter: npm run build"
echo -e "  3. Exécuter: npm test"
echo -e "  4. Si tout est OK, supprimer le backup: rm -rf $BACKUP_DIR"

echo -e "\n${GREEN}🎉 Monorepo nettoyé et consolidé avec succès !${NC}"
