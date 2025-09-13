#!/bin/bash

# 🚗 Statut du Sélecteur Véhicule Intelligent
# Quick status check script

echo "🚗 Sélecteur Véhicule Intelligent - Statut"
echo "=========================================="
echo ""

# Configuration
BASE_URL="http://localhost:3000"

# Fonction de test rapide
quick_test() {
    local endpoint=$1
    local name=$2
    
    if curl -s --max-time 5 "$endpoint" | jq -e '.data' > /dev/null 2>&1; then
        echo "✅ $name"
        return 0
    else
        echo "❌ $name"
        return 1
    fi
}

# Tests essentiels
echo "🔍 Tests essentiels:"
quick_test "$BASE_URL/api/vehicles/brands?limit=1" "Marques"
quick_test "$BASE_URL/api/vehicles/brands/22/years" "Années"
quick_test "$BASE_URL/api/vehicles/brands/22/models?limit=1" "Modèles"

# Récupérer un modèle pour tester les types
if model_id=$(curl -s "$BASE_URL/api/vehicles/brands/22/models?limit=1" | jq -r '.data[0].modele_id' 2>/dev/null); then
    if [ "$model_id" != "null" ] && [ "$model_id" != "" ]; then
        quick_test "$BASE_URL/api/vehicles/models/$model_id/types?limit=1" "Types"
    else
        echo "❌ Types (pas de modèle disponible)"
    fi
else
    echo "❌ Types (erreur récupération modèle)"
fi

echo ""

# Compter les données
echo "📊 Volumétrie:"
brands_count=$(curl -s "$BASE_URL/api/vehicles/brands" | jq '.total // 0' 2>/dev/null || echo "0")
echo "   → $brands_count marques disponibles"

if [ "$brands_count" -gt 0 ]; then
    # Test avec une marque populaire (BMW = 33)
    years_count=$(curl -s "$BASE_URL/api/vehicles/brands/33/years" | jq '.total // 0' 2>/dev/null || echo "0")
    models_count=$(curl -s "$BASE_URL/api/vehicles/brands/33/models" | jq '.total // 0' 2>/dev/null || echo "0")
    echo "   → $years_count années (BMW)"
    echo "   → $models_count modèles (BMW)"
fi

echo ""

# Statut global
if [ "$brands_count" -gt 30 ]; then
    echo "🎉 STATUT: OPÉRATIONNEL"
    echo "   Le sélecteur véhicule intelligent fonctionne parfaitement !"
elif [ "$brands_count" -gt 0 ]; then
    echo "⚠️  STATUT: DÉGRADÉ"
    echo "   Données limitées, vérifier la synchronisation DB"
else
    echo "🚨 STATUT: HORS SERVICE"
    echo "   Aucune donnée disponible, vérifier backend/DB"
fi

echo ""
echo "🔗 Interface: http://localhost:3000"
echo "📚 Documentation: ./VEHICLE_SELECTOR_MAINTENANCE_GUIDE.md"
echo "🧪 Validation complète: ./validate-vehicle-selector.sh"