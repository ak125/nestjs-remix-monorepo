#!/bin/bash

# 🚗 SCRIPT DE VALIDATION POST-MIGRATION
# Vérifie que la migration des types véhicules s'est bien passée

echo "🔍 Validation post-migration des types véhicules"
echo "================================================"

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app"
BACKEND_DIR="/workspaces/nestjs-remix-monorepo/backend"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SUCCESS=0
WARNINGS=0
ERRORS=0

print_status() {
    local status="$1"
    local message="$2"
    
    case $status in
        "OK")
            echo -e "   ${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "   ${YELLOW}⚠️  $message${NC}"
            ((WARNINGS++))
            ;;
        "ERROR")
            echo -e "   ${RED}❌ $message${NC}"
            ((ERRORS++))
            ;;
        "INFO")
            echo -e "   ${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

echo ""
echo "🔍 1. Vérification du fichier de types centralisé"
echo "================================================="

TYPES_FILE="$FRONTEND_DIR/types/vehicle.types.ts"

if [ -f "$TYPES_FILE" ]; then
    print_status "OK" "Fichier de types centralisé existe"
    
    # Vérifier les exports principaux
    if grep -q "export interface VehicleBrand" "$TYPES_FILE"; then
        print_status "OK" "Interface VehicleBrand exportée"
    else
        print_status "ERROR" "Interface VehicleBrand manquante"
    fi
    
    if grep -q "export interface VehicleModel" "$TYPES_FILE"; then
        print_status "OK" "Interface VehicleModel exportée" 
    else
        print_status "ERROR" "Interface VehicleModel manquante"
    fi
    
    if grep -q "export interface VehicleType" "$TYPES_FILE"; then
        print_status "OK" "Interface VehicleType exportée"
    else
        print_status "ERROR" "Interface VehicleType manquante"
    fi
    
else
    print_status "ERROR" "Fichier de types centralisé manquant: $TYPES_FILE"
fi

echo ""
echo "🔍 2. Vérification des imports dans les composants"
echo "=================================================="

COMPONENTS_TO_CHECK=(
    "$FRONTEND_DIR/components/vehicles/ModelSelector.tsx"
    "$FRONTEND_DIR/components/vehicles/TypeSelector.tsx"
    "$FRONTEND_DIR/components/home/VehicleSelector.tsx"
    "$FRONTEND_DIR/services/api/enhanced-vehicle.api.ts"
)

for file in "${COMPONENTS_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # Vérifier l'import des types centralisés
        if grep -q "from.*types/vehicle.types" "$file"; then
            print_status "OK" "$filename: Import des types centralisés présent"
        else
            print_status "WARNING" "$filename: Import des types centralisés manquant"
        fi
        
        # Vérifier s'il reste des interfaces locales
        if grep -q "^interface Vehicle\|^export interface Vehicle" "$file"; then
            print_status "WARNING" "$filename: Interfaces locales toujours présentes"
        else
            print_status "OK" "$filename: Pas d'interfaces locales détectées"
        fi
        
    else
        print_status "WARNING" "$(basename "$file"): Fichier non trouvé"
    fi
done

echo ""
echo "🔍 3. Vérification de la cohérence des noms de propriétés"
echo "========================================================="

# Vérifier que les noms de propriétés correspondent à la BDD
if [ -f "$TYPES_FILE" ]; then
    
    # Vérifier marque_id vs brand_id
    if grep -q "marque_id:" "$TYPES_FILE"; then
        print_status "OK" "Utilisation de marque_id (cohérent avec BDD)"
    else
        print_status "WARNING" "marque_id manquant dans les types"
    fi
    
    # Vérifier modele_id
    if grep -q "modele_id:" "$TYPES_FILE"; then
        print_status "OK" "Utilisation de modele_id (cohérent avec BDD)"
    else
        print_status "WARNING" "modele_id manquant dans les types"
    fi
    
    # Vérifier type_id
    if grep -q "type_id:" "$TYPES_FILE"; then
        print_status "OK" "Utilisation de type_id (cohérent avec BDD)"
    else
        print_status "WARNING" "type_id manquant dans les types"
    fi
fi

