#!/bin/bash

# Quick Start - Nettoyage et Consolidation
# Exécution rapide sans interaction

set -e

echo "🚀 Quick Start - Nettoyage Automatique"
echo "======================================"
echo ""

MONOREPO_ROOT="/workspaces/nestjs-remix-monorepo"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$MONOREPO_ROOT"

echo -e "${BLUE}📦 Phase 1: Nettoyage rapide${NC}"
echo "--------------------------------------"

# Nettoyer dist
if [ -d "backend/dist" ]; then
    rm -rf backend/dist
    echo "✓ backend/dist supprimé"
fi

# Nettoyer caches turbo
find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
echo "✓ Caches turbo nettoyés"

# Nettoyer tsbuildinfo
find . -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null || true
echo "✓ Fichiers tsbuildinfo nettoyés"

echo ""
echo -e "${BLUE}📊 Phase 2: Rapport rapide${NC}"
echo "--------------------------------------"

echo "📁 Structure:"
echo "  - Node modules: $([ -d "node_modules" ] && du -sh node_modules 2>/dev/null | cut -f1 || echo 'Aucun')"
echo "  - Documentation: $(find docs -name '*.md' 2>/dev/null | wc -l) fichiers"
echo "  - Scripts: $(find scripts -name '*.sh' 2>/dev/null | wc -l) scripts"

echo ""
echo -e "${GREEN}✅ Nettoyage rapide terminé !${NC}"
echo ""
echo -e "${YELLOW}Pour un nettoyage complet, exécutez:${NC}"
echo "  ./scripts/secure-cleanup.sh"
echo ""
echo -e "${YELLOW}Prochaines étapes:${NC}"
echo "  1. npm install"
echo "  2. npm run build"
echo "  3. npm run dev"
