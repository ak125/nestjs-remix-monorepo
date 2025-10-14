#!/bin/bash

# Test ultra simple de création de commande via l'endpoint de test
# Date: 6 octobre 2025

set -e

BACKEND_URL="http://localhost:3000"

echo "🧪 TEST SIMPLE DE CRÉATION DE COMMANDE"
echo "══════════════════════════════════════"
echo ""

echo "📦 Appel de l'endpoint /api/orders/test/create..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/orders/test/create" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "usr_1759774640723_njikmiz59"
  }')

echo "Réponse:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Vérifier le résultat
if echo "$RESPONSE" | grep -qi "ord_id\|success"; then
  echo "✅✅✅ SUCCÈS ! La commande a été créée avec ord_id !"
  echo ""
elif echo "$RESPONSE" | grep -qi "error\|violates\|constraint"; then
  echo "❌❌❌ ÉCHEC ! L'erreur ord_id persiste"
  echo ""
  exit 1
else
  echo "⚠️  Réponse inattendue"
  echo ""
fi

echo "══════════════════════════════════════"
echo "✅ Test terminé"
echo ""
