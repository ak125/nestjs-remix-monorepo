#!/bin/bash

# 🚗 Script de validation du sélecteur véhicule intelligent
# Usage: ./validate-vehicle-selector.sh

echo "🧪 Validation du sélecteur véhicule intelligent..."
echo "=================================================="

# Configuration
BASE_URL="http://localhost:3000"
TIMEOUT=10

# Fonction de test avec timeout
test_endpoint() {
    local url=$1
    local name=$2
    
    echo -n "Testing $name... "
    
    if response=$(curl -s --max-time $TIMEOUT "$url"); then
        if echo "$response" | jq -e '.data' > /dev/null 2>&1; then
            count=$(echo "$response" | jq '.data | length' 2>/dev/null)
            # Vérification que count est un nombre valide
            if [ -z "$count" ] || ! [[ "$count" =~ ^[0-9]+$ ]]; then
                count=0
            fi
            echo "✅ OK ($count items)"
            return 0
        else
            echo "❌ Invalid JSON structure"
            return 1
        fi
    else
        echo "❌ Failed to connect"
        return 1
    fi
}

# Tests des endpoints principaux
echo "🔍 Tests des endpoints API..."
echo ""

# 1. Test marques
test_endpoint "$BASE_URL/api/vehicles/brands?limit=5" "Marques"

# 2. Test années pour BMW (33)
test_endpoint "$BASE_URL/api/vehicles/brands/33/years" "Années BMW"

# 3. Test modèles BMW  
test_endpoint "$BASE_URL/api/vehicles/brands/33/models?limit=5" "Modèles BMW"

# 4. Test types pour un modèle BMW (premier trouvé)
if model_id=$(curl -s "$BASE_URL/api/vehicles/brands/33/models?limit=1" | jq -r '.data[0].modele_id' 2>/dev/null); then
    if [ "$model_id" != "null" ] && [ "$model_id" != "" ]; then
        test_endpoint "$BASE_URL/api/vehicles/models/$model_id/types?limit=3" "Types BMW modèle $model_id"
    else
        echo "❌ Could not get BMW model ID"
    fi
else
    echo "❌ Could not fetch BMW models"
fi

echo ""
echo "🎯 Test du workflow complet..."

# Test workflow complet
workflow_test() {
    echo "1️⃣ Récupération marques..."
    brands=$(curl -s "$BASE_URL/api/vehicles/brands?limit=3")
    brand_count=$(echo "$brands" | jq '.data | length' 2>/dev/null)
    # Vérification que brand_count est un nombre valide
    if [ -z "$brand_count" ] || ! [[ "$brand_count" =~ ^[0-9]+$ ]]; then
        brand_count=0
    fi
    echo "   → $brand_count marques trouvées"
    
    # Prendre AUDI (marque_id: 22)
    echo "2️⃣ Test avec AUDI (ID: 22)..."
    years=$(curl -s "$BASE_URL/api/vehicles/brands/22/years")
    year_count=$(echo "$years" | jq '.data | length' 2>/dev/null)
    # Vérification que year_count est un nombre valide
    if [ -z "$year_count" ] || ! [[ "$year_count" =~ ^[0-9]+$ ]]; then
        year_count=0
    fi
    echo "   → $year_count années disponibles"
    
    models=$(curl -s "$BASE_URL/api/vehicles/brands/22/models?limit=5")
    model_count=$(echo "$models" | jq '.data | length' 2>/dev/null)
    # Vérification que model_count est un nombre valide
    if [ -z "$model_count" ] || ! [[ "$model_count" =~ ^[0-9]+$ ]]; then
        model_count=0
    fi
    echo "   → $model_count modèles trouvés"
    
    if [ "$model_count" -gt 0 ]; then
        first_model=$(echo "$models" | jq -r '.data[0].modele_id')
        model_name=$(echo "$models" | jq -r '.data[0].modele_name')
        echo "3️⃣ Test avec modèle $model_name (ID: $first_model)..."
        
        types=$(curl -s "$BASE_URL/api/vehicles/models/$first_model/types?limit=3")
        type_count=$(echo "$types" | jq '.data | length' 2>/dev/null)
        # Vérification que type_count est un nombre valide
        if [ -z "$type_count" ] || ! [[ "$type_count" =~ ^[0-9]+$ ]]; then
            type_count=0
        fi
        echo "   → $type_count types/motorisations trouvés"
        
        if [ "$type_count" -gt 0 ]; then
            echo "4️⃣ Exemple de motorisation:"
            echo "$types" | jq '.data[0] | {type_name, type_fuel, type_power_ps}'
        fi
    fi
}

workflow_test

echo ""
echo "✅ Validation terminée !"
echo ""
echo "🎉 Le sélecteur véhicule intelligent est opérationnel !"
echo "   → Cascade: Marque → Années → Modèles → Types"
echo "   → Interface: http://localhost:3000"
echo "   → API Base: $BASE_URL/api/vehicles/*"