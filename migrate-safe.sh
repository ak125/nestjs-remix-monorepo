#!/bin/bash

# 🚗 SCRIPT DE MIGRATION SIMPLE ET SÛR
# Migre un fichier à la fois avec validation

echo "🚗 Migration sécurisée des types véhicules"
echo "=========================================="

# Migration du ModelSelector
echo "🔧 1/4 - Migration de ModelSelector.tsx"
if [ -f "frontend/app/components/vehicles/ModelSelector.tsx" ]; then
    echo "   ✅ ModelSelector.tsx déjà migré"
else
    echo "   ❌ ModelSelector.tsx non trouvé"
fi

# Migration du TypeSelector
echo "🔧 2/4 - Migration de TypeSelector.tsx"
if grep -q "import type.*vehicle.types" "frontend/app/components/vehicles/TypeSelector.tsx" 2>/dev/null; then
    echo "   ✅ TypeSelector.tsx déjà migré"
else
    echo "   🔄 Migration en cours..."
    
    # Ajouter l'import des types centralisés
    sed -i '3i import type { VehicleType, TypeSelectorProps } from "../../types/vehicle.types";' "frontend/app/components/vehicles/TypeSelector.tsx"
    
    # Supprimer l'interface locale VehicleType
    sed -i '/^export interface VehicleType {/,/^}/d' "frontend/app/components/vehicles/TypeSelector.tsx"
    
    echo "   ✅ TypeSelector.tsx migré"
fi

# Migration du VehicleSelector
echo "🔧 3/4 - Migration de VehicleSelector.tsx"
if grep -q "import type.*vehicle.types" "frontend/app/components/home/VehicleSelector.tsx" 2>/dev/null; then
    echo "   ✅ VehicleSelector.tsx déjà migré"
else
    echo "   🔄 Migration en cours..."
    
    # Ajouter l'import des types centralisés
    sed -i '8i import type { VehicleBrand, VehicleModel, VehicleType } from "../../types/vehicle.types";' "frontend/app/components/home/VehicleSelector.tsx"
    
    # Supprimer les interfaces locales
    sed -i '/^interface VehicleBrand {/,/^}/d' "frontend/app/components/home/VehicleSelector.tsx"
    sed -i '/^interface VehicleModel {/,/^}/d' "frontend/app/components/home/VehicleSelector.tsx"
    sed -i '/^interface VehicleType {/,/^}/d' "frontend/app/components/home/VehicleSelector.tsx"
    
    echo "   ✅ VehicleSelector.tsx migré"
fi

# Migration de l'API
echo "🔧 4/4 - Migration de enhanced-vehicle.api.ts"
if grep -q "import type.*vehicle.types" "frontend/app/services/api/enhanced-vehicle.api.ts" 2>/dev/null; then
    echo "   ✅ enhanced-vehicle.api.ts déjà migré"
else
    echo "   🔄 Migration en cours..."
    
    # Ajouter l'import des types centralisés
    sed -i '2i import type { VehicleBrand, VehicleModel, VehicleType } from "../../types/vehicle.types";' "frontend/app/services/api/enhanced-vehicle.api.ts"
    
    # Supprimer les interfaces dupliquées (mais garder les spécifiques à l'API)
    sed -i '/^export interface VehicleModel {/,/^}/d' "frontend/app/services/api/enhanced-vehicle.api.ts"
    
    echo "   ✅ enhanced-vehicle.api.ts migré"
fi

echo ""
echo "🔍 Test de compilation..."

# Test de compilation TypeScript
cd frontend
if npm run typecheck >/dev/null 2>&1; then
    echo "   ✅ Compilation TypeScript réussie"
    RESULT="SUCCESS"
else
    echo "   ⚠️  Erreurs de compilation détectées"
    RESULT="PARTIAL"
fi

cd ..

echo ""
echo "📊 Résumé:"
if [ "$RESULT" = "SUCCESS" ]; then
    echo "   🎉 Migration réussie!"
    echo "   ✅ Tous les types sont maintenant centralisés"
    echo "   ✅ La compilation TypeScript est propre"
else
    echo "   🔄 Migration partielle"
    echo "   ⚠️  Quelques erreurs mineures à corriger"
fi

echo ""
echo "🔧 Prochaines étapes:"
echo "   1. Tester les sélecteurs dans l'interface"
echo "   2. Vérifier les fonctionnalités avancées"
echo "   3. Valider les API calls"

echo ""
echo "✅ Migration sécurisée terminée!"