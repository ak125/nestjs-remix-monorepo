#!/bin/bash

# 🧪 TESTS DE VALIDATION ZOD GLOBALE
# Script pour tester le middleware de validation global

echo "🚀 Tests du middleware de validation Zod global"
echo "==============================================="

BASE_URL="http://localhost:3000/api/cart"

# Test 1: Erreur de validation détaillée
echo "📝 Test 1: Validation détaillée avec erreurs multiples"
echo "------------------------------------------------------"
RESPONSE=$(curl -s -X POST $BASE_URL/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "",
    "quantity": 0,
    "price": -10,
    "name": "",
    "image_url": "invalid-url"
  }')

echo "$RESPONSE" | jq .
STATUS_CODE=$(echo "$RESPONSE" | jq -r '.statusCode // empty')

if [ "$STATUS_CODE" = "400" ]; then
  echo "✅ SUCCÈS: Validation échouée comme attendu (400)"
  
  # Vérifier la présence des détails d'erreur
  HAS_DETAILS=$(echo "$RESPONSE" | jq -r '.details // empty')
  if [ ! -z "$HAS_DETAILS" ]; then
    echo "✅ SUCCÈS: Détails d'erreur présents"
  else
    echo "⚠️  AVERTISSEMENT: Détails d'erreur manquants"
  fi
else
  echo "❌ ÉCHEC: Code de statut inattendu: $STATUS_CODE"
fi

echo ""

# Test 2: Validation réussie
echo "📝 Test 2: Validation réussie"
echo "-----------------------------"
RESPONSE=$(curl -s -X POST $BASE_URL/items \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "valid-product-456",
    "quantity": 3,
    "price": 25.99,
    "name": "Produit de test middleware"
  }')

echo "$RESPONSE" | jq .
HAS_ITEMS=$(echo "$RESPONSE" | jq -r '.items // empty')

if [ ! -z "$HAS_ITEMS" ]; then
  echo "✅ SUCCÈS: Article ajouté avec succès"
else
  echo "❌ ÉCHEC: Échec de l'ajout d'article"
fi

echo ""

# Test 3: Validation des paramètres de mise à jour
echo "📝 Test 3: Validation des paramètres de mise à jour"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -X PUT $BASE_URL/test-item \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": "invalid"
  }')

echo "$RESPONSE" | jq .
STATUS_CODE=$(echo "$RESPONSE" | jq -r '.statusCode // empty')

if [ "$STATUS_CODE" = "400" ]; then
  echo "✅ SUCCÈS: Validation de type échouée comme attendu"
else
  echo "❌ ÉCHEC: Validation de type devrait échouer"
fi

echo ""

# Test 4: Validation avec quantité en limite
echo "📝 Test 4: Validation en limite (quantité maximale)"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -X PUT $BASE_URL/test-item \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 999
  }')

echo "$RESPONSE" | jq .
HAS_SUCCESS=$(echo "$RESPONSE" | jq -r '.message // empty')

if [ ! -z "$HAS_SUCCESS" ]; then
  echo "✅ SUCCÈS: Quantité limite acceptée"
else
  echo "❌ ÉCHEC: Quantité limite rejetée à tort"
fi

echo ""

# Test 5: Validation avec quantité hors limite
echo "📝 Test 5: Validation hors limite (quantité trop élevée)"
echo "--------------------------------------------------------"
RESPONSE=$(curl -s -X PUT $BASE_URL/test-item \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1000
  }')

echo "$RESPONSE" | jq .
STATUS_CODE=$(echo "$RESPONSE" | jq -r '.statusCode // empty')

if [ "$STATUS_CODE" = "400" ]; then
  echo "✅ SUCCÈS: Quantité excessive rejetée"
else
  echo "❌ ÉCHEC: Quantité excessive devrait être rejetée"
fi

echo ""
echo "🎯 Tests du middleware de validation terminés"
echo "============================================="