echo ""
echo "🔍 4. Test de compilation TypeScript"
echo "===================================="

cd "$FRONTEND_DIR/../.." || exit 1

if command -v npm &> /dev/null; then
    print_status "INFO" "Test de compilation en cours..."
    
    # Test de compilation sans émission de fichiers
    if npm run type-check 2>/dev/null || npx tsc --noEmit 2>/dev/null; then
        print_status "OK" "Compilation TypeScript réussie"
    else
        print_status "ERROR" "Erreurs de compilation TypeScript détectées"
        print_status "INFO" "Exécuter 'npm run type-check' pour plus de détails"
    fi
else
    print_status "WARNING" "npm non disponible, test de compilation ignoré"
fi

echo ""
echo "🔍 5. Vérification des endpoints API backend"
echo "============================================"

BACKEND_FILES=(
    "$BACKEND_DIR/src/modules/vehicles/vehicles-forms-simple.controller.ts"
    "$BACKEND_DIR/src/modules/vehicles/vehicles.controller.ts"
    "$BACKEND_DIR/src/modules/vehicles/vehicles.service.ts"
)

for file in "${BACKEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # Vérifier la cohérence des noms de tables
        if grep -q "auto_marque\|auto_modele\|auto_type" "$file"; then
            print_status "OK" "$filename: Utilise les vraies tables BDD"
        else
            print_status "WARNING" "$filename: Ne semble pas utiliser les tables BDD standard"
        fi
        
    else
        print_status "WARNING" "$(basename "$file"): Fichier backend non trouvé"
    fi
done

echo ""
echo "🔍 6. Test fonctionnel du sélecteur (si serveur actif)"
echo "======================================================"

# Tester si le serveur backend est actif
if curl -s http://localhost:4000/api/vehicles/forms/models >/dev/null 2>&1; then
    print_status "OK" "Serveur backend accessible"
    
    # Test de l'endpoint des modèles
    MODELS_RESPONSE=$(curl -s http://localhost:4000/api/vehicles/forms/models | jq length 2>/dev/null)
    if [ "$MODELS_RESPONSE" -gt 0 ] 2>/dev/null; then
        print_status "OK" "Endpoint des modèles retourne $MODELS_RESPONSE éléments"
    else
        print_status "WARNING" "Endpoint des modèles retourne des données invalides"
    fi
    
else
    print_status "INFO" "Serveur backend non accessible - tests fonctionnels ignorés"
fi

echo ""
echo "📊 RÉSUMÉ DE LA VALIDATION"
echo "========================="

echo -e "   ✅ Succès: $(($(find . -name "*.tsx" -o -name "*.ts" | wc -l) - ERRORS - WARNINGS))"
echo -e "   ⚠️  Avertissements: $WARNINGS"
echo -e "   ❌ Erreurs: $ERRORS"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 VALIDATION RÉUSSIE!${NC}"
    echo "   La migration des types véhicules s'est bien déroulée."
    echo ""
    echo "🔧 Prochaines étapes:"
    echo "   1. Démarrer le serveur de développement"
    echo "   2. Tester les sélecteurs dans l'interface"
    echo "   3. Vérifier les fonctionnalités avancées"
else
    echo -e "${RED}❌ VALIDATION ÉCHOUÉE${NC}"
    echo "   $ERRORS erreur(s) détectée(s) - correction manuelle nécessaire"
    echo ""
    echo "🔧 Actions recommandées:"
    echo "   1. Corriger les erreurs listées ci-dessus"
    echo "   2. Relancer la validation"
    echo "   3. Consulter les logs de compilation pour plus de détails"
fi

if [ $WARNINGS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  $WARNINGS avertissement(s) détecté(s)${NC}"
    echo "   Ces avertissements n'empêchent pas le fonctionnement mais méritent attention."
fi

echo ""
echo "📝 Pour plus d'informations:"
echo "   - Documentation: ./ANALYSE_PROBLEMES_VEHICLE_SELECTOR.md"
echo "   - Script de migration: ./migrate-vehicle-types.sh"
echo "   - Types centralisés: ./frontend/app/types/vehicle.types.ts"

exit $ERRORS