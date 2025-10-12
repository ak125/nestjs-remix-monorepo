#!/bin/bash

# Test simple de création de commande après le correctif ord_id
# Date: 6 octobre 2025

set -e

BACKEND_URL="http://localhost:3000"
USER_EMAIL="monia123@gmail.com"
PASSWORD="321monia"

echo "🧪 TEST DE CRÉATION DE COMMANDE (après correctif ord_id)"
echo "════════════════════════════════════════════════════════"
echo ""

# 1. Connexion
echo "🔐 Connexion de monia123@gmail.com..."
LOGIN_RESPONSE=$(curl -s -c /tmp/test_cookie.txt -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q "token\|user"; then
  echo "✅ Connexion réussie"
  echo ""
else
  echo "❌ Échec connexion"
  echo "Réponse: $LOGIN_RESPONSE"
  exit 1
fi

# 2. Créer la commande directement (TEST DU CORRECTIF ord_id)
echo "� Création de la commande (TEST DU CORRECTIF ord_id)..."
echo ""

CREATE_ORDER=$(curl -s -b /tmp/test_cookie.txt -X POST "$BACKEND_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "orderLines": [
      {
        "productId": "PROD_TEST_1",
        "productName": "Filtre à huile Bosch Test",
        "productReference": "REF-TEST-001",
        "quantity": 2,
        "unitPrice": 15.90,
        "vatRate": 20,
        "discount": 0
      },
      {
        "productId": "PROD_TEST_2",
        "productName": "Plaquettes de frein avant Test",
        "productReference": "REF-TEST-002",
        "quantity": 1,
        "unitPrice": 89.90,
        "vatRate": 20,
        "discount": 5
      }
    ],
    "billingAddress": {
      "civility": "Mme",
      "firstName": "Monia",
      "lastName": "Test",
      "address": "123 Avenue des Tests",
      "zipCode": "75001",
      "city": "Paris",
      "country": "France",
      "phone": "0123456789",
      "email": "monia123@gmail.com"
    },
    "shippingAddress": {
      "civility": "Mme",
      "firstName": "Monia",
      "lastName": "Test",
      "address": "456 Rue de la Livraison",
      "zipCode": "75002",
      "city": "Paris",
      "country": "France",
      "phone": "0123456789"
    },
    "shippingMethod": "standard",
    "paymentMethod": "card",
    "customerNote": "Test après correctif ord_id"
  }')

echo "Réponse de création:"
echo "$CREATE_ORDER" | jq '.' 2>/dev/null || echo "$CREATE_ORDER"
echo ""

# Vérifier le résultat
if echo "$CREATE_ORDER" | grep -q "ord_id"; then
  echo "✅✅✅ SUCCÈS ! La commande a été créée avec ord_id"
  ORDER_ID=$(echo "$CREATE_ORDER" | jq -r '.ord_id' 2>/dev/null || echo "N/A")
  echo "    ord_id: $ORDER_ID"
  echo ""
elif echo "$CREATE_ORDER" | grep -qi "error\|violates\|constraint"; then
  echo "❌❌❌ ÉCHEC ! Erreur lors de la création"
  echo ""
  echo "Message d'erreur:"
  echo "$CREATE_ORDER" | jq -r '.message' 2>/dev/null || echo "$CREATE_ORDER"
  echo ""
  exit 1
else
  echo "⚠️  Réponse inattendue (vérifier manuellement)"
  echo ""
fi

# Nettoyage
rm -f /tmp/test_cookie.txt

echo "════════════════════════════════════════════════════════"
echo "✅ Test terminé"
echo ""
