#!/bin/bash

# ===================================================================
# SCRIPT DE VALIDATION FINALE - MIGRATION MODULAIRE COMPLÈTE
# ===================================================================

set -e

echo "🔍 === VALIDATION FINALE DE LA MIGRATION ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
total_checks=0
passed_checks=0
failed_checks=0

# Fonction de validation
validate_item() {
    local description="$1"
    local condition="$2"
    
    total_checks=$((total_checks + 1))
    
    if eval "$condition"; then
        echo -e "✅ ${GREEN}PASS${NC} - $description"
        passed_checks=$((passed_checks + 1))
        return 0
    else
        echo -e "❌ ${RED}FAIL${NC} - $description"
        failed_checks=$((failed_checks + 1))
        return 1
    fi
}

echo "📁 === VALIDATION DE LA STRUCTURE ==="

# Vérification des dossiers principaux
validate_item "Dossier TEMPLATE_MCP_ENTERPRISE existe" "[ -d 'TEMPLATE_MCP_ENTERPRISE' ]"
validate_item "Dossier backend existe" "[ -d 'TEMPLATE_MCP_ENTERPRISE/packages/backend' ]"
validate_item "Dossier frontend existe" "[ -d 'TEMPLATE_MCP_ENTERPRISE/packages/frontend' ]"
validate_item "Dossier shared existe" "[ -d 'TEMPLATE_MCP_ENTERPRISE/packages/shared' ]"

echo
echo "🔧 === VALIDATION DES SCRIPTS ==="

# Vérification des scripts
validate_item "Script principal migrate-by-module.sh" "[ -f 'scripts/migrate-by-module.sh' -a -x 'scripts/migrate-by-module.sh' ]"
validate_item "Script fix-invalid-class-names.sh" "[ -f 'scripts/fix-invalid-class-names.sh' -a -x 'scripts/fix-invalid-class-names.sh' ]"
validate_item "Script fix-react-components.sh" "[ -f 'scripts/fix-react-components.sh' -a -x 'scripts/fix-react-components.sh' ]"
validate_item "Script simple-migration-report.sh" "[ -f 'scripts/simple-migration-report.sh' -a -x 'scripts/simple-migration-report.sh' ]"

echo
echo "📦 === VALIDATION DES MODULES BACKEND ==="

# Liste des modules attendus
modules=(
    "authentication"
    "ecommerce" 
    "catalog"
    "blog"
    "errors"
    "config"
    "auth"
    "cart"
    "stock"
    "users"
)

# Vérification des modules backend
for module in "${modules[@]}"; do
    module_dir="TEMPLATE_MCP_ENTERPRISE/packages/backend/src/modules/$module"
    validate_item "Module $module - dossier" "[ -d '$module_dir' ]"
    validate_item "Module $module - controller" "[ -f '$module_dir/$module.controller.ts' ]"
    validate_item "Module $module - service" "[ -f '$module_dir/$module.service.ts' ]"
    validate_item "Module $module - module" "[ -f '$module_dir/$module.module.ts' ]"
    validate_item "Module $module - DTO" "[ -f '$module_dir/dto/$module.dto.ts' ]"
done

echo
echo "🎨 === VALIDATION DES ROUTES FRONTEND ==="

# Vérification des routes frontend
frontend_routes=(
    "authentication.tsx"
    "ecommerce.tsx"
    "catalog.tsx"
    "blog.tsx"
    "page-errors.tsx"  # Nom corrigé
    "config.tsx"
    "auth.tsx"
    "cart.tsx"
    "stock.tsx"
    "users.tsx"
)

for route in "${frontend_routes[@]}"; do
    route_file="TEMPLATE_MCP_ENTERPRISE/packages/frontend/app/routes/$route"
    validate_item "Route frontend $route" "[ -f '$route_file' ]"
done

echo
echo "📋 === VALIDATION DES TYPES PARTAGÉS ==="

# Vérification des types partagés
for module in "${modules[@]}"; do
    types_file="TEMPLATE_MCP_ENTERPRISE/packages/shared/src/types/$module.types.ts"
    dto_file="TEMPLATE_MCP_ENTERPRISE/packages/shared/src/dtos/$module.dto.ts"
    
    validate_item "Types $module" "[ -f '$types_file' ]"
    validate_item "DTO partagé $module" "[ -f '$dto_file' ]"
done

echo
echo "📄 === VALIDATION DE LA DOCUMENTATION ==="

