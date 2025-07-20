#!/bin/bash

echo "🚀 TEST RAPIDE - API PAIEMENTS CORRIGÉE"
echo "========================================"

BASE_URL="http://localhost:3000"

echo "✨ Test 1: Statistiques"
curl -s "$BASE_URL/api/payments/stats" | jq .

echo ""
echo "✨ Test 2: Création d'un paiement"
PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "ord_cst_id": "81500",
    "ord_total_ttc": "99.99",
    "payment_gateway": "STRIPE",
    "return_url": "https://example.com/success",
    "cancel_url": "https://example.com/cancel",
    "callback_url": "https://example.com/callback",
    "payment_metadata": {
      "test": "quick_validation"
    }
  }')

echo "Réponse: $PAYMENT_RESPONSE"

# Extraire l'orderId s'il y en a un
ORDER_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.orderId // empty')

if [ ! -z "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  echo ""
  echo "✨ Test 3: Récupération du statut (Order ID: $ORDER_ID)"
  curl -s "$BASE_URL/api/payments/$ORDER_ID/status" | jq .
  
  echo ""
  echo "✨ Test 4: Initiation du paiement"
  curl -s -X POST "$BASE_URL/api/payments/$ORDER_ID/initiate" \
    -H "Content-Type: application/json" \
    -d '{
      "payment_gateway": "STRIPE",
      "return_url": "https://example.com/return"
    }' | jq .
else
  echo "❌ Pas d'ORDER_ID reçu, test des étapes suivantes impossible"
fi

echo ""
echo "🏁 Tests rapides terminés"
