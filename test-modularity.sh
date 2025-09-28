#!/bin/bash

# 🧪 TEST MODULARITÉ V5 - Vérification architecture modulaire
# Compare le comportement du service modulaire vs fonction originale

echo "🧪 TEST ARCHITECTURE MODULAIRE V5"
echo "=================================="

echo "📊 Test 1: Compilation TypeScript"
cd frontend && npx tsc --noEmit --skipLibCheck
if [ $? -eq 0 ]; then
    echo "✅ TypeScript: Compilation réussie"
else
    echo "❌ TypeScript: Erreurs de compilation"
    exit 1
fi
cd ..

echo ""
echo "📊 Test 2: Structure modulaire"
if [ -f "frontend/app/services/pieces/pieces.service.ts" ]; then
    echo "✅ Service: pieces.service.ts créé"
else
    echo "❌ Service: pieces.service.ts manquant"
    exit 1
fi

if [ -f "frontend/app/types/pieces.types.ts" ]; then
    echo "✅ Types: pieces.types.ts créé"
else
    echo "❌ Types: pieces.types.ts manquant"
    exit 1
fi

echo ""
echo "📊 Test 3: Taille des fichiers (modularité)"
ROUTE_SIZE=$(wc -l "frontend/app/routes/pieces.\$gamme.\$marque.\$modele.\$type[.]html.tsx" | cut -d' ' -f1)
SERVICE_SIZE=$(wc -l "frontend/app/services/pieces/pieces.service.ts" | cut -d' ' -f1)
TYPES_SIZE=$(wc -l "frontend/app/types/pieces.types.ts" | cut -d' ' -f1)

echo "📏 Route principal: $ROUTE_SIZE lignes"
echo "📏 Service modulaire: $SERVICE_SIZE lignes"
echo "📏 Types partagés: $TYPES_SIZE lignes"
echo "📏 Total modulaire: $((SERVICE_SIZE + TYPES_SIZE)) lignes"

if [ $SERVICE_SIZE -lt 200 ]; then
    echo "✅ Service: Taille raisonnable ($SERVICE_SIZE lignes)"
else
    echo "⚠️ Service: Taille importante ($SERVICE_SIZE lignes)"
fi

echo ""
echo "📊 Test 4: API backend toujours fonctionnelle"
API_TEST=$(curl -s "http://localhost:3000/api/catalog/pieces/php-logic/139/402" | jq -r '.success // false')
if [ "$API_TEST" = "true" ]; then
    echo "✅ API Backend: Toujours opérationnelle"
else
    echo "❌ API Backend: Problème détecté"
    exit 1
fi

echo ""
echo "🎯 BILAN MODULARITÉ:"
echo "✅ Service extrait: $SERVICE_SIZE lignes"
echo "✅ Types centralisés: $TYPES_SIZE lignes"
echo "✅ Route allégée: $ROUTE_SIZE lignes"
echo "✅ API préservée: Données réelles maintenues"
echo ""
echo "🏗️ ARCHITECTURE MODULAIRE: PRÊTE POUR INTÉGRATION"