# Vérification des fichiers de documentation
validate_item "README principal" "[ -f 'README.md' ]"
validate_item "Guide d'utilisation MCP" "[ -f 'MCP-USAGE-GUIDE.md' ]"
validate_item "Rapport final de migration" "[ -f 'RAPPORT-FINAL-MIGRATION-COMPLETE.md' ]"
validate_item "Checklist post-migration" "[ -f 'checklists/post-migration.md' ]"

echo
echo "🛠️ === VALIDATION DE LA CONFIGURATION ==="

# Vérification des fichiers de configuration
validate_item "turbo.json principal" "[ -f 'turbo.json' ]"
validate_item "turbo.json monorepo" "[ -f 'TEMPLATE_MCP_ENTERPRISE/turbo.json' ]"
validate_item "package.json monorepo" "[ -f 'TEMPLATE_MCP_ENTERPRISE/package.json' ]"
validate_item "Docker Compose" "[ -f 'PROJECT_PRODUCTION/docker-compose.prod.yml' ]"

echo
echo "🔍 === VALIDATION DU CONTENU (ÉCHANTILLON) ==="

# Vérification du contenu des fichiers (échantillon)
if [ -f "TEMPLATE_MCP_ENTERPRISE/packages/backend/src/modules/authentication/authentication.controller.ts" ]; then
    if grep -q "@Controller" "TEMPLATE_MCP_ENTERPRISE/packages/backend/src/modules/authentication/authentication.controller.ts"; then
        validate_item "Controller authentication contient @Controller" "true"
    else
        validate_item "Controller authentication contient @Controller" "false"
    fi
fi

if [ -f "TEMPLATE_MCP_ENTERPRISE/packages/frontend/app/routes/authentication.tsx" ]; then
    if grep -q "export default function" "TEMPLATE_MCP_ENTERPRISE/packages/frontend/app/routes/authentication.tsx"; then
        validate_item "Route authentication exporte une fonction" "true"
    else
        validate_item "Route authentication exporte une fonction" "false"
    fi
fi

echo
echo "📊 === RÉSULTATS DE LA VALIDATION ==="
echo -e "Total des vérifications: ${BLUE}$total_checks${NC}"
echo -e "✅ Réussies: ${GREEN}$passed_checks${NC}"
echo -e "❌ Échouées: ${RED}$failed_checks${NC}"

# Calcul du pourcentage de réussite
if [ $total_checks -gt 0 ]; then
    success_rate=$((passed_checks * 100 / total_checks))
    echo -e "📈 Taux de réussite: ${BLUE}$success_rate%${NC}"
else
    success_rate=0
fi

echo
echo "🎯 === ÉVALUATION FINALE ==="

if [ $success_rate -ge 95 ]; then
    echo -e "${GREEN}🏆 EXCELLENT${NC} - Migration complète et de haute qualité!"
    echo -e "🚀 Prêt pour la production"
elif [ $success_rate -ge 85 ]; then
    echo -e "${YELLOW}👍 BON${NC} - Migration réussie avec quelques améliorations possibles"
    echo -e "✨ Prêt pour les tests finaux"
elif [ $success_rate -ge 70 ]; then
    echo -e "${YELLOW}⚠️  MOYEN${NC} - Migration partiellement réussie"
    echo -e "🔧 Corrections nécessaires avant la production"
else
    echo -e "${RED}❌ INSUFFISANT${NC} - Migration incomplète"
    echo -e "🛠️  Révision majeure requise"
fi

echo
echo "📝 === RÉSUMÉ DES ARTEFACTS GÉNÉRÉS ==="

# Comptage des fichiers générés
backend_modules=$(find TEMPLATE_MCP_ENTERPRISE/packages/backend/src/modules -name "*.ts" 2>/dev/null | wc -l)
frontend_routes=$(find TEMPLATE_MCP_ENTERPRISE/packages/frontend/app/routes -name "*.tsx" 2>/dev/null | wc -l)
shared_types=$(find TEMPLATE_MCP_ENTERPRISE/packages/shared/src -name "*.ts" 2>/dev/null | wc -l)

echo "📦 Fichiers backend: $backend_modules"
echo "🎨 Routes frontend: $frontend_routes"
echo "📋 Types partagés: $shared_types"
echo "📄 Scripts de migration: $(ls scripts/*.sh 2>/dev/null | wc -l)"

total_artifacts=$((backend_modules + frontend_routes + shared_types))
echo -e "🏗️  Total des artefacts: ${BLUE}$total_artifacts${NC}"

echo
echo "✨ === VALIDATION TERMINÉE ==="
echo "Rapport généré le: $(date '+%Y-%m-%d %H:%M:%S')"

# Code de sortie basé sur le taux de réussite
if [ $success_rate -ge 85 ]; then
    exit 0
else
    exit 1
fi
