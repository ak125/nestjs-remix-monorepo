#!/bin/bash

# 🔍 AUDIT DES SERVICES VÉHICULES
# Compare les méthodes des différents services pour identifier les fonctionnalités uniques

echo "🔍 AUDIT DES SERVICES VÉHICULES"
echo "==============================="

echo ""
echo "📊 1. ENHANCED VEHICLE SERVICE (RÉFÉRENCE)"
echo "------------------------------------------"
echo "📁 Fichier: enhanced-vehicle.service.ts"
grep -n "async.*(" backend/src/modules/catalog/services/enhanced-vehicle.service.ts | head -15

echo ""
echo "📊 2. VEHICLES SERVICE (LEGACY)"  
echo "-------------------------------"
echo "📁 Fichier: vehicles.service.ts"
grep -n "async.*(" backend/src/modules/vehicles/vehicles.service.ts | head -15

echo ""
echo "📊 3. AUTO DATA SERVICE"
echo "-----------------------"
echo "📁 Fichier: auto-data.service.ts"
grep -n "async.*(" backend/src/modules/catalog/services/auto-data.service.ts | head -15

echo ""
echo "📊 4. AUTO DATA ENHANCED SERVICE"
echo "--------------------------------"
echo "📁 Fichier: auto-data-enhanced.service.ts"
if [ -f "backend/src/modules/catalog/services/auto-data-enhanced.service.ts" ]; then
    grep -n "async.*(" backend/src/modules/catalog/services/auto-data-enhanced.service.ts | head -15
else
    echo "❌ Fichier non trouvé"
fi

echo ""
echo "🔍 5. COMPARAISON DES MÉTHODES"
echo "------------------------------"

echo ""
echo "🏷️ Méthodes 'getBrands' :"
grep -r "getBrands" backend/src/modules/*/services/*vehicle*.ts backend/src/modules/*/services/*auto*.ts | head -10

echo ""
echo "🚙 Méthodes 'getModels' :"
grep -r "getModels\|findModels" backend/src/modules/*/services/*vehicle*.ts backend/src/modules/*/services/*auto*.ts | head -10

echo ""
echo "⚙️ Méthodes 'getTypes/getEngines' :"
grep -r "getTypes\|getEngines\|findTypes" backend/src/modules/*/services/*vehicle*.ts backend/src/modules/*/services/*auto*.ts | head -10

echo ""
echo "📈 6. STATISTIQUES"
echo "------------------"

enhanced_methods=$(grep -c "async.*(" backend/src/modules/catalog/services/enhanced-vehicle.service.ts)
vehicles_methods=$(grep -c "async.*(" backend/src/modules/vehicles/vehicles.service.ts)
auto_data_methods=$(grep -c "async.*(" backend/src/modules/catalog/services/auto-data.service.ts)

echo "📊 EnhancedVehicleService: $enhanced_methods méthodes"
echo "📊 VehiclesService: $vehicles_methods méthodes"  
echo "📊 AutoDataService: $auto_data_methods méthodes"

echo ""
echo "🎯 RECOMMANDATIONS IMMÉDIATES"
echo "-----------------------------"
echo "1. ✅ Garder EnhancedVehicleService comme référence"
echo "2. 🔍 Analyser les méthodes uniques de VehiclesService"
echo "3. 🔍 Analyser les méthodes uniques d'AutoDataService"
echo "4. ➡️  Migrer les fonctionnalités manquantes vers Enhanced"
echo "5. 🗑️  Supprimer les services dupliqués"