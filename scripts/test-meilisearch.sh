#!/bin/bash

# Script de test Meilisearch pour FAFA AUTO
# ========================================

echo "🔍 Test de Meilisearch - FAFA AUTO"

MEILISEARCH_HOST=${MEILISEARCH_HOST:-"http://localhost:7700"}
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY:-"masterKey123"}

# Test de santé
echo "⏳ Test de connexion..."
if curl -s "$MEILISEARCH_HOST/health" > /dev/null; then
    echo "✅ Meilisearch accessible"
else
    echo "❌ Meilisearch inaccessible"
    exit 1
fi

# Test des index
echo "⏳ Vérification des index..."
INDEX_RESPONSE=$(curl -s "$MEILISEARCH_HOST/indexes" -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY")
if echo "$INDEX_RESPONSE" | grep -q "vehicles"; then
    echo "✅ Index vehicles trouvé"
else
    echo "⚠️  Index vehicles non trouvé"
fi

if echo "$INDEX_RESPONSE" | grep -q "products"; then
    echo "✅ Index products trouvé"
else
    echo "⚠️  Index products non trouvé"
fi

# Test d'indexation
echo "⏳ Test d'indexation..."
curl -X POST "$MEILISEARCH_HOST/indexes/vehicles/documents" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d '[{
        "id": "test-001",
        "brand": "BMW",
        "model": "X3",
        "version": "xDrive30d",
        "year": 2023,
        "price": 55000,
        "fuel_type": "diesel",
        "transmission": "automatique",
        "color": "noir",
        "category": "suv"
    }]' > /dev/null

sleep 2

# Test de recherche
echo "⏳ Test de recherche..."
SEARCH_RESPONSE=$(curl -s "$MEILISEARCH_HOST/indexes/vehicles/search" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"q": "BMW"}')

if echo "$SEARCH_RESPONSE" | grep -q "BMW"; then
    echo "✅ Recherche fonctionnelle"
    echo "   Résultat : $(echo "$SEARCH_RESPONSE" | jq -r '.hits[0].brand + " " + .hits[0].model')"
else
    echo "❌ Recherche non fonctionnelle"
fi

# Test de filtre
echo "⏳ Test de filtres..."
FILTER_RESPONSE=$(curl -s "$MEILISEARCH_HOST/indexes/vehicles/search" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"q": "", "filter": ["brand = BMW"], "facets": ["brand", "fuel_type"]}')

if echo "$FILTER_RESPONSE" | grep -q "facetDistribution"; then
    echo "✅ Filtres fonctionnels"
else
    echo "⚠️  Filtres non configurés"
fi

# Nettoyage
echo "⏳ Nettoyage..."
curl -X DELETE "$MEILISEARCH_HOST/indexes/vehicles/documents/test-001" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" > /dev/null

echo ""
echo "🎉 Tests terminés !"
echo "📊 Interface d'administration : $MEILISEARCH_HOST"
