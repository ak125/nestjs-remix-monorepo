#!/bin/bash

# 🔧 CORRECTION DES NOMS DE CLASSES COMMENÇANT PAR DES CHIFFRES
# =============================================================

set -e

echo "🔧 === CORRECTION DES NOMS DE CLASSES INVALIDES ==="
echo ""

ENTERPRISE_ROOT="/workspaces/TEMPLATE_MCP_COMPLETE/TEMPLATE_MCP_ENTERPRISE"
MODULES_DIR="$ENTERPRISE_ROOT/packages/backend/src/modules"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour corriger les noms de classes
fix_class_names() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    
    echo "🔄 Correction: $file_name"
    
    # Patterns de correction pour les fichiers commençant par des chiffres
    sed -i 's/404PageController/Page404Controller/g' "$file_path"
    sed -i 's/404PageService/Page404Service/g' "$file_path"
    sed -i 's/404PageDto/Page404Dto/g' "$file_path"
    sed -i 's/404PageModule/Page404Module/g' "$file_path"
    sed -i 's/export class 404Page/export class Page404/g' "$file_path"
    
    sed -i 's/410PageController/Page410Controller/g' "$file_path"
    sed -i 's/410PageService/Page410Service/g' "$file_path"
    sed -i 's/410PageDto/Page410Dto/g' "$file_path"
    sed -i 's/410PageModule/Page410Module/g' "$file_path"
    sed -i 's/export class 410Page/export class Page410/g' "$file_path"
    
    sed -i 's/412PageController/Page412Controller/g' "$file_path"
    sed -i 's/412PageService/Page412Service/g' "$file_path"
    sed -i 's/412PageDto/Page412Dto/g' "$file_path"
    sed -i 's/412PageModule/Page412Module/g' "$file_path"
    sed -i 's/export class 412Page/export class Page412/g' "$file_path"
    
    # Corriger les autres patterns problématiques
    sed -i 's/410PageForOldLinkController/Page410ForOldLinkController/g' "$file_path"
    sed -i 's/410PageForOldLinkService/Page410ForOldLinkService/g' "$file_path"
    sed -i 's/410PageForOldLinkDto/Page410ForOldLinkDto/g' "$file_path"
    sed -i 's/410PageForOldLinkModule/Page410ForOldLinkModule/g' "$file_path"
    
    echo "   ✅ Corrigé"
}

echo -e "${BLUE}🔍 Recherche des fichiers à corriger...${NC}"
echo ""

# Trouver tous les fichiers TypeScript dans les modules errors
if [ -d "$MODULES_DIR/errors" ]; then
    echo -e "${YELLOW}📂 Module errors${NC}"
    
    # Corriger tous les fichiers TypeScript du module errors
    find "$MODULES_DIR/errors" -name "*.ts" -type f | while read -r file; do
        fix_class_names "$file"
    done
    
    echo ""
    echo -e "${GREEN}✅ Module errors corrigé${NC}"
else
    echo -e "${RED}❌ Module errors non trouvé${NC}"
fi

# Corriger aussi les DTOs et types partagés
echo ""
echo -e "${BLUE}🔍 Correction des fichiers partagés...${NC}"

if [ -d "$ENTERPRISE_ROOT/packages/shared/src/dtos" ]; then
    find "$ENTERPRISE_ROOT/packages/shared/src/dtos" -name "*404*" -o -name "*410*" -o -name "*412*" | while read -r file; do
        if [ -f "$file" ]; then
            fix_class_names "$file"
        fi
    done
fi

if [ -d "$ENTERPRISE_ROOT/packages/shared/src/types" ]; then
    find "$ENTERPRISE_ROOT/packages/shared/src/types" -name "*404*" -o -name "*410*" -o -name "*412*" | while read -r file; do
        if [ -f "$file" ]; then
            fix_class_names "$file"
        fi
    done
fi

# Corriger les routes frontend
echo ""
echo -e "${BLUE}🔍 Correction des routes frontend...${NC}"

if [ -d "$ENTERPRISE_ROOT/packages/frontend/app/routes" ]; then
    find "$ENTERPRISE_ROOT/packages/frontend/app/routes" -name "*404*" -o -name "*410*" -o -name "*412*" | while read -r file; do
        if [ -f "$file" ]; then
            # Pour les composants React/Remix, corriger aussi les noms de fonctions
            sed -i 's/function 404/function Page404/g' "$file"
            sed -i 's/function 410/function Page410/g' "$file" 
            sed -i 's/function 412/function Page412/g' "$file"
            sed -i 's/export default function 404/export default function Page404/g' "$file"
            sed -i 's/export default function 410/export default function Page410/g' "$file"
            sed -i 's/export default function 412/export default function Page412/g' "$file"
            
            fix_class_names "$file"
            echo "🔄 Corrigé: $(basename "$file")"
        fi
    done
fi

echo ""
echo -e "${GREEN}🎉 === CORRECTION TERMINÉE ===${NC}"
echo ""
echo -e "${BLUE}Les classes suivantes ont été renommées:${NC}"
echo "   404PageController → Page404Controller"
echo "   404PageService → Page404Service"
echo "   404PageDto → Page404Dto"
echo "   404PageModule → Page404Module"
echo ""
echo "   410PageController → Page410Controller"
echo "   410PageService → Page410Service"
echo "   etc..."
echo ""
echo -e "${YELLOW}Note:${NC} Les noms de fichiers restent inchangés pour la cohérence URL"
echo "      Seuls les noms de classes TypeScript ont été corrigés"
echo ""
