#!/bin/bash

# 🧪 Script de validation du système lazy loading
# Teste les performances et fonctionnalités des composants LazyImage et LazyCard

echo "🚀 Test du système lazy loading..."
echo "=================================="

# Test 1: Vérification de la disponibilité du serveur
echo "1️⃣ Test disponibilité serveur..."
if curl -s http://localhost:3000 >/dev/null; then
    echo "   ✅ Serveur accessible"
else
    echo "   ❌ Serveur non accessible"
    exit 1
fi

# Test 2: Test de l'API gammes avec cache
echo "2️⃣ Test API gammes avec cache Redis..."
GAMMES_RESPONSE=$(curl -s http://localhost:3000/api/products/gammes-cached)
GAMMES_COUNT=$(echo "$GAMMES_RESPONSE" | jq 'length' 2>/dev/null || echo "0")

if [ "$GAMMES_COUNT" -gt 100 ]; then
    echo "   ✅ API gammes fonctionnelle ($GAMMES_COUNT gammes)"
else
    echo "   ⚠️  API gammes retourne peu de données ($GAMMES_COUNT gammes)"
fi

# Test 3: Test de l'endpoint famille avec gammes
echo "3️⃣ Test API familles avec gammes..."
FAMILIES_RESPONSE=$(curl -s http://localhost:3000/api/catalog/hierarchy/families-with-subcategories)
FAMILIES_COUNT=$(echo "$FAMILIES_RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")

if [ "$FAMILIES_COUNT" -gt 5 ]; then
    echo "   ✅ API familles fonctionnelle ($FAMILIES_COUNT familles)"
else
    echo "   ⚠️  API familles retourne peu de données ($FAMILIES_COUNT familles)"
fi

# Test 4: Test d'une page de gamme spécifique
echo "4️⃣ Test page gamme spécifique..."
GAMME_PAGE=$(curl -s -w "%{http_code}" http://localhost:3000/pieces/support-moteur-247.html -o /dev/null)

if [ "$GAMME_PAGE" = "200" ]; then
    echo "   ✅ Page gamme accessible (HTTP $GAMME_PAGE)"
else
    echo "   ❌ Page gamme inaccessible (HTTP $GAMME_PAGE)"
fi

# Test 5: Vérification des composants lazy loading
echo "5️⃣ Vérification des fichiers lazy loading..."

LAZY_IMAGE_EXISTS=false
LAZY_CARD_EXISTS=false
SKELETON_LOADER_EXISTS=false

if [ -f "/workspaces/nestjs-remix-monorepo/frontend/app/components/ui/LazyImage.tsx" ]; then
    LAZY_IMAGE_EXISTS=true
    echo "   ✅ LazyImage.tsx présent"
else
    echo "   ❌ LazyImage.tsx manquant"
fi

if [ -f "/workspaces/nestjs-remix-monorepo/frontend/app/components/ui/LazyCard.tsx" ]; then
    LAZY_CARD_EXISTS=true
    echo "   ✅ LazyCard.tsx présent"
else
    echo "   ❌ LazyCard.tsx manquant"
fi

if [ -f "/workspaces/nestjs-remix-monorepo/frontend/app/components/ui/SkeletonLoader.tsx" ]; then
    SKELETON_LOADER_EXISTS=true
    echo "   ✅ SkeletonLoader.tsx présent"
else
    echo "   ❌ SkeletonLoader.tsx manquant"
fi

# Test 6: Analyse des performances
echo "6️⃣ Test de performance (temps de réponse)..."

START_TIME=$(date +%s%N)
curl -s http://localhost:3000 > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $RESPONSE_TIME -lt 1000 ]; then
    echo "   ✅ Temps de réponse excellent: ${RESPONSE_TIME}ms"
elif [ $RESPONSE_TIME -lt 3000 ]; then
    echo "   ⚠️  Temps de réponse acceptable: ${RESPONSE_TIME}ms"
else
    echo "   ❌ Temps de réponse lent: ${RESPONSE_TIME}ms"
fi

# Résumé
echo ""
echo "📊 RÉSUMÉ DU TEST LAZY LOADING"
echo "================================"

if $LAZY_IMAGE_EXISTS && $LAZY_CARD_EXISTS && $SKELETON_LOADER_EXISTS; then
    echo "✅ Tous les composants lazy loading sont présents"
else
    echo "❌ Certains composants lazy loading manquent"
fi

if [ $RESPONSE_TIME -lt 1000 ] && [ "$GAMMES_COUNT" -gt 100 ]; then
    echo "✅ Performance système: EXCELLENT"
elif [ $RESPONSE_TIME -lt 3000 ] && [ "$GAMMES_COUNT" -gt 50 ]; then
    echo "⚠️  Performance système: ACCEPTABLE"
else
    echo "❌ Performance système: À AMÉLIORER"
fi

echo ""
echo "🎯 Pour tester manuellement:"
echo "   1. Ouvrir http://localhost:3000"
echo "   2. Observer les animations de chargement"
echo "   3. Vérifier le lazy loading en scrollant"
echo "   4. Tester les URLs de gammes: /pieces/[slug]-[id].html"

echo ""
echo "🔧 Composants disponibles:"
echo "   - LazyImage: Chargement progressif des images"
echo "   - LazyCard: Animations d'apparition des cartes"
echo "   - SkeletonLoader: Placeholders de chargement"
echo "   - PerformanceMonitor: Monitoring des performances"