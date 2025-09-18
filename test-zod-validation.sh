#!/bin/bash

# 🧪 TESTS DE VALIDATION ZOD - CART API
# 
# Tests automatisés pour vérifier la validation Zod

echo "🚀 Tests de validation Zod pour l'API Cart"
echo "=========================================="

BASE_URL="http://localhost:3000/api/cart"

# Test 1: Données valides
echo ""
echo "📝 Test 1: Données valides"
echo "-------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "test-product-123",
    "quantity": 3,
    "price": 25.50,
    "name": "Produit de test Zod"
  }')

if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ SUCCÈS: Données valides acceptées"
  echo "   Items: $(echo "$response" | jq '.items | length')"
else
  echo "❌ ÉCHEC: Données valides rejetées"
  echo "   Réponse: $response"
fi

# Test 2: product_id vide
echo ""
echo "📝 Test 2: product_id vide"
echo "--------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "",
    "quantity": 1
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: product_id vide rejeté (400)"
else
  echo "❌ ÉCHEC: product_id vide non rejeté"
  echo "   Réponse: $response"
fi

# Test 3: quantity négative
echo ""
echo "📝 Test 3: quantity négative"
echo "----------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "valid-id",
    "quantity": -1
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: quantity négative rejetée (400)"
else
  echo "❌ ÉCHEC: quantity négative non rejetée"
  echo "   Réponse: $response"
fi

# Test 4: quantity trop grande
echo ""
echo "📝 Test 4: quantity trop grande"
echo "-------------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "valid-id",
    "quantity": 1000
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: quantity trop grande rejetée (400)"
else
  echo "❌ ÉCHEC: quantity trop grande non rejetée"
  echo "   Réponse: $response"
fi

# Test 5: price négative
echo ""
echo "📝 Test 5: price négative"
echo "-------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "valid-id",
    "quantity": 1,
    "price": -10.00
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: price négative rejetée (400)"
else
  echo "❌ ÉCHEC: price négative non rejetée"
  echo "   Réponse: $response"
fi

# Test 6: Caractères invalides dans product_id
echo ""
echo "📝 Test 6: Caractères invalides dans product_id"
echo "-----------------------------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "invalid@#$%",
    "quantity": 1
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: caractères invalides rejetés (400)"
else
  echo "❌ ÉCHEC: caractères invalides non rejetés"
  echo "   Réponse: $response"
fi

# Test 7: URL d'image invalide
echo ""
echo "📝 Test 7: URL d'image invalide"
echo "-------------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "valid-id",
    "quantity": 1,
    "image_url": "not-a-valid-url"
  }')

status_code=$(echo "$response" | jq -r '.statusCode // empty')
if [ "$status_code" = "400" ]; then
  echo "✅ SUCCÈS: URL invalide rejetée (400)"
else
  echo "❌ ÉCHEC: URL invalide non rejetée"
  echo "   Réponse: $response"
fi

# Test 8: Données optionnelles valides
echo ""
echo "📝 Test 8: Données optionnelles valides"
echo "---------------------------------------"
response=$(curl -s -X POST ${BASE_URL}/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "full-product-123",
    "quantity": 2,
    "price": 45.99,
    "name": "Produit complet",
    "description": "Description détaillée du produit",
    "image_url": "https://example.com/image.jpg",
    "category": "Électronique"
  }')

if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ SUCCÈS: Données complètes acceptées"
  item_name=$(echo "$response" | jq -r '.items[0].name')
  echo "   Nom: $item_name"
else
  echo "❌ ÉCHEC: Données complètes rejetées"
  echo "   Réponse: $response"
fi

echo ""
echo "🎯 Tests de validation Zod terminés"
echo "==================================="