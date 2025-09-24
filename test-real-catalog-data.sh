#!/bin/bash

# Script de test pour valider la récupération des vraies données

echo "🧪 Test de l'API Catalog Families"
echo "================================="

echo ""
echo "1️⃣ Test endpoint hiérarchie (backend)..."
HIERARCHY_COUNT=$(curl -s "http://localhost:3000/api/catalog/hierarchy/full" | jq '.stats.total_families')
echo "   Familles disponibles: $HIERARCHY_COUNT"

echo ""
echo "2️⃣ Test première famille..."
FIRST_FAMILY=$(curl -s "http://localhost:3000/api/catalog/hierarchy/full" | jq '.hierarchy["1"].family.mf_name')
echo "   Première famille: $FIRST_FAMILY"

echo ""
echo "3️⃣ Test gammes première famille..."
GAMMES_COUNT=$(curl -s "http://localhost:3000/api/catalog/hierarchy/full" | jq '.hierarchy["1"].gammes | length')
echo "   Nombre de gammes: $GAMMES_COUNT"

echo ""
echo "4️⃣ Affichage des 3 premières familles..."
curl -s "http://localhost:3000/api/catalog/hierarchy/full" | jq -r '.hierarchy | to_entries | .[0:3] | .[] | "\(.key): \(.value.family.mf_name) (\(.value.stats.total_gammes) gammes)"'

echo ""
echo "✅ Test terminé!"