#!/bin/bash

# Script de nettoyage sécurisé avec tests
# Date: 30 septembre 2025

set -e  # Arrêt en cas d'erreur

echo "🧹 NETTOYAGE SÉCURISÉ - nestjs-remix-monorepo"
echo "=============================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_REMOVED=0
TOTAL_SIZE=0

# Fonction de test avant suppression
test_file_usage() {
    local file=$1
    local filename=$(basename "$file")
    
    echo -e "${YELLOW}🔍 Test: $filename${NC}"
    
    # Chercher les imports dans tout le projet
    local usage_count=$(grep -r "from.*$filename" frontend/app backend/src 2>/dev/null | wc -l)
    local import_count=$(grep -r "import.*$filename" frontend/app backend/src 2>/dev/null | wc -l)
    
    if [ "$usage_count" -eq 0 ] && [ "$import_count" -eq 0 ]; then
        echo -e "  ${GREEN}✓ Sûr à supprimer (0 utilisation)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ UTILISÉ ($usage_count références)${NC}"
        return 1
    fi
}

# Fonction de sauvegarde
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        mkdir -p .backup-$(date +%Y%m%d)
        cp "$file" ".backup-$(date +%Y%m%d)/"
        echo -e "  ${GREEN}✓ Backup créé${NC}"
    fi
}

# Fonction de suppression sécurisée
safe_remove() {
    local file=$1
    
    if [ ! -f "$file" ]; then
        echo -e "  ${YELLOW}⚠ Fichier inexistant${NC}"
        return 1
    fi
    
    # Backup
    backup_file "$file"
    
    # Taille
    local size=$(du -h "$file" | cut -f1)
    
    # Suppression
    rm "$file"
    
    echo -e "  ${GREEN}✓ Supprimé ($size)${NC}"
    TOTAL_REMOVED=$((TOTAL_REMOVED + 1))
    
    return 0
}

echo "📋 PHASE 1: TEST DES COMPOSANTS FRONTEND"
echo "========================================="
echo ""

# Test SearchBarEnhanced.tsx
if test_file_usage "frontend/app/components/search/SearchBarEnhanced.tsx"; then
    FILES_TO_REMOVE+=("frontend/app/components/search/SearchBarEnhanced.tsx")
fi

# Test SearchBarSimple.tsx
if test_file_usage "frontend/app/components/search/SearchBarSimple.tsx"; then
    FILES_TO_REMOVE+=("frontend/app/components/search/SearchBarSimple.tsx")
fi

# Test SearchResults.tsx (ancien)
if test_file_usage "frontend/app/components/search/SearchResults.tsx"; then
    FILES_TO_REMOVE+=("frontend/app/components/search/SearchResults.tsx")
fi

echo ""
echo "📋 PHASE 2: TEST DES FICHIERS DE DOCUMENTATION"
echo "==============================================="
echo ""

# Documentation obsolète V4/V5
DOCS_V4_V5=(
    "AMELIORATIONS_V5_ULTIMATE_SUCCESS_REPORT.md"
    "AUDIT_V5_ULTIMATE_PLAN.md"
    "DOCUMENTATION_COMPLETE_V4.md"
    "DYNAMIC_SEO_V4_ULTIMATE_SUCCESS_FINAL.md"
    "ENDPOINTS_V5_CORRECTION_SUCCESS_REPORT.md"
    "MIGRATION_V4_SUCCESS_COMPLET_FINAL.md"
    "MIGRATION_V52_MODULAIRE_SUCCESS_REPORT.md"
    "MIGRATION_TYPES_PARTAGES_V4_SUCCESS.md"
    "METHODOLOGIE_V5_ULTIMATE_SUCCESS_REPORT.md"
    "PRODUCT_FILTER_V4_SUCCESS_FINAL.md"
    "PROJET_V4_ULTIMATE_RESUME_FINAL.md"
    "PROJET_V4_ULTIMATE_SHARED_TYPES_SUCCESS_FINAL.md"
    "PROJET_V4_ULTIMATE_SYNTHESE_FINALE_COMPLETE.md"
    "PULL_REQUEST_V4_SHARED_TYPES_FINAL.md"
    "PULL_REQUEST_V4_ULTIMATE_INSTRUCTIONS.md"
    "RAPPORT_PIECES_V4_SUCCESS_FINAL.md"
    "TEST_SEO_V5_ULTIMATE.md"
    "V5_ULTIMATE_COMPLETE_SUCCESS_REPORT.md"
    "V5_ULTIMATE_FILTERING_SUCCESS_FINAL.md"
    "V5_ULTIMATE_FINAL_SUCCESS_REPORT.md"
    "V5_ULTIMATE_IMPLEMENTATION_SUCCESS.md"
    "V5_ULTIMATE_VRAIES_DONNEES_CATALOGUE_FINAL.md"
    "V5_ULTIMATE_VRAIES_DONNEES_SUCCESS.md"
)

