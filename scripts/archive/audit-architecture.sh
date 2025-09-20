#!/bin/bash

# 🔍 DÉTECTION DES CONFLITS D'ARCHITECTURE
# Script pour identifier les doublons et conflits dans le projet

echo "🏗️ AUDIT ARCHITECTURE - Détection des conflits"
echo "==============================================="

echo ""
echo "🎯 1. CONTRÔLEURS AVEC ROUTES EN CONFLIT"
echo "----------------------------------------"

echo ""
echo "📁 Contrôleurs utilisant /api/vehicles :"
grep -r "@Controller.*api/vehicles" backend/src/ --include="*.ts" | head -10

echo ""
echo "📁 Contrôleurs utilisant /catalog/vehicles :"
grep -r "@Controller.*catalog/vehicles" backend/src/ --include="*.ts" | head -10

echo ""
echo "🔗 2. ENDPOINTS DUPLIQUÉS"
echo "-------------------------"

echo ""
echo "🏷️ Endpoints GET brands :"
grep -r "@Get.*brands" backend/src/ --include="*.ts" -A 2 | head -20

echo ""
echo "🚙 Endpoints GET models :"
grep -r "@Get.*models" backend/src/ --include="*.ts" -A 2 | head -20

echo ""
echo "⚙️ Endpoints GET types/engines :"
grep -r "@Get.*\(types\|engines\)" backend/src/ --include="*.ts" -A 2 | head -20

echo ""
echo "🔄 3. SERVICES DUPLIQUÉS"
echo "-----------------------"

echo ""
echo "📦 Services véhicules :"
find backend/src/ -name "*vehicle*.service.ts" -o -name "*auto*.service.ts" | head -10

echo ""
echo "🎭 4. INTERFACES/TYPES DUPLIQUÉS"
echo "--------------------------------"

echo ""
echo "🔍 Définitions VehicleType :"
grep -r "interface VehicleType\|type VehicleType" --include="*.ts" --include="*.tsx" . | head -10

echo ""
echo "🔍 Définitions VehicleBrand :"
grep -r "interface VehicleBrand\|type VehicleBrand" --include="*.ts" --include="*.tsx" . | head -10

echo ""
echo "🎨 5. COMPOSANTS FRONTEND SIMILAIRES"
echo "------------------------------------"

echo ""
echo "🧩 Composants Vehicle Selector :"
find frontend/ -name "*Vehicle*" -name "*.tsx" | head -10

echo ""
echo "📊 6. RÉSUMÉ DES CONFLITS"
echo "------------------------"

# Compter les conflits
controllers_conflicts=$(grep -r "@Controller.*api/vehicles" backend/src/ --include="*.ts" | wc -l)
services_count=$(find backend/src/ -name "*vehicle*.service.ts" -o -name "*auto*.service.ts" | wc -l)
types_duplicates=$(grep -r "interface VehicleType\|type VehicleType" --include="*.ts" --include="*.tsx" . | wc -l)

echo "⚠️  Contrôleurs en conflit sur /api/vehicles: $controllers_conflicts"
echo "📦 Services véhicules trouvés: $services_count"  
echo "🔍 Définitions VehicleType dupliquées: $types_duplicates"

if [ $controllers_conflicts -gt 1 ]; then
    echo ""
    echo "🚨 ALERTE: Conflit de routes détecté!"
    echo "   → Plusieurs contrôleurs utilisent la même route /api/vehicles"
    echo "   → Cela peut causer des bugs de routage"
fi

echo ""
echo "✅ Audit terminé. Voir ARCHITECTURE_AUDIT_REPORT.md pour plus de détails."