#!/bin/bash

# 🔧 CORRECTION DES NOMS DE FONCTIONS REACT INVALIDES
# ==================================================

set -e

echo "🔧 === CORRECTION DES NOMS DE FONCTIONS REACT ==="
echo ""

ENTERPRISE_ROOT="/workspaces/TEMPLATE_MCP_COMPLETE/TEMPLATE_MCP_ENTERPRISE"
FRONTEND_DIR="$ENTERPRISE_ROOT/packages/frontend/app/routes"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour convertir un nom de fichier en nom de fonction valide
convert_to_valid_function_name() {
    local file_name="$1"
    # Supprimer l'extension .tsx
    local base_name=$(basename "$file_name" .tsx)
    
    # Remplacer les points et tirets par des camelCase
    # myspace.account.out -> MyspaceAccountOut
    # mycart-add -> MycartAdd
    local function_name=$(echo "$base_name" | sed 's/\([a-z]\)\./\1_/g' | sed 's/\([a-z]\)-/\1_/g' | sed 's/_\([a-z]\)/\U\1/g' | sed 's/^\([a-z]\)/\U\1/')
    
    # Ajouter "Page" à la fin
    echo "${function_name}Page"
}

# Fonction pour corriger un fichier React
fix_react_component() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    
    echo "🔄 Correction: $file_name"
    
    # Extraire le nom de base du fichier pour générer le nom de fonction
    local module_file=$(echo "$file_name" | sed 's/\.tsx$//')
    local function_name=$(convert_to_valid_function_name "$file_name")
    
    # Corriger les noms de fonctions avec des points
    sed -i "s/export default function [^(]*(/export default function $function_name(/g" "$file_path"
    
    # Corriger les noms de classe CSS pour être cohérents
    local css_class=$(echo "$module_file" | sed 's/\./-/g')
    sed -i "s/className=\"[^\"]*-page\"/className=\"$css_class-page\"/g" "$file_path"
    
    # Corriger les titres pour être plus lisibles
    local readable_title=$(echo "$module_file" | sed 's/\./ /g' | sed 's/-/ /g' | sed 's/\b\w/\U&/g')
    sed -i "s/<h1>[^<]*{loaderData\.module}<\/h1>/<h1>$readable_title - {loaderData.module}<\/h1>/g" "$file_path"
    
    echo "   ✅ Corrigé → $function_name"
}

echo -e "${BLUE}🔍 Recherche des composants React à corriger...${NC}"
echo ""

if [ -d "$FRONTEND_DIR" ]; then
    # Trouver tous les fichiers .tsx qui contiennent des points dans leur nom
    find "$FRONTEND_DIR" -name "*.tsx" -type f | while read -r file; do
        # Vérifier si le fichier contient une fonction avec des points
        if grep -q "export default function [^(]*\." "$file" 2>/dev/null; then
            fix_react_component "$file"
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Correction terminée${NC}"
else
    echo -e "${RED}❌ Répertoire frontend non trouvé${NC}"
fi

echo ""
echo -e "${BLUE}📝 Résumé des corrections:${NC}"
echo "   - Noms de fonctions avec points → CamelCase valide"
echo "   - Classes CSS cohérentes"
echo "   - Titres plus lisibles"
echo ""
