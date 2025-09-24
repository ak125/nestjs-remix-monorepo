#!/bin/bash

# Script pour explorer les données cross_gamme_car

echo "🔍 Exploration des tables cross_gamme_car"
echo "========================================="

echo ""
echo "1️⃣ Test table __cross_gamme_car_new..."
echo "Compter les lignes:"
curl -s "http://localhost:3000" -X POST -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT COUNT(*) as count FROM __cross_gamme_car_new",
    "params": []
  }' 2>/dev/null | jq '.count // "Erreur"' || echo "Table inaccessible"

echo ""
echo "2️⃣ Test table __cross_gamme_car..."  
echo "Compter les lignes:"
curl -s "http://localhost:3000" -X POST -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT COUNT(*) as count FROM __cross_gamme_car", 
    "params": []
  }' 2>/dev/null | jq '.count // "Erreur"' || echo "Table inaccessible"

echo ""
echo "3️⃣ Test avec des type_id populaires..."
for type_id in 1 2 3 100 1000; do
  echo "Test type_id $type_id:"
  result=$(curl -s "http://localhost:3000/api/catalog/families/vehicle/$type_id" --max-time 5 | jq '.totalFamilies' 2>/dev/null)
  echo "   -> $result familles"
done

echo ""
echo "✅ Exploration terminée!"