echo "🔍 Test documents V4/V5 obsolètes..."
for doc in "${DOCS_V4_V5[@]}"; do
    if [ -f "$doc" ]; then
        FILES_TO_REMOVE+=("$doc")
        echo -e "  ${GREEN}✓ $doc (obsolète)${NC}"
    fi
done

# Analyses redondantes
DOCS_ANALYSES=(
    "ANALYSE_LOGIQUE_UTILISATION_ORIGINALE.md"
    "ANALYSE_PROBLEMES_VEHICLE_SELECTOR.md"
    "ANALYSE_PRODUCTSSERVICE_COMPARAISON.md"
    "ANALYSE_VEHICLESELECTOR_COMPARAISON.md"
    "ANALYSE_VEHICLESELECTOR_PERFORMANCE.md"
    "ARCHITECTURE_ANALYSIS_IMPROVEMENT_REPORT.md"
    "CATALOG_CONTROLLER_ANALYSIS.md"
    "CATALOG_GRID_ANALYSIS.md"
    "DESIGN_STRATEGY_ANALYSIS.md"
    "HOMEPAGE_ANALYSIS.md"
    "ROUTES_PIECES_ANALYSIS_RAPPORT.md"
)

echo ""
echo "🔍 Test analyses redondantes..."
for doc in "${DOCS_ANALYSES[@]}"; do
    if [ -f "$doc" ]; then
        FILES_TO_REMOVE+=("$doc")
        echo -e "  ${GREEN}✓ $doc (redondant)${NC}"
    fi
done

# Rapports de fusion obsolètes
DOCS_FUSION=(
    "CATALOG_CONTROLLER_FUSION_FINAL.md"
    "CATALOG_SERVICE_FUSION_REPORT.md"
    "COMPARAISON_SERVICES_FUSION_RAPPORT.md"
    "FUSION_NETTOYAGE_SERVICES_SUCCESS.md"
    "GAMME_SERVICE_FUSION_AMELIORE.md"
    "HOMEPAGE_FUSION_FINAL.md"
    "PRODUCT_CATALOG_FUSION_FINAL.md"
    "PRODUCT_CATALOG_FUSION_SUCCESS_REPORT.md"
)

echo ""
echo "🔍 Test rapports de fusion..."
for doc in "${DOCS_FUSION[@]}"; do
    if [ -f "$doc" ]; then
        FILES_TO_REMOVE+=("$doc")
        echo -e "  ${GREEN}✓ $doc (fusion effectuée)${NC}"
    fi
done

echo ""
echo "📊 RÉSUMÉ"
echo "========="
echo -e "${YELLOW}Fichiers à supprimer: ${#FILES_TO_REMOVE[@]}${NC}"
echo ""

# Demander confirmation
read -p "Voulez-vous continuer avec la suppression ? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Annulé par l'utilisateur${NC}"
    exit 1
fi

echo ""
echo "🗑️  PHASE 3: SUPPRESSION"
echo "========================"
echo ""

# Suppression
for file in "${FILES_TO_REMOVE[@]}"; do
    echo "Suppression: $file"
    safe_remove "$file"
done

echo ""
echo "✅ NETTOYAGE TERMINÉ"
echo "===================="
echo -e "${GREEN}Fichiers supprimés: $TOTAL_REMOVED${NC}"
echo -e "${GREEN}Backup créé dans: .backup-$(date +%Y%m%d)/${NC}"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Vérifier que le build fonctionne"
echo "  2. Tester l'application"
echo "  3. Commit les changements"
echo ""
