#!/bin/bash

# Test endpoint PUT /api/brands/:id/seo
# Usage: ./test-put-brand-seo.sh [marqueId]

MARQUE_ID=${1:-140}
BASE_URL="http://localhost:3000/api"

echo "🧪 Test API PUT /api/brands/${MARQUE_ID}/seo"
echo "================================================"
echo ""

# 1. Récupérer état actuel
echo "📖 État actuel SEO marque ${MARQUE_ID}:"
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo // "Pas de SEO"'
echo ""

# 2. Tester UPDATE avec données partielles
echo "✏️ Test UPDATE partiel (title + description):"
RESPONSE=$(curl -s -X PUT "${BASE_URL}/brands/${MARQUE_ID}/seo" \
  -H "Content-Type: application/json" \
  -d '{
    "sm_title": "Test API PUT - Renault - Pièces Auto Pas Cher",
    "sm_descrip": "Description mise à jour via API PUT. Catalogue complet pièces Renault avec variables #PrixPasCher#."
  }')

echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ UPDATE réussi"
else
  echo "❌ UPDATE échoué"
  exit 1
fi

echo ""

# 3. Vérifier mise à jour effective
echo "🔍 Vérification données mises à jour:"
sleep 1
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo'
echo ""

# 4. Tester UPDATE complet (tous champs)
echo "📝 Test UPDATE complet (tous champs):"
RESPONSE_FULL=$(curl -s -X PUT "${BASE_URL}/brands/${MARQUE_ID}/seo" \
  -H "Content-Type: application/json" \
  -d '{
    "sm_title": "Pièces Auto Renault | #PrixPasCher# | Automecanik",
    "sm_descrip": "Catalogue complet pièces détachées #VMarque# avec livraison express. Variables: #PrixPasCher#",
    "sm_h1": "Pièces Détachées #VMarque# - Freinage, Distribution, Embrayage",
    "sm_content": "<h2>Notre gamme complète pour #VMarque#</h2><p>Découvrez toutes les pièces #PrixPasCher# disponibles en stock.</p><ul><li>Freinage</li><li>Distribution</li><li>Embrayage</li></ul>",
    "sm_keywords": "renault, pieces auto renault, freinage renault, prix pas cher"
  }')

echo "$RESPONSE_FULL" | jq '.'
SUCCESS_FULL=$(echo "$RESPONSE_FULL" | jq -r '.success')

if [ "$SUCCESS_FULL" = "true" ]; then
  echo "✅ UPDATE complet réussi"
else
  echo "❌ UPDATE complet échoué"
  exit 1
fi

echo ""

# 5. Vérifier traitement variables
echo "🔧 Vérification traitement variables:"
sleep 1
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo | {
  title: .title,
  description: .description,
  h1: .h1,
  content: .content[0:100],
  contentText: .contentText[0:100]
}'

echo ""
echo "================================================"
echo "✅ Tests API PUT terminés avec succès"
