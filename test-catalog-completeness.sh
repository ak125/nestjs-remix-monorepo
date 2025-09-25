#!/bin/bash

echo "🔍 Test de complétude du catalogue pour différents véhicules"
echo "============================================================"

# Véhicules de test avec différents volumes de données
declare -A vehicles=(
    ["470"]="Citroën C4"
    ["22547"]="Audi A5 (18 TFSI 100ch)"
    ["8408"]="Citroën C4 II"
    ["17173"]="Autre test"
)

echo ""
echo "📊 Résultats par véhicule :"
echo "----------------------------"

for type_id in "${!vehicles[@]}"; do
    name="${vehicles[$type_id]}"
    echo -n "🚗 $name (ID: $type_id): "
    
    result=$(curl -s "http://localhost:3000/api/catalog/families/vehicle-v3/$type_id" 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$result" ]; then
        query_type=$(echo "$result" | jq -r '.catalog.queryType // "ERROR"')
        families=$(echo "$result" | jq -r '.catalog.totalFamilies // 0')
        gammes=$(echo "$result" | jq -r '.catalog.totalGammes // 0')
        
        if [ "$query_type" = "DIRECT_SUCCESS" ]; then
            echo "✅ $families familles, $gammes gammes"
        elif [ "$query_type" = "HYBRID_SUCCESS" ]; then
            echo "⚠️ $families familles, $gammes gammes (HYBRID)"
        elif [ "$query_type" = "GENERIC_FALLBACK" ]; then
            echo "❌ Fallback générique ($families familles)"
        else
            echo "❌ Erreur: $query_type"
        fi
    else
        echo "❌ Erreur de connexion"
    fi
done

echo ""
echo "🎯 Analyse comparative :"
echo "------------------------"
echo "✅ DIRECT_SUCCESS = Catalogue complet filtré par véhicule"
echo "⚠️ HYBRID_SUCCESS = Catalogue partiel avec validations FK"
echo "❌ GENERIC_FALLBACK = Aucun résultat spécifique au véhicule"

echo ""
echo "📈 Pour optimiser davantage :"
echo "-----------------------------"
echo "1. Si GENERIC_FALLBACK : Vérifier que le type_id existe et a des relations"
echo "2. Si peu de gammes : Augmenter les limites ou supprimer les filtres FK"
echo "3. Si timeout : Optimiser la requête avec des index supplémentaires"